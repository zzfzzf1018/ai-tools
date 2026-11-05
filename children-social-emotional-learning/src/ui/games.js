/* 心晴岛 · 七种互动玩法。原则：不打分、不说"错"，只让孩子看见"这样做会发生什么"。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils, A = window.SEL.art, Audio = window.SEL.audio;
  var S = window.SEL.state, UI = window.SEL.ui;

  var cleanups = [];
  function onCleanup(fn) { cleanups.push(fn); }
  function cleanup() {
    cleanups.forEach(function (f) { try { f(); } catch (e) {} });
    cleanups = [];
    Audio.stopSpeak();
  }

  function strip(s) { return String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }

  function setExtra(root, html) {
    var ex = U.$('.game-extra', root);
    if (ex) ex.innerHTML = html || '';
    return ex;
  }

  function finishBtn(stars, title, text, label) {
    return '<div style="margin-top:16px"><button class="btn ' + (label ? '' : 'green') + '" data-finish ' +
      'data-stars="' + U.clamp(stars, 1, 3) + '" data-title="' + U.esc(title) + '" ' +
      'data-text="' + U.esc(text) + '">' + U.esc(label || '收下星星 ⭐') + '</button></div>';
  }

  function tipBox(title, text, good) {
    return '<div class="feedback-box ' + (good ? 'good' : '') + '"><b>' + U.esc(title) + '</b>' +
      '<div>' + text + '</div></div>';
  }

  /* ---------------- 1. 情境选择 ---------------- */
  function choiceGame(level) {
    var d = level.data || {};
    var opts = d.options || [];
    var html = '<div class="game-prompt">' + U.esc(d.prompt || level.intro) + '</div>';
    if (d.scene) html += '<div class="scene-box">' + A.scene(d.scene) + '</div>';
    html += '<div class="game-instruction">选一个你想试试的做法，看看接下来会发生什么 🌱</div>' +
      '<div class="option-list">' + opts.map(function (o, i) {
        return '<button class="option-btn" data-i="' + i + '">' +
          '<span class="opt-emoji">' + U.esc(o.emoji || '💭') + '</span>' +
          '<span>' + U.esc(o.text || '') + '</span></button>';
      }).join('') + '</div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        function reset() {
          U.$$('.option-btn', card).forEach(function (b) {
            b.disabled = false; b.classList.remove('dim', 'picked');
          });
          setExtra(root, '');
        }
        U.delegate(card, 'click', '.option-btn', function (e, t) {
          if (t.disabled) return;
          Audio.sfx('select');
          var o = opts[Number(t.getAttribute('data-i'))] || {};
          U.$$('.option-btn', card).forEach(function (b) { b.disabled = true; b.classList.add('dim'); });
          t.classList.remove('dim'); t.classList.add('picked');
          var good = !!o.good;
          var title = good ? '这样试试看 🌱' : '看看会发生什么 🔎';
          var body = '<p>' + U.esc(o.outcome || '') + '</p><p>' + U.esc(o.feedback || '') + '</p>';
          var ex = setExtra(root, tipBox(title, body, good) +
            '<div class="row" style="margin-top:10px"><button class="btn tiny blue" data-again>再看看别的做法</button></div>' +
            finishBtn(good ? 3 : 2, '你做出选择了', strip(o.feedback || o.outcome || level.teach)));
          Audio.speak(title + '。' + strip(o.outcome || '') + '。' + strip(o.feedback || ''));
          U.$('[data-again]', ex).addEventListener('click', function () { Audio.sfx('tap'); reset(); });
        });
      }
    };
  }

  /* ---------------- 2. 配对 ---------------- */
  function matchGame(level) {
    var d = level.data || {};
    var pairs = d.pairs || [];
    var lefts = pairs.map(function (p, i) { return { key: 'k' + i, data: p.left || {} }; });
    var rights = U.shuffle(pairs.map(function (p, i) { return { key: 'k' + i, data: p.right || {} }; }));

    function leftInner(x) {
      var o = x.data;
      var f = o.face ? '<span class="pair-face">' + A.face(o.face, 52) + '</span>' : '';
      if (o.emoji && !f) f = '<span style="font-size:34px">' + U.esc(o.emoji) + '</span>';
      return f + (o.label ? '<span>' + U.esc(o.label) + '</span>' : '');
    }
    var html = '<div class="game-prompt">' + U.esc(d.instruction || '把一样的连起来') + '</div>' +
      '<div class="game-instruction">先点左边一张卡，再点右边和它做朋友的那张卡 ✨</div>' +
      '<div class="pair-board">' +
      '<div class="pair-col"><div class="pair-col-label">左边 · 线索</div>' + lefts.map(function (x) {
        return '<button class="pair-item" data-side="L" data-key="' + x.key + '">' + leftInner(x) + '</button>';
      }).join('') + '</div>' +
      '<div class="pair-col"><div class="pair-col-label">右边 · 答案</div>' + rights.map(function (x) {
        return '<button class="pair-item" data-side="R" data-key="' + x.key + '">' +
          (x.data.emoji ? '<span style="font-size:28px">' + U.esc(x.data.emoji) + '</span>' : '') +
          '<span>' + U.esc(x.data.label || '') + '</span></button>';
      }).join('') + '</div></div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        var active = null, matched = 0, miss = 0, total = pairs.length;
        U.delegate(card, 'click', '.pair-item', function (e, t) {
          if (t.classList.contains('matched')) return;
          var side = t.getAttribute('data-side');
          var key = t.getAttribute('data-key');
          Audio.sfx('tap');
          if (side === 'L') {
            U.$$('.pair-item.active', card).forEach(function (b) { b.classList.remove('active'); });
            t.classList.add('active'); active = t; return;
          }
          if (!active) {
            setExtra(root, tipBox('先点左边的一张卡吧', '每张左边的卡，都藏着一个小线索 🔍', false));
            return;
          }
          if (active.getAttribute('data-key') === key) {
            Audio.sfx('pop');
            active.classList.remove('active'); active.classList.add('matched');
            t.classList.add('matched'); active = null; matched++;
            setExtra(root, '');
            if (matched >= total) {
              var stars = miss <= 1 ? 3 : 2;
              var ex = setExtra(root, tipBox('全部找到朋友啦 🎉',
                '<p>你一共配出了 ' + total + ' 对。认出情绪的线索，是认识自己的第一步。</p>' +
                finishBtn(stars, '配对完成', level.teach || '你认出了这些情绪'), true));
              Audio.sfx('win'); Audio.speak('全部找到朋友啦！' + strip(level.teach || ''));
              UI.confetti(10);
              void ex;
            }
          } else {
            miss++;
            Audio.sfx('tryagain');
            t.classList.add('shake'); active.classList.add('shake');
            setTimeout(function () { t.classList.remove('shake'); }, 400);
            var a = active;
            setTimeout(function () { a.classList.remove('shake'); }, 400);
            setExtra(root, tipBox('这两张还不太一样', '再看看表情和线索，慢慢来就好 🙂', false));
          }
        });
      }
    };
  }

  /* ---------------- 3. 排序 ---------------- */
  function orderGame(level) {
    var d = level.data || {};
    var items = U.shuffle(d.items || []);
    var answer = d.answer || [];
    /* 打乱后正好等于正确答案就没有“排”的乐趣了，换一个起点 */
    if (items.length > 1 && items.every(function (it, i) { return it.id === answer[i]; })) {
      items = items.slice(1).concat(items.slice(0, 1));
    }
    var html = '<div class="game-prompt">' + U.esc(d.instruction || '把步骤排好顺序') + '</div>' +
      '<div class="game-instruction">用 ▲▼ 调整顺序，也可以直接拖着卡片移动。排好点「我排好了」👇</div>' +
      '<div class="order-list" data-order-list>' + items.map(function (it) {
        return '<div class="order-item" draggable="true" data-id="' + U.esc(it.id) + '">' +
          '<span class="ord-num">1</span><span class="ord-emoji">' + U.esc(it.emoji || '🔹') + '</span>' +
          '<span class="ord-text">' + U.esc(it.text || '') + '</span>' +
          '<span class="ord-move"><button data-move="up" aria-label="上移">▲</button>' +
          '<button data-move="down" aria-label="下移">▼</button></span></div>';
      }).join('') + '</div>' +
      '<div style="margin-top:18px" class="center"><button class="btn primary" data-check>我排好了 ✅</button></div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        var list = U.$('[data-order-list]', card);
        var tries = 0, solved = false;
        function renumber() {
          U.$$('.order-item', list).forEach(function (el, i) { U.$('.ord-num', el).textContent = String(i + 1); });
        }
        function currentOrder() { return U.$$('.order-item', list).map(function (el) { return el.getAttribute('data-id'); }); }
        renumber();

        U.delegate(list, 'click', '[data-move]', function (e, t) {
          e.stopPropagation();
          if (solved) return;
          var item = t.closest('.order-item');
          if (!item) return;
          Audio.sfx('tap');
          if (t.getAttribute('data-move') === 'up' && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
          if (t.getAttribute('data-move') === 'down' && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
          renumber();
        });

        var dragging = null;
        U.delegate(list, 'dragstart', '.order-item', function (e, t) {
          if (solved) { e.preventDefault(); return; }
          dragging = t; try { e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
        });
        U.delegate(list, 'dragover', '.order-item', function (e) { e.preventDefault(); });
        U.delegate(list, 'drop', '.order-item', function (e, t) {
          e.preventDefault();
          if (solved || !dragging || dragging === t) return;
          var r = t.getBoundingClientRect();
          if (e.clientY < r.top + r.height / 2) list.insertBefore(dragging, t);
          else list.insertBefore(dragging, t.nextSibling);
          dragging = null; renumber(); Audio.sfx('pop');
        });

        U.delegate(card, 'click', '[data-check]', function () {
          if (solved) return;
          Audio.sfx('select');
          var cur = currentOrder();
          var ok = cur.length === answer.length && cur.every(function (v, i) { return v === answer[i]; });
          tries++;
          if (ok) {
            solved = true;
            var stars = tries <= 1 ? 3 : 2;
            setExtra(root, tipBox('顺序排对啦 🎉',
              '<p>' + U.esc(level.teach || '一步步来，事情会顺很多。') + '</p>' +
              finishBtn(stars, '步骤排好了', strip(level.teach || '')), true));
            Audio.sfx('win'); UI.confetti(10);
          } else {
            var firstBad = 0;
            for (var i = 0; i < answer.length; i++) { if (cur[i] !== answer[i]) { firstBad = i; break; } }
            var el = U.$$('.order-item', list)[firstBad];
            if (el) { el.style.borderColor = 'var(--purple)'; setTimeout(function () { el.style.borderColor = ''; }, 1200); }
            setExtra(root, tipBox('再看看第 ' + (firstBad + 1) + ' 步',
              '<p>想想：做这件事之前，先要发生什么？把最该先做的一步挪到前面试试 🙌</p>', false));
            Audio.speak('再看看第 ' + (firstBad + 1) + ' 步，想想哪件事应该先发生。');
          }
        });
      }
    };
  }

  /* ---------------- 4. 情绪强度温度计 ---------------- */
  function sliderGame(level) {
    var d = level.data || {};
    var html = '<div class="game-prompt">' + U.esc(d.prompt || '现在这个感觉有多强？') + '</div>' +
      '<div class="slider-wrap">' +
      '<div class="slider-face" data-face>' + A.face('surprised', 150) + '</div>' +
      '<div class="slider-value" data-val>3</div>' +
      '<div class="small muted">格</div>' +
      '<input type="range" min="1" max="5" step="1" value="3" data-range aria-label="情绪强度">' +
      '<div class="slider-labels"><span>' + U.esc(d.minLabel || '一点点') + '</span>' +
      '<span>' + U.esc(d.maxLabel || '非常多') + '</span></div>' +
      '<div class="thermo-ticks"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>' +
      '</div><div class="center" style="margin-top:8px"><button class="btn primary" data-submit>就选这个 💛</button></div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        var range = U.$('[data-range]', card), val = U.$('[data-val]', card), face = U.$('[data-face]', card);
        function upd() {
          var n = Number(range.value);
          val.textContent = String(n);
          face.style.transform = 'scale(' + (0.78 + n * 0.075) + ')';
          face.style.filter = n >= 4 ? 'saturate(1.4)' : 'none';
        }
        range.addEventListener('input', function () { upd(); Audio.sfx('tap'); });
        upd();
        U.delegate(card, 'click', '[data-submit]', function () {
          Audio.sfx('select');
          var n = Number(range.value);
          var a = d.answer || { min: 3, max: 5 };
          var inRange = n >= (a.min || 1) && n <= (a.max || 5);
          var body = '<p>你选了 <b>' + n + '</b> 格。' +
            (inRange ? '这个强度的感觉很明显，值得认真对待。' : '你感受到的强度比较小，也完全没问题。') +
            '</p><p>' + U.esc(d.hint || '同一种情绪，也会有一点点和满满的区别。能说出「有多强」，别人才更容易帮到你。') + '</p>';
          setExtra(root, tipBox('你的感受，你最清楚 💛', body + finishBtn(3, '感觉被看见了', strip(d.hint || level.teach || '')), true));
          Audio.speak('你的感受，你最清楚。' + strip(body));
        });
      }
    };
  }

  /* ---------------- 5. 呼吸练习 ---------------- */
  function breatheGame(level) {
    var d = level.data || {};
    var cues = d.cues || [];
    var pattern = d.pattern || 'balloon';
    var ph = [];
    if (pattern === 'box') {
      ph = [{ n: '吸气', s: 4, c: cues[0] || '鼻子慢慢吸，数 4 下' },
            { n: '停一下', s: 3, c: '轻轻停住，不着急' },
            { n: '呼气', s: 4, c: cues[1] || '嘴巴慢慢呼，数 4 下' },
            { n: '停一下', s: 3, c: '再来一轮' }];
    } else if (pattern === '478') {
      ph = [{ n: '吸气', s: 4, c: cues[0] || '鼻子吸气，数 4 下' },
            { n: '停一下', s: 4, c: '轻轻屏住' },
            { n: '呼气', s: 6, c: cues[1] || '慢慢呼出去，像吹泡泡' }];
    } else {
      ph = [{ n: '吸气', s: Math.min(5, d.inhale || 4), c: cues[0] || '肚子像气球一样鼓起来' },
            { n: '停一下', s: Math.min(3, d.hold || 2), c: '轻轻停一下' },
            { n: '呼气', s: Math.min(6, d.exhale || 6), c: cues[1] || '慢慢把气放掉' }];
    }
    var cycles = Math.min(3, Math.max(1, d.cycles || 3));

    var html = '<div class="game-prompt center">' + U.esc(d.title || level.intro || '一起吹泡泡') + '</div>' +
      '<div class="game-instruction center">跟着大泡泡一起，慢慢吸气、慢慢呼气。不用做得完美 🫧</div>' +
      '<div class="breath-stage">' +
      '<div class="breath-orb" data-orb>准备</div>' +
      '<div class="breath-cue" data-cue>点「开始」，我们一起来</div>' +
      '<div class="breath-dots" data-dots>' + new Array(cycles + 1).join('<i></i>') + '</div>' +
      '<div class="row" style="justify-content:center;margin-top:18px">' +
      '<button class="btn primary" data-start>开始练习 ▶</button>' +
      '<button class="btn tiny ghost" data-stop>先停一下</button></div></div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        var orb = U.$('[data-orb]', card), cue = U.$('[data-cue]', card);
        var startBtn = U.$('[data-start]', card);
        var dots = U.$$('[data-dots] i', card);
        var cancelled = false, running = false, started = false;
        var timers = [], waiters = [], gen = 0;

        function clearTimers() { timers.forEach(clearTimeout); timers = []; }
        /* 取消时把挂起的等待也唤醒，否则旧的 run() 会永远停在 await 上 */
        function wakeWaiters() {
          var list = waiters.splice(0);
          list.forEach(function (res) { try { res(); } catch (e) {} });
        }
        function stopAll() { clearTimers(); wakeWaiters(); }
        onCleanup(function () { cancelled = true; gen++; stopAll(); });

        function wait(ms) {
          return new Promise(function (res) {
            waiters.push(res);
            timers.push(setTimeout(function () {
              waiters = waiters.filter(function (x) { return x !== res; });
              res();
            }, ms));
          });
        }
        function setOrb(cls, text) {
          orb.className = 'breath-orb' + (cls ? ' ' + cls : '');
          orb.textContent = text;
        }
        function resetStage() {
          stopAll();
          cancelled = false;
          running = false;
          setOrb('', '准备');
          cue.textContent = '点「开始」，我们一起来';
          dots.forEach(function (d) { d.classList.remove('on'); });
          setExtra(root, '');
          startBtn.disabled = false;
        }
        async function run() {
          if (running) return;
          resetStage();
          var my = ++gen;
          running = true; started = true;
          startBtn.disabled = true;
          for (var c = 0; c < cycles && gen === my && !cancelled; c++) {
            if (dots[c]) dots[c].classList.add('on');
            for (var i = 0; i < ph.length && gen === my && !cancelled; i++) {
              var p = ph[i];
              cue.textContent = p.c;
              var cls = p.n === '吸气' ? 'in' : (p.n === '呼气' ? 'out' : '');
              Audio.tone(p.n === '吸气' ? 392 : 294, 0.5, 'sine', 0, 0.12);
              for (var s = p.s; s > 0 && gen === my && !cancelled; s--) {
                setOrb(cls, p.n + ' ' + s);
                await wait(1000);
                if (gen !== my) return;   /* 已经被停止或被新一次练习顶替 */
              }
              if (gen === my && !cancelled) Audio.sfx('bubble');
            }
          }
          if (gen !== my) return;
          running = false;
          started = false;
          /* 练完后先留着「收下星星」，不让误点「开始」把奖励按钮清掉；
             想再练一次可以从完成弹窗的「再玩一次」重新进入 */
          startBtn.disabled = !cancelled;
          if (cancelled) return;
          setOrb('', '完成啦');
          cue.textContent = '你刚刚让身体慢下来了 🌿';
          dots.forEach(function (d) { d.classList.add('on'); });
          S.practiceStrategy('breathing');
          Audio.sfx('win'); UI.confetti(12);
          setExtra(root, tipBox('练完啦，真棒 🎉',
            '<p>生气、紧张、害怕的时候，都可以先做 3 轮这样的呼吸。' +
            U.esc(level.teach || '') + '</p>' + finishBtn(3, '呼吸练习完成', strip(level.teach || '')), true));
        }
        U.delegate(card, 'click', '[data-start]', function () { Audio.unlock(); Audio.sfx('pop'); run(); });
        U.delegate(card, 'click', '[data-stop]', function () {
          if (!started) { UI.toast('先点「开始练习」，我们一起试试 🌿'); return; }
          Audio.sfx('tap');
          cancelled = true; running = false; started = false; gen++;
          stopAll();
          startBtn.disabled = false;
          setOrb('', '随时回来');
          cue.textContent = '练过一点点也算数，想练的时候再来 🌿';
          setExtra(root, tipBox('先休息一下', '<p>呼吸练习不用一次做完，任何时候都能重新开始。</p>' +
            finishBtn(1, '今天练了一点点', '呼吸练习可以分次完成。'), true));
        });
      }
    };
  }

  /* ---------------- 6. 分支故事 ---------------- */
  function storyGame(level) {
    var d = level.data || {};
    var story = (S.data().stories || []).filter(function (s) { return s.id === d.storyId; })[0];
    if (!story) {
      return {
        html: '<div class="game-prompt">这个故事还在路上，先去玩别的关卡吧 🌈</div>',
        mount: function (root) {
          setExtra(root, finishBtn(3, '故事暂缺', '先去玩别的关卡吧。', '回到地图'));
        }
      };
    }
    var nodes = story.nodes || {};
    var steps = 0;
    var html = '<div class="game-prompt center">' + U.esc(story.cover || '📖') + ' ' + U.esc(story.title) + '</div>' +
      '<div class="story-panel" data-story></div>';

    return {
      html: html,
      mount: function (root) {
        var panel = U.$('[data-story]', root);
        /* 故事里的能力点只在「第一次走完这个关卡」时累加：
           重玩可以继续探索别的分支，但不会把同一份练习反复记成新的能力点 */
        var firstPlay = !(S.current().levels[level.id] && S.current().levels[level.id].done);
        function pathDots() {
          var max = 4, s = '<div class="story-path">';
          for (var i = 0; i < max; i++) s += '<span class="' + (i < steps ? 'on' : '') + '"></span>';
          return s + '</div>';
        }
        function draw(nodeId) {
          var n = nodes[nodeId] || {};
          var ending = n.ending === true || !n.choices || !n.choices.length;
          var face = A.buddy('cloud', n.emotion || 'calm', 90);
          var body = pathDots() +
            '<div class="story-top"><div class="story-avatar">' + face + '</div>' +
            '<div style="flex:1"><div class="spread"><div class="chip purple">' + U.esc(n.speaker || '团团') + '</div>' +
            UI.speakBtn(n.text || '') + '</div>' +
            '<div class="story-text" style="margin-top:10px">' + U.esc(n.text || '') + '</div></div></div>';
          if (ending) {
            body += (n.moral ? '<div class="story-moral">💡 ' + U.esc(n.moral) + '</div>' : '');
            body += tipBox('故事走到这里啦 📖',
              '<p>你一共做了 ' + steps + ' 次选择。故事里没有「错」的选择，只有不一样的结果。</p>' +
              finishBtn(3, '故事完成', strip(n.moral || level.teach || '')), true);
            Audio.sfx('good'); Audio.speak(strip(n.moral || level.teach || ''));
          } else {
            body += '<div class="game-instruction">如果是你，会怎么做？</div><div class="story-choices">' +
              n.choices.map(function (c, i) {
                return '<button class="option-btn" data-ci="' + i + '"><span class="opt-emoji">💭</span>' +
                  '<span>' + U.esc(c.text || '') + '</span></button>';
              }).join('') + '</div>';
          }
          panel.innerHTML = body;
          Audio.speak(n.text || '');
        }
        var currentId = story.start || Object.keys(nodes)[0];
        U.delegate(panel, 'click', '.option-btn', function (e, t) {
          var node = nodes[currentId] || {};
          var c = (node.choices || [])[Number(t.getAttribute('data-ci'))] || {};
          Audio.sfx('select');
          U.$$('.option-btn', panel).forEach(function (b) { b.disabled = true; b.classList.add('dim'); });
          t.classList.remove('dim'); t.classList.add('picked');
          var box = document.createElement('div');
          box.className = 'feedback-box' + (c.good ? ' good' : '');
          box.innerHTML = '<b>' + (c.good ? '这样处理，感觉更稳 🌱' : '看看接下来会发生什么 🔎') + '</b>' +
            '<p>' + U.esc(c.feedback || '') + '</p>' +
            '<div style="margin-top:12px"><button class="btn tiny blue" data-go>继续故事 →</button></div>';
          panel.appendChild(box);
          Audio.speak(strip(c.feedback || ''));
          U.$('[data-go]', box).addEventListener('click', function () {
            steps++;
            /* 点「继续故事」才算真的选定了这条路：只点开看看又离开，不写库 */
            if (firstPlay && c.effect && c.effect.skill) {
              S.addSkill(c.effect.skill, c.effect.delta || 1);
            }
            currentId = c.next || currentId;
            draw(currentId);
          });
        });
        draw(currentId);
      }
    };
  }

  /* ---------------- 7. 分类 ---------------- */
  function classifyGame(level) {
    var d = level.data || {};
    var buckets = d.buckets || [];
    var items = U.shuffle(d.items || []);
    var html = '<div class="game-prompt">' + U.esc(d.instruction || '把卡片放到合适的篮子里') + '</div>' +
      '<div class="game-instruction">先点一张卡片，再点它该去的篮子；也可以直接拖过去 🧺</div>' +
      '<div class="classify-pool" data-pool>' + items.map(function (it) {
        return '<button class="drag-item" draggable="true" data-id="' + U.esc(it.id) + '" data-bucket="' + U.esc(it.bucket) + '">' +
          '<span class="di-emoji">' + U.esc(it.emoji || '🔹') + '</span><span>' + U.esc(it.text || '') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="classify-board">' + buckets.map(function (b) {
        return '<div class="bucket" data-bucket-id="' + U.esc(b.id) + '"><h4>' + U.esc(b.emoji || '🧺') + ' ' + U.esc(b.label) + '</h4>' +
          '<div class="bucket-slot"></div></div>';
      }).join('') + '</div>';

    return {
      html: html,
      mount: function (root) {
        var card = U.$('.game-card', root);
        var pool = U.$('[data-pool]', card);
        var active = null, miss = 0, placed = 0, total = items.length, finished = false;
        function place(item, bucketEl) {
          if (finished) return;
          var want = item.getAttribute('data-bucket');
          var got = bucketEl.getAttribute('data-bucket-id');
          item.classList.remove('active');
          if (want === got) {
            Audio.sfx('pop');
            U.$('.bucket-slot', bucketEl).appendChild(item);
            item.setAttribute('data-placed', '1');
            item.setAttribute('draggable', 'false');
            placed++;
            setExtra(root, '');
            if (placed >= total) {
              finished = true;
              var stars = miss <= 1 ? 3 : 2;
              var explains = (d.explain || []).map(function (e) { return '<li>' + U.esc(e) + '</li>'; }).join('');
              setExtra(root, tipBox('全部放好啦 🎉',
                (explains ? '<ul style="margin:6px 0;padding-left:22px">' + explains + '</ul>' : '') +
                '<p>' + U.esc(level.teach || '') + '</p>' +
                finishBtn(stars, '分类完成', strip(level.teach || '')), true));
              Audio.sfx('win'); UI.confetti(10);
            }
          } else {
            miss++;
            Audio.sfx('tryagain');
            item.classList.add('shake');
            setTimeout(function () { item.classList.remove('shake'); }, 400);
            setExtra(root, tipBox('再想一想', '<p>这张卡放这里，会发生什么？看看它更适合哪个篮子 🙂</p>', false));
          }
          active = null;
        }
        U.delegate(card, 'click', '.drag-item', function (e, t) {
          if (t.getAttribute('data-placed')) return;
          Audio.sfx('tap');
          U.$$('.drag-item.active', card).forEach(function (b) { b.classList.remove('active'); });
          t.classList.add('active'); active = t;
        });
        U.delegate(card, 'click', '.bucket', function (e, t) {
          /* 点已经放进篮子的卡片时，不要弹“先选一张卡片”的提示 */
          if (e.target && e.target.closest && e.target.closest('.drag-item')) return;
          if (finished) return;
          if (!active) { setExtra(root, tipBox('先选一张卡片', '点上面的一张卡片，再选篮子 🙂', false)); return; }
          place(active, t);
        });
        var dragging = null;
        U.delegate(card, 'dragstart', '.drag-item', function (e, t) { dragging = t; });
        U.delegate(card, 'dragover', '.bucket', function (e, t) { e.preventDefault(); t.classList.add('hover'); });
        U.delegate(card, 'dragleave', '.bucket', function (e, t) { t.classList.remove('hover'); });
        U.delegate(card, 'drop', '.bucket', function (e, t) {
          e.preventDefault(); t.classList.remove('hover');
          if (dragging && !dragging.getAttribute('data-placed')) place(dragging, t);
          dragging = null;
        });
        void pool;
      }
    };
  }

  var registry = {
    choice: choiceGame, match: matchGame, order: orderGame, slider: sliderGame,
    breathe: breatheGame, story: storyGame, classify: classifyGame
  };

  function render(level, ctx) {
    var def = registry[level.type] || choiceGame;
    var inner = def(level, ctx);
    return {
      html: '<div class="game-card">' + inner.html + '<div class="game-extra"></div></div>',
      mount: function (root) {
        inner.mount(root);
        U.delegate(root, 'click', '[data-finish]', function (e, t) {
          Audio.sfx('star');
          var title = t.getAttribute('data-title') || '完成啦';
          var text = t.getAttribute('data-text') || '';
          Audio.speak(title + '。' + text);
          ctx.complete({
            stars: U.clamp(Number(t.getAttribute('data-stars')) || 3, 1, 3),
            title: title, feedback: text
          });
        });
      }
    };
  }

  window.SEL.games = { render: render, cleanup: cleanup };
})();
