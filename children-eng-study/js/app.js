/* ========================================
   趣味英语乐园 - 主应用逻辑
   导航 / 关卡地图 / 单词卡 / 句子小剧场 / 进度 / 弹窗 / 成就
   v1.3.0：全年级词库分单元分关学习 · 全英文图文沉浸 · 连续闯关
   ======================================== */

const App = {
    // 当前状态
        currentGrade: null,
        currentUnit: null,
        currentCardIndex: 0,
        currentCards: [],

        // 关卡状态

    // 关卡状态（levelPlan 为当前年级的完整关卡序列）
    levelPlan: [],
    currentLevelIndex: -1,
    currentLevel: null,
    inLevel: false,
    sentenceIndex: 0,
    playMode: 'map',          // 'map' 或趣味乐园的六个玩法

    // 用户进度数据
    userData: {
        schemaVersion: 6,
        stars: 0,
        streak: 0,
        lastVisitDate: null,
        missionDate: null,
        totalWords: 0,
        totalSpeak: 0,
        totalGames: 0,
        totalDays: 0,
        learnedWords: [],      // 已学习的单词，键为 "年级-单元-单词"
        completedGames: [],
        completedUnits: [],    // 已完成的单元，键为 "年级-单元"
        completedLevels: [],   // 已完成的关卡，键为 "年级-单元-L0" / "年级-单元-S"
        completedSentences: [], // 已拼出的句子，键为 "年级-单元-S0"
        missions: {
            learn: 0,
            speak: 0,
            game: false
        },
        badges: [],
        favorites: [],
        weakWords: [],
        recordings: {},
        lastGrade: null,        // 上次学习的年级，直接点「学习」Tab 时自动回到该年级地图
        petXp: 0,               // 单词宠物经验值
        reviewSchedule: {},     // 错词间隔复习排期: key -> { step, due }
        dubs: [],               // 我的配音集
        playDone: [],           // 趣味乐园玩法完成记录，避免重复发星
        stickers: [],           // 已解锁贴纸
        listenDate: null,       // 最近一次完成「每日盲听」的日期
        weakPracticed: 0        // 弱项专练完成次数
    },

    // 发音代次，用于丢弃上一张卡片迟到的回调
    speechToken: 0,

    // 跟读代次：切离学习页后作废旧识别，避免麦克风被延迟启动
    followReadToken: 0,

    // 卡片自动朗读的定时器句柄，切换卡片/页面时需要清理
    autoSpeakTimer: null,

    // 句子小剧场的自动朗读定时器，快速切句时避免多句叠加朗读
    sentenceSpeakTimer: null,

    clearSentenceSpeakTimer: function() {
        if (this.sentenceSpeakTimer) {
            clearTimeout(this.sentenceSpeakTimer);
            this.sentenceSpeakTimer = null;
        }
    },

    // 初始化
    init: function() {
        if (this.initialized) return;
        this.initialized = true;
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
        this.bindCardControls();
        Play.init();
        // 旧存档升级：静默补齐已达成但尚未授予的贴纸，避免启动时弹一堆
        if (typeof Stickers !== 'undefined') Stickers.refresh({ silent: true });

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
        ['learnedWords', 'completedGames', 'completedUnits', 'completedLevels',
         'completedSentences', 'badges', 'favorites', 'weakWords', 'stickers'].forEach(key => {
            if (!Array.isArray(data[key])) data[key] = [];
        });
        if (!data.recordings || typeof data.recordings !== 'object' || Array.isArray(data.recordings)) {
            data.recordings = {};
        }
        if (!data.reviewSchedule || typeof data.reviewSchedule !== 'object' || Array.isArray(data.reviewSchedule)) {
            data.reviewSchedule = {};
        }
        if (!Array.isArray(data.dubs)) data.dubs = [];
        if (!Array.isArray(data.playDone)) data.playDone = [];
        ['stars', 'streak', 'totalWords', 'totalSpeak', 'totalGames', 'totalDays', 'petXp', 'weakPracticed'].forEach(key => {
            if (!Number.isFinite(data[key])) data[key] = 0;
        });
        data.missions = Object.assign(
            { learn: 0, speak: 0, game: false },
            data.missions && typeof data.missions === 'object' ? data.missions : {}
        );
        if (!LEARNING_DATA[data.lastGrade]) data.lastGrade = null;
        if (data.listenDate && typeof data.listenDate !== 'string') data.listenDate = null;
        data.schemaVersion = 6;
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

    // 保存用户数据；返回是否成功，配音等大文件场景需要据此回滚
    saveUserData: function() {
        try {
            localStorage.setItem('kidsEnglishUserData', JSON.stringify(this.userData));
            return true;
        } catch(e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                this.showModal('⚠️', '存储空间不足', '录音或进度文件太多啦！请删除一些旧录音后再试~');
            } else {
                console.warn('保存用户数据失败:', e);
            }
            return false;
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
            if (this.userData.streak < 1) this.userData.streak = 1;
        } else {
            if (this.userData.lastVisitDate === yesterdayStr) {
                this.userData.streak++;
            } else {
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

    // 统一切换页面：停止发音、作废旧语音回调、恢复/隐藏学习控制条
    showPage: function(tab) {
        SpeechHelper.stop();
        if (typeof Combo !== 'undefined') Combo.reset();
        if (tab !== 'learn') {
            this.followReadToken = (this.followReadToken || 0) + 1;
            if (typeof Play !== 'undefined') Play.stopAll();
        }
        this.stopRecordingQuiet();
        this.speechToken++;
        if (this.autoSpeakTimer) {
            clearTimeout(this.autoSpeakTimer);
            this.autoSpeakTimer = null;
        }
        this.clearSentenceSpeakTimer();

        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const page = document.getElementById('page-' + tab);
        if (page) page.classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        if (tab === 'learn') {
            // 趣味乐园玩法不依赖年级，切回来时直接重绘当前玩法
            if (this.playMode && this.playMode !== 'map') {
                this.clearLearnEmptyState();
                Play.showMode(this.playMode);
                return;
            }
            // 未选年级时：优先回到上次学习的年级，否则显示引导空状态
            if (!this.currentGrade) {
                const lastGrade = this.userData.lastGrade;
                if (lastGrade && LEARNING_DATA[lastGrade]) {
                    this.enterGrade(lastGrade);
                    return;
                }
                this.renderLearnEmptyState();
                return;
            }
            this.clearLearnEmptyState();
            const inWordLevel = this.inLevel && this.currentLevel && this.currentLevel.type === 'word';
            document.getElementById('cardControls').style.display = inWordLevel ? 'flex' : 'none';
            const back = document.getElementById('learnBack');
            if (back) back.textContent = this.inLevel ? '🗺️ 关卡地图' : '🏠 首页';
        }

        if (tab === 'progress') {
            this.updateStats();
            this.updateWordList();
        }
    },

    // 尚未选择年级时的引导页，避免「学习」Tab 一片空白
    renderLearnEmptyState: function() {
        const container = document.getElementById('cardContainer');
        container.hidden = false;
        container.innerHTML = `
            <div class="learn-empty">
                <div class="learn-empty-emoji">🗺️</div>
                <div class="learn-empty-title">Start your adventure!</div>
                <div class="learn-empty-text">👈 请先在「🏠 首页」选一个年级，就能看到完整关卡地图啦</div>
                <button class="learn-empty-btn" id="learnEmptyBtn">去选年级 🏠</button>
            </div>`;
        document.getElementById('levelMap').hidden = true;
        document.getElementById('sentenceStage').hidden = true;
        document.getElementById('cardControls').style.display = 'none';
        document.getElementById('learnBack').textContent = '🏠 首页';
        document.getElementById('learnTitle').textContent = '选择学习内容';
        document.getElementById('learnEmptyBtn').onclick = () => this.showPage('home');
    },

    clearLearnEmptyState: function() {
        const empty = document.querySelector('.learn-empty');
        if (empty) empty.remove();
    },

    // ============== 年级选择 ==============
    initGradeSelector: function() {
        const gradeCards = document.querySelectorAll('.grade-card');
        gradeCards.forEach(card => {
            const grade = parseInt(card.dataset.grade);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${grade} 年级`);

            // 首页直接展示该年级的完整词库规模与关卡数
            const gradeData = LEARNING_DATA[grade];
            const totalWords = Object.keys(gradeData.units)
                .reduce((sum, key) => sum + gradeData.units[key].words.length, 0);
            const levelCount = this.buildLevelPlan(grade).length;
            const meta = document.createElement('div');
            meta.className = 'grade-meta';
            meta.textContent = `${totalWords} words · ${levelCount} levels`;
            card.appendChild(meta);

            card.addEventListener('click', () => this.enterGrade(grade));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-8px) scale(1.03) rotate(-1deg)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
            });
        });
    },

    // 进入年级：默认展示完整关卡地图
    enterGrade: function(grade) {
        this.currentGrade = grade;
        this.playMode = 'map';
        if (this.userData.lastGrade !== grade) {
            this.userData.lastGrade = grade;
            this.saveUserData();
        }
        this.levelPlan = this.buildLevelPlan(grade);
        this.currentLevelIndex = -1;
        this.currentLevel = null;
        this.inLevel = false;

        this.showPage('learn');
        this.renderUnitSelector();
        this.showLevelMap();
    },

    // 把整个年级的全部单词切成小关，每单元末尾再挂一个句子关
    buildLevelPlan: function(grade) {
        const gradeData = LEARNING_DATA[grade];
        if (!gradeData) return [];
        const plan = [];
        const size = WORDS_PER_LEVEL;

        Object.keys(gradeData.units).forEach(unitKey => {
            const unit = gradeData.units[unitKey];
            const chunks = Math.ceil(unit.words.length / size);
            for (let i = 0; i < chunks; i++) {
                plan.push({
                    key: `${grade}-${unitKey}-L${i}`,
                    grade: grade,
                    unit: unitKey,
                    type: 'word',
                    index: i,
                    label: `L${i + 1}`,
                    words: unit.words.slice(i * size, (i + 1) * size),
                    title: `${unit.title} · Level ${i + 1}`
                });
            }
            if (unit.sentences && unit.sentences.length) {
                plan.push({
                    key: `${grade}-${unitKey}-S`,
                    grade: grade,
                    unit: unitKey,
                    type: 'sentence',
                    index: 0,
                    label: '💬',
                    sentences: unit.sentences,
                    title: `${unit.title} · Sentence Show`
                });
            }
        });
        return plan;
    },

    // 顶部单元快捷按钮：跳到该单元第一个未完成的关卡
    renderUnitSelector: function() {
        const selector = document.getElementById('unitSelector');
        const gradeData = LEARNING_DATA[this.currentGrade];
        selector.innerHTML = '';
        Object.keys(gradeData.units).forEach(unitKey => {
            const unit = gradeData.units[unitKey];
            const btn = document.createElement('button');
            btn.className = 'unit-btn';
            btn.dataset.unit = unitKey;
            btn.textContent = unitKey === '0' ? '🔤' : `U${unitKey}`;
            btn.title = unit.title;
            btn.setAttribute('aria-label', unit.title);
            btn.addEventListener('click', () => {
                const first = this.levelPlan.findIndex(l => l.unit === unitKey);
                const pending = this.levelPlan.findIndex(l =>
                    l.unit === unitKey && !this.userData.completedLevels.includes(l.key));
                this.startLevel(pending >= 0 ? pending : first);
            });
            selector.appendChild(btn);
        });
    },

    setUnitActive: function(unitKey) {
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === String(unitKey));
        });
    },

    syncPlayNav: function(mode) {
        document.querySelectorAll('.play-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    },

    // ============== 关卡地图 ==============
    renderLevelMap: function() {
        const map = document.getElementById('levelMap');
        const gradeData = LEARNING_DATA[this.currentGrade];
        const totalWords = Object.keys(gradeData.units)
            .reduce((sum, key) => sum + gradeData.units[key].words.length, 0);
        const learned = this.userData.learnedWords
            .filter(key => String(key).startsWith(`${this.currentGrade}-`)).length;
        const done = this.levelPlan
            .filter(l => this.userData.completedLevels.includes(l.key)).length;
        const percent = Math.round(done / this.levelPlan.length * 100);
        const esc = SentenceLab.escapeHtml;

        map.innerHTML = `
            <div class="map-head">
                <div class="map-head-text">
                    <div class="map-title">🗺️ ${gradeData.emoji} ${gradeData.name} Word Map</div>
                    <div class="map-sub">${totalWords} words · ${this.levelPlan.length} levels · 全部词库分单元闯关</div>
                </div>
                <div class="map-progress">
                    <div class="map-progress-track"><span style="width:${percent}%"></span></div>
                    <span class="map-progress-text">${done}/${this.levelPlan.length} 关 ⭐ · ${learned}/${totalWords} words</span>
                </div>
                <button class="map-continue" id="mapContinueBtn">▶ 继续闯关</button>
            </div>
            <div class="map-units">
                ${Object.keys(gradeData.units).map(unitKey => {
                    const unit = gradeData.units[unitKey];
                    const levels = this.levelPlan.filter(l => l.unit === unitKey);
                    const unitDone = levels.filter(l => this.userData.completedLevels.includes(l.key)).length;
                    return `
                        <div class="map-unit">
                            <div class="map-unit-head">
                                <span class="map-unit-icon">${unit.icon}</span>
                                <span class="map-unit-name">${esc(unit.title)}</span>
                                <span class="map-unit-count">${unit.words.length} words · ${unitDone}/${levels.length} 关</span>
                            </div>
                            <div class="map-levels">
                                ${levels.map(l => {
                                    const isDone = this.userData.completedLevels.includes(l.key);
                                    return `
                                        <button class="map-level ${l.type} ${isDone ? 'done' : ''}"
                                                data-key="${l.key}" title="${esc(l.title)}">
                                            <span class="ml-icon">${l.type === 'sentence' ? '💬' : '🔤'}</span>
                                            <span class="ml-label">${l.type === 'sentence' ? 'Sentence' : l.label}</span>
                                            ${isDone ? '<span class="ml-check">✓</span>' : ''}
                                        </button>`;
                                }).join('')}
                            </div>
                        </div>`;
                }).join('')}
            </div>`;

        map.querySelectorAll('.map-level').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = this.levelPlan.findIndex(l => l.key === btn.dataset.key);
                if (idx >= 0) this.startLevel(idx);
            });
        });
        const continueBtn = document.getElementById('mapContinueBtn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                const idx = this.levelPlan.findIndex(l => !this.userData.completedLevels.includes(l.key));
                this.startLevel(idx >= 0 ? idx : 0);
            });
        }
    },

    showLevelMap: function() {
        this.inLevel = false;
        this.playMode = 'map';
        this.currentLevel = null;
        this.currentLevelIndex = -1;
        this.currentCards = [];
        // 玩法里可能还挂着定时朗读（盲听 / 选图），一并清掉，避免离开后仍有声音
        if (typeof Play !== 'undefined') Play.stopAll();
        SpeechHelper.stop();
        this.stopRecordingQuiet();
        this.clearSentenceSpeakTimer();
        this.syncPlayNav('map');

        this.renderLevelMap();
        document.getElementById('levelMap').hidden = false;
        const cardContainer = document.getElementById('cardContainer');
        cardContainer.hidden = true;
        cardContainer.innerHTML = '';
        const stage = document.getElementById('sentenceStage');
        stage.hidden = true;
        stage.innerHTML = '';
        const playStage = document.getElementById('playStage');
        playStage.hidden = true;
        playStage.innerHTML = '';
        document.getElementById('cardControls').style.display = 'none';

        const gradeData = LEARNING_DATA[this.currentGrade];
        document.getElementById('learnTitle').textContent =
            `${gradeData.emoji} ${gradeData.name} · ${gradeData.theme}`;
        document.getElementById('learnBack').textContent = '🏠 首页';
        this.setUnitActive(null);
    },

    // 进入某一关（单词关或句子关）
    startLevel: function(index) {
        if (index < 0 || index >= this.levelPlan.length) return;
        const level = this.levelPlan[index];
        if (typeof Play !== 'undefined') Play.stopAll();
        SpeechHelper.stop();
        this.stopRecordingQuiet();
        this.speechToken++;
        this.clearSentenceSpeakTimer();

        this.currentLevelIndex = index;
        this.currentLevel = level;
        this.currentUnit = level.unit;
        this.currentCardIndex = 0;
        this.currentCards = level.words ? level.words.slice() : [];
        this.inLevel = true;
        this.playMode = 'map';
        this.sentenceIndex = 0;
        this.syncPlayNav('map');

        document.getElementById('levelMap').hidden = true;
        const cardContainer = document.getElementById('cardContainer');
        cardContainer.hidden = level.type !== 'word';
        cardContainer.innerHTML = '';
        const stage = document.getElementById('sentenceStage');
        stage.hidden = level.type !== 'sentence';
        stage.innerHTML = '';
        const playStage = document.getElementById('playStage');
        playStage.hidden = true;
        playStage.innerHTML = '';
        document.getElementById('cardControls').style.display =
            level.type === 'word' ? 'flex' : 'none';

        document.getElementById('learnTitle').textContent =
            `${level.title} · ${index + 1}/${this.levelPlan.length}`;
        document.getElementById('learnBack').textContent = '🗺️ 关卡地图';
        this.setUnitActive(level.unit);

        if (level.type === 'word') this.renderCard();
        else this.renderSentenceCard();
    },

    // 兼容旧入口：跳到某单元第一关
    selectUnit: function(unitKey) {
        const idx = this.levelPlan.findIndex(l => l.unit === String(unitKey));
        if (idx >= 0) this.startLevel(idx);
    },

    // ============== 连续闯关 ==============
    goToNextLevel: function() {
        const next = this.currentLevelIndex + 1;
        if (next < this.levelPlan.length) {
            this.startLevel(next);
        } else {
            this.showGradeComplete();
        }
    },

    showGradeComplete: function() {
        const nextGrade = this.currentGrade + 1;
        const hasNextGrade = !!LEARNING_DATA[nextGrade];
        this.createConfetti(60);
        this.showModal(
            '🏆',
            'Grade Clear!',
            `你完成了 ${LEARNING_DATA[this.currentGrade].name} 的全部 ${this.levelPlan.length} 个关卡，太厉害啦！`,
            null,
            [
                {
                    label: hasNextGrade ? '▶ 下一年级' : '🎉 返回地图',
                    primary: true,
                    onClick: () => {
                        if (hasNextGrade) {
                            this.enterGrade(nextGrade);
                            this.startLevel(0);
                        } else {
                            this.showLevelMap();
                        }
                    }
                },
                { label: '🗺️ 关卡地图', onClick: () => this.showLevelMap() }
            ]
        );
    },

    // 完成当前关卡：首次通关发星，弹窗可直接进入下一关
    completeLevel: function() {
        const level = this.currentLevel;
        if (!level) return;
        // 防止小朋友连点「完成本关」导致重复排队通关弹窗（不同关卡不受影响）
        const key = level.key;
        const now = Date.now();
        if (this.lastCompletedKey === key && now - (this.lastCompleteAt || 0) < 800) return;
        this.lastCompletedKey = key;
        this.lastCompleteAt = now;
        const firstTime = !this.userData.completedLevels.includes(key);

        if (firstTime) {
            this.userData.completedLevels.push(key);
            this.userData.stars += level.type === 'sentence' ? 4 : 3;
            this.saveUserData();
            this.updateStats();
            Play.addXp(3);
        }
        const unitJustDone = this.checkUnitCompletion(level);
        this.checkBadges();
        // 剧情冒险进行中时，让宠物说一句鼓励的话
        if (typeof Quest !== 'undefined') Quest.encourage(level);
        this.createConfetti(36);

        const hasNext = this.currentLevelIndex + 1 < this.levelPlan.length;
        const actions = [];
        if (hasNext) {
            actions.push({ label: '▶ 下一关', primary: true, onClick: () => this.goToNextLevel() });
        } else {
            actions.push({
                label: this.currentGrade < 5 ? '🏆 完成本年级' : '🎉 全部通关',
                primary: true,
                onClick: () => this.showGradeComplete()
            });
        }
        actions.push({ label: '🗺️ 关卡地图', onClick: () => this.showLevelMap() });

        this.showModal(
            '🎉',
            'Level Clear!',
            firstTime
                ? `${level.title} 通关！奖励 ${level.type === 'sentence' ? 4 : 3} 颗星星 ⭐` +
                  (unitJustDone ? '\n🎊 本单元全部通关，额外奖励 5 颗星星！' : '')
                : `${level.title} 又复习了一遍，真棒！`,
            null,
            actions
        );
    },

    // 一个单元的所有关卡（含句子关）都完成后，标记单元完成并额外奖励
    checkUnitCompletion: function(level) {
        const unitLevels = this.levelPlan.filter(l => l.unit === level.unit);
        if (!unitLevels.length) return false;
        if (!unitLevels.every(l => this.userData.completedLevels.includes(l.key))) return false;
        const unitKey = `${this.currentGrade}-${level.unit}`;
        if (!this.userData.completedUnits.includes(unitKey)) {
            this.userData.completedUnits.push(unitKey);
            this.userData.stars += 5;
            this.saveUserData();
            this.updateStats();
            return true;
        }
        return false;
    },

    // ============== 单词学习卡片（全英文 + 图片） ==============
    renderCard: function() {
        const container = document.getElementById('cardContainer');
        const card = this.currentCards[this.currentCardIndex];

        if (!card) {
            container.innerHTML = '<p>暂无学习内容</p>';
            return;
        }

        this.stopRecordingQuiet();
        if (this.autoSpeakTimer) {
            clearTimeout(this.autoSpeakTimer);
            this.autoSpeakTimer = null;
        }

        const isLetterUnit = LEARNING_DATA[this.currentGrade].units[this.currentUnit].isLetterUnit;
        const wordKey = `${this.currentGrade}-${this.currentUnit}-${card.word}`;
        const isFav = this.userData.favorites.includes(wordKey);
        const isWeak = this.userData.weakWords.includes(wordKey);
        const hasRecording = !!this.userData.recordings[wordKey];

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
                 aria-label="${card.word}. ${card.sentence}. Tap to listen again.">
                <span class="card-emoji">${card.emoji}</span>
                ${letterExtra}
                <div class="card-word">${card.word}</div>
                <div class="card-phonetic">${card.phonetic}</div>
                <div class="card-sentence"><span class="card-sentence-tag">💬 Sentence</span>${card.sentence}</div>
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
                    Word ${this.currentCardIndex + 1} / ${this.currentCards.length} · ${this.currentLevel.title}
                </div>
            </div>
        `;

        const cardEl = document.getElementById('learningCard');
        const speakBtn = document.getElementById('cardSpeakBtn');
        speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speakCurrentCard(true);
        });
        cardEl.addEventListener('click', (e) => {
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

        document.getElementById('favBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleWordList('favorites', wordKey);
        });
        document.getElementById('weakBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleWordList('weakWords', wordKey);
        });
        document.getElementById('recordBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleRecording(wordKey, card.word);
        });
        document.getElementById('playRecBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.playRecording(wordKey);
        });
        document.getElementById('followBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.startFollowRead(card);
        });

        if (SpeechHelper.settings.autoSpeak) {
            const token = this.speechToken;
            this.autoSpeakTimer = setTimeout(() => {
                this.autoSpeakTimer = null;
                if (token !== this.speechToken) return;
                this.speakCurrentCard(false);
            }, 300);
        }

        this.updateCardControls();
        this.trackLearnedWord(card.word);
    },

    // 朗读当前卡片；isManual 为 true 时才算用户主动朗读
    speakCurrentCard: function(isManual) {
        const card = this.currentCards[this.currentCardIndex];
        if (!card) return;

        const speakIcon = document.getElementById('cardSpeakBtn');
        const speakBtn = document.getElementById('speakBtn');
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
                setTimeout(() => {
                    if (!isStillCurrent()) return;
                    SpeechHelper.speakSentence(card.sentence);
                }, 800);
            }
        );

        if (isManual) {
            this.userData.totalSpeak++;
            this.userData.missions.speak++;
            this.saveUserData();
            this.updateMissionsUI();
            this.updateStats();
            this.checkBadges();
        }
    },

    trackLearnedWord: function(word) {
        const key = `${this.currentGrade}-${this.currentUnit}-${word}`;
        if (!this.userData.learnedWords.includes(key)) {
            this.userData.learnedWords.push(key);
            this.userData.totalWords = this.userData.learnedWords.length;
            this.userData.missions.learn++;
            this.userData.stars += 1;
            this.saveUserData();
            this.updateMissionsUI();
            this.updateStats();
            this.checkBadges();
            Play.addXp(1);
        }
    },

    // ============== 句子小剧场（学习页句子关） ==============
    renderSentenceCard: function() {
        const level = this.currentLevel;
        const list = level.sentences || [];
        const item = list[this.sentenceIndex];
        const stage = document.getElementById('sentenceStage');
        if (!item) {
            this.completeLevel();
            return;
        }
        this.clearSentenceSpeakTimer();

        stage.innerHTML = `
            <div class="sentence-card">
                <div class="sentence-top">
                    <span class="sentence-badge">💬 Sentence Show</span>
                    <span class="sentence-progress">${this.sentenceIndex + 1} / ${list.length}</span>
                </div>
                <div class="sentence-scene">${SentenceLab.sceneHtml(item)}</div>
                <div class="sentence-listen">
                    <button class="sentence-audio" id="sentenceAudioBtn">🔊 Listen</button>
                    <button class="sentence-audio slow" id="sentenceSlowBtn">🐢 Slow</button>
                </div>
                <div class="sentence-hint" id="sentenceHint">Tap the English words in order! 👆</div>
                <div class="sentence-slots" id="sentenceSlots"></div>
                <div class="sentence-tiles" id="sentenceTiles"></div>
                <div class="sentence-reveal" id="sentenceReveal" hidden></div>
                <div class="sentence-actions" id="sentenceActions"></div>
                <div class="card-follow-hint" id="sentenceFollowHint" hidden></div>
            </div>`;

        document.getElementById('sentenceAudioBtn').onclick = () => SpeechHelper.speakSentence(item.text);
        document.getElementById('sentenceSlowBtn').onclick = () => SpeechHelper.speak(item.text, { rate: 0.6 });
        if (SpeechHelper.settings.autoSpeak) {
            this.sentenceSpeakTimer = setTimeout(() => {
                this.sentenceSpeakTimer = null;
                SpeechHelper.speakSentence(item.text);
            }, 400);
        }

        SentenceLab.renderPuzzle({
            text: item.text,
            slotsEl: document.getElementById('sentenceSlots'),
            tilesEl: document.getElementById('sentenceTiles'),
            onProgress: (cur, total) => {
                const hint = document.getElementById('sentenceHint');
                if (hint) hint.textContent = `Great! ${cur} / ${total} words ⭐`;
            },
            onWrong: () => {
                const hint = document.getElementById('sentenceHint');
                if (hint) hint.textContent = 'Oops! Try another word 🙈';
            },
            onSolved: () => this.onSentenceSolved(item)
        });
    },

    onSentenceSolved: function(item) {
        const reveal = document.getElementById('sentenceReveal');
        if (!reveal) return;
        const marked = item.text.split(item.word).join(`<mark>${item.word}</mark>`);
        reveal.innerHTML = `<div class="sentence-full">${marked}</div>`;
        reveal.hidden = false;

        SpeechHelper.speakSentence(item.text);
        // 同一个句子只在首次拼出时发星，避免反复进关刷星星
        const sentenceKey = `${this.currentGrade}-${this.currentUnit}-S${this.sentenceIndex}`;
        const firstSolve = !this.userData.completedSentences.includes(sentenceKey);
        if (firstSolve) {
            this.userData.completedSentences.push(sentenceKey);
            this.userData.stars += 2;
            this.saveUserData();
            this.updateStats();
            Play.addXp(2);
        }
        this.createConfetti(18);

        const isLast = this.sentenceIndex >= this.currentLevel.sentences.length - 1;
        const actions = document.getElementById('sentenceActions');
        actions.innerHTML = `
            <button class="sentence-btn" id="sentenceSayBtn">🗣️ Say it!</button>
            <button class="sentence-btn primary" id="sentenceNextBtn">${isLast ? '完成这一关 ✓' : '下一句 ▶'}</button>`;
        document.getElementById('sentenceSayBtn').onclick = () => {
            this.followReadText(item.text, document.getElementById('sentenceFollowHint'));
        };
        document.getElementById('sentenceNextBtn').onclick = () => {
            if (isLast) {
                this.completeLevel();
            } else {
                this.sentenceIndex++;
                this.renderSentenceCard();
            }
        };
    },

    // ============== 卡片控制 ==============
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
                this.completeLevel();
            }
        };

        speakBtn.onclick = () => this.speakCurrentCard(true);

        // 趣味乐园玩法 / 关卡里「返回」先回关卡地图，不再直接退回首页
        backBtn.onclick = () => {
            if (this.playMode && this.playMode !== 'map') Play.showMode('map');
            else if (this.inLevel) this.showLevelMap();
            else this.showPage('home');
        };
    },

    updateCardControls: function() {
        const prevBtn = document.getElementById('prevCard');
        const nextBtn = document.getElementById('nextCard');
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) {
            const isLast = this.currentCardIndex === this.currentCards.length - 1;
            nextBtn.disabled = this.currentCards.length === 0;
            nextBtn.innerHTML = isLast
                ? '完成本关 ✓'
                : '下一张 <span class="btn-icon">▶</span>';
        }
    },

    // ============== 每日任务 / 徽章 ==============
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

        document.querySelectorAll('.mission-item').forEach(item => {
            const mission = item.dataset.mission;
            let completed = false;
            if (mission === 'learn') completed = this.userData.missions.learn >= 5;
            if (mission === 'speak') completed = this.userData.missions.speak >= 3;
            if (mission === 'game') completed = this.userData.missions.game;
            item.classList.toggle('completed', completed);
        });
    },

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
        // 贴纸与徽章共用同一批里程碑，顺手刷新（只发新解锁的）
        if (typeof Stickers !== 'undefined') Stickers.refresh();
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

    // ============== 弹窗（支持多个动作按钮，排队显示） ==============
    modalQueue: [],
    modalActive: false,
    modalCallback: null,

    // showModal(emoji, title, message, onClose, actions)
    // actions: [{ label, primary, onClick }]
    showModal: function(emoji, title, message, onClose, actions) {
        const opts = (onClose && typeof onClose === 'object')
            ? onClose
            : { onClose: onClose || null, actions: actions || [] };
        this.modalQueue.push({
            emoji: emoji,
            title: title,
            message: message,
            onClose: opts.onClose || null,
            actions: opts.actions || []
        });
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

        const actionsBox = document.getElementById('modalActions');
        actionsBox.innerHTML = '';
        let primaryBtn = null;
        next.actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'modal-action-btn' + (action.primary ? ' primary' : '');
            btn.textContent = action.label;
            btn.onclick = () => {
                this.closeModal();
                if (action.onClick) action.onClick();
            };
            actionsBox.appendChild(btn);
            if (action.primary && !primaryBtn) primaryBtn = btn;
        });

        const mainBtn = document.getElementById('modalBtn');
        mainBtn.textContent = next.actions.length ? '留在本关' : '继续';
        mainBtn.onclick = () => this.closeModal();
        document.getElementById('modalOverlay').classList.add('show');
        // 键盘用户回车即可直接「下一关」
        (primaryBtn || mainBtn).focus();
    },

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
            const panel = document.getElementById('settingsPanel');
            if (panel && panel.classList.contains('show')) {
                panel.classList.remove('show');
                return;
            }
            this.closeModal();
        });
    },

    // ============== 语音设置 ==============
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
            window.speechSynthesis.addEventListener('voiceschanged', fillVoices);
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

        document.getElementById('settingsBtn').onclick = () => panel.classList.toggle('show');
        document.getElementById('settingsClose').onclick = () => panel.classList.remove('show');
        document.getElementById('settingsTest').onclick = () => {
            SpeechHelper.speak('Hello! Let us learn English together.');
        };
        panel.addEventListener('click', (e) => {
            if (e.target.id === 'settingsPanel') panel.classList.remove('show');
        });
    },

    // ============== 进度导出 / 导入 ==============
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
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(wordKey);

        // 标记/取消「不熟」时同步维护间隔复习排期
        if (listName === 'weakWords') {
            if (idx >= 0) Play.unmarkWeak(wordKey);
            else Play.markWeak(wordKey);
        }

        this.saveUserData();
        // 仅在「学习页 + 单词关」可见时重绘卡片，避免在成就页误触发自动朗读
        if (document.getElementById('page-learn').classList.contains('active') &&
            this.inLevel && this.currentLevel && this.currentLevel.type === 'word' &&
            !document.getElementById('cardContainer').hidden) {
            this.renderCard();
        }
        if (document.getElementById('page-progress').classList.contains('active')) {
            this.updateWordList();
        }
    },

    // ============== 录音 / 回放 ==============
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],

    stopRecordingQuiet: function() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
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
            this.mediaRecorder.stop();
            return;
        }
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
                        this.renderCard();
                    };
                    reader.readAsDataURL(blob);
                };
                this.mediaRecorder.start();
                setTimeout(() => {
                    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                }, 10000);
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
    startFollowRead: function(card) {
        this.followReadText(card.word, document.getElementById('followHint'), card.word);
    },

    followReadText: function(text, hintEl, matchedWord) {
        if (!hintEl) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const target = (matchedWord || text);

        if (!SpeechRecognition) {
            hintEl.textContent = '😢 你的浏览器不支持语音识别，试试 Chrome 桌面版！';
            hintEl.hidden = false;
            setTimeout(() => { hintEl.hidden = true; }, 4000);
            return;
        }

        hintEl.textContent = '🎤 Say it out loud: ' + text;
        hintEl.hidden = false;
        SpeechHelper.speakSentence(text);

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        let heard = '';
        let rate = 0;
        let hadError = false;
        const token = ++this.followReadToken;
        recognition.onresult = (e) => {
            // 多个识别候选取与目标词重合度最高的一个
            const result = e.results[0];
            for (let i = 0; i < result.length; i++) {
                const candidate = result[i].transcript.trim();
                const score = PlayLab.matchRate(candidate, target);
                if (score > rate) { rate = score; heard = candidate.toLowerCase(); }
            }
        };
        recognition.onerror = () => {
            hadError = true;
            hintEl.textContent = '😢 识别出错了，再试一次吧';
            hintEl.hidden = false;
        };
        recognition.onend = () => {
            // 识别失败不发星，也不把「出错」误判成「没听到声音」
            if (hadError) {
                hintEl.hidden = false;
                return;
            }
            // 真实评分：词级匹配 ≥80% 三星，≥40% 两星，其余一星鼓励
            const stars = !heard ? 1 : (rate >= 0.8 ? 3 : (rate >= 0.4 ? 2 : 1));
            this.userData.stars += stars;
            if (heard) {
                this.userData.totalSpeak++;
                this.userData.missions.speak++;
            }
            this.saveUserData();
            this.updateMissionsUI();
            this.updateStats();
            this.checkBadges();

            const starText = '⭐'.repeat(stars);
            if (!heard) {
                hintEl.textContent = '😢 没听到声音哦～奖你 1 颗鼓励星 ⭐，张大嘴巴再试一次！';
                SpeechHelper.speak(text, { rate: 0.6 });
            } else if (stars === 3) {
                hintEl.textContent = `${starText} Excellent! "${heard}" 跟 "${target}" 几乎一模一样！`;
                SpeechHelper.speak('Excellent!');
            } else if (stars === 2) {
                hintEl.textContent = `${starText} Good try! 听到 "${heard}" 啦，跟着慢速示范再读一遍～`;
                setTimeout(() => SpeechHelper.speak(text, { rate: 0.6 }), 350);
            } else {
                hintEl.textContent = `${starText} Keep going! 听到 "${heard}"，听我慢慢读一遍再试试！`;
                setTimeout(() => SpeechHelper.speak(text, { rate: 0.6 }), 350);
            }
            hintEl.hidden = false;
        };

        setTimeout(() => {
            // 已经切离学习页 / 发起新一次跟读时，不再启动麦克风
            if (token !== this.followReadToken) return;
            try { recognition.start(); } catch(e) {}
        }, 1800);
    },

    // ============== 词典查询（仅英文） ==============
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
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dict-search')) result.hidden = true;
        });
    },

    searchDict: function(query) {
        const result = document.getElementById('dictResult');
        const matches = [];
        for (const grade of Object.keys(LEARNING_DATA)) {
            const units = LEARNING_DATA[grade].units;
            for (const unitKey of Object.keys(units)) {
                for (const w of units[unitKey].words) {
                    if (w.word.toLowerCase().includes(query)) {
                        matches.push({ ...w, grade, unitKey });
                        if (matches.length >= 8) break;
                    }
                }
                if (matches.length >= 8) break;
            }
            if (matches.length >= 8) break;
        }

        if (matches.length === 0) {
            result.innerHTML = '<div class="dict-empty">No words found</div>';
        } else {
            result.innerHTML = matches.map(m => `
                <div class="dict-item" data-grade="${m.grade}" data-unit="${m.unitKey}" data-word="${m.word}">
                    <span class="dict-emoji">${m.emoji}</span>
                    <span class="dict-word">${m.word}</span>
                    <span class="dict-sentence">${m.sentence}</span>
                    <span class="dict-loc">G${m.grade}-U${m.unitKey}</span>
                </div>
            `).join('');
            result.querySelectorAll('.dict-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.jumpToWord(parseInt(item.dataset.grade), item.dataset.unit, item.dataset.word);
                    document.getElementById('dictInput').value = '';
                    result.hidden = true;
                });
            });
        }
        result.hidden = false;
    },

    // 从词典 / 收藏列表定位到「包含该单词的那一关」
    jumpToWord: function(grade, unitKey, word) {
        if (this.currentGrade !== grade || !this.levelPlan.length) this.enterGrade(grade);
        const levelIdx = this.levelPlan.findIndex(l =>
            l.unit === String(unitKey) && l.type === 'word' &&
            l.words.some(w => w.word === word));
        if (levelIdx < 0) return;
        this.startLevel(levelIdx);
        const cardIdx = this.currentCards.findIndex(c => c.word === word);
        if (cardIdx >= 0) {
            this.currentCardIndex = cardIdx;
            this.renderCard();
        }
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

        const favBtn = nav.querySelector('[data-list="favorites"]');
        const weakBtn = nav.querySelector('[data-list="weak"]');
        const dubBtn = nav.querySelector('[data-list="dubs"]');
        if (favBtn) favBtn.querySelector('span').textContent = this.userData.favorites.length;
        if (weakBtn) weakBtn.querySelector('span').textContent = this.userData.weakWords.length;
        if (dubBtn) dubBtn.querySelector('span').textContent = (this.userData.dubs || []).length;

        // 「我的配音」是独立结构（音频对象数组），交给趣味乐园模块渲染
        if (listName === 'dubs') {
            Play.renderDubList(list);
            return;
        }

        const keys = this.userData[listName] || [];
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
            if (card) items.push({ card, grade, unitKey, key, word });
        }

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
                <span class="wli-sentence">${it.card.sentence}</span>
                <span class="wli-loc">G${it.grade}-U${it.unitKey}</span>
                <button class="wli-remove" data-remove="${it.key}" title="移除">✕</button>
            </div>
        `).join('');

        list.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleWordList(listName, btn.dataset.remove);
            });
        });
        list.querySelectorAll('.word-list-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.wli-remove')) return;
                const parts = el.dataset.key.split('-');
                this.showPage('learn');
                this.jumpToWord(parseInt(parts[0]), parts[1], parts.slice(2).join('-'));
            });
        });
    },

    // ============== 彩色纸屑庆祝效果 ==============
    createConfetti: function(count) {
        const container = document.getElementById('celebration');
        const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#FF8C42', '#A78BFA', '#60A5FA', '#34D399'];
        const total = count || 50;

        for (let i = 0; i < total; i++) {
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
