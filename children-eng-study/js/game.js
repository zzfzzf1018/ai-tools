/* ========================================
   趣味英语乐园 - 游戏逻辑
   6 个闯关游戏：连连看 / 听音选图 / 拼写 / 记忆翻牌 / 字母拼拼乐 / 句子小剧场
   v1.3.0：全英文 + 图片，通关后可直接进入下一关
   ======================================== */

const Game = {
    // 当前游戏状态
    currentGame: null,
    currentGameTitle: '',
    currentGrade: 1,
    gameScore: 0,
    gameLevel: 1,
    gameData: [],

    // 游戏内的延时任务统一登记，切离游戏页时一次性清理；
    // gameCompleted 保证一局游戏只结算一次（避免连点/多个定时器重复发奖）
    timers: [],
    gameCompleted: false,
    pendingComplete: false,

    // 游戏 DOM 不会因为切 Tab 而重建，题目推进定时器必须继续跑完
    // （否则 renderQuestion 闭包丢失，孩子切回来会卡在已答对的那一题）。
    // 跨页副作用（奖状 / 自动朗读）则靠这个判断抑制。
    isActivePage: function() {
        const page = document.getElementById('page-game');
        return !!page && page.classList.contains('active');
    },

    later: function(fn, ms) {
        // 这里必须用原生 setTimeout（later 自身不能再递归调用 later）
        const t = setTimeout(() => {
            this.timers = this.timers.filter(x => x !== t);
            fn();
        }, ms);
        this.timers.push(t);
        return t;
    },

    stopAll: function() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers = [];
        SpeechHelper.stop();
    },

    // 闯关顺序：通关后「下一关」按此序列推进，循环进入更高 Level
    GAME_ORDER: ['match', 'guess', 'spell', 'memory', 'fillword', 'sentence'],

    // 每个游戏的专属奖状样式（称号 + 奖牌 + 配色类名）
    CERTIFICATES: {
        match:    { cls: 'cert-match',    ribbon: '🧩', award: '配对小达人', en: 'Match Master' },
        guess:    { cls: 'cert-guess',    ribbon: '🎯', award: '听力小达人', en: 'Super Listener' },
        spell:    { cls: 'cert-spell',    ribbon: '✏️', award: '拼写小明星', en: 'Spelling Star' },
        memory:   { cls: 'cert-memory',   ribbon: '🃏', award: '记忆小超人', en: 'Memory Hero' },
        fillword: { cls: 'cert-fillword', ribbon: '🧱', award: '拼词小工匠', en: 'Word Builder' },
        sentence: { cls: 'cert-sentence', ribbon: '💬', award: '句子小明星', en: 'Sentence Star' }
    },

    init: function() {
        if (this.initialized) return;
        this.initialized = true;
        this.bindGameSelector();

        const certOverlay = document.getElementById('certOverlay');
        document.getElementById('certBtn').addEventListener('click', () => this.closeCertificate());
        certOverlay.addEventListener('click', (e) => {
            if (e.target === certOverlay) this.closeCertificate();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && certOverlay.classList.contains('show')) {
                this.closeCertificate();
            }
        });
    },

    closeCertificate: function(afterClose) {
        const overlay = document.getElementById('certOverlay');
        const wasShown = overlay.classList.contains('show');
        overlay.classList.remove('show');
        // 徽章提示等弹窗等奖状收起后再显示，避免被奖状遮住
        if (wasShown) App.checkBadges();
        if (afterClose) afterClose();
    },

    backToSelector: function() {
        this.stopAll();
        document.querySelector('.game-selector').style.display = 'block';
        document.getElementById('gameArea').style.display = 'none';
        const bar = document.getElementById('voiceGuideBar');
        if (bar) { bar.hidden = true; bar.innerHTML = ''; }
        if (typeof Combo !== 'undefined') Combo.reset();
    },

    bindGameSelector: function() {
        const gameCards = document.querySelectorAll('.game-card');
        gameCards.forEach(card => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.addEventListener('click', () => this.startGame(card.dataset.game));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });

        const backBtn = document.getElementById('gameBack');
        if (backBtn) backBtn.addEventListener('click', () => this.backToSelector());
    },

    // 游戏词汇取自当前年级的完整词库；每进一关轮换一批，多闯几关即可覆盖全部单词
    getGameWords: function(count = 8) {
        const grade = LEARNING_DATA[this.currentGrade] || LEARNING_DATA[1];
        const all = [];
        const seen = new Set();
        const seenEmoji = new Set();
        Object.keys(grade.units).forEach(unitKey => {
            grade.units[unitKey].words.forEach(w => {
                // 词库里 hello/goodbye 同为 👋、bye/hand 同为 ✋ 等 28 组重复 Emoji。
                // 连连看 / 记忆翻牌按图片配对，两个相同图会让孩子无法区分，取词时按图去重。
                if (seen.has(w.word) || seenEmoji.has(w.emoji)) return;
                seen.add(w.word);
                seenEmoji.add(w.emoji);
                all.push({ ...w, unitKey });
            });
        });

        // 第一关优先复习学习页当前正在学的那一关
        let priorityWords = [];
        if (this.gameLevel === 1 && App.currentGrade === this.currentGrade &&
            App.currentLevel && App.currentLevel.type === 'word') {
            priorityWords = App.currentLevel.words.map(w => w.word);
        }
        const first = all.filter(w => priorityWords.includes(w.word));
        const rest = all.filter(w => !priorityWords.includes(w.word));
        const start = (this.gameLevel * count) % (rest.length || 1);
        const rotated = rest.slice(start).concat(rest.slice(0, start));
        return first.concat(rotated).slice(0, count);
    },

    // 题目语音小助手：更新播报条 + 自动读题
    // 自动播报仍走 later + isActivePage 守卫，避免孩子切到别的 Tab 时突然冒出声音
    setQuestion: function(type, getTarget, auto) {
        const bar = document.getElementById('voiceGuideBar');
        if (!bar || typeof VoiceGuide === 'undefined') return;
        const journey = (typeof GRADE_JOURNEY !== 'undefined') ? GRADE_JOURNEY[this.currentGrade] : null;
        bar.innerHTML = VoiceGuide.barHtml(type, { buddy: journey ? journey.buddy : '🐣' });
        bar.hidden = false;
        VoiceGuide.bindBar(bar, type, getTarget);
        if (!auto) return;
        this.later(() => {
            if (!this.isActivePage()) return;
            const t = (typeof getTarget === 'function') ? getTarget() : getTarget;
            VoiceGuide.readQuestion(type, t, true);
        }, 280);
    },

    startGame: function(gameType, keepLevel) {
        this.stopAll();          // 上一局遗留的朗读/推进定时器不能带进新一局
        this.gameCompleted = false;
        this.currentGame = gameType;
        this.gameScore = 0;
        if (!keepLevel) this.gameLevel = 1;
        this.currentGrade = App.currentGrade || 1;
        if (typeof Combo !== 'undefined') Combo.startRun();

        SpeechHelper.stop();
        this.closeCertificate();

        document.querySelector('.game-selector').style.display = 'none';
        document.getElementById('gameArea').style.display = 'block';
        // 先收起并清空；由 setQuestion() 在题目渲染成功后显示，
        // 避免「词汇不够」提前 return 时留下一个空的播报条容器
        const guideBar = document.getElementById('voiceGuideBar');
        if (guideBar) { guideBar.hidden = true; guideBar.innerHTML = ''; }

        const titles = {
            match: '🧩 单词连连看',
            guess: '🎯 听音选词',
            spell: '✏️ 拼写大师',
            memory: '🃏 记忆翻牌',
            fillword: '🧱 字母拼拼乐',
            sentence: '💬 句子小剧场'
        };
        const baseTitle = titles[gameType] || '游戏';
        this.currentGameTitle = baseTitle;
        document.getElementById('gameTitle').textContent = `${baseTitle} · Lv.${this.gameLevel}`;
        const orderIdx = this.GAME_ORDER.indexOf(gameType);
        document.getElementById('gameLevel').textContent =
            `Level ${this.gameLevel} · ${orderIdx >= 0 ? orderIdx + 1 : 1}/${this.GAME_ORDER.length}`;
        document.getElementById('gameScore').textContent = '0';

        switch (gameType) {
            case 'match': this.initMatchGame(); break;
            case 'guess': this.initGuessGame(); break;
            case 'spell': this.initSpellGame(); break;
            case 'memory': this.initMemoryGame(); break;
            case 'fillword': this.initFillWordGame(); break;
            case 'sentence': this.initSentenceGame(); break;
        }
    },

    // 通关后继续下一关，不必退回主页
    startNextLevel: function() {
        const idx = this.GAME_ORDER.indexOf(this.currentGame);
        const next = this.GAME_ORDER[(idx + 1) % this.GAME_ORDER.length];
        this.gameLevel++;
        this.startGame(next, true);
    },

    updateScore: function(points = 1) {
        let gained = points;
        if (typeof Combo !== 'undefined') {
            Combo.hit();
            gained = Math.round(points * Combo.multiplier());
        }
        this.gameScore += gained;
        const el = document.getElementById('gameScore');
        if (el) el.textContent = this.gameScore;
    },

    // 通关奖励：固定 3 颗星 + 颁发当前游戏专属样式的小奖状
    completeGame: function() {
        // 一局只结算一次：句子小剧场最后一句连点会排出多个 completeGame 定时器
        if (this.gameCompleted) return 0;
        // 通关瞬间人已经切到首页/成就页时，奖状不能盖在别的页面上；
        // 先记下来，等切回「🎮 游戏」Tab 再补发。
        if (!this.isActivePage()) {
            this.pendingComplete = true;
            return 0;
        }
        this.gameCompleted = true;
        this.pendingComplete = false;
        const stars = 3;

        App.userData.totalGames++;
        App.userData.missions.game = true;
        App.userData.stars += stars;
        if (!App.userData.completedGames.includes(this.currentGame)) {
            App.userData.completedGames.push(this.currentGame);
        }
        App.saveUserData();
        App.updateStats();
        App.updateMissionsUI();
        if (typeof Stickers !== 'undefined') Stickers.refresh();
        App.createConfetti();
        this.showCertificate(stars);
        if (typeof VoiceGuide !== 'undefined') VoiceGuide.cheer();

        return stars;
    },

    // 颁发小奖状：按游戏切换配色/称号，星星逐颗弹出，并提供连续闯关入口
    showCertificate: function(stars) {
        const conf = this.CERTIFICATES[this.currentGame] ||
            { cls: '', ribbon: '🏅', award: '闯关小达人', en: 'Great Job' };
        const overlay = document.getElementById('certOverlay');
        const cert = document.getElementById('certificate');

        cert.className = 'certificate' + (conf.cls ? ' ' + conf.cls : '');
        document.getElementById('certRibbon').textContent = conf.ribbon;
        document.getElementById('certTitleEn').textContent = conf.en;
        document.getElementById('certAwardName').textContent = conf.award;
        const comboBest = (typeof Combo !== 'undefined') ? Combo.best : 0;
        document.getElementById('certReason').textContent =
            `恭喜通关「${this.currentGameTitle}」Level ${this.gameLevel}，得分 ${this.gameScore} 分` +
            (comboBest >= 2 ? `，最高连击 x${comboBest} 🔥` : '');
        document.getElementById('certDate').textContent =
            new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

        const starsBox = document.getElementById('certStars');
        starsBox.innerHTML = Array.from({ length: stars }, () => '<span>⭐</span>').join('');

        // 奖状上的多个去向：下一关 / 再玩一次 / 游戏列表 / 首页
        const actionsBox = document.getElementById('certActions');
        actionsBox.innerHTML = '';
        const actions = [
            { label: '▶ 下一关', primary: true, run: () => this.startNextLevel() },
            { label: '🔄 再玩一次', run: () => this.startGame(this.currentGame, true) },
            { label: '🎮 游戏列表', run: () => this.backToSelector() },
            { label: '🏠 首页', run: () => { this.backToSelector(); App.showPage('home'); } }
        ];
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'cert-action-btn' + (action.primary ? ' primary' : '');
            btn.textContent = action.label;
            btn.onclick = () => this.closeCertificate(action.run);
            actionsBox.appendChild(btn);
        });

        overlay.classList.add('show');
        document.getElementById('certBtn').focus();
    },

    // ============== 连连看：英文 ↔ 图片 ==============
    initMatchGame: function() {
        const words = this.getGameWords(6);
        const content = document.getElementById('gameContent');

        content.innerHTML = `
            <div class="match-container">
                <div class="match-column" id="matchColumn1"></div>
                <div class="match-column" id="matchColumn2"></div>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #6B7280;">
                左边选英文，右边选对应的图片，配对成功就消除！
            </div>
        `;
        this.setQuestion('match', null, true);

        const col1 = document.getElementById('matchColumn1');
        const col2 = document.getElementById('matchColumn2');

        const englishWords = words.map((w, i) => ({ ...w, id: i, type: 'en' }));
        const pictureWords = words.map((w, i) => ({ ...w, id: i, type: 'pic' }));

        const shuffledEn = [...englishWords].sort(() => Math.random() - 0.5);
        const shuffledPic = [...pictureWords].sort(() => Math.random() - 0.5);

        let selectedEn = null;
        let selectedPic = null;
        let matchedCount = 0;

        shuffledEn.forEach(word => {
            const div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = word.word;
            div.dataset.id = word.id;
            div.addEventListener('click', () => {
                if (div.classList.contains('matched')) return;
                col1.querySelectorAll('.match-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedEn = div.dataset.id;
                // 点一下就念出来，边玩边听
                if (typeof VoiceGuide !== 'undefined') VoiceGuide.sayWord(word.word);
                if (selectedEn !== null && selectedPic !== null) checkMatch();
            });
            col1.appendChild(div);
        });

        shuffledPic.forEach(word => {
            const div = document.createElement('div');
            div.className = 'match-item match-picture';
            div.textContent = word.emoji;
            div.dataset.id = word.id;
            div.addEventListener('click', () => {
                if (div.classList.contains('matched')) return;
                col2.querySelectorAll('.match-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedPic = div.dataset.id;
                // 看图也能听发音，帮孩子把图片和单词的声音连起来
                if (typeof VoiceGuide !== 'undefined') VoiceGuide.sayWord(word.word);
                if (selectedEn !== null && selectedPic !== null) checkMatch();
            });
            col2.appendChild(div);
        });

        const checkMatch = () => {
            const enItem = col1.querySelector(`[data-id="${selectedEn}"]`);
            const picItem = col2.querySelector(`[data-id="${selectedPic}"]`);

            if (selectedEn === selectedPic) {
                enItem.classList.add('matched');
                picItem.classList.add('matched');
                enItem.classList.remove('selected');
                picItem.classList.remove('selected');
                this.updateScore(10);
                matchedCount++;

                const matchedWord = words[Number(selectedEn)];
                if (typeof VoiceGuide !== 'undefined') VoiceGuide.praise(matchedWord);
                else if (matchedWord) SpeechHelper.speakWord(matchedWord.word);

                if (matchedCount === words.length) {
                    this.later(() => this.completeGame(), 500);
                }
            } else {
                if (typeof Combo !== 'undefined') Combo.miss();
                if (typeof VoiceGuide !== 'undefined') VoiceGuide.retry(null);
                this.later(() => {
                    enItem.classList.remove('selected');
                    picItem.classList.remove('selected');
                }, 300);
            }

            selectedEn = null;
            selectedPic = null;
        };
    },

    // ============== 听音选词：听发音选图片 + 英文 ==============
    initGuessGame: function() {
        const words = this.getGameWords(10);
        let currentIndex = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                this.later(() => this.completeGame(), 500);
                return;
            }

            const currentWord = words[currentIndex];
            const otherWords = words.filter(w => w.word !== currentWord.word);
            const wrongOptions = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
            const allOptions = [currentWord, ...wrongOptions].sort(() => Math.random() - 0.5);

            content.innerHTML = `
                <div class="guess-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <button class="guess-audio-btn" id="guessAudioBtn">🔊</button>
                    <p style="margin: 12px 0 24px; color: #374151; font-size: 18px;">听发音，选出对应的图片和单词</p>
                    <div class="guess-options" id="guessOptions">
                        ${allOptions.map(opt => `
                            <button class="guess-option" data-word="${opt.word}">
                                <span class="guess-option-emoji">${opt.emoji}</span>
                                <span class="guess-option-word">${opt.word}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            this.setQuestion('guess', () => ({ word: currentWord.word }), true);

            document.getElementById('guessAudioBtn').addEventListener('click', () => {
                if (typeof VoiceGuide !== 'undefined') {
                    VoiceGuide.readQuestion('guess', { word: currentWord.word }, false);
                } else {
                    SpeechHelper.speakWord(currentWord.word);
                }
            });

            let answered = false;
            let triedWrong = false;

            document.querySelectorAll('.guess-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (answered) return;
                    const selectedWord = btn.dataset.word;

                    if (selectedWord === currentWord.word) {
                        answered = true;
                        btn.classList.add('correct');
                        this.updateScore(triedWrong ? 5 : 10);
                        if (typeof VoiceGuide !== 'undefined') VoiceGuide.praise({ word: currentWord.word });
                        else SpeechHelper.speak('Correct! Well done!');
                        this.later(() => {
                            currentIndex++;
                            renderQuestion();
                        }, 1000);
                    } else {
                        triedWrong = true;
                        if (typeof Combo !== 'undefined') Combo.miss();
                        btn.classList.add('wrong');
                        if (typeof VoiceGuide !== 'undefined') VoiceGuide.retry({ word: currentWord.word });
                        else SpeechHelper.speak('Try again!');
                        this.later(() => btn.classList.remove('wrong'), 500);
                    }
                });
            });
        };

        renderQuestion();
    },

    // ============== 拼写游戏：看图 + 听音 ==============
    initSpellGame: function() {
        const words = this.getGameWords(8);
        let currentIndex = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                this.later(() => this.completeGame(), 500);
                return;
            }

            const currentWord = words[currentIndex];
            const letterCount = currentWord.word.replace(/[^a-zA-Z]/g, '').length;

            content.innerHTML = `
                <div class="spell-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <div style="font-size: 80px; margin-bottom: 16px;">${currentWord.emoji}</div>
                    <button class="guess-audio-btn" id="spellAudioBtn" style="font-size: 48px; padding: 20px; margin-bottom: 20px;">🔊</button>
                    <div class="spell-input-area">
                        <input type="text" class="spell-input" id="spellInput" placeholder="Type the word" autocomplete="off" spellcheck="false">
                        <button class="spell-check-btn" id="spellCheckBtn">检查 ✅</button>
                    </div>
                    <div class="spell-hint">💡 ${letterCount} letters</div>
                </div>
            `;

            this.setQuestion('spell', () => ({ word: currentWord.word }), true);

            const input = document.getElementById('spellInput');
            input.focus();

            document.getElementById('spellAudioBtn').addEventListener('click', () => {
                if (typeof VoiceGuide !== 'undefined') {
                    VoiceGuide.readQuestion('spell', { word: currentWord.word }, false);
                } else {
                    SpeechHelper.speakWord(currentWord.word);
                }
            });

            let solved = false;
            let triedWrong = false;

            const checkAnswer = () => {
                if (solved) return;
                const answer = input.value.trim().toLowerCase();
                const correct = currentWord.word.toLowerCase();

                if (!answer) {
                    input.focus();
                    return;
                }

                if (answer === correct) {
                    solved = true;
                    input.disabled = true;
                    document.getElementById('spellCheckBtn').disabled = true;
                    input.style.borderColor = 'var(--color-green)';
                    input.style.color = 'var(--color-green)';
                    this.updateScore(triedWrong ? 8 : 15);
                    if (typeof VoiceGuide !== 'undefined') VoiceGuide.praise({ word: currentWord.word });
                    else SpeechHelper.speak('Excellent!');
                    this.later(() => {
                        currentIndex++;
                        renderQuestion();
                    }, 1200);
                } else {
                    triedWrong = true;
                    if (typeof Combo !== 'undefined') Combo.miss();
                    input.style.borderColor = '#EF4444';
                    input.style.color = '#EF4444';
                    // retry 会把「温柔鼓励 + 重读单词」排进朗读队列，孩子能立刻再听清一次
                    if (typeof VoiceGuide !== 'undefined') VoiceGuide.retry({ word: currentWord.word });
                    else SpeechHelper.speak('Almost! Listen again.');
                    this.later(() => {
                        input.style.borderColor = 'var(--color-blue)';
                        input.style.color = 'var(--color-text)';
                    }, 800);
                }
            };

            document.getElementById('spellCheckBtn').addEventListener('click', checkAnswer);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') checkAnswer();
            });
        };

        renderQuestion();
    },

    // ============== 记忆翻牌：英文 ↔ 图片 ==============
    initMemoryGame: function() {
        const words = this.getGameWords(8);
        const content = document.getElementById('gameContent');

        const cards = [];
        words.forEach((word, i) => {
            cards.push({ id: i, type: 'en', content: word.word, pairId: i });
            cards.push({ id: i + 100, type: 'pic', content: word.emoji, pairId: i });
        });
        cards.sort(() => Math.random() - 0.5);

        let flippedCards = [];
        let matchedPairs = 0;
        let isProcessing = false;

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 16px; color: #6B7280;">
                翻开卡片，找到英文单词和对应图片的配对！
            </div>
            <div class="memory-grid" id="memoryGrid">
                ${cards.map((card, idx) => `
                    <div class="memory-card" data-idx="${idx}">?</div>
                `).join('')}
            </div>
        `;
        this.setQuestion('memory', null, true);

        const cardElements = document.querySelectorAll('.memory-card');
        cardElements.forEach((cardEl, idx) => {
            cardEl.addEventListener('click', () => {
                if (isProcessing) return;
                if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
                if (flippedCards.length >= 2) return;

                cardEl.textContent = cards[idx].content;
                if (cards[idx].type === 'pic') cardEl.classList.add('picture');
                cardEl.classList.add('flipped');
                // 翻到单词卡或图片卡都会念出这个单词，边翻边记
                const flipWord = words[cards[idx].pairId];
                if (flipWord && typeof VoiceGuide !== 'undefined') VoiceGuide.sayWord(flipWord.word);
                flippedCards.push({ el: cardEl, data: cards[idx] });

                if (flippedCards.length === 2) {
                    isProcessing = true;
                    const [first, second] = flippedCards;

                    if (first.data.pairId === second.data.pairId && first.data.type !== second.data.type) {
                        this.later(() => {
                            first.el.classList.add('matched');
                            second.el.classList.add('matched');
                            first.el.classList.remove('flipped');
                            second.el.classList.remove('flipped');
                            this.updateScore(15);
                            if (typeof VoiceGuide !== 'undefined') {
                                const w = words[first.data.pairId];
                                VoiceGuide.praise(w ? { word: w.word } : null);
                            }
                            matchedPairs++;
                            flippedCards = [];
                            isProcessing = false;

                            if (matchedPairs === words.length) {
                                this.later(() => this.completeGame(), 500);
                            }
                        }, 600);
                    } else {
                        if (typeof Combo !== 'undefined') Combo.miss();
                        if (typeof VoiceGuide !== 'undefined') VoiceGuide.retry(null);
                        this.later(() => {
                            first.el.textContent = '?';
                            second.el.textContent = '?';
                            first.el.classList.remove('flipped', 'picture');
                            second.el.classList.remove('flipped', 'picture');
                            flippedCards = [];
                            isProcessing = false;
                        }, 1000);
                    }
                }
            });
        });
    },

    // ============== 字母拼拼乐：看图片拼单词 ==============
    initFillWordGame: function() {
        const words = this.getGameWords(10).filter(w => /^[a-zA-Z]+$/.test(w.word)).slice(0, 6);
        if (words.length < 3) {
            App.showModal('😅', '词汇不够', '当前年级适合的单词太少，换个年级试试吧');
            return;
        }

        let currentIndex = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                this.later(() => this.completeGame(), 500);
                return;
            }

            const currentWord = words[currentIndex];
            const target = currentWord.word.toLowerCase();
            const targetLetters = target.split('');

            const otherWords = words.filter(w => w.word !== currentWord.word);
            const extraLetters = [];
            for (let i = 0; i < Math.min(2, otherWords.length); i++) {
                const lw = otherWords[i].word.toLowerCase();
                if (lw && /^[a-z]+$/.test(lw)) {
                    for (const ch of lw) {
                        if (!targetLetters.includes(ch) && !extraLetters.includes(ch)) {
                            extraLetters.push(ch);
                            break;
                        }
                    }
                }
            }
            const allUsed = new Set(targetLetters);
            const alphabet = 'abcdefghijklmnopqrstuvwxyz';
            while (extraLetters.length < 2) {
                const ch = alphabet[Math.floor(Math.random() * 26)];
                if (!allUsed.has(ch) && !extraLetters.includes(ch)) extraLetters.push(ch);
            }

            const pool = [...targetLetters, ...extraLetters].sort(() => Math.random() - 0.5);

            content.innerHTML = `
                <div class="fillword-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <div style="font-size: 80px; margin-bottom: 8px;">${currentWord.emoji}</div>
                    <button class="guess-audio-btn" id="fillAudioBtn" style="font-size: 40px; padding: 16px;">🔊</button>
                    <div class="spell-hint" style="margin: 8px 0 16px;">💡 ${targetLetters.length} letters</div>

                    <div class="fillword-slots" id="fillSlots">
                        ${targetLetters.map((_, i) => `<div class="fill-slot" data-slot="${i}"></div>`).join('')}
                    </div>
                    <div class="fillword-pool" id="fillPool">
                        ${pool.map((ch, i) => `<button class="fill-letter" data-letter="${ch}" data-pool-idx="${i}">${ch}</button>`).join('')}
                    </div>
                    <button class="fillword-undo" id="fillUndoBtn">↩️ 撤回</button>
                </div>
            `;

            this.setQuestion('fillword', () => ({ word: currentWord.word }), true);
            document.getElementById('fillAudioBtn').onclick = () => {
                if (typeof VoiceGuide !== 'undefined') {
                    VoiceGuide.readQuestion('fillword', { word: currentWord.word }, false);
                } else {
                    SpeechHelper.speakWord(currentWord.word);
                }
            };

            const answerSlots = Array(targetLetters.length).fill(null);
            const usedPoolIdx = new Set();
            // 记录每个答案槽用的是字母池里的哪一个按钮，撤回含重复字母的单词时才不会误恢复
            const slotPoolIdx = Array(targetLetters.length).fill(null);
            let solved = false;
            let triedWrong = false;

            const renderSlots = () => {
                const slots = document.querySelectorAll('.fill-slot');
                slots.forEach((el, i) => {
                    el.textContent = answerSlots[i] || '';
                    el.classList.toggle('filled', !!answerSlots[i]);
                    el.classList.toggle('correct', solved && answerSlots[i] === targetLetters[i]);
                });
            };

            const checkFull = () => {
                if (solved) return;
                if (answerSlots.every(s => s !== null)) {
                    const spelled = answerSlots.join('');
                    if (spelled === target) {
                        solved = true;
                        renderSlots();
                        document.querySelectorAll('.fill-letter').forEach(b => {
                            if (!usedPoolIdx.has(Number(b.dataset.poolIdx))) b.disabled = true;
                        });
                        this.updateScore(triedWrong ? 8 : 15);
                        if (typeof VoiceGuide !== 'undefined') VoiceGuide.praise({ word: currentWord.word });
                        else SpeechHelper.speak('Excellent!');
                        this.later(() => {
                            currentIndex++;
                            renderQuestion();
                        }, 1200);
                    } else {
                        triedWrong = true;
                        if (typeof Combo !== 'undefined') Combo.miss();
                        document.querySelectorAll('.fill-slot').forEach(s => s.classList.add('shake'));
                        if (typeof VoiceGuide !== 'undefined') VoiceGuide.retry({ word: currentWord.word });
                        else SpeechHelper.speak('Almost!');
                        this.later(() => {
                            document.querySelectorAll('.fill-slot').forEach(s => s.classList.remove('shake'));
                            answerSlots.fill(null);
                            usedPoolIdx.clear();
                            slotPoolIdx.fill(null);
                            document.querySelectorAll('.fill-letter').forEach(b => {
                                b.classList.remove('used');
                                b.disabled = false;
                            });
                            renderSlots();
                        }, 600);
                    }
                }
            };

            document.querySelectorAll('.fill-letter').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (solved) return;
                    const poolIdx = Number(btn.dataset.poolIdx);
                    if (usedPoolIdx.has(poolIdx)) return;
                    const emptyIdx = answerSlots.findIndex(s => s === null);
                    if (emptyIdx === -1) return;
                    answerSlots[emptyIdx] = btn.dataset.letter;
                    slotPoolIdx[emptyIdx] = poolIdx;
                    usedPoolIdx.add(poolIdx);
                    btn.classList.add('used');
                    btn.disabled = true;
                    renderSlots();
                    checkFull();
                });
            });

            document.getElementById('fillUndoBtn').addEventListener('click', () => {
                if (solved) return;
                const lastFilled = answerSlots.map((s, i) => s !== null ? i : -1).filter(i => i >= 0).pop();
                if (lastFilled === undefined) return;
                const poolIdx = slotPoolIdx[lastFilled];
                answerSlots[lastFilled] = null;
                slotPoolIdx[lastFilled] = null;
                usedPoolIdx.delete(poolIdx);
                // 只恢复这一个槽实际用过的按钮，避免重复字母被一起释放
                const usedBtn = document.querySelector(`.fill-letter[data-pool-idx="${poolIdx}"]`);
                if (usedBtn) {
                    usedBtn.classList.remove('used');
                    usedBtn.disabled = false;
                }
                renderSlots();
            });
        };

        renderQuestion();
    },

    // ============== 句子小剧场：听句子 → 看图片 → 按顺序拼词块 ==============
    initSentenceGame: function() {
        const sentences = SentenceLab.pick(this.currentGrade, 4, this.gameLevel - 1);
        if (!sentences.length) {
            App.showModal('😅', '句子不够', '当前年级还没有句子，换个年级试试吧');
            return;
        }

        let currentIndex = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= sentences.length) {
                this.later(() => this.completeGame(), 500);
                return;
            }

            const item = sentences[currentIndex];
            content.innerHTML = `
                <div class="sentence-card">
                    <div class="sentence-top">
                        <span class="sentence-badge">💬 Sentence Show</span>
                        <span class="sentence-progress">${currentIndex + 1} / ${sentences.length}</span>
                    </div>
                    <div class="sentence-scene">${SentenceLab.sceneHtml(item)}</div>
                    <div class="sentence-listen">
                        <button class="sentence-audio" id="sgAudioBtn">🔊 Listen</button>
                        <button class="sentence-audio slow" id="sgSlowBtn">🐢 Slow</button>
                    </div>
                    <div class="sentence-hint" id="sgHint">Listen, then tap the words in order! 👆</div>
                    <div class="sentence-slots" id="sgSlots"></div>
                    <div class="sentence-tiles" id="sgTiles"></div>
                    <div class="sentence-reveal" id="sgReveal" hidden></div>
                    <div class="sentence-actions" id="sgActions"></div>
                </div>`;

            this.setQuestion('sentence', () => ({ sentence: item.text }), true);
            document.getElementById('sgAudioBtn').onclick = () => {
                if (typeof VoiceGuide !== 'undefined') {
                    VoiceGuide.readQuestion('sentence', { sentence: item.text }, false);
                } else {
                    SpeechHelper.speakSentence(item.text);
                }
            };
            document.getElementById('sgSlowBtn').onclick = () => SpeechHelper.speak(item.text, { rate: 0.6 });

            SentenceLab.renderPuzzle({
                text: item.text,
                slotsEl: document.getElementById('sgSlots'),
                tilesEl: document.getElementById('sgTiles'),
                onProgress: (cur, total) => {
                    const hint = document.getElementById('sgHint');
                    if (hint) hint.textContent = `Great! ${cur} / ${total} words ⭐`;
                },
                onWrong: () => {
                    const hint = document.getElementById('sgHint');
                    if (hint) hint.textContent = 'Oops! Try another word 🙈';
                },
                onSolved: () => {
                    const reveal = document.getElementById('sgReveal');
                    const marked = item.text.split(item.word).join(`<mark>${item.word}</mark>`);
                    reveal.innerHTML = `<div class="sentence-full">${marked}</div>`;
                    reveal.hidden = false;
                    if (typeof VoiceGuide !== 'undefined') VoiceGuide.praise({ sentence: item.text });
                    else SpeechHelper.speakSentence(item.text);
                    this.updateScore(15);
                    App.createConfetti(16);

                    const isLast = currentIndex === sentences.length - 1;
                    const actions = document.getElementById('sgActions');
                    actions.innerHTML = `
                        <button class="sentence-btn primary" id="sgNextBtn">${isLast ? '完成闯关 ✓' : '下一句 ▶'}</button>`;
                    const nextBtn = document.getElementById('sgNextBtn');
                    nextBtn.onclick = () => {
                        // 连点「下一句」会一次跳掉两题；最后一题则会排出多个通关定时器
                        if (nextBtn.disabled) return;
                        nextBtn.disabled = true;
                        currentIndex++;
                        renderQuestion();
                    };
                }
            });
        };

        renderQuestion();
    }
};

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
