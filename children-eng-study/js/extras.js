/* ========================================
   趣味英语乐园 - v1.5.0 扩展玩法
   Combo 连击 / 贴纸收集册 / 磨耳朵听力 /
   主题剧情冒险 / 弱项专练本
   依赖：data.js、content.js、speech.js、app.js、play.js
   ======================================== */

const escHtml = SentenceLab.escapeHtml;

// 底部浮动提示统一堆叠，避免「贴纸解锁」与「剧情鼓励」同时出现时互相遮挡
function stackToasts() {
    const list = Array.from(document.querySelectorAll('.sticker-toast, .quest-toast'));
    let offset = 100;
    list.forEach(el => {
        el.style.bottom = offset + 'px';
        // 首帧尚未布局 / 无布局引擎时 offsetHeight 为 0，给个兜底高度避免提示叠在一起
        offset += (el.offsetHeight || 64) + 12;
    });
}

/* ==========================================================
   0. Combo 连击系统
   连续答对累积连击，>2 显示徽标，>=3 分数 x1.5，>=6 分数 x2
   ========================================================== */
const Combo = {
    count: 0,
    best: 0,
    el: null,
    hideTimer: null,

    init: function() {
        this.el = document.getElementById('comboBadge');
    },

    // 一次新的闯关/练习开始
    startRun: function() {
        this.count = 0;
        this.best = 0;
        this.hide();
    },

    // 离开页面/玩法
    reset: function() {
        this.count = 0;
        this.hide();
    },

    multiplier: function() {
        if (this.count >= 6) return 2;
        if (this.count >= 3) return 1.5;
        return 1;
    },

    hit: function() {
        this.count++;
        if (this.count > this.best) this.best = this.count;
        this.render(false);
        return this.count;
    },

    miss: function() {
        if (this.count > 0) {
            this.count = 0;
            this.render(true);
        }
    },

    render: function(broken) {
        if (!this.el) this.el = document.getElementById('comboBadge');
        if (!this.el) return;
        if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }

        if (broken) {
            this.el.textContent = '💥 Combo lost';
            this.el.classList.add('lost');
            this.el.classList.add('show');
            this.el.classList.remove('pop');
            void this.el.offsetWidth;
            this.el.classList.add('pop');
            this.hideTimer = setTimeout(() => this.hide(), 1200);
            return;
        }

        if (this.count >= 2) {
            this.el.textContent = `🔥 Combo x${this.count}`;
            this.el.classList.remove('lost');
            this.el.classList.add('show');
            this.el.classList.remove('pop');
            void this.el.offsetWidth;
            this.el.classList.add('pop');
            this.hideTimer = setTimeout(() => {
                if (this.el) this.el.classList.remove('show');
            }, 2400);
        } else {
            this.el.classList.remove('show');
        }
    },

    hide: function() {
        if (!this.el) this.el = document.getElementById('comboBadge');
        if (this.el) this.el.classList.remove('show', 'lost', 'pop');
        if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    }
};

/* ==========================================================
   1. 贴纸收集册
   每达成一个里程碑解锁一张贴纸，集册展示
   ========================================================== */
const STICKER_DATA = [
    { id: 'st-first',   emoji: '🌱', name: 'First Step',      desc: 'Learn 1 word',            need: s => s.words >= 1 },
    { id: 'st-word10',  emoji: '🐣', name: 'Little Learner',  desc: 'Learn 10 words',          need: s => s.words >= 10 },
    { id: 'st-word30',  emoji: '📖', name: 'Word Explorer',   desc: 'Learn 30 words',          need: s => s.words >= 30 },
    { id: 'st-word60',  emoji: '📚', name: 'Bookworm',        desc: 'Learn 60 words',          need: s => s.words >= 60 },
    { id: 'st-word100', emoji: '🎓', name: 'Word Master',     desc: 'Learn 100 words',         need: s => s.words >= 100 },
    { id: 'st-word180', emoji: '👑', name: 'Vocabulary King', desc: 'Learn 180 words',         need: s => s.words >= 180 },
    { id: 'st-star30',  emoji: '⭐', name: 'Star Collector',  desc: 'Collect 30 stars',        need: s => s.stars >= 30 },
    { id: 'st-star100', emoji: '🌟', name: 'Shining Star',    desc: 'Collect 100 stars',       need: s => s.stars >= 100 },
    { id: 'st-streak3', emoji: '🔥', name: 'On Fire',         desc: 'Study 3 days in a row',   need: s => s.streak >= 3 },
    { id: 'st-streak7', emoji: '🏅', name: 'Week Hero',       desc: 'Study 7 days in a row',   need: s => s.streak >= 7 },
    { id: 'st-game1',   emoji: '🧩', name: 'Game Starter',    desc: 'Finish 1 game',           need: s => s.games >= 1 },
    { id: 'st-game10',  emoji: '🎮', name: 'Game Champ',      desc: 'Finish 10 games',         need: s => s.games >= 10 },
    { id: 'st-sent10',  emoji: '💬', name: 'Sentence Star',   desc: 'Build 10 sentences',      need: s => s.sentences >= 10 },
    { id: 'st-speak10', emoji: '🗣️', name: 'Brave Speaker',   desc: 'Speak 10 times',          need: s => s.speak >= 10 },
    { id: 'st-speak50', emoji: '🎤', name: 'Talkative',       desc: 'Speak 50 times',          need: s => s.speak >= 50 },
    { id: 'st-level10', emoji: '🗺️', name: 'Level 10',        desc: 'Clear 10 levels',         need: s => s.levels >= 10 },
    { id: 'st-level40', emoji: '🏆', name: 'Level 40',        desc: 'Clear 40 levels',         need: s => s.levels >= 40 },
    { id: 'st-phonics', emoji: '🔤', name: 'Phonics Pro',     desc: 'Finish all phonics',      need: s => s.phonicsAll },
    { id: 'st-story',   emoji: '📖', name: 'Story Lover',     desc: 'Finish all story books',  need: s => s.storyAll },
    { id: 'st-chant',   emoji: '🎵', name: 'Chant Fan',       desc: 'Finish all chants',       need: s => s.chantAll },
    { id: 'st-dub',     emoji: '🎬', name: 'Voice Actor',     desc: 'Record 1 dub',            need: s => s.dubs >= 1 },
    { id: 'st-pet1',    emoji: '🐥', name: 'Pet Friend',      desc: 'Grow your pet once',      need: s => s.petStage >= 1 },
    { id: 'st-pet2',    emoji: '🦜', name: 'Pet Pal',         desc: 'Grow your pet to stage 3', need: s => s.petStage >= 2 },
    { id: 'st-pet4',    emoji: '🦄', name: 'Magic Pet',       desc: 'Reach the magic form',    need: s => s.petStage >= 4 },
    { id: 'st-listen',  emoji: '🎧', name: 'Good Listener',   desc: 'Do the daily blind listen', need: s => s.listened >= 1 },
    { id: 'st-weak',    emoji: '📕', name: 'Practice Hero',   desc: 'Practice weak words',     need: s => s.weakPracticed >= 1 }
];

const Stickers = {
    stats: function() {
        const d = App.userData;
        const done = d.playDone || [];
        const petStage = (typeof Play !== 'undefined') ? Play.petStage(d.petXp || 0) : 0;
        return {
            words: d.totalWords || 0,
            stars: d.stars || 0,
            streak: d.streak || 0,
            games: d.totalGames || 0,
            sentences: (d.completedSentences || []).length,
            speak: d.totalSpeak || 0,
            levels: (d.completedLevels || []).length,
            dubs: (d.dubs || []).length,
            petStage: petStage,
            listened: d.listenDate ? 1 : 0,
            weakPracticed: d.weakPracticed || 0,
            phonicsAll: PHONICS_DATA.length > 0 && PHONICS_DATA.every(x => done.includes('ph-' + x.id)),
            storyAll: STORY_DATA.length > 0 && STORY_DATA.every(x => done.includes('story-' + x.id)),
            chantAll: CHANT_DATA.length > 0 && CHANT_DATA.every(x => done.includes('chant-' + x.id))
        };
    },

    owned: function() {
        return App.userData.stickers || [];
    },

    // 检查并解锁新贴纸；silent 用于启动时静默补齐，避免一次性弹一堆
    refresh: function(opts) {
        if (!App.userData) return [];
        const st = App.userData;
        if (!Array.isArray(st.stickers)) st.stickers = [];
        const stats = this.stats();
        const newly = [];
        STICKER_DATA.forEach(item => {
            if (!st.stickers.includes(item.id) && item.need(stats)) {
                st.stickers.push(item.id);
                newly.push(item);
            }
        });
        if (newly.length) {
            App.saveUserData();
            if (App.playMode === 'stickers' && typeof Play !== 'undefined') {
                // 贴纸册正在展示时立即刷新
                try { Play.render('stickers'); } catch (e) {}
            }
            if (!(opts && opts.silent)) this.announce(newly);
        }
        return newly;
    },

    announce: function(list) {
        if (!list || !list.length) return;
        document.querySelectorAll('.sticker-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'sticker-toast';
        toast.setAttribute('role', 'status');
        toast.innerHTML = `
            <div class="st-title">🎉 New Sticker${list.length > 1 ? 's' : ''}!</div>
            <div class="st-row">
                ${list.map(s => `<span class="st-chip"><span class="st-emoji">${s.emoji}</span>${escHtml(s.name)}</span>`).join('')}
            </div>`;
        document.body.appendChild(toast);
        stackToasts();
        setTimeout(() => toast.remove(), 3800);
        if (typeof App !== 'undefined') App.createConfetti(18);
        // 这里刻意不朗读英文：解锁常发生在「点发音 / 跟读」之后，
        // 语音会被 speechSynthesis.cancel() 打断，孩子就听不到单词发音了。
    },

    renderAlbum: function() {
        const stage = document.getElementById('playStage');
        const owned = this.owned();
        const total = STICKER_DATA.length;
        const pct = Math.round(owned.length / total * 100);
        stage.innerHTML = `
            <div class="play-card sticker-card">
                ${Play.cardHead('🏅 Sticker Album', `${owned.length} / ${total}`)}
                <div class="sticker-progress"><span style="width:${pct}%"></span></div>
                <div class="play-hint">Collect stickers by learning, playing and listening!</div>
                <div class="sticker-grid">
                    ${STICKER_DATA.map(d => {
                        const has = owned.includes(d.id);
                        return `<div class="sticker-cell ${has ? 'owned' : ''}">
                            <span class="sticker-emoji">${has ? d.emoji : '🔒'}</span>
                            <span class="sticker-name">${has ? escHtml(d.name) : '???'}</span>
                            <span class="sticker-need">${has ? 'Got it!' : escHtml(d.desc)}</span>
                        </div>`;
                    }).join('')}
                </div>
                <button class="play-btn ghost" id="stickerBack">🗺️ 关卡地图</button>
            </div>`;
        const back = document.getElementById('stickerBack');
        if (back) back.onclick = () => Play.showMode('map');
    }
};

/* ==========================================================
   2. 磨耳朵听力：每日盲听 / 听音选图 / 听写填空
   ========================================================== */
const Listening = {
    blindItems: [],
    blindIndex: 0,
    blindToken: 0,
    blindTimer: null,
    pickQueue: [],
    pickIndex: 0,
    pickCorrect: 0,
    dictQueue: [],
    dictIndex: 0,
    dictCorrect: 0,

    // 当前年级全部真实单词（去掉字母卡），无年级时用全库
    allWords: function() {
        const out = [];
        const seen = new Set();
        const grades = App.currentGrade ? [App.currentGrade] : Object.keys(LEARNING_DATA);
        grades.forEach(g => {
            const gd = LEARNING_DATA[g];
            if (!gd) return;
            Object.keys(gd.units).forEach(u => {
                gd.units[u].words.forEach(w => {
                    if (w.letterLower) return;
                    if (seen.has(w.word)) return;
                    seen.add(w.word);
                    out.push(Object.assign({}, w, { grade: g, unit: u }));
                });
            });
        });
        return out;
    },

    // 取 4 个选项：保证 emoji 不重复，避免出现两个相同图片
    pickOptions: function(target, pool) {
        const opts = [target];
        const usedEmoji = new Set([target.emoji]);
        const shuffled = PlayLab.shuffle(pool);
        for (let i = 0; i < shuffled.length && opts.length < 4; i++) {
            const w = shuffled[i];
            if (w.word === target.word || usedEmoji.has(w.emoji)) continue;
            usedEmoji.add(w.emoji);
            opts.push(w);
        }
        return PlayLab.shuffle(opts);
    },

    renderMenu: function() {
        const stage = document.getElementById('playStage');
        const today = PlayLab.today();
        const blindDone = App.userData.listenDate === today;
        const pet = PET_STAGES[Play.petStage(App.userData.petXp || 0)];
        const words = this.allWords();
        stage.innerHTML = `
            <div class="listen-hero">
                <div class="listen-pet">${pet.emoji}🎧</div>
                <div class="listen-hero-title">Ear Training</div>
                <div class="listen-hero-sub">Close your eyes and listen carefully!</div>
                <div class="listen-daily ${blindDone ? 'done' : ''}">
                    ${blindDone ? '✅ Today\'s blind listen is done' : '🎧 Daily blind listen: 6 sounds waiting'}
                </div>
            </div>
            <div class="listen-menu">
                <button class="listen-card" data-lmode="blind">
                    <span class="lc-emoji">🙈</span>
                    <span class="lc-title">每日盲听</span>
                    <span class="lc-sub">只看耳朵，不听图，磨耳朵</span>
                </button>
                <button class="listen-card" data-lmode="pick">
                    <span class="lc-emoji">👂</span>
                    <span class="lc-title">听音选图</span>
                    <span class="lc-sub">听单词，选出正确的图片</span>
                </button>
                <button class="listen-card" data-lmode="dictation">
                    <span class="lc-emoji">✍️</span>
                    <span class="lc-title">听写填空</span>
                    <span class="lc-sub">听发音，把单词拼出来</span>
                </button>
            </div>
            <div class="play-hint" style="text-align:center;margin-top:14px;">
                ${words.length} words ready · ${App.currentGrade ? LEARNING_DATA[App.currentGrade].name : 'All grades'}
            </div>`;
        stage.querySelectorAll('[data-lmode]').forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.lmode;
                if (mode === 'blind') this.startBlind();
                else if (mode === 'pick') this.startPick();
                else this.startDictation();
            };
        });
    },

    // ---------- 每日盲听 ----------
    buildBlind: function() {
        const grade = App.currentGrade || 1;
        const words = PlayLab.shuffle(this.allWords()).slice(0, 4);
        const sentences = PlayLab.shuffle(SentenceLab.pool(grade)).slice(0, 2);
        const items = words.map(w => ({ type: 'word', text: w.word, emoji: w.emoji }))
            .concat(sentences.map(s => ({ type: 'sentence', text: s.text, emoji: s.emoji })));
        return PlayLab.shuffle(items);
    },

    startBlind: function() {
        const items = this.buildBlind();
        if (!items.length) {
            App.showModal('😅', 'No words yet', '先选一个年级学几个单词，再来磨耳朵吧！');
            return;
        }
        this.clearBlindTimer();
        this.blindItems = items;
        this.blindIndex = 0;
        this.blindToken++;
        Combo.reset();
        this.playBlindSeq();
    },

    // 盲听推进用独立的可取消定时器（Play.later 无法单独取消），离开玩法后由 token/DOM 兜底终止
    clearBlindTimer: function() {
        if (this.blindTimer) {
            clearTimeout(this.blindTimer);
            this.blindTimer = null;
        }
    },

    // 离开玩法：连代次一起作废，旧语音的 onend 回调就不会再挂上新定时器
    cancelBlind: function() {
        this.blindToken++;
        this.clearBlindTimer();
    },

    playBlindSeq: function() {
        const stage = document.getElementById('playStage');
        if (this.blindIndex >= this.blindItems.length) {
            this.finishBlind();
            return;
        }
        const item = this.blindItems[this.blindIndex];
        const token = this.blindToken;
        stage.innerHTML = `
            <div class="play-card listen-player">
                ${Play.cardHead('🙈 Blind Listen', `${this.blindIndex + 1} / ${this.blindItems.length}`)}
                <div class="lp-wave">🎧</div>
                <div class="lp-dots">
                    ${this.blindItems.map((_, i) =>
                        `<span class="lp-dot ${i < this.blindIndex ? 'done' : (i === this.blindIndex ? 'on' : '')}"></span>`).join('')}
                </div>
                <div class="play-hint">Just listen 👂 No peeking!</div>
                <button class="play-audio" id="blindReplay">🔁 Play again</button>
            </div>`;

        // 一题只前进一次：语音播完后再留 0.6s 余量，长句不会被截断；
        // 点「Play again」会重置计时重新播，不会刚播一半就被切走
        let advanced = false;
        let playSeq = 0;   // 每次重播 +1，用于忽略被 cancel 掉的旧语音回调
        const advance = () => {
            if (advanced) return;
            advanced = true;
            this.clearBlindTimer();
            if (token !== this.blindToken) return;
            if (App.playMode !== 'listen') return;
            if (!document.getElementById('blindReplay')) return;
            this.blindIndex++;
            this.playBlindSeq();
        };
        const play = () => {
            if (advanced) return;
            const mySeq = ++playSeq;
            this.clearBlindTimer();
            // 兜底：语音不可用 / 静音异常时也能继续
            this.blindTimer = setTimeout(advance, Math.max(3600, item.text.length * 130));
            // 主动重播要绕开发音去重（600ms 内同文本会被跳过）
            SpeechHelper.lastSpeakKey = '';
            SpeechHelper.speak(item.text, { rate: 0.8 }).catch(() => {}).then(() => {
                if (token !== this.blindToken || advanced || mySeq !== playSeq) return;
                this.clearBlindTimer();
                this.blindTimer = setTimeout(advance, 600);
            });
        };

        const replay = document.getElementById('blindReplay');
        if (replay) replay.onclick = play;
        play();
    },

    finishBlind: function() {
        const stage = document.getElementById('playStage');
        this.clearBlindTimer();
        const today = PlayLab.today();
        const firstToday = App.userData.listenDate !== today;
        if (firstToday) {
            App.userData.listenDate = today;
            // 每日奖励用 listenDate 判定就够了。若按日期往 playDone 里塞 key，
            // 用得越久数组越长、存档越大，且每次都会多一次线性查找。
            App.userData.stars += 2;
            App.saveUserData();
            App.updateStats();
            Play.addXp(4);
            if (typeof Stickers !== 'undefined') Stickers.refresh();
        }
        App.createConfetti(20);
        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('🙈 Blind Listen', 'Finished!')}
                <div class="play-big-emoji">🎧</div>
                <div class="play-hint">${firstToday ? 'Great ears! You earned stars for today.' : 'Great ears! Practice makes perfect.'}</div>
                <div class="listen-reveal">
                    ${this.blindItems.map(it => `
                        <div class="lr-item">
                            <span class="lr-emoji">${it.emoji}</span>
                            <span class="lr-text">${escHtml(it.text)}</span>
                        </div>`).join('')}
                </div>
                <div class="play-actions">
                    <button class="play-btn" id="blindAgain">🔁 再听一遍</button>
                    <button class="play-btn ghost" id="blindBack">🎧 返回</button>
                </div>
            </div>`;
        document.getElementById('blindAgain').onclick = () => this.startBlind();
        document.getElementById('blindBack').onclick = () => this.renderMenu();
    },

    // ---------- 听音选图 ----------
    startPick: function() {
        this.pickQueue = PlayLab.shuffle(this.allWords()).slice(0, 6);
        if (!this.pickQueue.length) {
            App.showModal('😅', 'No words yet', '先选一个年级学几个单词，再来玩吧！');
            return;
        }
        this.pickIndex = 0;
        this.pickCorrect = 0;
        Combo.startRun();
        this.renderPick();
    },

    renderPick: function() {
        const stage = document.getElementById('playStage');
        if (this.pickIndex >= this.pickQueue.length) {
            this.finishPick();
            return;
        }
        const word = this.pickQueue[this.pickIndex];
        const options = this.pickOptions(word, this.allWords());

        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('👂 Listen & Pick', `${this.pickIndex + 1} / ${this.pickQueue.length}`)}
                <button class="play-audio" id="pickAudio">🔊 Listen</button>
                <div class="play-hint">Which picture did you hear?</div>
                <div class="listen-options">
                    ${options.map(o => `<button class="listen-opt" data-word="${escHtml(o.word)}">${o.emoji}</button>`).join('')}
                </div>
                <div class="play-feedback" id="pickFeedback"></div>
            </div>`;
        const speak = () => SpeechHelper.speakWord(word.word);
        document.getElementById('pickAudio').onclick = speak;
        if (SpeechHelper.settings.autoSpeak) Play.later(speak, 350);

        stage.querySelectorAll('.listen-opt').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                if (btn.dataset.word === word.word) {
                    btn.classList.add('correct');
                    Combo.hit();
                    this.pickCorrect++;
                    const fb = document.getElementById('pickFeedback');
                    if (fb) fb.textContent = '⭐ Yes! ' + word.word;
                    SpeechHelper.speakWord(word.word);
                    stage.querySelectorAll('.listen-opt').forEach(b => { b.disabled = true; });
                    Play.later(() => { this.pickIndex++; this.renderPick(); }, 900);
                } else {
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    Combo.miss();
                    const fb = document.getElementById('pickFeedback');
                    if (fb) fb.textContent = 'Try again! Listen once more 🙈';
                    speak();
                }
            };
        });
    },

    finishPick: function() {
        const stage = document.getElementById('playStage');
        Play.reward('listen-pick', 3);
        App.createConfetti(22);
        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('👂 Listen & Pick', 'Finished!')}
                <div class="play-big-emoji">🌟</div>
                <div class="play-hint">You got ${this.pickCorrect} / ${this.pickQueue.length} right!</div>
                <div class="play-actions">
                    <button class="play-btn" id="pickAgain">🔁 再玩一次</button>
                    <button class="play-btn ghost" id="pickBack">🎧 返回</button>
                </div>
            </div>`;
        document.getElementById('pickAgain').onclick = () => this.startPick();
        document.getElementById('pickBack').onclick = () => this.renderMenu();
    },

    // ---------- 听写填空 ----------
    startDictation: function() {
        this.dictQueue = PlayLab.shuffle(this.allWords().filter(w => /^[a-zA-Z]+$/.test(w.word))).slice(0, 5);
        if (!this.dictQueue.length) {
            App.showModal('😅', 'No words yet', '先选一个年级学几个单词，再来听写吧！');
            return;
        }
        this.dictIndex = 0;
        this.dictCorrect = 0;
        Combo.startRun();
        this.renderDictation();
    },

    renderDictation: function() {
        const stage = document.getElementById('playStage');
        if (this.dictIndex >= this.dictQueue.length) {
            this.finishDictation();
            return;
        }
        const word = this.dictQueue[this.dictIndex];
        const letters = word.word.replace(/[^a-zA-Z]/g, '').length;

        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('✍️ Dictation', `${this.dictIndex + 1} / ${this.dictQueue.length}`)}
                <div class="dict-blanks">${Array.from({ length: letters }, () => '<span class="dict-blank"></span>').join('')}</div>
                <div class="play-actions" style="margin-top:6px;">
                    <button class="play-audio" id="dictAudio" style="margin:0;">🔊 Listen</button>
                    <button class="play-audio" id="dictSlow" style="margin:0;">🐢 Slow</button>
                </div>
                <div class="play-hint">Type the word you hear. ${letters} letters.</div>
                <div class="dict-input-row">
                    <input type="text" class="dict-input" id="dictAnswer" placeholder="Type here" autocomplete="off" spellcheck="false">
                    <button class="play-btn primary" id="dictCheck">Check ✅</button>
                </div>
                <div class="play-feedback" id="dictFeedback"></div>
            </div>`;

        // 注意：必须在本舞台内取元素。页面上还有一个「查单词」输入框（#dictInput），
        // 若用全局 id 会取错元素，导致听写永远无法判定。
        const input = stage.querySelector('#dictAnswer');
        const speak = () => SpeechHelper.speakWord(word.word);
        document.getElementById('dictAudio').onclick = () => speak();
        document.getElementById('dictSlow').onclick = () => SpeechHelper.speak(word.word, { rate: 0.55 });
        if (SpeechHelper.settings.autoSpeak) Play.later(() => speak(), 350);
        if (input) input.focus();

        let solved = false;
        const check = () => {
            if (solved || !input) return;
            const val = input.value.trim().toLowerCase();
            if (!val) { input.focus(); return; }
            const fb = document.getElementById('dictFeedback');
            if (val === word.word.toLowerCase()) {
                solved = true;
                input.disabled = true;
                input.classList.add('ok');
                Combo.hit();
                this.dictCorrect++;
                if (fb) fb.textContent = '⭐ Excellent! ' + word.word;
                SpeechHelper.speakWord(word.word);
                Play.later(() => { this.dictIndex++; this.renderDictation(); }, 1000);
            } else {
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
                Combo.miss();
                if (fb) fb.textContent = 'Almost! Listen again. 🙈';
                Play.later(() => speak(), 500);
            }
        };
        document.getElementById('dictCheck').onclick = check;
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') check(); });
    },

    finishDictation: function() {
        const stage = document.getElementById('playStage');
        Play.reward('listen-dict', 3);
        App.createConfetti(22);
        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('✍️ Dictation', 'Finished!')}
                <div class="play-big-emoji">🏅</div>
                <div class="play-hint">You spelled ${this.dictCorrect} / ${this.dictQueue.length} words correctly!</div>
                <div class="play-actions">
                    <button class="play-btn" id="dictAgain">🔁 再练一次</button>
                    <button class="play-btn ghost" id="dictBack">🎧 返回</button>
                </div>
            </div>`;
        document.getElementById('dictAgain').onclick = () => this.startDictation();
        document.getElementById('dictBack').onclick = () => this.renderMenu();
    }
};

/* ==========================================================
   3. 主题剧情冒险：以宠物为主角，把每个单元关卡串成故事任务
   ========================================================== */
const QUEST_VERBS = ['lands in', 'trots into', 'zooms to', 'sneaks into', 'marches into'];

const Quest = {
    activeUnit: null,

    petStage: function() {
        return PET_STAGES[Play.petStage(App.userData.petXp || 0)];
    },

    ensurePlan: function() {
        const grade = App.currentGrade;
        if (!grade || !LEARNING_DATA[grade]) return;
        // 年级切换由 App.enterGrade 重建计划；这里只兜底「有年级但计划为空」的情况
        if (!Array.isArray(App.levelPlan) || !App.levelPlan.length) {
            App.levelPlan = App.buildLevelPlan(grade);
        }
    },

    renderList: function() {
        const stage = document.getElementById('playStage');
        if (!App.currentGrade) {
            stage.innerHTML = `
                <div class="play-card">
                    ${Play.cardHead('🎭 Story Quest', 'Pick a grade')}
                    <div class="play-big-emoji">🧭</div>
                    <div class="play-hint">Choose a grade on the home page to start the adventure!</div>
                    <button class="play-btn primary" id="questHome">🏠 去选年级</button>
                </div>`;
            document.getElementById('questHome').onclick = () => App.showPage('home');
            return;
        }
        this.ensurePlan();
        const gradeData = LEARNING_DATA[App.currentGrade];
        const pet = this.petStage();
        const chapters = Object.keys(gradeData.units).map((unitKey, idx) => {
            const unit = gradeData.units[unitKey];
            const levels = App.levelPlan.filter(l => l.unit === unitKey);
            const done = levels.filter(l => App.userData.completedLevels.includes(l.key)).length;
            const complete = done === levels.length && levels.length > 0;
            return { unitKey, idx, unit, levels, done, complete };
        });

        stage.innerHTML = `
            <div class="play-card quest-card-main">
                ${Play.cardHead('🎭 Story Quest', `${gradeData.emoji} ${gradeData.name}`)}
                <div class="quest-hero">
                    <div class="quest-pet">${pet.emoji}</div>
                    <div class="quest-hero-text">
                        <div class="quest-hero-name">${escHtml(pet.name)}'s Adventure</div>
                        <div class="quest-hero-sub">Help your pet explore every unit and collect word gems!</div>
                    </div>
                </div>
                <div class="quest-list">
                    ${chapters.map(ch => `
                        <button class="quest-chapter ${ch.complete ? 'done' : ''}" data-unit="${ch.unitKey}">
                            <span class="qc-icon">${ch.unit.icon}</span>
                            <span class="qc-body">
                                <span class="qc-title">Chapter ${ch.idx + 1} · ${escHtml(ch.unit.topic)}</span>
                                <span class="qc-sub">${ch.done}/${ch.levels.length} missions done</span>
                            </span>
                            <span class="qc-badge">${ch.complete ? '✅' : '▶'}</span>
                        </button>`).join('')}
                </div>
            </div>`;
        stage.querySelectorAll('[data-unit]').forEach(btn => {
            btn.onclick = () => this.renderChapter(btn.dataset.unit);
        });
    },

    renderChapter: function(unitKey) {
        this.ensurePlan();
        const gradeData = LEARNING_DATA[App.currentGrade];
        const unit = gradeData.units[unitKey];
        if (!unit) { this.renderList(); return; }
        const stage = document.getElementById('playStage');
        const pet = this.petStage();
        const levels = App.levelPlan.filter(l => l.unit === unitKey);
        if (!levels.length) { this.renderList(); return; }
        const done = levels.filter(l => App.userData.completedLevels.includes(l.key)).length;
        const complete = done === levels.length && levels.length > 0;
        const chapterNo = Object.keys(gradeData.units).indexOf(unitKey) + 1;
        const verb = QUEST_VERBS[(chapterNo - 1) % QUEST_VERBS.length];
        const intro = `${pet.emoji} ${pet.name} ${verb} ${unit.topic}. Help it collect ${unit.words.length} word gems!`;
        const outro = `${pet.emoji} Hooray! ${pet.name} finished ${unit.topic} and grew stronger!`;

        stage.innerHTML = `
            <div class="play-card quest-detail">
                ${Play.cardHead('🎭 Story Quest', `Chapter ${chapterNo} · ${escHtml(unit.topic)}`)}
                <div class="quest-scene">${unit.icon}${pet.emoji}</div>
                <div class="quest-line">${escHtml(complete ? outro : intro)}</div>
                <div class="quest-missions">
                    ${levels.map((l, i) => {
                        const isDone = App.userData.completedLevels.includes(l.key);
                        return `<button class="quest-mission ${isDone ? 'done' : ''}" data-key="${l.key}">
                            <span class="qm-num">${l.type === 'sentence' ? '💬' : (i + 1)}</span>
                            <span class="qm-label">${l.type === 'sentence' ? 'Sentence' : escHtml(l.label)}</span>
                            ${isDone ? '<span class="qm-check">✓</span>' : ''}
                        </button>`;
                    }).join('')}
                </div>
                <div class="play-actions">
                    <button class="play-btn primary" id="questStart">${complete ? '🔁 再走一遍' : '▶ 开始任务'}</button>
                    <button class="play-btn ghost" id="questBack">🎭 章节列表</button>
                </div>
            </div>`;

        stage.querySelectorAll('.quest-mission').forEach(btn => {
            btn.onclick = () => {
                const idx = App.levelPlan.findIndex(l => l.key === btn.dataset.key);
                if (idx >= 0) {
                    this.activeUnit = unitKey;
                    App.startLevel(idx);
                }
            };
        });
        document.getElementById('questStart').onclick = () => {
            const pending = levels.findIndex(l => !App.userData.completedLevels.includes(l.key));
            const firstIdx = App.levelPlan.findIndex(l => l.key === levels[0].key);
            this.activeUnit = unitKey;
            App.startLevel(firstIdx + (pending >= 0 ? pending : 0));
        };
        document.getElementById('questBack').onclick = () => this.renderList();
    },

    // 关卡通关时，若处于剧情模式，给宠物一句鼓励
    encourage: function(level) {
        if (!this.activeUnit || !level || this.activeUnit !== level.unit) return;
        // 章节编号只在同一年级内有意义，换年级后的同编号单元不能误触发剧情鼓励
        if (level.grade && App.currentGrade &&
            String(level.grade) !== String(App.currentGrade)) return;
        if (!Array.isArray(App.levelPlan) || !App.levelPlan.length) return;
        const unitLevels = App.levelPlan.filter(l => l.unit === level.unit);
        const allDone = unitLevels.length && unitLevels.every(l => App.userData.completedLevels.includes(l.key));
        const pet = this.petStage();
        if (allDone) this.activeUnit = null;
        document.querySelectorAll('.quest-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'quest-toast';
        toast.innerHTML = `<span class="qt-pet">${pet.emoji}</span>
            <span class="qt-text">${allDone ? 'Chapter complete! You are amazing!' : 'Great job! On to the next mission!'}</span>`;
        document.body.appendChild(toast);
        stackToasts();
        setTimeout(() => toast.remove(), 3000);
    }
};

/* ==========================================================
   4. 弱项专练本：把 markWeak 标记的易错词集中成册刷
   ========================================================== */
const WeakBook = {
    queue: [],
    index: 0,
    correct: 0,

    render: function() {
        const stage = document.getElementById('playStage');
        const keys = App.userData.weakWords || [];
        const items = [];
        keys.forEach(key => {
            const w = PlayLab.findWord(key);
            if (w) items.push({ key, w });
        });
        if (!items.length) {
            stage.innerHTML = `
                <div class="play-card">
                    ${Play.cardHead('📕 Weak Word Book', 'All clear!')}
                    <div class="play-big-emoji">🎉</div>
                    <div class="play-hint">No weak words right now. Tap ❌ on a card to add tricky words here!</div>
                    <button class="play-btn primary" id="weakGoLearn">📚 去学习</button>
                </div>`;
            document.getElementById('weakGoLearn').onclick = () => Play.showMode('map');
            return;
        }

        stage.innerHTML = `
            <div class="play-card weak-cover">
                ${Play.cardHead('📕 Weak Word Book', `${items.length} words`)}
                <div class="weak-cover-emoji">📕</div>
                <div class="play-hint">Practice your tricky words until they are easy!</div>
                <button class="play-btn primary" id="weakStart">▶ 开始专练</button>
                <div class="weak-list">
                    ${items.map(it => `
                        <div class="weak-item" data-key="${it.key}">
                            <span class="weak-emoji">${it.w.emoji}</span>
                            <span class="weak-word">${escHtml(it.w.word)}</span>
                            <span class="weak-sentence">${escHtml(it.w.sentence || '')}</span>
                            <button class="weak-remove" data-remove="${it.key}" title="移出">✕</button>
                        </div>`).join('')}
                </div>
            </div>`;
        document.getElementById('weakStart').onclick = () => this.start();
        stage.querySelectorAll('[data-remove]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                App.toggleWordList('weakWords', btn.dataset.remove);
                this.render();
            };
        });
    },

    start: function() {
        const keys = (App.userData.weakWords || []).filter(key => PlayLab.findWord(key));
        if (!keys.length) { this.render(); return; }
        const shuffled = PlayLab.shuffle(keys).slice(0, 12);
        this.queue = shuffled.map(key => ({ key, w: PlayLab.findWord(key) })).filter(x => x.w);
        if (!this.queue.length) { this.render(); return; }
        this.index = 0;
        this.correct = 0;
        Combo.startRun();
        this.renderQuestion();
    },

    renderQuestion: function() {
        const stage = document.getElementById('playStage');
        if (this.index >= this.queue.length) { this.finish(); return; }
        const item = this.queue[this.index];
        const word = item.w;
        const all = [];
        const seen = new Set([word.emoji]);
        (App.userData.weakWords || []).forEach(key => {
            const w = PlayLab.findWord(key);
            if (w && !seen.has(w.emoji) && w.word !== word.word) {
                seen.add(w.emoji);
                all.push(w);
            }
        });
        // 弱词不够时从当前年级补足干扰项
        if (all.length < 3) {
            const pool = Listening.allWords();
            PlayLab.shuffle(pool).forEach(w => {
                if (all.length >= 3) return;
                if (w.word === word.word || seen.has(w.emoji)) return;
                seen.add(w.emoji);
                all.push(w);
            });
        }
        const options = PlayLab.shuffle([word].concat(PlayLab.shuffle(all).slice(0, 3)));

        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('📕 Weak Word Book', `${this.index + 1} / ${this.queue.length}`)}
                <button class="play-audio" id="weakAudio">🔊 Listen</button>
                <div class="play-hint">Which picture is this word?</div>
                <div class="listen-options">
                    ${options.map(o => `<button class="listen-opt" data-word="${escHtml(o.word)}">${o.emoji}</button>`).join('')}
                </div>
                <div class="play-feedback" id="weakFeedback"></div>
            </div>`;
        const speak = () => SpeechHelper.speakWord(word.word);
        document.getElementById('weakAudio').onclick = speak;
        if (SpeechHelper.settings.autoSpeak) Play.later(speak, 300);

        stage.querySelectorAll('.listen-opt').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                if (btn.dataset.word === word.word) {
                    btn.classList.add('correct');
                    Combo.hit();
                    this.correct++;
                    const fb = document.getElementById('weakFeedback');
                    if (fb) fb.textContent = '⭐ Great! ' + word.word;
                    SpeechHelper.speakWord(word.word);
                    stage.querySelectorAll('.listen-opt').forEach(b => { b.disabled = true; });
                    Play.later(() => { this.index++; this.renderQuestion(); }, 850);
                } else {
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    Combo.miss();
                    const fb = document.getElementById('weakFeedback');
                    if (fb) fb.textContent = 'Try again! 🙈';
                    speak();
                }
            };
        });
    },

    finish: function() {
        const stage = document.getElementById('playStage');
        App.userData.weakPracticed = (App.userData.weakPracticed || 0) + 1;
        App.saveUserData();
        Play.reward('weakbook', 4);
        App.createConfetti(24);
        stage.innerHTML = `
            <div class="play-card">
                ${Play.cardHead('📕 Weak Word Book', 'Finished!')}
                <div class="play-big-emoji">🏅</div>
                <div class="play-hint">You practiced ${this.queue.length} tricky words and got ${this.correct} right!</div>
                <div class="play-actions">
                    <button class="play-btn" id="weakAgain">🔁 再练一轮</button>
                    <button class="play-btn ghost" id="weakBack">📕 返回词本</button>
                </div>
            </div>`;
        document.getElementById('weakAgain').onclick = () => this.start();
        document.getElementById('weakBack').onclick = () => this.render();
    }
};

/* 初始化 */
document.addEventListener('DOMContentLoaded', () => {
    Combo.init();
    if (typeof App !== 'undefined' && App.userData) {
        Stickers.refresh({ silent: true });
    }
});
