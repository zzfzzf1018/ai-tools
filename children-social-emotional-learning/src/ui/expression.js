/* 心晴岛 · 说一说（勇气小话筒）
   鼓励孩子把心里的话「大声说出来」，但不申请麦克风、不录音、不做语音识别：
   先由系统中文语音念一句示范，孩子跟着说，再自己点「我说出来啦」。
   存档只记次数与日期，绝不保存孩子说过的内容。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils, S = window.SEL.state, UI = window.SEL.ui, Audio = window.SEL.audio;

  var lastCheer = -1;

  function cfg() { return (S.data().expression || {}); }
  function esc(s) { return U.esc(s); }

  function frames() { return cfg().frames || []; }
  function prompts() { return cfg().prompts || []; }
  function audiences() { return cfg().audiences || []; }
  function badges() { return cfg().badges || []; }
  /* 与 state.js 的 dailyCap() 同口径，别把分母写死 */
  function starCap() { return U.clamp(Number(cfg().dailyStarCap) || 3, 1, 10); }

  function levelTopic(level) {
    var t = (cfg().levelPrompts || {})[level && level.id];
    if (!t) return null;
    return { id: level.id, scene: t.scene || level.intro || '', who: t.who || '团团',
      demo: t.demo || '', demoAdult: t.demoAdult || t.demo || '', frame: '', fromLevel: true };
  }

  function toTopic(p) {
    return { id: p.id, scene: p.scene, who: p.who, demo: p.demo,
      demoAdult: p.demoAdult || p.demo || '', frame: p.frame, emoji: p.emoji, feeling: p.feeling };
  }
  function randomTopic(excludeId) {
    var list = prompts();
    if (!list.length) return null;
    var pool = list.filter(function (p) { return p.id !== excludeId; });
    if (!pool.length) pool = list;
    return toTopic(pool[Math.floor(Math.random() * pool.length)]);
  }
  /* #/express/ex-3 可以指定某张情境卡：家长/老师想练同一句话、
     以及视觉回归需要确定性截图时都用它；未知 id 自动退回随机。 */
  function fixedTopic(id) {
    if (typeof id !== 'string' || !id) return null;
    var hit = prompts().filter(function (p) { return p.id === id; })[0];
    return hit ? toTopic(hit) : null;
  }

  function cheer() {
    var list = cfg().cheers || [];
    if (!list.length) return '你说出来啦，真勇敢！';
    var i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastCheer) i = (i + 1) % list.length;
    lastCheer = i;
    return list[i];
  }

  function statStrip() {
    var st = S.expressionStats();
    return '<div class="say-stats">' +
      '<div><b>' + st.total + '</b><span>累计说出来</span></div>' +
      '<div><b>' + st.streak + '</b><span>连续天数</span></div>' +
      '<div><b>' + st.today + '</b><span>今天说过</span></div>' +
      '<div><b>' + st.todayStars + '/' + starCap() + '</b><span>今天勇气星</span></div>' +
      '</div>';
  }

  function weekStrip() {
    var st = S.expressionStats();
    var byDate = {};
    (S.current().expression && S.current().expression.days || []).forEach(function (d) { byDate[d.date] = d.count; });
    var out = '';
    for (var i = 6; i >= 0; i--) {
      var day = U.daysAgo(i);
      out += '<span class="say-day ' + (byDate[day] ? 'on' : '') + '" title="' + day + ' 说了 ' +
        (byDate[day] || 0) + ' 次" aria-label="' + day + ' 说了 ' + (byDate[day] || 0) + ' 次">' +
        (Number(day.slice(8)) || '') + '</span>';
    }
    return '<div class="say-week"><span class="small muted">最近 7 天</span>' + out +
      '<span class="small muted">· 本周共 ' + st.week + ' 次</span></div>';
  }

  /* 卡片本体：关卡页与独立练习页共用。opts.compact 控制是否显示完整引导 */
  function card(topic, opts) {
    if (!topic) return '';
    opts = opts || {};
    var st = S.expressionStats();
    var fs = frames();
    var cardText = [topic.scene, topic.who, topic.demo, topic.demoAdult]
      .concat(fs.map(function (f) { return f.label + f.hint; })).filter(Boolean).join('。');
    var audienceHtml = opts.showAudience
      ? '<div class="say-audience"><label for="say-who">这句话，想说给谁听？</label> ' +
        '<select id="say-who" data-say-who aria-label="选择说话对象">' +
        audiences().map(function (a, i) { return '<option value="' + i + '">' + esc(a) + '</option>'; }).join('') +
        '</select><span class="small muted">选谁都可以，说给自己听也算数</span></div>'
      : '';
    return '<section class="say-card" data-say-card data-topic="' + esc(topic.id) +
      '" data-frame="' + esc(topic.frame || '') + '" data-variant="peer">' +
      '<div class="say-head">' +
        '<span class="say-emoji" aria-hidden="true">' + esc(topic.emoji || '🗣️') + '</span>' +
        '<div class="say-head-text"><h3>说一说 · 勇气小话筒</h3>' +
          '<p class="small muted">不用打字，也不用录音，大声说出来就好</p></div>' +
        UI.speakBtn(cardText, '朗读这一张说一说卡片') +
        '<span class="chip green" data-say-count>今天 ' + st.today + ' 次</span>' +
      '</div>' +
      '<div class="say-scene"><b>刚才这一关：</b>' + esc(topic.scene) +
        '<div class="small muted" style="margin-top:6px">试着说给 <b data-say-target>' + esc(topic.who) + '</b> 听，也可以说给自己听。</div></div>' +
      '<div class="say-frames">' + fs.map(function (f) {
        return '<div class="say-frame"><span class="sf-emoji">' + esc(f.emoji) + '</span>' +
          '<div><b>' + esc(f.label) + '</b><div class="small muted">' + esc(f.hint) + '，例如：' + esc(f.example) + '</div></div></div>';
      }).join('') + '</div>' +
      audienceHtml +
      '<div class="say-demo"><div class="spread"><b>🔊 先听一句话怎么说</b>' +
        '<button class="btn tiny blue" data-say-demo>听示范 ▶</button></div>' +
        '<div class="say-variants" role="group" aria-label="选择示范对象">' +
          '<button class="btn tiny primary" data-variant="peer" aria-pressed="true">👫 对同伴说</button>' +
          '<button class="btn tiny ghost" data-variant="adult" aria-pressed="false">🧑 对大人说</button>' +
          '<span class="small muted">同一件事，换个人听，说法也换一换</span></div>' +
        '<p data-say-demo-text>' + esc(topic.demo) + '</p>' +
        '<div class="small muted">听完就轮到你啦，用自己的话说说看，说得不一样也没关系。</div></div>' +
      '<div class="say-actions">' +
        '<button class="btn primary" data-say-done>🗣️ 我说出来啦</button>' +
        (opts.next ? '<button class="btn tiny ghost" data-say-next>换一张情境卡 🔄</button>' : '') +
        (opts.hideable ? '<button class="btn tiny ghost" data-say-hide>今天先不说</button>' : '') +
      '</div>' +
      (opts.hideable
        ? '<div class="say-folded"><button class="btn tiny ghost" data-say-unhide>🗣️ 想说的时候点这里</button>' +
          '<span class="small muted">今天先不说也没关系，随时可以回来</span></div>'
        : '') +
      '<div class="say-feedback" data-say-feedback aria-live="polite"></div>' +
      '</section>';
  }

  /* 把卡片绑到页面。onNext 用于独立页换题；onRecord 用于刷新页上的统计与贴纸进度。 */
  function mount(root, topic, onNext, onRecord) {
    var box = U.$('[data-say-card]', root);
    if (!box || !topic) return;
    var doneBtn = U.$('[data-say-done]', box);
    var feedback = U.$('[data-say-feedback]', box);
    var whoSel = U.$('[data-say-who]', box);
    var target = U.$('[data-say-target]', box);
    var variant = 'peer';
    function demoText() { return variant === 'adult' ? (topic.demoAdult || topic.demo) : topic.demo; }

    if (whoSel) {
      whoSel.addEventListener('change', function () {
        var a = audiences()[Number(whoSel.value)];
        if (target && a) target.textContent = a;
      });
    }
    /* 同一话题两种示范：对同伴说更短更直接，对大人说带称呼、把需要什么帮助讲清楚 */
    U.delegate(box, 'click', '[data-variant]', function (e, t) {
      var v = t.getAttribute('data-variant') === 'adult' ? 'adult' : 'peer';
      if (v === variant) return;
      variant = v;
      box.setAttribute('data-variant', v);
      U.$$('[data-variant]', box).forEach(function (b) {
        var on = b.getAttribute('data-variant') === v;
        b.classList.toggle('primary', on);
        b.classList.toggle('ghost', !on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var p = U.$('[data-say-demo-text]', box);
      if (p) { p.textContent = demoText(); UI.setReadable(p); }
      Audio.speak(demoText(), { role: 'cloud' });
    });
    U.delegate(box, 'click', '[data-say-demo]', function () {
      Audio.speak(demoText(), { role: 'cloud' });
      UI.toast('听完轮到你啦 🗣️');
    });
    if (U.$('[data-say-hide]', box)) {
      U.delegate(box, 'click', '[data-say-hide]', function () {
        box.classList.add('folded');
        Audio.stopSpeak();
      });
      U.delegate(box, 'click', '[data-say-unhide]', function () {
        box.classList.remove('folded');
      });
    }
    U.delegate(box, 'click', '[data-say-next]', function () {
      Audio.stopSpeak();
      if (onNext) onNext();
    });
    U.delegate(box, 'click', '[data-say-done]', function () {
      if (doneBtn.getAttribute('data-claimed') === '1') return;
      doneBtn.setAttribute('data-claimed', '1');
      doneBtn.disabled = true;
      doneBtn.textContent = '已说出口 ✓';
      var r = S.recordExpression(topic.id, box.getAttribute('data-frame') || '', variant);
      if (!r) {   /* 课程数据异常时不写库，但仍给孩子一句鼓励 */
        feedback.innerHTML = '<div class="feedback-box good"><b>你把话说出来啦 💛</b></div>';
        return;
      }
      var good = cheer();
      Audio.sfx('star');
      var bits = '<div class="feedback-box good"><b>' + esc(good) + '</b>' +
        '<div class="small" style="margin-top:6px">' +
        (r.star ? '收到 1 颗勇气星 ⭐'
          : '今天的勇气星已经收满 ' + starCap() + ' 颗啦，说出来本身就很棒 💛') +
        ' · 累计说出来 ' + r.total + ' 次' + (r.streak > 1 ? ' · 连续 ' + r.streak + ' 天' : '') +
        ' · 这次练的是对' + (variant === 'adult' ? '大人' : '同伴') + '说</div>' +
        r.badges.map(function (b) {
          return '<div class="say-badge">🎖️ 新贴纸：' + esc(b.title) + ' — ' + esc(b.text) + '</div>';
        }).join('') +
        '<div style="margin-top:10px"><button class="btn tiny green" data-say-again>🔄 再说一次（也算数）</button></div></div>';
      feedback.innerHTML = bits;
      var cnt = U.$('[data-say-count]', box);
      if (cnt) cnt.textContent = '今天 ' + S.expressionStats().today + ' 次';
      if (onRecord) onRecord(r);
      UI.confetti(r.badges.length ? 14 : 8);
      Audio.readAuto(good + '。' + (r.star ? '收到一颗勇气星。' : '今天的勇气星收满啦，说出来本身就很棒。') +
        (r.badges.length ? '还解锁了新贴纸：' + r.badges.map(function (b) { return b.title; }).join('、') + '。' : ''));
      U.$('[data-say-again]', feedback).addEventListener('click', function () {
        /* 又开口一次就算一次（当天星星仍封顶）。独立页会顺手换一张新情境卡；
           关卡页只有本关这一张话题，保持原话题再说一次，语义一致。 */
        feedback.innerHTML = '';
        doneBtn.disabled = false;
        doneBtn.removeAttribute('data-claimed');
        doneBtn.innerHTML = '🗣️ 我说出来啦';
        if (onNext) onNext();
      });
    });
  }

  function badgeStrip() {
    var st = S.expressionStats();
    var owned = S.current().stickers || [];
    return '<div class="say-badges">' + badges().map(function (b) {
      var got = owned.indexOf(b.id) >= 0;
      return '<div class="say-badge-item ' + (got ? 'got' : '') + '">' +
        '<span>' + (got ? '🎖️' : '🔒') + '</span><b>' + esc(b.title) + '</b>' +
        '<div class="small muted">' + (got ? esc(b.text) : '说出来累计 ' + b.at + ' 次解锁 · 目前 ' + st.total + ' 次') + '</div></div>';
    }).join('') + '</div>';
  }

  /* 独立练习页 #/express，可选 #/express/<情境卡 id> */
  function page(topicId) {
    var first = fixedTopic(topicId) || randomTopic('');
    var html = '<div class="level-shell">' +
      '<div style="margin-bottom:14px"><button class="btn ghost" data-nav="#/home">← 回首页</button></div>' +
      UI.sectionHead('说一说 · 勇气小话筒', '听一句示范，再把自己的话大声说出来', 'SPEAK UP') +
      UI.guideRow('心里的话说出来，别人才能听见呀。不用说得漂亮，说给自己听也算数。', 'cloud', 'happy') +
      '<div class="card soft" style="margin-bottom:18px" data-say-stat-slot>' + statStrip() + weekStrip() + '</div>' +
      '<div data-say-slot>' + card(first, { next: true, showAudience: true }) + '</div>' +
      '<div class="grid grid-2" style="margin-top:20px">' +
        '<div class="card"><h3>🎖️ 勇气贴纸</h3><div data-say-badge-slot>' + badgeStrip() + '</div>' +
          '<p class="small muted" style="margin-top:10px">累计说出来就能解锁，不比谁说得好。</p></div>' +
        '<div class="card"><h3>💡 三句话的小秘密</h3>' +
          '<p class="muted">「我觉得…」说出感觉，「因为…」说清事情，「我希望…」说一个小小的请求。' +
          '三句连起来，听的人就容易明白啦。</p>' +
          '<p class="small muted">这里不会录音，也不会保存你说了什么，只有你自己知道刚才说了哪句话。</p>' +
          '<button class="btn tiny blue" data-say-frames>🔊 听一遍三句话</button></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>给爸爸妈妈</h3>' +
        '<p class="muted">孩子说的时候，先听完再回应，不必急着纠正用词。可以回一句「我听见了，你希望…」，' +
        '让「说出来」带来真实的回应。软件只记录次数与日期，用来陪孩子看见自己的勇气，不作为评价依据。</p></div>' +
      '<div class="row" style="margin-top:18px"><button class="btn ghost" data-nav="#/map">去闯关 →</button>' +
        '<button class="btn ghost" data-nav="#/checkin">说说今天的心情 🌤</button></div>' +
      '</div>';
    return {
      html: html,
      mount: function (root) {
        UI.markReadable(root);
        function refresh() {
          var s = U.$('[data-say-stat-slot]', root);
          if (s) s.innerHTML = statStrip() + weekStrip();
          var b = U.$('[data-say-badge-slot]', root);
          if (b) b.innerHTML = badgeStrip();
        }
        /* 每次换卡都换掉卡片容器节点：旧节点上的事件委托随节点一起丢弃，
           否则反复换卡会叠加多个监听器，点一次却记好几次。 */
        function draw(topic, announce) {
          var slot = U.$('[data-say-slot]', root);
          if (!slot || !topic) return;
          var inner = document.createElement('div');
          inner.innerHTML = card(topic, { next: true, showAudience: true });
          slot.innerHTML = '';
          slot.appendChild(inner);
          UI.markReadable(inner);
          mount(inner, topic, function () { draw(randomTopic(topic.id), true); }, refresh);
          if (announce) {
            Audio.readAuto(['换一张情境卡。' + topic.scene + '。想好了就大声说出来。']);
          }
        }
        draw(first, false);
        U.delegate(root, 'click', '[data-say-frames]', function () {
          Audio.speak(frames().map(function (f) { return f.label + f.hint + '，例如：' + f.example; }).join('。'));
        });
      }
    };
  }

  /* 家长面板里的表达统计卡 */
  function parentCard() {
    var st = S.expressionStats();
    var fs = frames().filter(function (f) { return f.id === st.topFrame; })[0];
    var owned = S.current().stickers || [];
    var got = badges().filter(function (b) { return owned.indexOf(b.id) >= 0; }).length;
    var v = st.variants || { peer: 0, adult: 0 };
    return '<div class="card" style="margin-top:20px"><h3>🗣️ 开口表达</h3>' +
      '<div class="kpi-grid" style="margin-top:10px">' +
        '<div class="kpi"><b>' + st.total + '</b><span>累计说出来</span></div>' +
        '<div class="kpi"><b>' + st.week + '</b><span>本周次数</span></div>' +
        '<div class="kpi"><b>' + st.streak + '</b><span>连续天数</span></div>' +
        '<div class="kpi"><b>' + got + '/' + badges().length + '</b><span>勇气贴纸</span></div>' +
      '</div>' +
      weekStrip() +
      '<p class="small muted" style="margin-top:10px">两种示范各练了：对同伴说 <b>' + v.peer +
        '</b> 次 · 对大人说 <b>' + v.adult + '</b> 次。</p>' +
      '<p class="small muted" style="margin-top:10px">' +
        (st.total ? '最近一次：' + esc(U.prettyDate(st.lastAt || U.today())) +
          (fs ? ' · 最常练的句式：' + esc(fs.label) : '') : '还没有开口记录，可以从首页的「说一说」陪孩子试一次。') +
      '</p>' +
      '<p class="small muted">只记录次数、日期与用过的句式，<b>不录音、不识别、不保存孩子说过的任何一句话</b>；' +
      '同一天最多 3 颗勇气星，之后仍累计次数。这些数字用来陪伴回顾，请不要当作奖惩依据。</p>' +
      '<p class="small muted">可以试试：孩子说完先复述一句「我听见了，你希望…」，再把三句式贴到桌角，冲突后轮流说一轮。</p>' +
      '</div>';
  }

  function reportLine() {
    var st = S.expressionStats();
    return '这周把心里的话大声说出了 <b>' + st.week + '</b> 次' +
      (st.streak > 1 ? '，已经连着 <b>' + st.streak + '</b> 天愿意开口' : '') + '。';
  }

  window.SEL.expression = {
    card: card, mount: mount, page: page, parentCard: parentCard,
    levelTopic: levelTopic, randomTopic: randomTopic, cheer: cheer,
    reportLine: reportLine, statStrip: statStrip
  };
})();
