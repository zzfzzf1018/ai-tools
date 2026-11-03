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
        schemaVersion: 2,
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
        gradeProgress: {}  // 各年级进度
    },

    // 发音代次，用于丢弃上一张卡片迟到的回调
    speechToken: 0,

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
        
        // 打印支持信息
        console.log('🎪 趣味英语乐园已启动！');
        console.log('🔊 语音支持:', SpeechHelper.isSupported() ? '是' : '否');
    },

    // 加载用户数据
    loadUserData: function() {
        const saved = localStorage.getItem('kidsEnglishUserData');
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
        ['learnedWords', 'completedGames', 'completedUnits', 'badges'].forEach(key => {
            if (!Array.isArray(data[key])) data[key] = [];
        });
        ['stars', 'streak', 'totalWords', 'totalSpeak', 'totalGames', 'totalDays'].forEach(key => {
            if (!Number.isFinite(data[key])) data[key] = 0;
        });
        data.missions = Object.assign(
            { learn: 0, speak: 0, game: false },
            data.missions && typeof data.missions === 'object' ? data.missions : {}
        );
        if (!data.gradeProgress || typeof data.gradeProgress !== 'object') {
            data.gradeProgress = {};
        }
        data.schemaVersion = 2;
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

    // 统一切换页面：停止发音、恢复学习控制条、刷新成就数据
    showPage: function(tab) {
        SpeechHelper.stop();

        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const page = document.getElementById('page-' + tab);
        if (page) page.classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // 从「← 返回」或其它 Tab 回到学习页时，恢复卡片控制条
        document.getElementById('cardControls').style.display =
            (tab === 'learn' && this.currentGrade) ? 'flex' : 'none';

        if (tab === 'progress') this.updateStats();
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
        Object.keys(gradeData.units).forEach((unitKey, idx) => {
            const unit = gradeData.units[unitKey];
            const btn = document.createElement('button');
            btn.className = 'unit-btn';
            btn.textContent = `U${idx + 1}`;
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

        // 确定卡片类型
        let cardType = 'word';
        if (this.currentGrade === 1 && this.currentUnit === '1') cardType = 'letter';

        container.innerHTML = `
            <div class="learning-card ${cardType === 'letter' ? 'letter-card' : ''}" data-type="${cardType}"
                 id="learningCard" role="button" tabindex="0" aria-label="点击再听一遍发音">
                <span class="card-emoji">${card.emoji}</span>
                <div class="card-word">${card.word}</div>
                <div class="card-phonetic">${card.phonetic}</div>
                <div class="card-chinese">${card.cn}</div>
                <div class="card-sentence">${card.sentence}</div>
                <div class="card-sentence-cn">${card.sentenceCn}</div>
                <div style="margin-top: 20px;">
                    <span class="speak-icon" id="cardSpeakBtn" title="点击发音">🔊</span>
                </div>
                <div class="card-progress" style="margin-top: 16px; font-size: 13px; color: #6B7280;">
                    ${this.currentCardIndex + 1} / ${this.currentCards.length}
                </div>
            </div>
        `;

        // 绑定发音按钮（整张卡片点击/回车也能重听）
        const cardEl = document.getElementById('learningCard');
        const speakBtn = document.getElementById('cardSpeakBtn');
        speakBtn.addEventListener('click', () => {
            this.speakCurrentCard(true);
        });
        cardEl.addEventListener('click', (e) => {
            if (e.target.closest('.speak-icon')) return;
            this.speakCurrentCard(true);
        });
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.speakCurrentCard(true);
            }
        });

        // 自动发音（不计入朗读次数，可在语音设置里关闭）
        if (SpeechHelper.settings.autoSpeak) {
            setTimeout(() => this.speakCurrentCard(false), 300);
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
            if (e.key === 'Escape') this.closeModal();
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

        document.getElementById('settingsBtn').onclick = () => panel.classList.add('show');
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
                schemaVersion: 2,
                exportedAt: new Date().toISOString(),
                userData: this.userData
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `kids-english-progress-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
            hint.textContent = '已导出进度文件';
        };

        document.getElementById('importBtn').onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) return;
            file.text().then(text => {
                const parsed = JSON.parse(text);
                const data = parsed.userData || parsed;
                if (!data || typeof data !== 'object') throw new Error('文件格式不正确');
                if (!window.confirm('导入会覆盖当前进度，确定继续吗？')) {
                    fileInput.value = '';
                    return;
                }

                this.userData = Object.assign({}, this.userData, data);
                this.normalizeUserData();
                this.saveUserData();
                location.reload();
            }).catch(error => {
                hint.textContent = `导入失败：${error.message}`;
                fileInput.value = '';
            });
        };
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
