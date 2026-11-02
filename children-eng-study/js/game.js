/* ========================================
   趣味英语乐园 - 游戏逻辑
   连连看、听音选词、拼写大师、记忆翻牌
   ======================================== */

const Game = {
    // 当前游戏状态
    currentGame: null,
    currentGrade: 1,
    gameScore: 0,
    gameData: [],
    
    init: function() {
        this.bindGameSelector();
    },

    bindGameSelector: function() {
        const gameCards = document.querySelectorAll('.game-card');
        gameCards.forEach(card => {
            card.addEventListener('click', () => {
                const gameType = card.dataset.game;
                this.startGame(gameType);
            });
        });

        // 返回按钮
        const backBtn = document.getElementById('gameBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                document.querySelector('.game-selector').style.display = 'block';
                document.getElementById('gameArea').style.display = 'none';
                SpeechHelper.stop();
            });
        }
    },

    // 获取游戏用的单词数据
    getGameWords: function(count = 8) {
        const grade = LEARNING_DATA[this.currentGrade];
        const allWords = [];
        
        Object.values(grade.units).forEach(unit => {
            unit.words.forEach(word => {
                allWords.push(word);
            });
        });

        // 打乱并取前 count 个
        const shuffled = allWords.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    },

    startGame: function(gameType) {
        this.currentGame = gameType;
        this.gameScore = 0;
        
        // 切换显示
        document.querySelector('.game-selector').style.display = 'none';
        const gameArea = document.getElementById('gameArea');
        gameArea.style.display = 'block';
        
        // 更新标题
        const titles = {
            match: '🧩 单词连连看',
            guess: '🎯 听音选词',
            spell: '✏️ 拼写大师',
            memory: '🃏 记忆翻牌'
        };
        document.getElementById('gameTitle').textContent = titles[gameType] || '游戏';
        document.getElementById('gameScore').textContent = '0';

        // 根据游戏类型初始化
        switch (gameType) {
            case 'match': this.initMatchGame(); break;
            case 'guess': this.initGuessGame(); break;
            case 'spell': this.initSpellGame(); break;
            case 'memory': this.initMemoryGame(); break;
        }
    },

    updateScore: function(points = 1) {
        this.gameScore += points;
        document.getElementById('gameScore').textContent = this.gameScore;
    },

    completeGame: function() {
        App.userData.totalGames++;
        App.userData.missions.game = true;
        App.userData.stars += 3;
        App.saveUserData();
        App.updateStats();
        App.updateMissionsUI();
        App.checkBadges();
    },

    // ============== 连连看游戏 ==============
    initMatchGame: function() {
        const words = this.getGameWords(6);
        const content = document.getElementById('gameContent');
        
        content.innerHTML = `
            <div class="match-container">
                <div class="match-column" id="matchColumn1"></div>
                <div class="match-column" id="matchColumn2"></div>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #6B7280;">
                左边选英文，右边选中文，配对成功就消除！
            </div>
        `;

        const col1 = document.getElementById('matchColumn1');
        const col2 = document.getElementById('matchColumn2');

        // 英文列
        const englishWords = words.map((w, i) => ({ ...w, id: i, type: 'en' }));
        const chineseWords = words.map((w, i) => ({ ...w, id: i, type: 'cn' }));

        // 打乱顺序
        const shuffledEn = [...englishWords].sort(() => Math.random() - 0.5);
        const shuffledCn = [...chineseWords].sort(() => Math.random() - 0.5);

        let selectedEn = null;
        let selectedCn = null;
        let matchedCount = 0;

        // 渲染英文
        shuffledEn.forEach(word => {
            const div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = `${word.emoji} ${word.word}`;
            div.dataset.id = word.id;
            div.addEventListener('click', () => {
                if (div.classList.contains('matched')) return;
                
                col1.querySelectorAll('.match-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedEn = div.dataset.id;

                if (selectedEn !== null && selectedCn !== null) {
                    checkMatch();
                }
            });
            col1.appendChild(div);
        });

        // 渲染中文
        shuffledCn.forEach(word => {
            const div = document.createElement('div');
            div.className = 'match-item';
            div.textContent = `${word.emoji} ${word.cn}`;
            div.dataset.id = word.id;
            div.addEventListener('click', () => {
                if (div.classList.contains('matched')) return;
                
                col2.querySelectorAll('.match-item').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                selectedCn = div.dataset.id;

                if (selectedEn !== null && selectedCn !== null) {
                    checkMatch();
                }
            });
            col2.appendChild(div);
        });

        const checkMatch = () => {
            const enItem = col1.querySelector(`[data-id="${selectedEn}"]`);
            const cnItem = col2.querySelector(`[data-id="${selectedCn}"]`);
            
            if (selectedEn === selectedCn) {
                // 匹配成功
                enItem.classList.add('matched');
                cnItem.classList.add('matched');
                enItem.classList.remove('selected');
                cnItem.classList.remove('selected');
                this.updateScore(10);
                App.createConfetti();
                matchedCount++;
                
                // 播放发音
                const word = words.find(w => String(col1.querySelector('.match-item.matched:last-of-type')?.dataset.id) === String(w.id));
                
                if (matchedCount === words.length) {
                    setTimeout(() => {
                        this.completeGame();
                        App.showModal('🎉', '恭喜通关！', `你的得分是 ${this.gameScore} 分！`, () => {});
                        App.createConfetti();
                    }, 500);
                }
            } else {
                // 不匹配
                setTimeout(() => {
                    enItem.classList.remove('selected');
                    cnItem.classList.remove('selected');
                }, 300);
            }
            
            selectedEn = null;
            selectedCn = null;
        };
    },

    // ============== 听音选词游戏 ==============
    initGuessGame: function() {
        const words = this.getGameWords(10);
        let currentIndex = 0;
        let correctCount = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                // 游戏结束
                setTimeout(() => {
                    this.completeGame();
                    App.showModal('🎉', '游戏结束！', `正确 ${correctCount}/${words.length} 题，得分 ${this.gameScore}！`, () => {});
                }, 500);
                return;
            }

            const currentWord = words[currentIndex];
            
            // 生成干扰选项
            const otherWords = words.filter(w => w.word !== currentWord.word);
            const wrongOptions = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
            const allOptions = [currentWord, ...wrongOptions].sort(() => Math.random() - 0.5);

            content.innerHTML = `
                <div class="guess-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <button class="guess-audio-btn" id="guessAudioBtn">🔊</button>
                    <p style="margin: 12px 0 24px; color: #374151; font-size: 18px;">听发音，选择正确的中文意思</p>
                    <div class="guess-options" id="guessOptions">
                        ${allOptions.map(opt => `
                            <button class="guess-option" data-word="${opt.word}">
                                ${opt.emoji} ${opt.cn}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            // 自动播放发音
            setTimeout(() => SpeechHelper.speakWord(currentWord.word), 300);

            // 播放按钮
            document.getElementById('guessAudioBtn').addEventListener('click', function() {
                SpeechHelper.speakWord(currentWord.word);
            });

            // 选项点击
            document.querySelectorAll('.guess-option').forEach(btn => {
                btn.addEventListener('click', function() {
                    const selectedWord = this.dataset.word;
                    
                    if (selectedWord === currentWord.word) {
                        this.classList.add('correct');
                        this.updateScore(10);
                        correctCount++;
                        SpeechHelper.speak('Correct! Well done!');
                        setTimeout(() => {
                            currentIndex++;
                            renderQuestion();
                        }, 1000);
                    } else {
                        this.classList.add('wrong');
                        SpeechHelper.speak('Try again!');
                        setTimeout(() => this.classList.remove('wrong'), 500);
                    }
                });
            });
        };

        renderQuestion();
    },

    // ============== 拼写游戏 ==============
    initSpellGame: function() {
        const words = this.getGameWords(8);
        let currentIndex = 0;
        let correctCount = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                setTimeout(() => {
                    this.completeGame();
                    App.showModal('🎉', '拼写完成！', `正确 ${correctCount}/${words.length}，得分 ${this.gameScore}！`, () => {});
                }, 500);
                return;
            }

            const currentWord = words[currentIndex];
            
            content.innerHTML = `
                <div class="spell-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <div style="font-size: 80px; margin-bottom: 16px;">${currentWord.emoji}</div>
                    <p style="font-size: 24px; margin-bottom: 8px;">${currentWord.cn}</p>
                    <button class="guess-audio-btn" id="spellAudioBtn" style="font-size: 48px; padding: 20px; margin-bottom: 20px;">🔊</button>
                    <div class="spell-input-area">
                        <input type="text" class="spell-input" id="spellInput" placeholder="输入英文" autocomplete="off" spellcheck="false">
                        <button class="spell-check-btn" id="spellCheckBtn">检查 ✅</button>
                    </div>
                    <div class="spell-hint">💡 提示：这个单词有 ${currentWord.word.length} 个字母</div>
                </div>
            `;

            // 自动播放发音
            setTimeout(() => SpeechHelper.speakWord(currentWord.word), 300);

            const input = document.getElementById('spellInput');
            input.focus();

            document.getElementById('spellAudioBtn').addEventListener('click', () => {
                SpeechHelper.speakWord(currentWord.word);
            });

            const checkAnswer = () => {
                const answer = input.value.trim().toLowerCase();
                const correct = currentWord.word.toLowerCase();
                
                if (answer === correct) {
                    input.style.borderColor = 'var(--color-green)';
                    input.style.color = 'var(--color-green)';
                    this.updateScore(15);
                    correctCount++;
                    SpeechHelper.speak('Excellent!');
                    setTimeout(() => {
                        currentIndex++;
                        renderQuestion();
                    }, 1200);
                } else if (answer.length >= correct.length) {
                    input.style.borderColor = '#EF4444';
                    input.style.color = '#EF4444';
                    SpeechHelper.speak('Almost! Listen again.');
                    setTimeout(() => {
                        input.style.borderColor = 'var(--color-blue)';
                        input.style.color = 'var(--color-text)';
                        SpeechHelper.speakWord(currentWord.word);
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

    // ============== 记忆翻牌游戏 ==============
    initMemoryGame: function() {
        const words = this.getGameWords(8);
        const content = document.getElementById('gameContent');

        // 创建配对卡片
        const cards = [];
        words.forEach((word, i) => {
            cards.push({ id: i, type: 'en', content: `${word.emoji} ${word.word}`, pairId: i });
            cards.push({ id: i + 100, type: 'cn', content: `${word.emoji} ${word.cn}`, pairId: i });
        });

        // 打乱
        cards.sort(() => Math.random() - 0.5);

        let flippedCards = [];
        let matchedPairs = 0;
        let isProcessing = false;

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 16px; color: #6B7280;">
                翻开卡片，找到英文和中文的配对！
            </div>
            <div class="memory-grid" id="memoryGrid">
                ${cards.map((card, idx) => `
                    <div class="memory-card" data-idx="${idx}">?</div>
                `).join('')}
            </div>
        `;

        const grid = document.getElementById('memoryGrid');
        const cardElements = grid.querySelectorAll('.memory-card');

        cardElements.forEach((cardEl, idx) => {
            cardEl.addEventListener('click', () => {
                if (isProcessing) return;
                if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
                if (flippedCards.length >= 2) return;

                // 翻开卡片
                cardEl.textContent = cards[idx].content;
                cardEl.classList.add('flipped');
                flippedCards.push({ el: cardEl, data: cards[idx] });

                if (flippedCards.length === 2) {
                    isProcessing = true;
                    const [first, second] = flippedCards;

                    if (first.data.pairId === second.data.pairId && first.data.type !== second.data.type) {
                        // 配对成功
                        setTimeout(() => {
                            first.el.classList.add('matched');
                            second.el.classList.add('matched');
                            first.el.classList.remove('flipped');
                            second.el.classList.remove('flipped');
                            this.updateScore(15);
                            matchedPairs++;
                            flippedCards = [];
                            isProcessing = false;
                            App.createConfetti();

                            if (matchedPairs === words.length) {
                                setTimeout(() => {
                                    this.completeGame();
                                    App.showModal('🎉', '记忆超群！', `得分 ${this.gameScore} 分！`, () => {});
                                }, 500);
                            }
                        }, 600);
                    } else {
                        // 配对失败
                        setTimeout(() => {
                            first.el.textContent = '?';
                            second.el.textContent = '?';
                            first.el.classList.remove('flipped');
                            second.el.classList.remove('flipped');
                            flippedCards = [];
                            isProcessing = false;
                        }, 1000);
                    }
                }
            });
        });
    }
};

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
