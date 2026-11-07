/* ========================================
   趣味英语乐园 - 趣味乐园模块（v1.4.0）
   宠物养成 / 间隔复习 / Phonics / 绘本 / 句型 / 儿歌 / 配音
   依赖：data.js、content.js、speech.js、app.js
   ======================================== */

const Play = {
    // 当前玩法内部状态
    phonicsIndex: 0,
    phonicsStep: 0,
    storyId: null,
    storyPage: 0,
    patternIndex: 0,
    chantIndex: 0,
    dubSceneId: null,
    reviewWords: [],
    reviewIndex: 0,
    reviewCorrect: [],
    timers: [],
    recorder: null,
    recorderStream: null,
    recorderChunks: [],

    MODE_TITLES: {
        map: '',
        phonics: '🔤 Phonics · 自然拼读',
        story: '📖 Story Book · 绘本小剧场',
        pattern: '🧩 Pattern Play · 句型换词',
        chant: '🎵 Chant Time · 韵律儿歌',
        dub: '🎬 Little Voice · 小配音员',
        listen: '🎧 Ear Training · 磨耳朵听力',
        quest: '🎭 Story Quest · 剧情冒险',
        weakbook: '📕 Weak Word Book · 弱项专练',
        stickers: '🏅 Sticker Album · 贴纸册',
        review: "🔁 Today's Review · 今日复习"
    },

    init: function() {
        if (this.initialized) return;
        this.initialized = true;
        document.querySelectorAll('.play-tab').forEach(btn => {
            btn.addEventListener('click', () => this.showMode(btn.dataset.mode));
        });
        const feedBtn = document.getElementById('petFeedBtn');
        if (feedBtn) feedBtn.addEventListener('click', () => this.feedPet());
        const reviewBtn = document.getElementById('reviewGoBtn');
        if (reviewBtn) reviewBtn.addEventListener('click', () => {
            App.showPage('learn');
            this.showMode('review');
        });
        this.renderPet();
        this.renderReviewCard();
    },

    stopAll: function() {
        this.timers.forEach(t => clearTimeout(t));
        this.timers = [];
        this.stopRecordingQuiet();
        SpeechHelper.stop();
        // 学习页的卡片/句子自动朗读定时器由 App 持有。直接点 play-tab 不经过 App.showPage，
        // 若不清理，300~400ms 后旧回调会在新玩法里读出上一关的单词。
        if (typeof App !== 'undefined') {
            App.speechToken++;
            if (App.autoSpeakTimer) { clearTimeout(App.autoSpeakTimer); App.autoSpeakTimer = null; }
            App.clearSentenceSpeakTimer();
        }
        // 盲听用独立可取消定时器推进；离开玩法时连代次一起作废，
        // 避免旧语音的 onend 回调又重新挂上一个新定时器
        if (typeof Listening !== 'undefined' && Listening.cancelBlind) Listening.cancelBlind();
    },

    later: function(fn, ms) {
        const t = setTimeout(() => {
            this.timers = this.timers.filter(x => x !== t);
            fn();
        }, ms);
        this.timers.push(t);
        return t;
    },

    // ============== 模式切换 ==============
    showMode: function(mode) {
        this.stopAll();
        // 切换玩法等于结束上一轮练习，连击从头开始，徽标也不残留
        if (typeof Combo !== 'undefined') Combo.reset();
        App.playMode = mode;
        document.querySelectorAll('.play-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });

        const stage = document.getElementById('playStage');
        if (mode === 'map') {
            stage.hidden = true;
            stage.innerHTML = '';
            if (App.currentGrade) App.showLevelMap();
            else App.renderLearnEmptyState();
            return;
        }

        document.getElementById('levelMap').hidden = true;
        document.getElementById('cardContainer').hidden = true;
        document.getElementById('sentenceStage').hidden = true;
        document.getElementById('cardControls').style.display = 'none';
        stage.hidden = false;
        document.getElementById('learnTitle').textContent = this.MODE_TITLES[mode] || '趣味乐园';
        document.getElementById('learnBack').textContent = '🗺️ 关卡地图';
        this.render(mode);
    },

    render: function(mode) {
        switch (mode) {
            case 'phonics': this.renderPhonicsList(); break;
            case 'story': this.renderStoryList(); break;
            case 'pattern': this.renderPattern(); break;
            case 'chant': this.renderChant(); break;
            case 'dub': this.renderDub(); break;
            case 'listen': if (typeof Listening !== 'undefined') Listening.renderMenu(); break;
            case 'quest': if (typeof Quest !== 'undefined') Quest.renderList(); break;
            case 'weakbook': if (typeof WeakBook !== 'undefined') WeakBook.render(); break;
            case 'stickers': if (typeof Stickers !== 'undefined') Stickers.renderAlbum(); break;
            case 'review': this.renderReview(); break;
        }
    },

    cardHead: function(title, sub) {
        return `<div class="play-card-head"><span>${title}</span><span class="play-card-sub">${sub || ''}</span></div>`;
    },

    backToList: function(label) {
        return `<button class="play-btn ghost" id="playBackList">📚 ${label || '返回列表'}</button>`;
    },

    bindBack: function(mode) {
        const btn = document.getElementById('playBackList');
        if (btn) btn.onclick = () => this.render(mode);
    },

    // 统一发奖：同一玩法内容只在首次完成时给星星，并给宠物加点数
    reward: function(key, xp) {
        const d = App.userData;
        if (!d.playDone.includes(key)) {
            d.playDone.push(key);
            d.stars += 2;
            // 宠物经验同样只在首次完成给：不然「再玩一次」可以无限刷 petXp，
            // 满级后还会每次都写一次存档
            this.addXp(xp || 2);
            App.saveUserData();
            App.updateStats();
        }
        if (typeof Stickers !== 'undefined') Stickers.refresh();
    },

    // ============== 1. 单词宠物 ==============
    petStage: function(xp) {
        let idx = 0;
        for (let i = 0; i < PET_STAGES.length; i++) {
            if (xp >= PET_STAGES[i].min) idx = i;
        }
        return idx;
    },

    renderPet: function() {
        const d = App.userData;
        const xp = d.petXp || 0;
        const idx = this.petStage(xp);
        const stage = PET_STAGES[idx];
        const next = PET_STAGES[idx + 1];
        const pct = next
            ? Math.round((xp - stage.min) / (next.min - stage.min) * 100)
            : 100;

        const emoji = document.getElementById('petEmoji');
        if (!emoji) return;
        emoji.textContent = stage.emoji;
        document.getElementById('petName').textContent = stage.name;
        document.getElementById('petFill').style.width = Math.max(0, Math.min(100, pct)) + '%';
        document.getElementById('petHint').textContent = next
            ? `${xp}/${next.min} XP · ${next.min - xp} more to grow!`
            : 'Max level! You are a super learner!';
        const feed = document.getElementById('petFeedBtn');
        if (feed) feed.disabled = !next;
    },

    addXp: function(amount) {
        const d = App.userData;
        const before = this.petStage(d.petXp || 0);
        d.petXp = (d.petXp || 0) + amount;
        const after = this.petStage(d.petXp);
        App.saveUserData();
        this.renderPet();
        if (after > before) {
            App.createConfetti(30);
            // 用轻提示而不是模态弹窗：不抢占通关弹窗队列、不打断闯关。
            // 这里刻意不朗读：speechSynthesis.cancel() 会掐掉孩子刚点的单词/句子示范发音。
            this.showGrowthToast(PET_STAGES[after]);
        }
    },

    showGrowthToast: function(stage) {
        document.querySelectorAll('.pet-levelup').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'pet-levelup';
        toast.setAttribute('role', 'status');
        toast.innerHTML = `<span class="plu-emoji">${stage.emoji}</span>
            <span class="plu-text"><b>Your pet grew up!</b><br>${SentenceLab.escapeHtml(stage.name)}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3800);
    },

    feedPet: function() {
        const d = App.userData;
        if (this.petStage(d.petXp || 0) >= PET_STAGES.length - 1) {
            App.showModal('🦄', 'Max level!', '你的宠物已经是最高形态啦，继续学单词收集星星吧！');
            return;
        }
        if (d.stars < PET_FEED_COST) {
            App.showModal('⭐', '星星不够', `喂一次需要 ${PET_FEED_COST} 颗星星，再学几个单词就有啦！`);
            return;
        }
        d.stars -= PET_FEED_COST;
        App.saveUserData();
        App.updateStats();
        this.addXp(PET_FEED_XP);
        const emoji = document.getElementById('petEmoji');
        if (emoji) {
            emoji.classList.remove('pet-bounce');
            void emoji.offsetWidth;
            emoji.classList.add('pet-bounce');
        }
    },

    // ============== 4. 间隔复习 ==============
    markWeak: function(key) {
        const d = App.userData;
        d.reviewSchedule[key] = { step: 0, due: PlayLab.today() };
        App.saveUserData();
        this.renderReviewCard();
    },

    unmarkWeak: function(key) {
        const d = App.userData;
        delete d.reviewSchedule[key];
        App.saveUserData();
        this.renderReviewCard();
    },

    getDueReviews: function() {
        const d = App.userData;
        const today = PlayLab.today();
        return (d.weakWords || []).filter(key => {
            const item = d.reviewSchedule[key];
            return !item || item.due <= today;
        });
    },

    renderReviewCard: function() {
        const el = document.getElementById('reviewCount');
        if (!el) return;
        const count = this.getDueReviews().length;
        el.textContent = count;
        const btn = document.getElementById('reviewGoBtn');
        if (btn) btn.disabled = count === 0;
        const card = document.getElementById('reviewCard');
        if (card) card.classList.toggle('all-done', count === 0);
    },

    renderReview: function() {
        const stage = document.getElementById('playStage');
        const due = this.getDueReviews();
        if (!due.length) {
            stage.innerHTML = `
                <div class="play-card">
                    ${this.cardHead("🔁 Today's Review", 'All clear!')}
                    <div class="play-big-emoji">🎓</div>
                    <div class="play-hint">No words to review today. Great job!</div>
                    ${this.backToList('返回关卡地图')}
                </div>`;
            const back = document.getElementById('playBackList');
            if (back) back.onclick = () => this.showMode('map');
            return;
        }

        this.reviewWords = due.slice(0, 8);
        this.reviewIndex = 0;
        this.reviewCorrect = [];
        this.renderReviewQuestion();
    },

    renderReviewQuestion: function() {
        const stage = document.getElementById('playStage');
        if (this.reviewIndex >= this.reviewWords.length) {
            this.finishReview();
            return;
        }
        const key = this.reviewWords[this.reviewIndex];
        const word = PlayLab.findWord(key);
        if (!word) {
            this.reviewIndex++;
            this.renderReviewQuestion();
            return;
        }
        // 干扰选项从同年级其他单词里取，全部是英文（无中文词义）
        const grade = key.split('-')[0];
        const gradeData = LEARNING_DATA[grade];
        const pool = [];
        if (gradeData) {
            Object.keys(gradeData.units).forEach(u => {
                gradeData.units[u].words.forEach(w => {
                    if (w.word !== word.word && !pool.some(p => p.word === w.word)) pool.push(w);
                });
            });
        }
        const options = PlayLab.shuffle([word].concat(PlayLab.shuffle(pool).slice(0, 2)));

        stage.innerHTML = `
            <div class="play-card">
                ${this.cardHead("🔁 Today's Review", `${this.reviewIndex + 1} / ${this.reviewWords.length}`)}
                <div class="play-big-emoji">${word.emoji}</div>
                <button class="play-audio" id="reviewAudio">🔊 Listen</button>
                <div class="play-hint">Which word is this picture?</div>
                <div class="review-options">
                    ${options.map(o => `<button class="review-option" data-word="${SentenceLab.escapeHtml(o.word)}">${SentenceLab.escapeHtml(o.word)}</button>`).join('')}
                </div>
                <div class="play-feedback" id="reviewFeedback"></div>
            </div>`;

        const speak = () => SpeechHelper.speakWord(word.word);
        document.getElementById('reviewAudio').onclick = speak;
        if (SpeechHelper.settings.autoSpeak) this.later(speak, 350);

        document.querySelectorAll('.review-option').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                const feedback = document.getElementById('reviewFeedback');
                if (btn.dataset.word === word.word) {
                    btn.classList.add('correct');
                    feedback.textContent = '⭐ Excellent! ' + word.word;
                    SpeechHelper.speakWord(word.word);
                    this.reviewCorrect.push(key);
                    this.onReviewCorrect(key);
                    document.querySelectorAll('.review-option').forEach(b => { b.disabled = true; });
                    this.later(() => { this.reviewIndex++; this.renderReviewQuestion(); }, 900);
                } else {
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    feedback.textContent = 'Try again! Listen once more 🙈';
                    this.onReviewWrong(key);
                    speak();
                }
            };
        });
    },

    onReviewCorrect: function(key) {
        const d = App.userData;
        const item = d.reviewSchedule[key] || { step: 0, due: PlayLab.today() };
        item.step = (item.step || 0) + 1;
        if (item.step > REVIEW_INTERVALS.length) {
            // 完整走完 1/2/4/7/15 天五轮还记得，正式毕业，自动移出错词本
            d.weakWords = d.weakWords.filter(k => k !== key);
            delete d.reviewSchedule[key];
            d.stars += 2;
        } else {
            // step 由 0 变 1 时排 1 天后，依次 2/4/7 天，第 5 次答对毕业
            item.due = PlayLab.addDays(REVIEW_INTERVALS[item.step - 1]);
            d.reviewSchedule[key] = item;
            d.stars += 1;
        }
        App.saveUserData();
        App.updateStats();
        this.addXp(1);
        this.renderReviewCard();
    },

    onReviewWrong: function(key) {
        const d = App.userData;
        d.reviewSchedule[key] = { step: 0, due: PlayLab.addDays(1) };
        App.saveUserData();
        this.renderReviewCard();
    },

    finishReview: function() {
        const stage = document.getElementById('playStage');
        const d = App.userData;
        const graduated = this.reviewCorrect.filter(k => !d.weakWords.includes(k)).length;
        App.createConfetti(25);
        stage.innerHTML = `
            <div class="play-card">
                ${this.cardHead("🔁 Today's Review", 'Finished!')}
                <div class="play-big-emoji">${graduated ? '🎓' : '🌟'}</div>
                <div class="play-hint">Great work! ${graduated} words graduated from your weak list.</div>
                <div class="play-actions">
                    <button class="play-btn" id="reviewAgain">🔁 再练一轮</button>
                    <button class="play-btn primary" id="reviewBack">🗺️ 关卡地图</button>
                </div>
            </div>`;
        document.getElementById('reviewAgain').onclick = () => this.renderReview();
        document.getElementById('reviewBack').onclick = () => this.showMode('map');
    },

    // ============== 5. Phonics 自然拼读 ==============
    renderPhonicsList: function() {
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-list">
                ${PHONICS_DATA.map((d, i) => `
                    <button class="play-list-card ${App.userData.playDone.includes('ph-' + d.id) ? 'done' : ''}"
                            data-index="${i}">
                        <span class="plc-emoji">${d.emoji}</span>
                        <span class="plc-title">${d.sound}</span>
                        <span class="plc-sub">Letter ${d.letter.toUpperCase()}</span>
                        ${App.userData.playDone.includes('ph-' + d.id) ? '<span class="plc-check">✓</span>' : ''}
                    </button>`).join('')}
            </div>`;
        stage.querySelectorAll('[data-index]').forEach(btn => {
            btn.onclick = () => { this.phonicsIndex = Number(btn.dataset.index); this.phonicsStep = 0; this.renderPhonicsStep(); };
        });
    },

    renderPhonicsStep: function() {
        const d = PHONICS_DATA[this.phonicsIndex];
        const stage = document.getElementById('playStage');
        const head = this.cardHead('🔤 Phonics', `${this.phonicsIndex + 1} / ${PHONICS_DATA.length} · ${d.sound}`);

        if (this.phonicsStep === 0) {
            stage.innerHTML = `
                <div class="play-card">
                    ${head}
                    <div class="play-big-emoji">${d.emoji}</div>
                    <div class="play-hint">Listen! Which letter starts these words?</div>
                    <div class="play-examples">
                        ${d.examples.map(e => `<div class="play-example"><span>${e.emoji}</span><span>${SentenceLab.escapeHtml(e.word)}</span></div>`).join('')}
                    </div>
                    <button class="play-audio" id="phAudio">🔊 Listen</button>
                    <div class="play-choices">
                        ${PlayLab.shuffle(d.choices).map(c => `<button class="play-choice" data-letter="${c}">${c.toUpperCase()}</button>`).join('')}
                    </div>
                    <div class="play-feedback" id="phFeedback"></div>
                    ${this.backToList('音素列表')}
                </div>`;
            const speak = () => SpeechHelper.speak(d.examples.map(e => e.word).join(', '));
            document.getElementById('phAudio').onclick = speak;
            if (SpeechHelper.settings.autoSpeak) this.later(speak, 350);
            stage.querySelectorAll('.play-choice').forEach(btn => {
                btn.onclick = () => {
                    const fb = document.getElementById('phFeedback');
                    if (btn.dataset.letter === d.letter) {
                        btn.classList.add('correct');
                        fb.textContent = `⭐ Yes! ${d.letter.toUpperCase()} starts ${d.examples[0].word}.`;
                        SpeechHelper.speakWord(d.examples[0].word);
                        stage.querySelectorAll('.play-choice').forEach(b => { b.disabled = true; });
                        this.later(() => { this.phonicsStep = 1; this.renderPhonicsStep(); }, 900);
                    } else {
                        btn.classList.add('wrong');
                        btn.disabled = true;
                        fb.textContent = 'Try another letter 🙈';
                    }
                };
            });
            this.bindBack('phonics');
            return;
        }

        // 第二步：按字母顺序拼出 CVC 单词
        stage.innerHTML = `
            <div class="play-card">
                ${head}
                <div class="play-big-emoji">${d.build.emoji}</div>
                <div class="play-hint">Tap the letters in order to build the word!</div>
                <div class="sentence-slots" id="phSlots"></div>
                <div class="sentence-tiles" id="phTiles"></div>
                <div class="play-reveal" id="phReveal" hidden></div>
                <div class="play-actions" id="phActions"></div>
            </div>`;
        SentenceLab.renderPuzzle({
            text: d.build.letters.join(' '),
            slotsEl: document.getElementById('phSlots'),
            tilesEl: document.getElementById('phTiles'),
            onSolved: () => {
                const reveal = document.getElementById('phReveal');
                reveal.innerHTML = `<div class="play-word">${d.build.emoji} ${d.build.word.toUpperCase()}</div>`;
                reveal.hidden = false;
                SpeechHelper.speakWord(d.build.word);
                this.reward('ph-' + d.id, 3);
                App.createConfetti(16);
                const next = this.phonicsIndex + 1 < PHONICS_DATA.length;
                document.getElementById('phActions').innerHTML = `
                    ${next ? '<button class="play-btn primary" id="phNext">▶ 下一个音素</button>' : ''}
                    ${this.backToList('音素列表')}`;
                if (next) document.getElementById('phNext').onclick = () => {
                    this.phonicsIndex++;
                    this.phonicsStep = 0;
                    this.renderPhonicsStep();
                };
                this.bindBack('phonics');
            }
        });
    },

    // ============== 6. Emoji 绘本小剧场 ==============
    renderStoryList: function() {
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-list">
                ${STORY_DATA.map(s => `
                    <button class="play-list-card story-card ${App.userData.playDone.includes('story-' + s.id) ? 'done' : ''}"
                            data-id="${s.id}">
                        <span class="plc-emoji">${s.cover.join('')}</span>
                        <span class="plc-title">${SentenceLab.escapeHtml(s.title)}</span>
                        <span class="plc-sub">Grade ${s.grade} · ${s.pages.length} pages</span>
                        ${App.userData.playDone.includes('story-' + s.id) ? '<span class="plc-check">✓</span>' : ''}
                    </button>`).join('')}
            </div>`;
        stage.querySelectorAll('[data-id]').forEach(btn => {
            btn.onclick = () => { this.storyId = btn.dataset.id; this.storyPage = 0; this.renderStoryPage(); };
        });
    },

    renderStoryPage: function() {
        const s = STORY_DATA.find(x => x.id === this.storyId);
        const stage = document.getElementById('playStage');
        if (!s) { this.renderStoryList(); return; }

        if (this.storyPage >= s.pages.length) {
            stage.innerHTML = `
                <div class="play-card">
                    ${this.cardHead('📖 Story Book', SentenceLab.escapeHtml(s.title))}
                    <div class="play-big-emoji">❓</div>
                    <div class="play-hint">How does the story end? Pick one!</div>
                    <div class="story-endings">
                        ${s.endings.map((e, i) => `
                            <button class="story-ending" data-ending="${i}">
                                <span>${e.emoji}</span><span>${SentenceLab.escapeHtml(e.text)}</span>
                            </button>`).join('')}
                    </div>
                    <div class="play-actions" id="storyActions"></div>
                </div>`;
            stage.querySelectorAll('[data-ending]').forEach(btn => {
                btn.onclick = () => {
                    const e = s.endings[Number(btn.dataset.ending)];
                    stage.querySelectorAll('.story-ending').forEach(b => b.classList.remove('picked'));
                    btn.classList.add('picked');
                    SpeechHelper.speakSentence(e.text);
                    this.reward('story-' + s.id, 3);
                    App.createConfetti(22);
                    const next = STORY_DATA.findIndex(x => x.id === s.id) + 1 < STORY_DATA.length;
                    document.getElementById('storyActions').innerHTML = `
                        ${next ? '<button class="play-btn primary" id="storyNextBook">▶ 下一个故事</button>' : ''}
                        <button class="play-btn ghost" id="storyBackShelf">📚 返回书架</button>`;
                    if (next) document.getElementById('storyNextBook').onclick = () => {
                        this.storyId = STORY_DATA[STORY_DATA.findIndex(x => x.id === s.id) + 1].id;
                        this.storyPage = 0;
                        this.renderStoryPage();
                    };
                    document.getElementById('storyBackShelf').onclick = () => this.renderStoryList();
                };
            });
            return;
        }

        const page = s.pages[this.storyPage];
        const isLast = this.storyPage === s.pages.length - 1;
        stage.innerHTML = `
            <div class="play-card story-page-card">
                ${this.cardHead('📖 Story Book', `${SentenceLab.escapeHtml(s.title)} · ${this.storyPage + 1}/${s.pages.length}`)}
                <div class="story-scene">${SentenceLab.sceneHtml({ scene: page.scene, emoji: page.scene[0] })}</div>
                <div class="story-line">${SentenceLab.escapeHtml(page.text)}</div>
                <div class="play-actions">
                    <button class="play-btn" id="storyListen">🔊 Listen</button>
                    <button class="play-btn primary" id="storyNext">${isLast ? '❓ 选结局 ▶' : '下一格 ▶'}</button>
                </div>
                <button class="play-btn ghost" id="storyBackShelf">📚 返回书架</button>
            </div>`;
        const speak = () => SpeechHelper.speakSentence(page.text);
        document.getElementById('storyListen').onclick = speak;
        if (SpeechHelper.settings.autoSpeak) this.later(speak, 400);
        document.getElementById('storyNext').onclick = () => { this.storyPage++; this.renderStoryPage(); };
        document.getElementById('storyBackShelf').onclick = () => this.renderStoryList();
    },

    // ============== 7. 句型换词 ==============
    renderPattern: function() {
        const d = PATTERN_DATA[this.patternIndex] || PATTERN_DATA[0];
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-card">
                ${this.cardHead('🧩 Pattern Play', `${this.patternIndex + 1} / ${PATTERN_DATA.length}`)}
                <div class="pattern-sentence" id="patternSentence">${SentenceLab.escapeHtml(d.pattern)}</div>
                <div class="play-hint">Pick a picture to make your own sentence!</div>
                <div class="pattern-options">
                    ${d.options.map((o, i) => `
                        <button class="pattern-option" data-opt="${i}">
                            <span class="po-emoji">${o.emoji}</span>
                            <span class="po-word">${SentenceLab.escapeHtml(o.word)}</span>
                        </button>`).join('')}
                </div>
                <div class="play-reveal" id="patternReveal" hidden></div>
                <div class="play-actions" id="patternActions"></div>
                <div class="card-follow-hint" id="patternHint" hidden></div>
                <div class="play-actions">
                    <button class="play-btn ghost" id="patternPrev">◀ 上一个</button>
                    <button class="play-btn ghost" id="patternNext">下一个 ▶</button>
                </div>
            </div>`;

        stage.querySelectorAll('[data-opt]').forEach(btn => {
            btn.onclick = () => {
                const opt = d.options[Number(btn.dataset.opt)];
                const full = d.pattern.replace('___', opt.word);
                stage.querySelectorAll('.pattern-option').forEach(b => b.classList.remove('picked'));
                btn.classList.add('picked');
                const reveal = document.getElementById('patternReveal');
                reveal.innerHTML = `<div class="play-word">${opt.emoji} ${SentenceLab.escapeHtml(full)}</div>`;
                reveal.hidden = false;
                SpeechHelper.speakSentence(full);
                this.reward('pt-' + d.id + '-' + opt.word, 2);
                document.getElementById('patternActions').innerHTML = `
                    <button class="play-btn" id="patternAgain">🔊 Listen again</button>
                    <button class="play-btn primary" id="patternSay">🗣️ Say it!</button>`;
                document.getElementById('patternAgain').onclick = () => SpeechHelper.speakSentence(full);
                document.getElementById('patternSay').onclick = () =>
                    App.followReadText(full, document.getElementById('patternHint'), opt.word);
            };
        });
        document.getElementById('patternPrev').onclick = () => {
            this.patternIndex = (this.patternIndex - 1 + PATTERN_DATA.length) % PATTERN_DATA.length;
            this.renderPattern();
        };
        document.getElementById('patternNext').onclick = () => {
            this.patternIndex = (this.patternIndex + 1) % PATTERN_DATA.length;
            this.renderPattern();
        };
    },

    // ============== 8. 韵律儿歌 ==============
    renderChant: function() {
        const c = CHANT_DATA[this.chantIndex] || CHANT_DATA[0];
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-card chant-card">
                ${this.cardHead('🎵 Chant Time', `${this.chantIndex + 1} / ${CHANT_DATA.length}`)}
                <div class="play-big-emoji">${c.cover}</div>
                <div class="chant-title">${SentenceLab.escapeHtml(c.title)}</div>
                <div class="chant-lines" id="chantLines">
                    ${c.lines.map((l, i) => `
                        <div class="chant-line" data-line="${i}">
                            <span class="cl-emoji">${l.emoji}</span>
                            <span class="cl-text">${SentenceLab.escapeHtml(l.text)}</span>
                            <span class="cl-clap">👏</span>
                        </div>`).join('')}
                </div>
                <div class="play-actions">
                    <button class="play-btn primary" id="chantPlay">▶ 一起念</button>
                    <button class="play-btn" id="chantStop">⏹️ 停一下</button>
                    <button class="play-btn ghost" id="chantNext">下一首 ▶</button>
                </div>
            </div>`;
        document.getElementById('chantPlay').onclick = () => this.playChantLines();
        document.getElementById('chantStop').onclick = () => {
            this.stopAll();
            stage.querySelectorAll('.chant-line').forEach(el => el.classList.remove('active'));
        };
        document.getElementById('chantNext').onclick = () => {
            this.chantIndex = (this.chantIndex + 1) % CHANT_DATA.length;
            this.renderChant();
        };
        if (SpeechHelper.settings.autoSpeak) this.later(() => this.playChantLines(), 500);
    },

    playChantLines: function() {
        const c = CHANT_DATA[this.chantIndex] || CHANT_DATA[0];
        this.stopAll();
        const lines = Array.from(document.querySelectorAll('.chant-line'));
        let idx = 0;
        const step = () => {
            lines.forEach(el => el.classList.remove('active'));
            if (idx >= c.lines.length) {
                this.reward('chant-' + c.id, 2);
                return;
            }
            const line = c.lines[idx];
            const el = lines[idx];
            if (el) el.classList.add('active');
            SpeechHelper.speak(line.text, { rate: 0.75, pitch: 1.2 });
            idx++;
            // 长句多留一点时间，避免上一行还没念完就被下一行打断
            this.later(step, Math.max(1500, line.text.length * 75));
        };
        step();
    },

    // ============== 10. 小配音员 ==============
    renderDub: function() {
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-list">
                ${DUB_SCENES.map(s => `
                    <button class="play-list-card dub-card" data-id="${s.id}">
                        <span class="plc-emoji">${s.scene.join('')}</span>
                        <span class="plc-title">${SentenceLab.escapeHtml(s.prompt)}</span>
                        <span class="plc-sub">Say one English sentence!</span>
                    </button>`).join('')}
            </div>
            <div class="dub-my-list" id="dubMyList"></div>`;
        stage.querySelectorAll('[data-id]').forEach(btn => {
            btn.onclick = () => { this.dubSceneId = btn.dataset.id; this.renderDubScene(); };
        });
        this.renderDubMyList();
    },

    renderDubMyList: function() {
        const box = document.getElementById('dubMyList');
        if (!box) return;
        const dubs = App.userData.dubs || [];
        box.innerHTML = `
            <div class="dub-my-title">🎧 My Voice (${dubs.length})</div>
            ${dubs.length ? dubs.slice().reverse().map(item => `
                <div class="dub-item">
                    <span class="dub-item-emoji">${(item.scene || ['🎬']).join('')}</span>
                    <span class="dub-item-text">${SentenceLab.escapeHtml(item.prompt || '')}</span>
                    <button class="dub-play" data-play="${item.id}">▶️</button>
                    <button class="dub-del" data-del="${item.id}">✕</button>
                </div>`).join('') : '<div class="dub-empty">Pick a scene and record your first sentence!</div>'}`;
        box.querySelectorAll('[data-play]').forEach(btn => {
            btn.onclick = () => {
                const item = (App.userData.dubs || []).find(x => x.id === btn.dataset.play);
                if (item && item.audio) new Audio(item.audio).play();
            };
        });
        box.querySelectorAll('[data-del]').forEach(btn => {
            btn.onclick = () => {
                App.userData.dubs = (App.userData.dubs || []).filter(x => x.id !== btn.dataset.del);
                App.saveUserData();
                this.renderDubMyList();
                App.updateWordList();
            };
        });
    },

    renderDubScene: function() {
        const s = DUB_SCENES.find(x => x.id === this.dubSceneId) || DUB_SCENES[0];
        const stage = document.getElementById('playStage');
        stage.innerHTML = `
            <div class="play-card">
                ${this.cardHead('🎬 Little Voice', 'Say it out loud!')}
                <div class="story-scene">${SentenceLab.sceneHtml({ scene: s.scene, emoji: s.scene[0] })}</div>
                <div class="play-hint">${SentenceLab.escapeHtml(s.prompt)}</div>
                <button class="play-audio" id="dubSample">🔊 Listen to a sample</button>
                <div class="dub-sample">${SentenceLab.escapeHtml(s.sample)}</div>
                <div class="play-actions">
                    <button class="play-btn primary" id="dubRecord">🎙️ 开始配音</button>
                    <button class="play-btn ghost" id="dubBack">🎬 换场景</button>
                </div>
                <div class="play-feedback" id="dubFeedback"></div>
                <div class="play-actions" id="dubResult"></div>
            </div>`;
        document.getElementById('dubSample').onclick = () => SpeechHelper.speakSentence(s.sample);
        if (SpeechHelper.settings.autoSpeak) this.later(() => SpeechHelper.speakSentence(s.sample), 400);
        document.getElementById('dubRecord').onclick = () => this.startDubRecording(s);
        document.getElementById('dubBack').onclick = () => this.renderDub();
    },

    startDubRecording: function(s) {
        const feedback = document.getElementById('dubFeedback');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            App.showModal('⚠️', '录音不可用', '你的浏览器不支持录音，试试 Chrome 或 Edge 桌面版！');
            return;
        }
        if (this.recorder && this.recorder.state === 'recording') {
            this.recorder.stop();
            return;
        }
        if ((App.userData.dubs || []).length >= 20) {
            App.showModal('⚠️', '配音集满啦', '最多保存 20 段配音，先删掉几段再录吧~');
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            this.recorderStream = stream;
            this.recorderChunks = [];
            this.recorder = new MediaRecorder(stream);
            this.recorder.ondataavailable = e => {
                if (e.data.size > 0) this.recorderChunks.push(e.data);
            };
            this.recorder.onstop = () => {
                if (this.recorderStream) {
                    this.recorderStream.getTracks().forEach(t => t.stop());
                    this.recorderStream = null;
                }
                if (!this.recorderChunks.length) return;
                const blob = new Blob(this.recorderChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => this.saveDub(s, reader.result);
                reader.readAsDataURL(blob);
            };
            this.recorder.start();
            const btn = document.getElementById('dubRecord');
            if (btn) { btn.textContent = '⏹️ 录好了'; btn.classList.add('recording'); }
            feedback.textContent = '🎙️ Recording... Say one English sentence! (max 10s)';
            this.later(() => {
                if (this.recorder && this.recorder.state === 'recording') this.recorder.stop();
            }, 10000);
        }).catch(() => {
            App.showModal('⚠️', '无法录音', '请允许浏览器使用麦克风权限');
        });
    },

    stopRecordingQuiet: function() {
        if (this.recorder && this.recorder.state === 'recording') {
            this.recorder.onstop = null;
            this.recorder.stop();
        }
        if (this.recorderStream) {
            this.recorderStream.getTracks().forEach(t => t.stop());
            this.recorderStream = null;
        }
    },

    saveDub: function(s, audio) {
        const item = {
            id: 'dub-' + Date.now(),
            sceneId: s.id,
            scene: s.scene,
            prompt: s.prompt,
            sample: s.sample,
            audio: audio,
            date: PlayLab.today()
        };
        App.userData.dubs.push(item);
        if (!App.saveUserData()) {
            // 容量不足时回滚，避免界面显示成功但重载后作品消失
            App.userData.dubs.pop();
            return;
        }
        this.reward('dub-' + s.id, 3);
        App.createConfetti(16);
        const feedback = document.getElementById('dubFeedback');
        if (feedback) feedback.textContent = '⭐ Great job! Your voice is saved.';
        const result = document.getElementById('dubResult');
        if (result) {
            result.innerHTML = `
                <button class="play-btn" id="dubPlayNew">▶️ 听听我的配音</button>
                <button class="play-btn" id="dubRetry">🔁 再录一次</button>`;
            document.getElementById('dubPlayNew').onclick = () => new Audio(item.audio).play();
            document.getElementById('dubRetry').onclick = () => this.renderDubScene();
        }
        const recordBtn = document.getElementById('dubRecord');
        if (recordBtn) { recordBtn.textContent = '🎙️ 开始配音'; recordBtn.classList.remove('recording'); }
        this.renderDubMyList();
        App.updateWordList();
    },

    // 成就页「我的配音」Tab
    renderDubList: function(container) {
        const dubs = App.userData.dubs || [];
        if (!dubs.length) {
            container.innerHTML = '<div class="word-list-empty">还没有配音哦 🎬 去「趣味乐园 → 小配音员」录一句英文吧！</div>';
            return;
        }
        container.innerHTML = dubs.slice().reverse().map(item => `
            <div class="word-list-item dub-list-item">
                <span class="wli-emoji">${(item.scene || ['🎬']).join('')}</span>
                <span class="wli-word">${SentenceLab.escapeHtml(item.prompt || '')}</span>
                <span class="wli-sentence">${SentenceLab.escapeHtml(item.sample || '')}</span>
                <span class="wli-loc">${item.date || ''}</span>
                <button class="dub-play" data-play="${item.id}" title="回放">▶️</button>
                <button class="wli-remove" data-del="${item.id}" title="删除">✕</button>
            </div>`).join('');
        container.querySelectorAll('[data-play]').forEach(btn => {
            btn.onclick = () => {
                const item = dubs.find(x => x.id === btn.dataset.play);
                if (item && item.audio) new Audio(item.audio).play();
            };
        });
        container.querySelectorAll('[data-del]').forEach(btn => {
            btn.onclick = () => {
                App.userData.dubs = dubs.filter(x => x.id !== btn.dataset.del);
                App.saveUserData();
                // updateWordList 会同时刷新 Tab 上的「🎬 配音 N」计数并重绘当前列表
                App.updateWordList();
            };
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof App !== 'undefined' && typeof LEARNING_DATA !== 'undefined') Play.init();
});
