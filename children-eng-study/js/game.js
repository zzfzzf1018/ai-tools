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
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.addEventListener('click', () => {
                const gameType = card.dataset.game;
                this.startGame(gameType);
            });
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
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

    // 获取游戏用的单词数据（优先当前单元，不足时用同年级其他单元补齐）
    getGameWords: function(count = 8) {
        const grade = LEARNING_DATA[this.currentGrade] || LEARNING_DATA[1];
        const unitWords = [];
        const otherWords = [];

        Object.keys(grade.units).forEach(unitKey => {
            grade.units[unitKey].words.forEach(word => {
                if (String(unitKey) === String(App.currentUnit) && this.currentGrade === App.currentGrade) {
                    unitWords.push(word);
                } else {
                    otherWords.push(word);
                }
            });
        });

        // 当前单元的词优先出现，其余随机补齐
        const prioritized = unitWords.sort(() => Math.random() - 0.5);
        const fillers = otherWords.sort(() => Math.random() - 0.5);
        return prioritized.concat(fillers).slice(0, count);
    },

    startGame: function(gameType) {
        this.currentGame = gameType;
        this.gameScore = 0;
        // 游戏词汇跟随学习页选择的年级，未选择时默认一年级
        this.currentGrade = App.currentGrade || 1;

        SpeechHelper.stop();

        // 切换显示
        document.querySelector('.game-selector').style.display = 'none';
        const gameArea = document.getElementById('gameArea');
        gameArea.style.display = 'block';
        
        // 更新标题
        const titles = {
            match: '🧩 单词连连看',
            guess: '🎯 听音选词',
            spell: '✏️ 拼写大师',
            memory: '🃏 记忆翻牌',
            fillword: '🧱 字母拼拼乐'
        };
        document.getElementById('gameTitle').textContent = titles[gameType] || '游戏';
        document.getElementById('gameScore').textContent = '0';

        // 根据游戏类型初始化
        switch (gameType) {
            case 'match': this.initMatchGame(); break;
            case 'guess': this.initGuessGame(); break;
            case 'spell': this.initSpellGame(); break;
            case 'memory': this.initMemoryGame(); break;
            case 'fillword': this.initFillWordGame(); break;
        }
    },

    updateScore: function(points = 1) {
        this.gameScore += points;
        document.getElementById('gameScore').textContent = this.gameScore;
    },

    // 按失误扣星：满星 5 颗，每 2 次失误扣 1 颗，保底 1 颗
    completeGame: function(mistakes = 0) {
        const stars = Math.max(1, 5 - Math.ceil(mistakes / 2));

        App.userData.totalGames++;
        App.userData.missions.game = true;
        App.userData.stars += stars;
        if (!App.userData.completedGames.includes(this.currentGame)) {
            App.userData.completedGames.push(this.currentGame);
        }
        App.saveUserData();
        App.updateStats();
        App.updateMissionsUI();
        App.checkBadges();

        return stars;
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
        let mistakes = 0;

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
                matchedCount++;

                // 配对成功时朗读该单词（用户操作触发的即时反馈）
                const matchedWord = words[Number(selectedEn)];
                if (matchedWord) SpeechHelper.speakWord(matchedWord.word);

                if (matchedCount === words.length) {
                    setTimeout(() => {
                        const stars = this.completeGame(mistakes);
                        App.showModal('🎉', '恭喜通关！', `你的得分是 ${this.gameScore} 分，获得 ${stars} 颗星星！`);
                        App.createConfetti();
                    }, 500);
                }
            } else {
                // 不匹配
                mistakes++;
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
        let firstTryCorrect = 0;
        let mistakes = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                // 游戏结束
                setTimeout(() => {
                    const stars = this.completeGame(mistakes);
                    App.showModal('🎉', '游戏结束！', `一次答对 ${firstTryCorrect}/${words.length} 题，得分 ${this.gameScore}，获得 ${stars} 颗星星！`);
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

            // 自动播放发音（可在语音设置里关闭）
            if (SpeechHelper.settings.autoSpeak) {
                setTimeout(() => SpeechHelper.speakWord(currentWord.word), 300);
            }

            // 播放按钮
            document.getElementById('guessAudioBtn').addEventListener('click', () => {
                SpeechHelper.speakWord(currentWord.word);
            });

            // answered 防止答对后等待期间重复点击，造成重复计分跳题
            let answered = false;
            let triedWrong = false;

            // 选项点击（箭头函数保证 this 指向 Game）
            document.querySelectorAll('.guess-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (answered) return;
                    const selectedWord = btn.dataset.word;

                    if (selectedWord === currentWord.word) {
                        answered = true;
                        btn.classList.add('correct');
                        this.updateScore(triedWrong ? 5 : 10);
                        if (!triedWrong) firstTryCorrect++;
                        SpeechHelper.speak('Correct! Well done!');
                        setTimeout(() => {
                            currentIndex++;
                            renderQuestion();
                        }, 1000);
                    } else {
                        triedWrong = true;
                        mistakes++;
                        btn.classList.add('wrong');
                        SpeechHelper.speak('Try again!');
                        setTimeout(() => btn.classList.remove('wrong'), 500);
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
        let firstTryCorrect = 0;
        let mistakes = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                setTimeout(() => {
                    const stars = this.completeGame(mistakes);
                    App.showModal('🎉', '拼写完成！', `一次拼对 ${firstTryCorrect}/${words.length}，得分 ${this.gameScore}，获得 ${stars} 颗星星！`);
                }, 500);
                return;
            }

            const currentWord = words[currentIndex];
            // 字母数只统计 a-z，不把空格、撇号算进去
            const letterCount = currentWord.word.replace(/[^a-zA-Z]/g, '').length;
            
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
                    <div class="spell-hint">💡 提示：这个单词有 ${letterCount} 个字母</div>
                </div>
            `;

            // 自动播放发音（可在语音设置里关闭）
            if (SpeechHelper.settings.autoSpeak) {
                setTimeout(() => SpeechHelper.speakWord(currentWord.word), 300);
            }

            const input = document.getElementById('spellInput');
            input.focus();

            document.getElementById('spellAudioBtn').addEventListener('click', () => {
                SpeechHelper.speakWord(currentWord.word);
            });

            // solved 防止答对后 1.2 秒内重复提交，导致连跳多题
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
                    if (!triedWrong) firstTryCorrect++;
                    SpeechHelper.speak('Excellent!');
                    setTimeout(() => {
                        currentIndex++;
                        renderQuestion();
                    }, 1200);
                } else {
                    triedWrong = true;
                    mistakes++;
                    input.style.borderColor = '#EF4444';
                    input.style.color = '#EF4444';
                    SpeechHelper.speak('Almost! Listen again.');
                    setTimeout(() => {
                        input.style.borderColor = 'var(--color-blue)';
                        input.style.color = 'var(--color-text)';
                        // 仅在题目仍未切换时重读单词，避免切走后残留发音
                        if (!solved && document.getElementById('spellInput') === input) {
                            SpeechHelper.speakWord(currentWord.word);
                        }
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
        let mistakes = 0;
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

                            if (matchedPairs === words.length) {
                                setTimeout(() => {
                                    const stars = this.completeGame(mistakes);
                                    App.showModal('🎉', '记忆超群！', `得分 ${this.gameScore} 分，获得 ${stars} 颗星星！`);
                                    App.createConfetti();
                                }, 500);
                            }
                        }, 600);
                    } else {
                        // 配对失败
                        mistakes++;
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
    },

    // ============== 字母拼拼乐游戏 ==============
    initFillWordGame: function() {
        // 从当前单元或同年级取 6 个纯字母单词（过滤掉空格的短语）
        const words = this.getGameWords(10).filter(w => /^[a-zA-Z]+$/.test(w.word)).slice(0, 6);
        if (words.length < 3) {
            App.showModal('😅', '词汇不够', '当前年级适合的单词太少，换个年级试试吧');
            return;
        }

        let currentIndex = 0;
        let firstTryCorrect = 0;
        let mistakes = 0;
        const content = document.getElementById('gameContent');

        const renderQuestion = () => {
            if (currentIndex >= words.length) {
                setTimeout(() => {
                    const stars = this.completeGame(mistakes);
                    App.showModal('🎉', '拼词完成！', `一次拼对 ${firstTryCorrect}/${words.length}，得分 ${this.gameScore}，获得 ${stars} 颗星星！`);
                }, 500);
                return;
            }

            const currentWord = words[currentIndex];
            const target = currentWord.word.toLowerCase();
            const targetLetters = target.split('');

            // 生成干扰字母池（从同年级其他单词里随机取）
            const otherWords = words.filter(w => w.word !== currentWord.word);
            const extraLetters = [];
            for (let i = 0; i < Math.min(2, otherWords.length); i++) {
                const lw = otherWords[i].word.toLowerCase();
                if (lw && /^[a-z]+$/.test(lw)) {
                    // 取第一个不重复的字母
                    for (const ch of lw) {
                        if (!targetLetters.includes(ch) && !extraLetters.includes(ch)) {
                            extraLetters.push(ch);
                            break;
                        }
                    }
                }
            }
            // 把干扰字母凑到至少 2 个
            const allUsed = new Set(targetLetters);
            const alphabet = 'abcdefghijklmnopqrstuvwxyz';
            while (extraLetters.length < 2) {
                const ch = alphabet[Math.floor(Math.random() * 26)];
                if (!allUsed.has(ch) && !extraLetters.includes(ch)) extraLetters.push(ch);
            }

            // 打乱
            const pool = [...targetLetters, ...extraLetters].sort(() => Math.random() - 0.5);

            content.innerHTML = `
                <div class="fillword-container">
                    <h3 style="margin-bottom: 16px; color: #6B7280;">第 ${currentIndex + 1} / ${words.length} 题</h3>
                    <div style="font-size: 80px; margin-bottom: 8px;">${currentWord.emoji}</div>
                    <p style="font-size: 24px; margin-bottom: 8px;">${currentWord.cn}</p>
                    <button class="guess-audio-btn" id="fillAudioBtn" style="font-size: 40px; padding: 16px;">🔊</button>

                    <!-- 答案槽 -->
                    <div class="fillword-slots" id="fillSlots">
                        ${targetLetters.map((_, i) => `<div class="fill-slot" data-slot="${i}"></div>`).join('')}
                    </div>

                    <!-- 字母池 -->
                    <div class="fillword-pool" id="fillPool">
                        ${pool.map((ch, i) => `<button class="fill-letter" data-letter="${ch}" data-pool-idx="${i}">${ch}</button>`).join('')}
                    </div>

                    <button class="fillword-undo" id="fillUndoBtn">↩️ 撤回</button>
                </div>
            `;

            // 自动播放发音
            if (SpeechHelper.settings.autoSpeak) {
                setTimeout(() => SpeechHelper.speakWord(currentWord.word), 300);
            }
            document.getElementById('fillAudioBtn').onclick = () => SpeechHelper.speakWord(currentWord.word);

            // 游戏状态
            const answerSlots = Array(targetLetters.length).fill(null);
            const usedPoolIdx = new Set();
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
                        // 禁用所有剩余字母按钮
                        document.querySelectorAll('.fill-letter').forEach(b => {
                            if (!usedPoolIdx.has(Number(b.dataset.poolIdx))) b.disabled = true;
                        });
                        this.updateScore(triedWrong ? 8 : 15);
                        if (!triedWrong) firstTryCorrect++;
                        SpeechHelper.speak('Excellent!');
                        setTimeout(() => {
                            currentIndex++;
                            renderQuestion();
                        }, 1200);
                    } else {
                        triedWrong = true;
                        mistakes++;
                        // 全槽闪红，然后清空重来
                        document.querySelectorAll('.fill-slot').forEach(s => s.classList.add('shake'));
                        SpeechHelper.speak('Almost!');
                        setTimeout(() => {
                            document.querySelectorAll('.fill-slot').forEach(s => s.classList.remove('shake'));
                            answerSlots.fill(null);
                            usedPoolIdx.clear();
                            document.querySelectorAll('.fill-letter').forEach(b => {
                                b.classList.remove('used');
                                b.disabled = false;
                            });
                            renderSlots();
                        }, 600);
                    }
                }
            };

            // 点击字母 → 填入第一个空槽
            document.querySelectorAll('.fill-letter').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (solved) return;
                    const poolIdx = Number(btn.dataset.poolIdx);
                    if (usedPoolIdx.has(poolIdx)) return;
                    // 找第一个空槽
                    const emptyIdx = answerSlots.findIndex(s => s === null);
                    if (emptyIdx === -1) return;
                    answerSlots[emptyIdx] = btn.dataset.letter;
                    usedPoolIdx.add(poolIdx);
                    btn.classList.add('used');
                    btn.disabled = true;
                    renderSlots();
                    checkFull();
                });
            });

            // 撤回最后一个字母
            document.getElementById('fillUndoBtn').addEventListener('click', () => {
                if (solved) return;
                const lastFilled = answerSlots.map((s, i) => s !== null ? i : -1).filter(i => i >= 0).pop();
                if (lastFilled === undefined) return;
                const letter = answerSlots[lastFilled];
                answerSlots[lastFilled] = null;
                // 找回对应按钮
                document.querySelectorAll('.fill-letter').forEach(b => {
                    if (b.dataset.letter === letter && b.classList.contains('used')) {
                        usedPoolIdx.delete(Number(b.dataset.poolIdx));
                        b.classList.remove('used');
                        b.disabled = false;
                    }
                });
                renderSlots();
            });
        };

        renderQuestion();
    }
};

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
