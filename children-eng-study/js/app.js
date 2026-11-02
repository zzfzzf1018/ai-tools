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
        stars: 0,
        streak: 0,
        lastVisitDate: null,
        totalWords: 0,
        totalSpeak: 0,
        totalGames: 0,
        totalDays: 0,
        learnedWords: [],  // 已学习的单词
        completedGames: [],
        missions: {
            learn: 0,
            speak: 0,
            game: false
        },
        badges: [],
        gradeProgress: {}  // 各年级进度
    },

    // 初始化
    init: function() {
        this.loadUserData();
        this.updateStats();
        this.initNavigation();
        this.initGradeSelector();
        this.initDailyMissions();
        this.initModal();
        this.checkDailyStreak();
        
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
                this.userData = Object.assign(this.userData, parsed);
            } catch(e) {
                console.warn('加载用户数据失败:', e);
            }
        }
    },

    // 保存用户数据
    saveUserData: function() {
        localStorage.setItem('kidsEnglishUserData', JSON.stringify(this.userData));
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
    },

    // 检查连续学习
    checkDailyStreak: function() {
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        if (this.userData.lastVisitDate === today) {
            // 今天已经访问过
        } else if (this.userData.lastVisitDate === yesterdayStr) {
            // 昨天访问过，增加连续天数
            this.userData.streak++;
        } else {
            // 中断了，重置
            this.userData.streak = 1;
        }
        
        this.userData.lastVisitDate = today;
        this.saveUserData();
        this.updateStats();
    },

    // 标签页导航
    initNavigation: function() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                // 更新按钮状态
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // 切换页面
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('page-' + tab).classList.add('active');
                
                // 如果是成就页，刷新徽章
                if (tab === 'progress') {
                    this.updateBadges();
                    this.updateStats();
                }
            });
        });
    },

    // 年级选择
    initGradeSelector: function() {
        const gradeCards = document.querySelectorAll('.grade-card');
        gradeCards.forEach(card => {
            card.addEventListener('click', () => {
                const grade = parseInt(card.dataset.grade);
                this.enterGrade(grade);
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
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-learn').classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="learn"]').classList.add('active');
        
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
            <div class="learning-card ${cardType === 'letter' ? 'letter-card' : ''}" data-type="${cardType}">
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

        // 绑定发音按钮
        const speakBtn = document.getElementById('cardSpeakBtn');
        speakBtn.addEventListener('click', () => {
            this.speakCurrentCard();
        });

        // 自动发音
        setTimeout(() => this.speakCurrentCard(), 300);

        // 更新进度
        this.updateCardControls();
        
        // 更新学习进度
        this.trackLearnedWord(card.word);
    },

    // 朗读当前卡片
    speakCurrentCard: function() {
        const card = this.currentCards[this.currentCardIndex];
        if (!card) return;

        const speakIcon = document.getElementById('cardSpeakBtn');
        const speakBtn = document.getElementById('speakBtn');
        
        SpeechHelper.speakWord(card.word, 
            () => {
                if (speakIcon) speakIcon.classList.add('speaking');
                if (speakBtn) speakBtn.classList.add('speaking');
            },
            () => {
                if (speakIcon) speakIcon.classList.remove('speaking');
                if (speakBtn) speakBtn.classList.remove('speaking');
                
                // 朗读句子
                setTimeout(() => {
                    SpeechHelper.speakSentence(card.sentence);
                }, 800);
            }
        );

        // 更新朗读统计
        this.userData.totalSpeak++;
        this.userData.missions.speak++;
        this.saveUserData();
        this.updateMissionsUI();
        this.updateStats();
        this.checkBadges();
    },

    // 跟踪学习的单词
    trackLearnedWord: function(word) {
        if (!this.userData.learnedWords.includes(word)) {
            this.userData.learnedWords.push(word);
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
                // 已完成所有卡片，给奖励
                this.showModal('🎉', '太棒了！', '你完成了这个单元的学习！获得5颗星星！', () => {
                    this.userData.stars += 5;
                    this.saveUserData();
                    this.updateStats();
                });
                this.createConfetti();
            }
        };

        speakBtn.onclick = () => {
            this.speakCurrentCard();
        };

        backBtn.onclick = () => {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-home').classList.add('active');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="home"]').classList.add('active');
            document.getElementById('cardControls').style.display = 'none';
        };
    },

    // 更新卡片控制按钮状态
    updateCardControls: function() {
        const prevBtn = document.getElementById('prevCard');
        const nextBtn = document.getElementById('nextCard');
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentCardIndex === this.currentCards.length - 1;
    },

    // 每日任务
    initDailyMissions: function() {
        this.updateMissionsUI();
    },

    updateMissionsUI: function() {
        document.getElementById('learnProgress').textContent = 
            Math.min(this.userData.missions.learn, 5);
        document.getElementById('speakProgress').textContent = 
            Math.min(this.userData.missions.speak, 3);
        
        const gameProgress = document.getElementById('gameProgress');
        if (this.userData.missions.game) {
            gameProgress.textContent = '已完成 ✓';
        }

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
        };

        let newBadge = null;
        for (const [id, unlocked] of Object.entries(checks)) {
            if (unlocked && !data.badges.includes(id)) {
                data.badges.push(id);
                newBadge = BADGES_DATA.find(b => b.id === id);
            }
        }

        if (newBadge) {
            this.saveUserData();
            this.updateBadges();
            this.showModal('🎖️', '获得新徽章！', `你解锁了「${newBadge.name}」`, () => {});
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

    // 弹窗
    showModal: function(emoji, title, message, onClose) {
        const overlay = document.getElementById('modalOverlay');
        document.getElementById('modalEmoji').textContent = emoji;
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('modalBtn').onclick = () => {
            overlay.classList.remove('show');
            if (onClose) onClose();
        };
        overlay.classList.add('show');
    },

    initModal: function() {
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                document.getElementById('modalOverlay').classList.remove('show');
            }
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
