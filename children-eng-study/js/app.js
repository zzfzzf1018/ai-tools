/* ========================================
   趣味英语乐园 - 主应用逻辑
   页面导航、卡片展示、进度管理
   ======================================== */

const App = {
    // 当前状态
    currentGrade: null,
    currentUnit: null,
    currentCardIndex: 0,
    currentCards: [],
    
    // 用户进度数据
    userData: {
        schemaVersion: 3,
        stars: 0,
        streak: 0,
        lastVisitDate: null,
        missionDate: null,
        totalWords: 0,
        totalSpeak: 0,
        totalGames: 0,
        totalDays: 0,
        learnedWords: [],  // 已学习的单词，键为 "年级-单元-单词"
        completedGames: [],
        completedUnits: [],  // 已完成的单元，键为 "年级-单元"
        missions: {
            learn: 0,
            speak: 0,
            game: false
        },
        badges: [],
        favorites: [],   // 收藏的单词，键为 "年级-单元-单词"
        weakWords: [],   // 不熟的单词，键同上
        recordings: {}   // 录音，键为 "年级-单元-单词" -> data URL
    },

    // 发音代次，用于丢弃上一张卡片迟到的回调
    speechToken: 0,

    // 卡片自动朗读的定时器句柄，切换卡片/页面时需要清理
    autoSpeakTimer: null,

    // 初始化
    init: function() {
        this.loadUserData();
        this.checkDailyStreak();
        this.initNavigation();
        this.initGradeSelector();
        this.initDailyMissions();
        this.initModal();
        this.initSettings();
        this.initDataTransfer();
        this.startDayWatcher();
        this.initDictSearch();
        this.initWordListNav();

        // 打印支持信息
        console.log('🎪 趣味英语乐园已启动！');
        console.log('🔊 语音支持:', SpeechHelper.isSupported() ? '是' : '否');
    },

    // 加载用户数据
    loadUserData: function() {
        let saved = null;
        try {
            saved = localStorage.getItem('kidsEnglishUserData');
        } catch(e) {
            console.warn('读取本地存储失败:', e);
        }
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    this.userData = Object.assign({}, this.userData, parsed);
                }
            } catch(e) {
                console.warn('加载用户数据失败:', e);
            }
        }
        this.normalizeUserData();
    },

    // 兼容旧版本存档：补齐缺失字段，并把纯单词迁移成 "年级-单元-单词"
    normalizeUserData: function() {
        const data = this.userData;
        ['learnedWords', 'completedGames', 'completedUnits', 'badges', 'favorites', 'weakWords'].forEach(key => {
            if (!Array.isArray(data[key])) data[key] = [];
        });
        if (!data.recordings || typeof data.recordings !== 'object' || Array.isArray(data.recordings)) {
            data.recordings = {};
        }
        ['stars', 'streak', 'totalWords', 'totalSpeak', 'totalGames', 'totalDays'].forEach(key => {
            if (!Number.isFinite(data[key])) data[key] = 0;
        });
        data.missions = Object.assign(
            { learn: 0, speak: 0, game: false },
            data.missions && typeof data.missions === 'object' ? data.missions : {}
        );
        data.schemaVersion = 3;
        this.migrateLearnedWords();
    },

    // 旧存档里的 learnedWords 是纯单词，重复词会被跨年级去重；迁移为单元内唯一键
    migrateLearnedWords: function() {
        const migrated = [];
        const seen = new Set();
        this.userData.learnedWords.forEach(entry => {
            if (typeof entry !== 'string') return;
            let key = entry;
            if (!/^\d+-\d+-/.test(entry)) {
                key = this.findFirstWordKey(entry) || entry;
            }
            if (!seen.has(key)) {
                seen.add(key);
                migrated.push(key);
            }
        });
        this.userData.learnedWords = migrated;
        if (migrated.length) this.userData.totalWords = migrated.length;
    },

    findFirstWordKey: function(word) {
        for (const grade of Object.keys(LEARNING_DATA)) {
            const units = LEARNING_DATA[grade].units;
            for (const unit of Object.keys(units)) {
                if (units[unit].words.some(item => item.word === word)) {
                    return `${grade}-${unit}-${word}`;
                }
            }
        }
        return null;
    },

    // 保存用户数据
    saveUserData: function() {
        try {
            localStorage.setItem('kidsEnglishUserData', JSON.stringify(this.userData));
        } catch(e) {
            console.warn('保存用户数据失败:', e);
        }
    },

    // 更新统计显示
    updateStats: function() {
        document.getElementById('starCount').textContent = this.userData.stars;
        document.getElementById('streakCount').textContent = this.userData.streak;
        document.getElementById('totalWords').textContent = this.userData.totalWords;
        document.getElementById('totalSpeak').textContent = this.userData.totalSpeak;
        document.getElementById('totalGames').textContent = this.userData.totalGames;
        document.getElementById('totalDays').textContent = this.userData.totalDays;
        this.updateBadges();
        this.updateGradeProgress();
    },

    // 年级进度（已完成单元数 / 总单元数）
    updateGradeProgress: function() {
        const list = document.getElementById('gradeProgressList');
        if (!list) return;

        list.innerHTML = Object.keys(LEARNING_DATA).map(grade => {
            const gradeData = LEARNING_DATA[grade];
            const units = Object.keys(gradeData.units);
            const done = units.filter(unit =>
                this.userData.completedUnits.includes(`${grade}-${unit}`)
            ).length;
            const percent = Math.round((done / units.length) * 100);
            return `
                <div class="grade-progress-item">
                    <span class="gp-name">${gradeData.emoji} ${gradeData.name}</span>
                    <div class="gp-track"><div class="gp-fill" style="width:${percent}%"></div></div>
                    <span class="gp-count">${done}/${units.length}</span>
                </div>
            `;
        }).join('');
    },

    // 检查连续学习
    checkDailyStreak: function() {
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (this.userData.lastVisitDate === today) {
            // 今天已经访问过，学习天数不重复累加
            if (this.userData.streak < 1) this.userData.streak = 1;
        } else {
            if (this.userData.lastVisitDate === yesterdayStr) {
                // 昨天访问过，增加连续天数
                this.userData.streak++;
            } else {
                // 中断了，重置
                this.userData.streak = 1;
            }
            this.userData.totalDays++;
            this.userData.lastVisitDate = today;
            this.resetDailyMissions(today);
        }

        this.saveUserData();
        this.updateStats();
    },

    // 应用长时间打开时，跨天后自动重置连续记录与每日任务
    startDayWatcher: function() {
        const check = () => {
            const today = new Date().toDateString();
            if (this.userData.lastVisitDate !== today) {
                this.checkDailyStreak();
            } else if (this.userData.missionDate !== today) {
                this.resetDailyMissions(today);
                this.saveUserData();
                this.updateMissionsUI();
            }
        };
        setInterval(check, 60 * 1000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) check();
        });
    },

    // 每日任务跨天清零（只改数据，UI 由 updateMissionsUI 刷新）
    resetDailyMissions: function(today) {
        this.userData.missionDate = today || new Date().toDateString();
        this.userData.missions = { learn: 0, speak: 0, game: false };
    },

    // 标签页导航
    initNavigation: function() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showPage(btn.dataset.tab));
        });
    },

    // 统一切换页面：停止发音、作废旧语音回调、恢复学习控制条、刷新成就数据
    showPage: function(tab) {
        SpeechHelper.stop();
        this.stopRecordingQuiet();
        // 代次递增：让切换前未完成的单词回调和 800ms 句子朗读全部失效
        this.speechToken++;
        if (this.autoSpeakTimer) {
            clearTimeout(this.autoSpeakTimer);
            this.autoSpeakTimer = null;
        }

        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const page = document.getElementById('page-' + tab);
        if (page) page.classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // 从「← 返回」或其它 Tab 回到学习页时，恢复卡片控制条
        document.getElementById('cardControls').style.display =
            (tab === 'learn' && this.currentGrade) ? 'flex' : 'none';

        if (tab === 'progress') {
            this.updateStats();
            this.updateWordList();
        }
    },

    // 年级选择
    initGradeSelector: function() {
        const gradeCards = document.querySelectorAll('.grade-card');
        gradeCards.forEach(card => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${card.dataset.grade} 年级`);
            card.addEventListener('click', () => {
                const grade = parseInt(card.dataset.grade);
                this.enterGrade(grade);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
            
            // 添加悬停动画
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px) scale(1.03) rotate(-1deg)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    },

    // 进入年级
    enterGrade: function(grade) {
        this.currentGrade = grade;
        const gradeData = LEARNING_DATA[grade];
        
        // 切换到学习页面
        this.showPage('learn');

        // 更新标题
        document.getElementById('learnTitle').textContent = 
            `${gradeData.emoji} ${gradeData.name} - ${gradeData.theme}`;
        
        // 生成单元选择器
        const unitSelector = document.getElementById('unitSelector');
        unitSelector.innerHTML = '';
        Object.keys(gradeData.units).forEach((unitKey) => {
            const unit = gradeData.units[unitKey];
            const btn = document.createElement('button');
            btn.className = 'unit-btn';
            btn.textContent = unitKey === '0' ? '🔤' : `U${unitKey}`;
            btn.title = unit.title;
            btn.addEventListener('click', () => {
                this.selectUnit(unitKey);
                document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            unitSelector.appendChild(btn);
        });

        // 进入第一个单元
        const firstUnitKey = Object.keys(gradeData.units)[0];
        this.selectUnit(firstUnitKey);
        document.querySelector('.unit-btn').classList.add('active');

        // 显示控制按钮
        document.getElementById('cardControls').style.display = 'flex';

        // 绑定按钮事件
        this.bindCardControls();
    },

    // 选择单元
    selectUnit: function(unitKey) {
        this.currentUnit = unitKey;
        const gradeData = LEARNING_DATA[this.currentGrade];
        const unit = gradeData.units[unitKey];
        this.currentCards = unit.words;
        this.currentCardIndex = 0;
        this.renderCard();
    },

    // 渲染学习卡片
    renderCard: function() {
        const container = document.getElementById('cardContainer');
        const card = this.currentCards[this.currentCardIndex];
        
        if (!card) {
            container.innerHTML = '<p>暂无学习内容</p>';
            return;
        }

        // 重绘 DOM 前，如果录音还在进行，先静默停掉避免 stream 泄漏
        this.stopRecordingQuiet();

        // 渲染新卡片前清掉上一张卡片未触发的自动朗读
        if (this.autoSpeakTimer) {
            clearTimeout(this.autoSpeakTimer);
            this.autoSpeakTimer = null;
        }

        const unitKey = `${this.currentGrade}-${this.currentUnit}`;
        const isLetterUnit = LEARNING_DATA[this.currentGrade].units[this.currentUnit].isLetterUnit;
        const wordKey = `${this.currentGrade}-${this.currentUnit}-${isLetterUnit ? card.letterLower : card.word}`;
        const isFav = this.userData.favorites.includes(wordKey);
        const isWeak = this.userData.weakWords.includes(wordKey);
        const hasRecording = !!this.userData.recordings[wordKey];

        // 字母卡片特殊布局
        let letterExtra = '';
        if (isLetterUnit) {
            letterExtra = `
                <div class="letter-display">
                    <span class="letter-upper">${card.letterUpper}</span>
                    <span class="letter-lower">${card.letterLower}</span>
                </div>
                <div class="letter-examples">
                    ${card.examples.map(ex => `<span class="letter-example">${ex}</span>`).join('')}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="learning-card ${isLetterUnit ? 'letter-card' : ''}" data-type="${isLetterUnit ? 'letter' : 'word'}"
                 id="learningCard" role="button" tabindex="0"
                 aria-label="${card.word}，${card.cn}。点击再听一遍发音">
                <span class="card-emoji">${card.emoji}</span>
                ${letterExtra}
                <div class="card-word">${card.word}</div>
                <div class="card-phonetic">${card.phonetic}</div>
                <div class="card-chinese">${card.cn}</div>
                <div class="card-sentence">${card.sentence}</div>
                <div class="card-sentence-cn">${card.sentenceCn}</div>
                <div style="margin-top: 20px;">
                    <span class="speak-icon" id="cardSpeakBtn" title="点击发音">🔊</span>
                </div>
                <!-- 收藏/不熟/录音/跟读按钮 -->
                <div class="card-action-bar">
                    <button class="card-action-btn ${isFav ? 'active' : ''}" id="favBtn" title="收藏这个单词" aria-label="收藏">
                        ${isFav ? '⭐' : '☆'}
                    </button>
                    <button class="card-action-btn ${isWeak ? 'active' : ''}" id="weakBtn" title="标记为不熟" aria-label="不熟">
                        ${isWeak ? '❌' : '✓'}
                    </button>
                    <button class="card-action-btn" id="recordBtn" title="录制你的朗读" aria-label="录音">
                        ${hasRecording ? '🔁' : '🎙️'}
                    </button>
                    <button class="card-action-btn" id="playRecBtn" title="播放我的录音" aria-label="播放录音"
                            ${hasRecording ? '' : 'disabled'}>▶️</button>
                    <button class="card-action-btn" id="followBtn" title="跟我读（需要麦克风）" aria-label="跟读">🗣️</button>
                </div>
                <div class="card-follow-hint" id="followHint" hidden></div>
                <div class="card-progress" style="margin-top: 16px; font-size: 13px; color: #6B7280;">
                    ${this.currentCardIndex + 1} / ${this.currentCards.length}
                </div>
            </div>
        `;

        // 绑定发音按钮（整张卡片点击/回车也能重听）
        const cardEl = document.getElementById('learningCard');
        const speakBtn = document.getElementById('cardSpeakBtn');
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speakCurrentCard(true);
        });
        cardEl.addEventListener('click', (e) => {
            // 如果点的是 action bar 里的按钮，跳过
            if (e.target.closest('.card-action-bar')) return;
            if (e.target.closest('.speak-icon')) return;
            this.speakCurrentCard(true);
        });
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.speakCurrentCard(true);
            }
        });

        // 收藏 / 不熟
        document.getElementById('favBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleWordList('favorites', wordKey);
        });
        document.getElementById('weakBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleWordList('weakWords', wordKey);
        });

        // 录音
        document.getElementById('recordBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRecording(wordKey, card.word);
        });
        document.getElementById('playRecBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.playRecording(wordKey);
        });

        // 跟读
        document.getElementById('followBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startFollowRead(card);
        });

        // 自动发音（不计入朗读次数，可在语音设置里关闭）
        if (SpeechHelper.settings.autoSpeak) {
            const token = this.speechToken;
            this.autoSpeakTimer = setTimeout(() => {
                this.autoSpeakTimer = null;
                // 期间切换过页面或换过卡片则放弃播放
                if (token !== this.speechToken) return;
                this.speakCurrentCard(false);
            }, 300);
        }

        // 更新进度
        this.updateCardControls();
        
        // 更新学习进度
        this.trackLearnedWord(card.word);
    },

    // 朗读当前卡片；isManual 为 true 时才算用户主动朗读
    speakCurrentCard: function(isManual) {
        const card = this.currentCards[this.currentCardIndex];
        if (!card) return;

        const speakIcon = document.getElementById('cardSpeakBtn');
        const speakBtn = document.getElementById('speakBtn');

        // 每次发音递增代次：旧卡片的 onend / 延时句子会被丢弃
        const token = ++this.speechToken;
        const isStillCurrent = () =>
            this.speechToken === token && this.currentCards[this.currentCardIndex] === card;

        SpeechHelper.speakWord(card.word,
            () => {
                if (!isStillCurrent()) return;
                if (speakIcon) speakIcon.classList.add('speaking');
                if (speakBtn) speakBtn.classList.add('speaking');
            },
            () => {
                if (!isStillCurrent()) return;
                if (speakIcon) speakIcon.classList.remove('speaking');
                if (speakBtn) speakBtn.classList.remove('speaking');

                // 朗读句子
                setTimeout(() => {
                    if (!isStillCurrent()) return;
                    SpeechHelper.speakSentence(card.sentence);
                }, 800);
            }
        );

        // 只有用户主动点发音才计入朗读统计，自动播放不算
        if (isManual) {
            this.userData.totalSpeak++;
            this.userData.missions.speak++;
            this.saveUserData();
            this.updateMissionsUI();
            this.updateStats();
            this.checkBadges();
        }
    },

    // 跟踪学习的单词（以单元内唯一键计数，避免跨年级重复词被吞掉）
    trackLearnedWord: function(word) {
        const key = `${this.currentGrade}-${this.currentUnit}-${word}`;
        if (!this.userData.learnedWords.includes(key)) {
            this.userData.learnedWords.push(key);
            this.userData.totalWords = this.userData.learnedWords.length;
            this.userData.missions.learn++;
            this.userData.stars += 1;  // 每学一个单词得一颗星
            this.saveUserData();
            this.updateMissionsUI();
            this.updateStats();
            this.checkBadges();
        }
    },

    // 绑定卡片控制
    bindCardControls: function() {
        const prevBtn = document.getElementById('prevCard');
        const nextBtn = document.getElementById('nextCard');
        const speakBtn = document.getElementById('speakBtn');
        const backBtn = document.getElementById('learnBack');

        prevBtn.onclick = () => {
            if (this.currentCardIndex > 0) {
                this.currentCardIndex--;
                this.renderCard();
            }
        };

        nextBtn.onclick = () => {
            if (this.currentCardIndex < this.currentCards.length - 1) {
                this.currentCardIndex++;
                this.renderCard();
            } else {
                this.completeUnit();
            }
        };

        speakBtn.onclick = () => {
            this.speakCurrentCard(true);
        };

        backBtn.onclick = () => {
            this.showPage('home');
        };
    },

    // 更新卡片控制按钮状态
    updateCardControls: function() {
        const prevBtn = document.getElementById('prevCard');
        const nextBtn = document.getElementById('nextCard');
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) {
            const isLast = this.currentCardIndex === this.currentCards.length - 1;
            // 最后一张仍可点击，用于触发单元完成奖励
            nextBtn.disabled = this.currentCards.length === 0;
            nextBtn.innerHTML = isLast
                ? '完成 ✓'
                : '下一张 <span class="btn-icon">▶</span>';
        }
    },

    // 完成当前单元：首次完成奖励 5 颗星，重复学习只提示不重复发星
    completeUnit: function() {
        const key = `${this.currentGrade}-${this.currentUnit}`;
        const firstTime = !this.userData.completedUnits.includes(key);

        if (firstTime) {
            this.userData.completedUnits.push(key);
            this.userData.stars += 5;
            this.saveUserData();
            this.updateStats();
        }

        this.createConfetti();
        this.showModal(
            '🎉',
            '太棒了！',
            firstTime
                ? '你完成了这个单元的学习！获得5颗星星！'
                : '这个单元你又复习了一遍，真棒！'
        );
        this.checkBadges();
    },

    // 每日任务
    initDailyMissions: function() {
        const today = new Date().toDateString();
        if (this.userData.missionDate !== today) {
            this.resetDailyMissions(today);
            this.saveUserData();
        }
        this.updateMissionsUI();
    },

    updateMissionsUI: function() {
        document.getElementById('learnProgress').textContent = 
            Math.min(this.userData.missions.learn, 5);
        document.getElementById('speakProgress').textContent = 
            Math.min(this.userData.missions.speak, 3);
        
        const gameProgress = document.getElementById('gameProgress');
        gameProgress.textContent = this.userData.missions.game ? '已完成 ✓' : '未完成';

        // 更新任务完成状态
        document.querySelectorAll('.mission-item').forEach(item => {
            const mission = item.dataset.mission;
            let completed = false;
            if (mission === 'learn') completed = this.userData.missions.learn >= 5;
            if (mission === 'speak') completed = this.userData.missions.speak >= 3;
            if (mission === 'game') completed = this.userData.missions.game;
            
            item.classList.toggle('completed', completed);
        });
    },

    // 成就徽章
    checkBadges: function() {
        const data = this.userData;
        const grades = Object.keys(LEARNING_DATA);
        const isGradeDone = grade => Object.keys(LEARNING_DATA[grade].units)
            .every(unit => data.completedUnits.includes(`${grade}-${unit}`));

        const checks = {
            first_word: data.totalWords >= 1,
            word_10: data.totalWords >= 10,
            word_50: data.totalWords >= 50,
            word_100: data.totalWords >= 100,
            speak_10: data.totalSpeak >= 10,
            speak_50: data.totalSpeak >= 50,
            game_win: data.totalGames >= 1,
            game_10: data.totalGames >= 10,
            day_3: data.streak >= 3,
            day_7: data.streak >= 7,
            grade_complete: grades.some(isGradeDone),
            grade_5: grades.every(isGradeDone),
        };

        const newBadges = [];
        for (const [id, unlocked] of Object.entries(checks)) {
            if (unlocked && !data.badges.includes(id)) {
                data.badges.push(id);
                const badge = BADGES_DATA.find(b => b.id === id);
                if (badge) newBadges.push(badge);
            }
        }

        if (newBadges.length) {
            this.saveUserData();
            this.updateBadges();
            const names = newBadges.map(badge => `「${badge.name}」`).join('、');
            this.showModal('🎖️', '获得新徽章！', `你解锁了 ${names}`);
        }
    },

    updateBadges: function() {
        const grid = document.getElementById('badgesGrid');
        if (!grid) return;
        
        grid.innerHTML = BADGES_DATA.map(badge => {
            const unlocked = this.userData.badges.includes(badge.id);
            return `
                <div class="badge ${unlocked ? 'unlocked' : ''}" title="${badge.desc}">
                    <div class="badge-icon">${unlocked ? badge.icon : '🔒'}</div>
                    <div class="badge-name">${badge.name}</div>
                </div>
            `;
        }).join('');
    },

    // 弹窗（排队显示，避免后一个弹窗覆盖前一个的回调）
    modalQueue: [],
    modalActive: false,
    modalCallback: null,

    showModal: function(emoji, title, message, onClose) {
        this.modalQueue.push({ emoji, title, message, onClose: onClose || null });
        if (!this.modalActive) this.showNextModal();
    },

    showNextModal: function() {
        const next = this.modalQueue.shift();
        if (!next) return;

        this.modalActive = true;
        this.modalCallback = next.onClose;
        document.getElementById('modalEmoji').textContent = next.emoji;
        document.getElementById('modalTitle').textContent = next.title;
        document.getElementById('modalMessage').textContent = next.message;
        document.getElementById('modalBtn').onclick = () => this.closeModal();
        document.getElementById('modalOverlay').classList.add('show');
    },

    // 按钮、遮罩、Esc 统一走这里，保证 onClose 一定执行
    closeModal: function() {
        if (!this.modalActive) return;

        this.modalActive = false;
        document.getElementById('modalOverlay').classList.remove('show');
        const callback = this.modalCallback;
        this.modalCallback = null;
        if (callback) callback();
        this.showNextModal();
    },

    initModal: function() {
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') this.closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            // Esc 优先关设置面板，其次关弹窗
            const panel = document.getElementById('settingsPanel');
            if (panel && panel.classList.contains('show')) {
                panel.classList.remove('show');
                return;
            }
            this.closeModal();
        });
    },

    // 语音设置面板
    initSettings: function() {
        const panel = document.getElementById('settingsPanel');
        const toggle = document.getElementById('autoSpeakToggle');
        const rate = document.getElementById('speechRate');
        const rateValue = document.getElementById('speechRateValue');
        const voiceSelect = document.getElementById('voiceSelect');

        toggle.checked = SpeechHelper.settings.autoSpeak;
        rate.value = SpeechHelper.settings.rate;
        rateValue.textContent = SpeechHelper.settings.rate;

        const fillVoices = () => {
            const voices = SpeechHelper.getEnglishVoices();
            voiceSelect.innerHTML = '<option value="">自动选择</option>';
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                voiceSelect.appendChild(option);
            });
            voiceSelect.value = SpeechHelper.settings.voiceName || '';
        };
        fillVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = fillVoices;
        }

        toggle.onchange = () => {
            SpeechHelper.settings.autoSpeak = toggle.checked;
            SpeechHelper.saveSettings();
        };
        rate.oninput = () => {
            SpeechHelper.settings.rate = parseFloat(rate.value);
            rateValue.textContent = rate.value;
            SpeechHelper.saveSettings();
        };
        voiceSelect.onchange = () => {
            SpeechHelper.settings.voiceName = voiceSelect.value;
            SpeechHelper.saveSettings();
        };

        document.getElementById('settingsBtn').onclick = () => {
            panel.classList.toggle('show');  // ⚙️ 可开可关
        };
        document.getElementById('settingsClose').onclick = () => panel.classList.remove('show');
        document.getElementById('settingsTest').onclick = () => {
            SpeechHelper.speak('Hello! Let us learn English together.');
        };
        panel.addEventListener('click', (e) => {
            if (e.target.id === 'settingsPanel') panel.classList.remove('show');
        });
    },

    // 进度导出 / 导入
    initDataTransfer: function() {
        const fileInput = document.getElementById('importFile');
        const hint = document.getElementById('dataHint');

        document.getElementById('exportBtn').onclick = () => {
            const payload = {
                schemaVersion: this.userData.schemaVersion,
                exportedAt: new Date().toISOString(),
                userData: this.userData,
                speechSettings: SpeechHelper.settings
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `kids-english-progress-${new Date().toISOString().slice(0, 10)}.json`;
            // 部分浏览器要求链接挂在 DOM 上，且不能立刻回收 URL
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            hint.textContent = '已导出进度文件（含语音设置）';
        };

        document.getElementById('importBtn').onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) return;
            file.text().then(text => {
                const parsed = JSON.parse(text);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error('文件格式不正确');
                }
                if (parsed.schemaVersion && parsed.schemaVersion > this.userData.schemaVersion) {
                    throw new Error('文件来自更新的版本，请升级应用后再导入');
                }
                const data = parsed.userData || parsed;
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('文件中没有有效的进度数据');
                }
                if (!window.confirm('导入将替换当前学习进度和语音设置，确定继续吗？')) {
                    fileInput.value = '';
                    return;
                }

                this.userData = Object.assign({}, this.userData, data);
                this.normalizeUserData();
                this.saveUserData();

                // 语音设置一并恢复（如果备份里包含）
                if (parsed.speechSettings && typeof parsed.speechSettings === 'object') {
                    Object.assign(SpeechHelper.settings, parsed.speechSettings);
                    SpeechHelper.saveSettings();
                }
                location.reload();
            }).catch(error => {
                hint.textContent = `导入失败：${error.message}`;
                fileInput.value = '';
            });
        };
    },

    // ============== 收藏 / 不熟 ==============
    toggleWordList: function(listName, wordKey) {
        const arr = this.userData[listName];
        const idx = arr.indexOf(wordKey);
        if (idx >= 0) {
            arr.splice(idx, 1);
        } else {
            arr.push(wordKey);
        }
        this.saveUserData();
        // 重渲染当前卡片上的按钮状态
        this.renderCard();
        // 如果在成就页也刷新列表
        if (document.getElementById('page-progress').classList.contains('active')) {
            this.updateWordList();
        }
    },

    // ============== 录音 / 回放 ==============
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],

    // 静默停止录音（页面切换/重绘时调用，不触发 onstop 里的保存逻辑）
    stopRecordingQuiet: function() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            // 清掉 onstop，避免重绘 DOM 后回调找按钮失败
            this.mediaRecorder.onstop = null;
            this.mediaRecorder.stop();
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }
    },

    toggleRecording: function(wordKey, word) {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            // 停止录音
            this.mediaRecorder.stop();
            return;
        }

        // 先检查浏览器支持
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showModal('⚠️', '录音不可用', '你的浏览器不支持录音功能，可以用 Chrome 或 Edge 桌面版试试！');
            return;
        }
        if (!window.MediaRecorder) {
            this.showModal('⚠️', '录音不可用', '浏览器不支持 MediaRecorder API');
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                this.mediaStream = stream;
                this.recordedChunks = [];
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.recordedChunks.push(e.data);
                };
                this.mediaRecorder.onstop = () => {
                    // 清理 stream
                    if (this.mediaStream) {
                        this.mediaStream.getTracks().forEach(t => t.stop());
                        this.mediaStream = null;
                    }
                    if (this.recordedChunks.length === 0) return;
                    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onload = () => {
                        this.userData.recordings[wordKey] = reader.result;
                        this.saveUserData();
                        // 重渲染以更新按钮状态
                        this.renderCard();
                    };
                    reader.readAsDataURL(blob);
                };
                this.mediaRecorder.start();
                // 最多录 10 秒自动停
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                }, 10000);
                // 更新按钮
                const btn = document.getElementById('recordBtn');
                if (btn) {
                    btn.textContent = '⏹️';
                    btn.title = '停止录音（最长10秒）';
                }
            })
            .catch(() => {
                this.showModal('⚠️', '无法录音', '请允许浏览器使用麦克风权限');
            });
    },

    playRecording: function(wordKey) {
        const dataUrl = this.userData.recordings[wordKey];
        if (!dataUrl) return;
        const audio = new Audio(dataUrl);
        audio.play();
    },

    // ============== 跟读（SpeechRecognition） ==============
    // 仅 Chrome / Edge 支持；失败时给用户友好提示
    startFollowRead: function(card) {
        const hint = document.getElementById('followHint');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            hint.textContent = '😢 你的浏览器不支持语音识别，试试 Chrome 桌面版！';
            hint.hidden = false;
            setTimeout(() => { hint.hidden = true; }, 4000);
            return;
        }

        hint.textContent = '🎤 请跟我读：' + card.word;
        hint.hidden = false;

        // 先播放标准音
        SpeechHelper.speakWord(card.word);

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        let heard = '';
        recognition.onresult = (e) => {
            heard = e.results[0][0].transcript.trim().toLowerCase();
        };
        recognition.onerror = () => {
            hint.textContent = '😢 识别出错了，再试一次吧';
            hint.hidden = false;
        };
        recognition.onend = () => {
            if (!heard) {
                hint.textContent = '😢 没有听到你说话，再试试';
            } else if (heard.includes(card.word.toLowerCase()) || heard.includes(card.word.toLowerCase().replace(/[^a-z]/g, ''))) {
                hint.textContent = `🎉 太棒了！你说的是 "${heard}"，跟 "${card.word}" 一致！`;
                // 跟读也算一次朗读
                this.userData.totalSpeak++;
                this.userData.missions.speak++;
                this.saveUserData();
                this.updateMissionsUI();
                this.updateStats();
            } else {
                hint.textContent = `💪 加油！你说的是 "${heard}"，再听听标准音试试`;
            }
            hint.hidden = false;
        };

        // 等标准音播完 1 秒后开始录音
        setTimeout(() => {
            try { recognition.start(); } catch(e) {}
        }, 1500);
    },

    // ============== 词典查询 ==============
    initDictSearch: function() {
        const input = document.getElementById('dictInput');
        const result = document.getElementById('dictResult');
        if (!input) return;

        let debounceTimer = null;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const q = input.value.trim().toLowerCase();
                if (!q) { result.hidden = true; result.innerHTML = ''; return; }
                this.searchDict(q);
            }, 300);
        });
        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dict-search')) {
                result.hidden = true;
            }
        });
    },

    searchDict: function(query) {
        const result = document.getElementById('dictResult');
        const matches = [];
        for (const grade of Object.keys(LEARNING_DATA)) {
            const units = LEARNING_DATA[grade].units;
            for (const unitKey of Object.keys(units)) {
                for (const w of units[unitKey].words) {
                    const haystack = w.word.toLowerCase() + ' ' + (w.cn || '');
                    if (haystack.includes(query)) {
                        matches.push({ ...w, grade, unitKey });
                        if (matches.length >= 8) break;
                    }
                }
                if (matches.length >= 8) break;
            }
            if (matches.length >= 8) break;
        }

        if (matches.length === 0) {
            result.innerHTML = '<div class="dict-empty">未找到相关单词</div>';
        } else {
            result.innerHTML = matches.map(m => `
                <div class="dict-item" data-grade="${m.grade}" data-unit="${m.unitKey}" data-word="${m.word}">
                    <span class="dict-emoji">${m.emoji}</span>
                    <span class="dict-word">${m.word}</span>
                    <span class="dict-cn">${m.cn}</span>
                    <span class="dict-loc">G${m.grade}-U${m.unitKey}</span>
                </div>
            `).join('');
            result.querySelectorAll('.dict-item').forEach(item => {
                item.addEventListener('click', () => {
                    const grade = parseInt(item.dataset.grade);
                    const unitKey = item.dataset.unit;
                    const word = item.dataset.word;
                    this.enterGrade(grade);
                    this.selectUnit(unitKey);
                    // 翻到目标卡片
                    const idx = this.currentCards.findIndex(c => c.word === word);
                    if (idx >= 0) {
                        this.currentCardIndex = idx;
                        this.renderCard();
                    }
                    document.getElementById('dictInput').value = '';
                    result.hidden = true;
                });
            });
        }
        result.hidden = false;
    },

    // ============== 成就页 收藏/不熟 Tab ==============
    initWordListNav: function() {
        const nav = document.getElementById('wordListNav');
        if (!nav) return;
        nav.querySelectorAll('.mini-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                nav.querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateWordList();
            });
        });
    },

    updateWordList: function() {
        const nav = document.getElementById('wordListNav');
        const list = document.getElementById('wordList');
        if (!nav || !list) return;

        const activeTab = nav.querySelector('.mini-tab.active');
        const listName = activeTab ? activeTab.dataset.list : 'favorites';
        const keys = this.userData[listName] || [];

        // 从 key 解析并取数据
        const items = [];
        for (const key of keys) {
            const parts = key.split('-');
            if (parts.length < 3) continue;
            const grade = parts[0];
            const unitKey = parts[1];
            const word = parts.slice(2).join('-');
            const gradeData = LEARNING_DATA[grade];
            if (!gradeData) continue;
            const unit = gradeData.units[unitKey];
            if (!unit) continue;
            const card = unit.words.find(w =>
                (w.letterLower || '').toLowerCase() === word.toLowerCase() ||
                w.word.toLowerCase() === word.toLowerCase()
            );
            if (card) items.push({ card, grade, unitKey, key });
        }

        // 更新计数
        const favBtn = nav.querySelector('[data-list="favorites"]');
        const weakBtn = nav.querySelector('[data-list="weak"]');
        if (favBtn) favBtn.querySelector('span').textContent = this.userData.favorites.length;
        if (weakBtn) weakBtn.querySelector('span').textContent = this.userData.weakWords.length;

        if (items.length === 0) {
            const emptyMsg = listName === 'favorites'
                ? '还没有收藏单词哦 ⭐ 快去学习页点一下卡片上的收藏按钮吧！'
                : '没有不熟的单词，太棒了！🎉';
            list.innerHTML = `<div class="word-list-empty">${emptyMsg}</div>`;
            return;
        }

        list.innerHTML = items.map(it => `
            <div class="word-list-item" data-key="${it.key}">
                <span class="wli-emoji">${it.card.emoji}</span>
                <span class="wli-word">${it.card.word}</span>
                <span class="wli-cn">${it.card.cn}</span>
                <span class="wli-loc">G${it.grade}-U${it.unitKey}</span>
                <button class="wli-remove" data-remove="${it.key}" title="移除">✕</button>
            </div>
        `).join('');

        // 绑定移除
        list.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const key = btn.dataset.remove;
                this.toggleWordList(listName, key);
            });
        });
        // 点击定位跳转
        list.querySelectorAll('.word-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.wli-remove')) return;
                const key = el.dataset.key;
                const parts = key.split('-');
                const grade = parseInt(parts[0]);
                const unitKey = parts[1];
                const word = parts.slice(2).join('-');
                this.showPage('learn');
                this.enterGrade(grade);
                this.selectUnit(unitKey);
                const idx = this.currentCards.findIndex(c => {
                    const lw = c.letterLower || '';
                    return lw.toLowerCase() === word.toLowerCase() || c.word.toLowerCase() === word.toLowerCase();
                });
                if (idx >= 0) { this.currentCardIndex = idx; this.renderCard(); }
            });
        });
    },

    // 彩色纸屑庆祝效果
    createConfetti: function() {
        const container = document.getElementById('celebration');
        const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#FF8C42', '#A78BFA', '#60A5FA', '#34D399'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(confetti);
            
            setTimeout(() => confetti.remove(), 4000);
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
