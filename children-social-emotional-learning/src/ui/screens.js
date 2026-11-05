/* 心晴岛 · 全部页面。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils, A = window.SEL.art, Audio = window.SEL.audio;
  var S = window.SEL.state, UI = window.SEL.ui, G = window.SEL.games, C = window.SEL.ui;

  var TYPE_NAME = {
    choice: '情境选择', match: '连一连', order: '排顺序', slider: '心情温度计',
    breathe: '呼吸练习', story: '互动故事', classify: '分分类'
  };
  var ISLAND_LABEL = {
    awareness: '自我认知', management: '自我管理', social: '社会认知',
    relationship: '人际关系', decision: '负责任决策'
  };

  function D() { return S.data(); }
  function esc(s) { return U.esc(s); }
  function totalLevels() { return S.allLevels().length; }
  function gameTypeCount() {
    var seen = {};
    S.allLevels().forEach(function (l) { seen[l.level.type] = 1; });
    return Object.keys(seen).length;
  }
  function appVersion() {
    var m = document.querySelector('meta[name="app-version"]');
    return (m && m.getAttribute('content')) || '';
  }
  function navBtn(hash, label, cls) {
    return '<button class="btn ' + (cls || 'ghost') + '" data-nav="' + hash + '">' + label + '</button>';
  }
  function backRow(hash, label) {
    return '<div style="margin-bottom:14px">' + navBtn(hash, '← ' + (label || '返回')) + '</div>';
  }
  function wrap(inner, mount) { return { html: inner, mount: mount || function () {} }; }

  /* ==================== 首页 ==================== */
  function home() {
    var p = S.current(), st = S.stats();
    var doneToday = p.checkins.some(function (c) { return c.date === U.today(); });
    var html =
      '<div class="hero">' +
        '<div><div class="eyebrow">给 6-10 岁小朋友的社会情绪冒险</div>' +
        '<h1>心里的小天气，<br><span>也值得被看见</span> ☁️</h1>' +
        '<p>和团团、咕咕老师一起，认识情绪、练会冷静、听懂别人、交到朋友，再学着做出让自己安心的小决定。</p>' +
        '<div class="actions">' +
          '<button class="btn primary big" data-nav="#/map">开始探险 🚀</button>' +
          '<button class="btn blue big" data-nav="#/checkin">' + (doneToday ? '再记一次心情 🌿' : '今天的心情签到 🌤') + '</button>' +
        '</div>' +
        '<div class="hero-help"><button class="btn tiny ghost" data-nav="#/help">ℹ️ 玩法说明（小朋友和爸爸妈妈都能看）</button></div>' +
        '<div class="hero-stat">' +
          '<div><b>⭐ ' + p.stars + '</b><span>收集到的星星</span></div>' +
          '<div><b>' + st.doneLevels + '/' + st.totalLevels + '</b><span>完成的小关卡</span></div>' +
          '<div><b>' + st.checkins + '</b><span>记下的心情</span></div>' +
          '<div><b>' + st.streak + '</b><span>连续签到天数</span></div>' +
        '</div></div>' +
        '<div class="hero-art">' +
          '<span class="buddy-owl">' + A.buddy('owl', 'happy', 92) + '</span>' +
          '<span class="buddy-main">' + A.buddy('cloud', 'happy', 160) + '</span>' +
          '<span class="buddy-fox">' + A.buddy('fox', 'happy', 96) + '</span>' +
        '</div></div>' +

      '<div class="daily-banner">' +
        '<div style="font-size:38px">' + (doneToday ? '🌻' : '🌤') + '</div>' +
        '<div style="flex:1"><b>' + (doneToday ? '今天已经和团团打过招呼啦' : '先花 1 分钟，看看现在的心情') + '</b>' +
        '<div class="small muted">' + (doneToday ? '情绪会变，随时可以再记一次，还会长出一朵新的心情花。' : '选一个情绪、说说为什么，再种一朵心情花。每天第一次签到有 1 颗星。') + '</div></div>' +
        '<button class="btn ' + (doneToday ? 'green' : 'primary') + '" data-nav="#/checkin">' + (doneToday ? '再记一次' : '去签到 →') + '</button>' +
      '</div>' +

      UI.sectionHead('今天想玩什么？', '每一个入口都是一小段旅程', 'EXPLORE') +
      '<div class="quick-grid">' +
        '<a class="quick-card" href="#/map" data-nav="#/map"><span class="qc-icon">🏝️</span><b>五座小岛</b><span>' + totalLevels() + ' 个互动关卡</span></a>' +
        '<a class="quick-card" href="#/emotions" data-nav="#/emotions"><span class="qc-icon">🎭</span><b>情绪图鉴</b><span>认出心里的小天气</span></a>' +
        '<a class="quick-card" href="#/strategies" data-nav="#/strategies"><span class="qc-icon">🧰</span><b>冷静工具箱</b><span>5 个随时能用的小方法</span></a>' +
        '<a class="quick-card" href="#/garden" data-nav="#/garden"><span class="qc-icon">🌷</span><b>心情花园</b><span>看看记下的每一天</span></a>' +
      '</div>' +

      '<div class="grid grid-2" style="margin-top:22px">' +
        '<div class="card"><h3>🌈 在这里，没有「答错」</h3>' +
          '<p class="muted">每个选择都会告诉你「接下来可能发生什么」。所有情绪都可以存在，我们只一起看看怎么表达更舒服。</p>' +
          '<div class="row tight"><span class="chip">自我认知</span><span class="chip blue">自我管理</span><span class="chip green">社会认知</span><span class="chip purple">人际关系</span><span class="chip">负责任决策</span></div></div>' +
        '<div class="card"><h3>🔒 只属于这台电脑</h3>' +
          '<p class="muted">不需要账号、不联网、没有广告，也不会把孩子的记录发给任何人。所有内容都保存在本机，家长可以随时导出备份或清空。</p>' +
          '<button class="btn tiny ghost" data-nav="#/parent">家长 / 老师专区 →</button></div>' +
      '</div>';
    return wrap(html);
  }

  /* ==================== 玩法说明 ==================== */
  function help() {
    var html =
      backRow('#/home', '回首页') +
      UI.sectionHead('玩法说明', '给小朋友和爸爸妈妈的一张小地图', 'HOW TO PLAY') +
      '<div class="card soft" style="margin-bottom:18px">' +
        '<p class="muted">心晴岛是一段关于「认识情绪、照顾自己、和朋友相处」的小冒险。这里没有「答错」——' +
        '每一个选择都会告诉你接下来可能发生什么，所有情绪都值得被看见。</p>' +
        '<div class="row tight"><span class="chip">自我认知</span><span class="chip blue">自我管理</span>' +
        '<span class="chip green">社会认知</span><span class="chip purple">人际关系</span><span class="chip">负责任决策</span></div>' +
      '</div>' +

      '<div class="grid grid-2">' +
        '<div class="card"><h3>🌤 每天心情签到</h3>' +
          '<p class="muted">选一个现在的情绪、说说为什么，再种一朵心情花。每天第一次签到会得 1 颗星，连续签到还有小惊喜。</p></div>' +
        '<div class="card"><h3>🏝️ ' + S.data().islands.length + ' 座小岛 ' + totalLevels() + ' 关</h3>' +
          '<p class="muted">用星星解锁新岛，按顺序玩更顺。每关有情境选择、连一连、排顺序等 ' + gameTypeCount() + ' 种小游戏，完成得星星和贴纸。</p></div>' +
        '<div class="card"><h3>🧰 冷静工具箱</h3>' +
          '<p class="muted">' + S.data().strategies.length + ' 个随时能用的小方法：觉察、呼吸、应对、拉开距离、表达。生气或紧张时，跟着做一遍就好。</p></div>' +
        '<div class="card"><h3>🌷 心情花园</h3>' +
          '<p class="muted">记下的每一天都会开出一朵花。翻翻看，就能看见自己情绪的小天气是怎么变化的。</p></div>' +
      '</div>' +

      '<div class="card" style="margin-top:18px"><h3>🔒 爸爸妈妈放心的小设计</h3>' +
        '<ul class="muted" style="margin:6px 0 0 18px;line-height:1.8">' +
          '<li>不需要账号、不联网、没有广告，所有内容都保存在这台电脑上。</li>' +
          '<li>「家长 / 老师专区」用一道算术题挡住小朋友，里面可以看进度、导出备份或清空数据。</li>' +
          '<li>如果愿意，可以对着屏幕点「读给我听」，软件会用中文把文字念出来（需要电脑已安装中文语音）。</li>' +
        '</ul>' +
        '<button class="btn tiny ghost" data-nav="#/parent">去家长 / 老师专区 →</button></div>';
    return wrap(html);
  }

  /* ==================== 地图 ==================== */
  function map() {
    var p = S.current(), st = S.stats();
    var islands = D().islands || [];
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('五座小岛', '攒星星解锁新岛屿，按顺序玩更有趣', 'ADVENTURE MAP') +
      '<div class="card soft" style="margin-bottom:20px"><div class="spread">' +
        '<div><b>⭐ ' + p.stars + ' 颗星星</b><div class="small muted">完成 ' + st.doneLevels + ' / ' + st.totalLevels + ' 个小关卡</div></div>' +
        '<div style="flex:1;min-width:200px">' + UI.progressBar(st.totalLevels ? st.doneLevels / st.totalLevels * 100 : 0) + '</div>' +
      '</div></div>' +
      '<div class="island-grid">' + islands.map(function (is) {
        var unlocked = S.isIslandUnlocked(is);
        var done = (is.levels || []).filter(function (l) { return p.levels[l.id] && p.levels[l.id].done; }).length;
        var total = (is.levels || []).length;
        return '<button class="island-card ' + (unlocked ? '' : 'locked') + '" ' +
          (unlocked ? 'data-nav="#/island/' + esc(is.id) + '"' : 'data-locked="1"') +
          ' style="background:linear-gradient(140deg,' + esc(is.color || '#FFC94A') + '55, ' + esc(is.color || '#FFC94A') + 'CC)">' +
          '<div class="ic-deco">' + esc(is.emoji || '🏝️') + '</div>' +
          '<div class="ic-emoji">' + esc(is.emoji || '🏝️') + '</div>' +
          '<h3>' + esc(is.name) + '</h3>' +
          '<div class="ic-skill">' + esc(is.skill) + ' · ' + esc(is.subtitle || '') + '</div>' +
          '<div class="ic-desc">' + esc(is.desc || '') + '</div>' +
          (unlocked ? '' : '<div class="lock-badge">🔒 需要 ' + (is.unlockAt || 0) + ' ⭐</div>') +
          '<div class="ic-progress">' + UI.progressBar(total ? done / total * 100 : 0, done + ' / ' + total + ' 关') + '</div>' +
          '</button>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:22px"><div class="spread">' +
        '<div><h3>🧰 随时都能用</h3><p class="muted small" style="margin:0">情绪上来了？先去工具箱做个呼吸，再回来探险。</p></div>' +
        '<button class="btn blue" data-nav="#/strategies">打开冷静工具箱</button></div></div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-locked]', function () {
        UI.toast('再攒几颗星星，这座岛就开啦 ⭐');
        Audio.sfx('tryagain');
      });
    });
  }

  /* ==================== 单座岛 ==================== */
  function island(id) {
    var is = (D().islands || []).filter(function (x) { return x.id === id; })[0];
    if (!is) return wrap(UI.emptyState('🗺️', '没找到这座岛', '回地图看看别的岛吧', navBtn('#/map', '回地图', 'primary')));
    var p = S.current();
    if (!S.isIslandUnlocked(is, p)) {
      var need = Math.max(1, (is.unlockAt || 0) - p.stars);
      return wrap(backRow('#/map', '回地图') +
        UI.emptyState('🔒', is.name + ' 还没开门', '再攒 ' + need + ' 颗星星，这座岛就开啦。',
          navBtn('#/map', '回地图', 'primary')), function () {
            UI.toast('再攒几颗星星，这座岛就开啦 ⭐');
          });
    }
    var levels = is.levels || [];
    var done = levels.filter(function (l) { return p.levels[l.id] && p.levels[l.id].done; }).length;
    var tips = (D().parentTips || {})[id] || [];
    var html = backRow('#/map', '回地图') +
      '<div class="card" style="background:linear-gradient(135deg,' + esc(is.color || '#FFC94A') + '33,#fff)">' +
      '<div class="spread"><div><div class="eyebrow">' + esc(is.skill) + '</div>' +
      '<h2 style="font-size:32px;margin:6px 0">' + esc(is.emoji || '') + ' ' + esc(is.name) + '</h2>' +
      '<p class="muted" style="max-width:620px">' + esc(is.desc || '') + '</p></div>' +
      '<div style="font-size:70px">' + esc(is.emoji || '🏝️') + '</div></div>' +
      '<div style="margin-top:14px">' + UI.progressBar(levels.length ? done / levels.length * 100 : 0, '已完成 ' + done + ' / ' + levels.length + ' 关') + '</div></div>' +
      UI.guideRow(is.levels && is.levels.length ? '这一岛有 ' + levels.length + ' 个小挑战，一个一个来，我陪着你。' : '这里还在搭建中。', 'owl', 'happy') +
      UI.sectionHead('小挑战', '完成一关，下一关就开门', 'LEVELS') +
      '<div class="level-list">' + levels.map(function (lv, i) {
        var rec = p.levels[lv.id];
        var unlocked = S.isLevelUnlocked(is, i);
        var teach = String(lv.teach || '');
        var teaser = esc(teach.slice(0, 24)) + (teach.length > 24 ? '…' : '');
        return '<button class="level-card ' + (rec && rec.done ? 'done' : '') + ' ' + (unlocked ? '' : 'locked') + '" ' +
          (unlocked ? 'data-nav="#/level/' + esc(lv.id) + '"' : 'data-locklevel="1"') + '>' +
          '<span class="num">' + (rec && rec.done ? '✓' : (i + 1)) + '</span>' +
          '<span><b>' + esc(lv.title) + '</b><div class="lv-type">' + (TYPE_NAME[lv.type] || lv.type) + ' · ' + teaser + '</div></span>' +
          '<span style="margin-left:auto">' + UI.starRow(rec ? rec.stars : 0, 3) + '</span>' +
          '<span class="lv-arrow">' + (unlocked ? '→' : '🔒') + '</span></button>';
      }).join('') + '</div>' +
      (tips.length ? '<div class="card" style="margin-top:22px"><h3>👨‍👩‍👧 给大人的一句话</h3><ul>' +
        tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '');
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-locklevel]', function () { UI.toast('先完成上一关，这里就开门啦 🔑'); });
    });
  }

  /* ==================== 关卡 ==================== */
  function level(levelId) {
    var found = S.findLevel(levelId);
    if (!found) return wrap(UI.emptyState('🔍', '没找到这一关', '回地图看看', navBtn('#/map', '回地图', 'primary')));
    var lv = found.level, is = found.island;
    var p = S.current();
    var idx = is.levels.indexOf(lv);
    var rec = p.levels[lv.id];
    /* 已完成的关卡允许重玩；未完成的必须按顺序解锁，防止直接改 hash 跳关 */
    var accessible = S.isLevelUnlocked(is, idx, p) || !!(rec && rec.done);
    if (!accessible) {
      var need = Math.max(0, (is.unlockAt || 0) - p.stars);
      return wrap(backRow('#/map', '回地图') +
        UI.emptyState('🔒', is.name + ' 还没开门',
          need > 0 ? '再攒 ' + need + ' 颗星星，这座岛就开啦。' : '先完成上一个关卡，这里就开门啦。',
          navBtn('#/map', '回地图', 'primary')), function () {
            UI.toast('先完成前面的关卡，再来这里 🔑');
          });
    }

    var completed = false;
    var ctx = {
      complete: function (res) {
        if (completed) return;   /* 防止连点「收下星星」重复结算 */
        completed = true;
        var out = S.completeLevel(levelId, res.stars);
        UI.confetti(18);
        var sticker = (D().stickers || []).filter(function (s) { return s.id === out.newSticker; })[0];
        var all = S.allLevels();
        var at = all.findIndex(function (x) { return x.level.id === levelId; });
        var next = at >= 0 ? all[at + 1] : null;
        var nextOpen = !!next && (S.isLevelUnlocked(next.island, next.index, S.current()) ||
          !!(S.current().levels[next.level.id] && S.current().levels[next.level.id].done));
        var body = '<div class="big-stars">' + UI.starRow(res.stars, 3) + '</div>' +
          '<p>' + esc(res.title || '完成啦') + '</p>' +
          (res.feedback ? '<p class="muted small">' + esc(res.feedback) + '</p>' : '') +
          '<div class="feedback-box good" style="text-align:left;margin-top:14px"><b>🌱 今天学到</b>' + esc(lv.teach || '') + '</div>' +
          (sticker ? '<div class="chip green" style="margin-top:12px">🎁 新贴纸：' + esc(sticker.emoji || '') + ' ' + esc(sticker.name) + '</div>' : '') +
          '<p class="small muted" style="margin-top:14px">给大人：' + esc(lv.tip || '') + '</p>';
        var actions = [];
        if (nextOpen) actions.push({ label: '下一关 →', cls: 'primary', nav: '#/level/' + next.level.id });
        actions.push({ label: '回岛屿', cls: 'blue', nav: '#/island/' + is.id });
        actions.push({ label: '再玩一次', cls: 'ghost', act: 'replay' });
        UI.modal({ title: '这一关走完啦 🎉', art: '⭐', body: body, actions: actions }, function (act) {
          if (act === 'replay') { UI.closeModal(); window.SEL.render(); }
        });
        Audio.sfx('win');
      }
    };
    var game = G.render(lv, ctx);
    var html = '<div class="level-shell">' + backRow('#/island/' + is.id, '回' + is.name) +
      '<div class="level-head"><h2>' + esc(lv.title) + '</h2>' +
      '<span class="chip">' + esc(is.skill) + '</span>' + '<span class="chip blue">' + (TYPE_NAME[lv.type] || lv.type) + '</span>' +
      '<div style="margin-left:auto">' + UI.starRow(rec ? rec.stars : 0, 3) + '</div></div>' +
      UI.guideRow(lv.intro || '我们一起来试试看！', 'cloud', 'happy') +
      game.html +
      '<div class="center small muted" style="margin-top:20px">慢慢来，没有时间限制，也没有「答错」这回事 🌿</div></div>';
    return wrap(html, function (root) { game.mount(root); });
  }

  /* ==================== 情绪图鉴 ==================== */
  function emotions() {
    var list = D().emotions || [];
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('情绪图鉴', '点开每一张脸，看看它在身体里是什么样', 'FEELINGS') +
      UI.guideRow('情绪没有好坏，它只是来告诉你一件事：你现在需要点什么。', 'owl', 'calm') +
      '<div class="emotion-grid">' + list.map(function (e, i) {
        return '<button class="emotion-card" data-em="' + i + '">' + A.face(e.face || e.id, 72, e.color) +
          '<b>' + esc(e.name) + '</b><small>' + esc(e.emoji || '') + ' 点开看看</small></button>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:22px"><h3>💡 一个小秘密</h3>' +
      '<p class="muted">同一种情绪，也会有一点点和满满的区别。能说出「我现在有一点生气」和「我非常生气」，别人就更容易明白怎么帮你。</p>' +
      '<button class="btn blue" data-nav="#/checkin">去说说现在的心情 →</button></div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-em]', function (e, t) {
        var em = list[Number(t.getAttribute('data-em'))];
        if (!em) return;
        Audio.sfx('pop');
        UI.modal({
          title: em.emoji + ' ' + em.name, art: A.face(em.face || em.id, 110, em.color),
          body: '<div class="feedback-box" style="text-align:left"><b>身体里会发生什么</b>' + esc(em.body || '') + '</div>' +
            '<div class="row tight" style="margin:12px 0">' + (em.cues || []).map(function (c) { return '<span class="chip blue">' + esc(c) + '</span>'; }).join('') + '</div>' +
            '<p class="small muted">还可以说：' + (em.words || []).map(esc).join('、') + '</p>' +
            '<button class="btn tiny green" data-nav="#/strategies">试试推荐的小方法 🧰</button>',
          actions: [{ label: '知道啦', cls: 'primary', close: true }]
        });
      });
    });
  }

  /* ==================== 每日签到（4 步） ==================== */
  function checkin() {
    var list = D().emotions || [];
    var strategies = D().strategies || [];
    var state = { step: 0, emotion: null, intensity: 3, reason: '', strategy: null };
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('今天的心情签到', '四小步，种一朵属于今天的花', 'DAILY CHECK-IN') +
      '<div class="step-dots" data-dots></div>' +
      '<div class="card" data-checkin-body></div>';

    return wrap(html, function (root) {
      var body = U.$('[data-checkin-body]', root);
      var dots = U.$('[data-dots]', root);
      var lastPlantAt = 0;
      function draw() {
        dots.innerHTML = [0, 1, 2, 3].map(function (i) { return '<i class="' + (i <= state.step ? 'on' : '') + '"></i>'; }).join('');
        var s = '';
        if (state.step === 0) {
          s = '<h3>1️⃣ 现在，心里是什么天气？</h3><p class="muted small">选最像的那个，选错了也没关系。</p>' +
            '<div class="emotion-grid" style="margin-top:14px">' + list.map(function (e, i) {
              return '<button class="emotion-card ' + (state.emotion === e.id ? 'active' : '') + '" data-pick="' + i + '">' +
                A.face(e.face || e.id, 72, e.color) + '<b>' + esc(e.name) + '</b></button>';
            }).join('') + '</div>' +
            '<div class="center" style="margin-top:18px"><button class="btn primary" data-next ' + (state.emotion ? '' : 'disabled') + '>下一步 →</button></div>';
        } else if (state.step === 1) {
          var em = list.filter(function (x) { return x.id === state.emotion; })[0] || {};
          var reasons = (D().checkinReasons || {})[state.emotion] || [];
          s = '<h3>2️⃣ 这份感觉有多强？为什么？</h3>' +
            '<div class="slider-wrap" style="padding:8px">' +
            '<div class="slider-face">' + A.face(em.face || 'calm', 120, em.color) + '</div>' +
            '<div class="slider-value" data-val>' + state.intensity + '</div>' +
            '<input type="range" min="1" max="5" step="1" value="' + state.intensity + '" data-range aria-label="情绪强度">' +
            '<div class="slider-labels"><span>一点点</span><span>非常多</span></div></div>' +
            '<h4 style="margin:14px 0 8px">可能是因为…（选一个，也可以不选）</h4>' +
            '<div class="reason-grid">' + reasons.map(function (r, i) {
              return '<button class="reason-btn ' + (state.reason === r ? 'active' : '') + '" data-reason="' + i + '">' + esc(r) + '</button>';
            }).join('') + '</div>' +
            '<div class="row" style="margin-top:18px"><button class="btn ghost" data-back>← 上一步</button>' +
            '<button class="btn primary" data-next>下一步 →</button></div>';
        } else if (state.step === 2) {
          var em2 = list.filter(function (x) { return x.id === state.emotion; })[0] || {};
          var st = strategies.filter(function (x) { return x.id === (em2.strategy || state.strategy); })[0] || strategies[0] || {};
          state.strategy = st.id;
          s = '<h3>3️⃣ 送自己一个小方法 🧰</h3>' +
            '<p class="muted small">感觉到「' + esc(em2.name || '') + '」的时候，可以试试这个。不一定要马上做好，练一练就好。</p>' +
            '<div class="strategy-card" style="margin-top:14px"><div class="st-emoji">' + esc(st.emoji || '🌿') + '</div>' +
            '<div><b>' + esc(st.name || '') + '</b><span class="chip purple" style="margin-left:8px">' + esc(st.muscle || '') + '</span>' +
            '<p class="small muted" style="margin:6px 0">' + esc(st.desc || '') + '</p>' +
            '<ol>' + (st.steps || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div></div>' +
            '<div class="row" style="margin-top:18px">' +
            '<button class="btn ghost" data-back>← 上一步</button>' +
            '<button class="btn blue" data-practice>现在练一练 ▶</button>' +
            '<button class="btn primary" data-next>先记下来 →</button></div>';
        } else {
          var em3 = list.filter(function (x) { return x.id === state.emotion; })[0] || {};
          var doneToday = S.current().checkins.some(function (c) { return c.date === U.today(); });
          s = '<h3>4️⃣ 把今天种进花园 🌷</h3>' +
            '<div class="center" style="margin:10px 0">' + A.flower(em3.color, Math.floor(Math.random() * 5), 110) + '</div>' +
            '<div class="center"><b>' + esc(em3.name || '') + ' · ' + state.intensity + ' 格</b>' +
            (state.reason ? '<div class="small muted">因为：' + esc(state.reason) + '</div>' : '') +
            '<p class="small muted" style="margin-top:8px">' + (doneToday ? '今天已经记过一次，还可以再种一朵。' : '今天的第一次签到，会收到 1 颗星 ⭐') + '</p></div>' +
            '<div class="row" style="margin-top:18px"><button class="btn ghost" data-back>← 上一步</button>' +
            '<button class="btn green" data-plant>种下这朵花 🌱</button></div>';
        }
        body.innerHTML = s;
        bindRange();
      }

      /* 每次重绘只需给新的滑块绑事件；事件委托在下面只注册一次，避免重复触发 */
      function bindRange() {
        var range = U.$('[data-range]', body);
        if (range) range.addEventListener('input', function () {
          state.intensity = Number(range.value);
          var v = U.$('[data-val]', body); if (v) v.textContent = range.value;
        });
      }

      (function bindOnce() {
        U.delegate(body, 'click', '[data-pick]', function (e, t) {
          var picked = list[Number(t.getAttribute('data-pick'))];
          if (!picked) return;
          /* 换了情绪，上一种情绪选过的原因就不该继续挂着 */
          if (state.emotion !== picked.id) state.reason = '';
          state.emotion = picked.id;
          Audio.sfx('select'); Audio.speak('你现在觉得' + picked.name);
          draw();
        });
        U.delegate(body, 'click', '[data-reason]', function (e, t) {
          var rs = (D().checkinReasons || {})[state.emotion] || [];
          var r = rs[Number(t.getAttribute('data-reason'))];
          state.reason = (state.reason === r) ? '' : r;
          Audio.sfx('tap'); draw();
        });
        U.delegate(body, 'click', '[data-next]', function () { Audio.sfx('pop'); state.step = Math.min(3, state.step + 1); draw(); });
        U.delegate(body, 'click', '[data-back]', function () { Audio.sfx('tap'); state.step = Math.max(0, state.step - 1); draw(); });
        U.delegate(body, 'click', '[data-practice]', function () { runStrategy(state.strategy); });
        U.delegate(body, 'click', '[data-plant]', function () {
          var now = Date.now();
          /* 防连点重复种花，但不阻止关掉弹窗后再记一朵 */
          if (now - lastPlantAt < 800) return;
          lastPlantAt = now;
          var em = list.filter(function (x) { return x.id === state.emotion; })[0] || {};
          var r = S.addCheckin({
            date: U.today(), emotion: state.emotion, intensity: state.intensity,
            reason: state.reason, strategy: state.strategy, color: em.color || '#FFC94A'
          });
          Audio.sfx('plant'); UI.confetti(14);
          UI.modal({
            title: '种好啦 🌷', art: A.flower(em.color || '#FFC94A', 1, 110),
            body: '<p>今天的心情被好好收起来了。</p>' +
              (r.star ? '<div class="chip">⭐ 今天第一次签到，+1 颗星</div>' : '<p class="small muted">今天已经记过啦，这一朵是新的。</p>') +
              '<p class="small muted" style="margin-top:12px">情绪会变，明天、甚至一小时后，都可以再来记一次。</p>',
            actions: [
              { label: '去花园看看', cls: 'green', nav: '#/garden' },
              { label: '回首页', cls: 'primary', nav: '#/home' },
              { label: '再记一次', cls: 'ghost', act: 'again' }
            ]
          }, function (act) {
            if (act === 'again') { UI.closeModal(); window.SEL.render(); }
          });
        });
      })();
      draw();
    });
  }

  /* ==================== 策略工具箱（含随时可练的小练习） ==================== */
  function strategies() {
    var list = D().strategies || [];
    var p = S.current();
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('冷静工具箱', '情绪大的时候，挑一个用一用', 'TOOLBOX') +
      UI.guideRow('这些方法就像口袋里的小工具，用得越多，越顺手。不用等到难过才练哦。', 'fox', 'calm') +
      '<div class="grid grid-2">' + list.map(function (st) {
        var n = p.strategyCount[st.id] || 0;
        return '<div class="card"><div class="spread"><div class="row"><span style="font-size:38px">' + esc(st.emoji || '') + '</span>' +
          '<div><h3>' + esc(st.name) + '</h3><span class="chip purple">' + esc(st.muscle || '') + '</span></div></div>' +
          '<span class="chip green">练过 ' + n + ' 次</span></div>' +
          '<p class="muted small" style="margin-top:10px">' + esc(st.desc || '') + '</p>' +
          '<ol class="small">' + (st.steps || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
          '<button class="btn blue" data-practice="' + esc(st.id) + '">现在练一练 ▶</button></div>';
      }).join('') + '</div>' +
      '<div class="card center" style="margin-top:22px"><h3>🌿 任何情绪都可以存在</h3>' +
      '<p class="muted">工具不是用来把情绪赶走的，是帮你留出一点点空间，再决定怎么做。</p>' +
      '<button class="btn primary" data-nav="#/checkin">说说现在的心情 →</button></div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-practice]', function (e, t) { runStrategy(t.getAttribute('data-practice')); });
    });
  }

  /* 通用练习弹窗：呼吸类有节奏动画，其余为步骤 + 计时 */
  function runStrategy(id) {
    var st = (D().strategies || []).filter(function (x) { return x.id === id; })[0];
    if (!st) return;
    var seconds = Math.min(90, Math.max(15, st.seconds || 45));
    var isBreath = st.id === 'breathing';
    var body = '<div class="center" data-run="1">' +
      '<div class="breath-orb" data-orb style="width:150px;height:150px;font-size:19px">准备好了吗</div>' +
      '<p class="breath-cue" data-cue style="font-size:17px;margin-top:14px">' + esc(st.desc || '') + '</p>' +
      '<div class="row" style="justify-content:center;margin-top:10px">' +
      (st.steps || []).map(function (x, i) { return '<span class="chip blue">' + (i + 1) + '. ' + esc(x) + '</span>'; }).join('') + '</div>' +
      '<div style="margin-top:18px"><button class="btn primary" data-modal-act="start">开始 ' + seconds + ' 秒 ▶</button></div>' +
      '<div class="small muted" style="margin-top:10px">随时可以关掉，练过一点点也算数。</div></div>';
    UI.modal({ title: st.emoji + ' ' + st.name, body: body, actions: [{ label: '结束练习', cls: 'ghost', close: true }] }, function (act, ov) {
      if (act !== 'start') return;
      var run = U.$('[data-run]', ov);
      if (!run) return;
      var orb = U.$('[data-orb]', run), cue = U.$('[data-cue]', run);
      var left = seconds;
      U.$('[data-modal-act="start"]', run).disabled = true;
      Audio.unlock(); Audio.sfx('pop');
      var timer = setInterval(function () {
        if (!document.body.contains(run)) { clearInterval(timer); return; }
        left--;
        var phase = isBreath ? (left % 8) : 0;
        if (isBreath) {
          var inhale = phase < 4;
          orb.className = 'breath-orb ' + (inhale ? 'in' : 'out');
          orb.textContent = (inhale ? '吸气' : '呼气') + ' ' + left;
          cue.textContent = inhale ? '慢慢吸，肚子鼓起来 🫧' : '慢慢呼，肩膀放下来 🌿';
        } else {
          orb.textContent = String(left);
          cue.textContent = (st.steps || [])[Math.floor((seconds - left) / Math.max(1, Math.floor(seconds / Math.max(1, (st.steps || []).length))))] || '照着步骤，慢慢来';
        }
        if (left % 4 === 0) Audio.sfx('bubble');
        if (left <= 0) {
          clearInterval(timer);
          orb.className = 'breath-orb';
          orb.textContent = '做到啦';
          cue.textContent = '你刚刚给自己留了一点点空间 🌿';
          S.practiceStrategy(st.id);
          Audio.sfx('win'); UI.confetti(10);
          var b = document.createElement('div');
          b.className = 'chip green';
          b.style.marginTop = '14px';
          b.textContent = '练习次数 +1';
          run.appendChild(b);
        }
      }, 1000);
    });
  }

  /* ==================== 心情花园 ==================== */
  function garden() {
    var p = S.current();
    var flowers = p.flowers.slice().reverse();
    var counts = {};
    flowers.forEach(function (f) { counts[f.emotion] = (counts[f.emotion] || 0) + 1; });
    var emotionName = {};
    (D().emotions || []).forEach(function (e) { emotionName[e.id] = e; });
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('心情花园', '每一次签到，都会长出一朵花', 'MIND GARDEN') +
      '<div class="card soft" style="margin-bottom:18px"><div class="spread">' +
        '<div><b>🌷 一共 ' + flowers.length + ' 朵</b><div class="small muted">这里有各种各样的心情，每一朵都好好留着。</div></div>' +
        '<button class="btn primary" data-nav="#/checkin">再种一朵 🌱</button></div></div>' +
      (flowers.length ? '<div class="garden-grid">' + flowers.map(function (f, i) {
        var e = emotionName[f.emotion] || {};
        return '<button class="flower-card" data-flower="' + i + '">' + A.flower(f.color, f.petal, 84) +
          '<small>' + esc(U.prettyDate(f.date)) + '</small><small>' + esc(e.name || '') + '</small></button>';
      }).join('') + '</div>' : UI.emptyState('🌱', '花园还空着', '去完成一次心情签到，就会开出第一朵花', navBtn('#/checkin', '去签到', 'primary'))) +
      (flowers.length ? '<div class="card" style="margin-top:22px"><h3>🌈 花园里的天气</h3>' +
        '<div class="row">' + Object.keys(counts).map(function (k) {
          var e = emotionName[k] || {};
          return '<span class="chip" style="background:' + esc(e.color || '#FFF1C9') + '66">' + esc(e.emoji || '') + ' ' + esc(e.name || k) + ' × ' + counts[k] + '</span>';
        }).join('') + '</div>' +
        '<p class="small muted" style="margin-top:12px">看到各种各样的心情很正常。它们来来去去，像天气一样。</p></div>' : '');
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-flower]', function (e, t) {
        var f = flowers[Number(t.getAttribute('data-flower'))];
        if (!f) return;
        var em = emotionName[f.emotion] || {};
        /* 同一天同一情绪可能记过多次，取最后一次，而不是最早的 */
        var rec = {};
        for (var i = p.checkins.length - 1; i >= 0; i--) {
          if (p.checkins[i].date === f.date && p.checkins[i].emotion === f.emotion) { rec = p.checkins[i]; break; }
        }
        UI.modal({
          title: U.prettyDate(f.date) + ' 的花', art: A.flower(f.color, f.petal, 100),
          body: '<p><b>' + esc(em.emoji || '') + ' ' + esc(em.name || '') + '</b>' + (rec.intensity ? ' · ' + rec.intensity + ' 格' : '') + '</p>' +
            (rec.reason ? '<p class="muted">因为：' + esc(rec.reason) + '</p>' : '') +
            '<p class="small muted">那天的心情，被好好收起来了 🌿</p>',
          actions: [{ label: '关上', cls: 'primary', close: true }]
        });
      });
    });
  }

  /* ==================== 贴纸册 ==================== */
  function stickers() {
    var p = S.current();
    var list = D().stickers || [];
    var got = p.stickers.length;
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('我的贴纸册', '完成关卡就能收集', 'STICKERS') +
      '<div class="card soft" style="margin-bottom:18px">' + UI.progressBar(list.length ? got / list.length * 100 : 0, got + ' / ' + list.length + ' 张') + '</div>' +
      '<div class="sticker-grid">' + list.map(function (s) {
        var owned = p.stickers.indexOf(s.id) >= 0;
        return '<div class="sticker-card ' + (owned ? '' : 'locked') + '">' +
          '<span class="s-emoji">' + esc(s.emoji || '⭐') + '</span><b>' + esc(owned ? s.name : '还没解锁') + '</b>' +
          '<small>' + esc(owned ? s.desc : '继续探险就能找到它') + '</small></div>';
      }).join('') + '</div>' +
      '<div class="center" style="margin-top:22px">' + navBtn('#/map', '去探险，收集更多贴纸 →', 'primary') + '</div>';
    return wrap(html);
  }

  /* ==================== 家长 / 老师专区 ==================== */
  function parent() {
    var passed = false;
    try { passed = window.sessionStorage.getItem('sunny-parent-ok') === '1'; } catch (e) {}
    if (!passed) {
      var a = 6 + Math.floor(Math.random() * 5), b = 4 + Math.floor(Math.random() * 6);
      var html = '<div class="gate card"><div style="font-size:48px">👨‍👩‍👧</div>' +
        '<h2>家长 / 老师专区</h2><p class="muted">这里放着孩子的进度记录。请大人来算一下：</p>' +
        '<h3 style="margin:14px 0">' + a + ' + ' + b + ' = ?</h3>' +
        '<input type="number" data-gate-input placeholder="?" aria-label="答案">' +
        '<div style="margin-top:16px"><button class="btn primary" data-gate-ok>进入 →</button></div>' +
        '<p class="small muted" style="margin-top:14px">这只是避免小朋友误入的小门槛，不是密码保护。</p>' +
        '<div style="margin-top:10px">' + navBtn('#/home', '回首页') + '</div></div>';
      return wrap(html, function (root) {
        function check() {
          var v = Number(U.$('[data-gate-input]', root).value);
          if (v === a + b) {
            try { window.sessionStorage.setItem('sunny-parent-ok', '1'); } catch (e) {}
            window.SEL.render();
          } else { UI.toast('再算一次试试 🙂'); Audio.sfx('tryagain'); }
        }
        U.delegate(root, 'click', '[data-gate-ok]', check);
        var inp = U.$('[data-gate-input]', root);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
        inp.focus();
      });
    }
    var p = S.current(), st = S.stats();
    var islands = D().islands || [];
    var labels = islands.map(function (i) { return i.skill || i.name; });
    var values = islands.map(function (i) { return p.skills[i.id] || 0; });
    var weak = islands.slice().sort(function (x, y) { return (p.skills[x.id] || 0) - (p.skills[y.id] || 0); }).slice(0, 2);
    var tips = D().parentTips || {};
    var emotions = D().emotions || [];
    var levelRows = S.allLevels().map(function (x) {
      var r = p.levels[x.level.id];
      return '<tr><td>' + esc(x.island.skill) + '</td><td>' + esc(x.level.title) + '</td>' +
        '<td>' + (r && r.done ? '已完成' : '未开始') + '</td><td>' + (r ? UI.starRow(r.stars, 3) : '—') + '</td></tr>';
    }).join('');
    var cal = '';
    for (var i = 13; i >= 0; i--) {
      var day = U.daysAgo(i);
      var on = p.checkins.some(function (c) { return c.date === day; });
      cal += '<i class="' + (on ? 'on' : '') + (i === 0 ? ' today' : '') + '" title="' + day + '"></i>';
    }
    var emotionRows = emotions.map(function (e) {
      return '<tr><td>' + esc(e.emoji || '') + ' ' + esc(e.name) + '</td><td>' + (st.emotionCount[e.id] || 0) + ' 次</td></tr>';
    }).join('');
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('成长记录', '只记录练习过程，不给孩子的能力打分', 'FOR GROWN-UPS') +
      '<div class="kpi-grid">' +
        '<div class="kpi"><b>' + st.doneLevels + '/' + st.totalLevels + '</b><span>完成关卡</span></div>' +
        '<div class="kpi"><b>' + st.stars + '</b><span>收集星星</span></div>' +
        '<div class="kpi"><b>' + st.checkins + '</b><span>心情签到</span></div>' +
        '<div class="kpi"><b>' + st.streak + '</b><span>连续天数</span></div>' +
      '</div>' +
      '<div class="parent-grid" style="margin-top:20px">' +
        '<div class="card"><h3>五种能力的练习次数</h3>' +
          '<div class="radar-wrap">' + A.radar(values, labels) + '</div>' +
          '<p class="small muted center">这是「练过多少次」，不是能力高低，请不要用来比较孩子。</p></div>' +
        '<div class="card"><h3>最近 14 天签到</h3><div class="calendar">' + cal + '</div>' +
          '<h4 style="margin-top:20px">记下过的心情</h4>' +
          '<table class="data-table"><thead><tr><th>心情</th><th>次数</th></tr></thead><tbody>' + emotionRows + '</tbody></table></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>💬 可以一起试试的家庭小练习</h3>' +
        weak.map(function (w) {
          return '<div style="margin-top:12px"><b>' + esc(w.skill) + ' · ' + esc(w.name) + '</b><ul>' +
            (tips[w.id] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
        }).join('') +
        '<p class="small muted">优先推荐练习次数较少的两项。日常对话里用一次，比在软件里做十关更有用。</p></div>' +
      '<div class="card" style="margin-top:20px"><h3>每一关的情况</h3>' +
        '<table class="data-table"><thead><tr><th>能力</th><th>关卡</th><th>状态</th><th>星星</th></tr></thead><tbody>' + levelRows + '</tbody></table></div>' +
      '<div class="card" style="margin-top:20px"><h3>🔒 数据与隐私</h3>' +
        '<div class="privacy-note">全部记录只保存在这台电脑的浏览器本地存储里。没有账号、没有服务器、不联网、没有广告，也不会采集孩子的姓名以外的个人信息、位置或设备信息。你可以随时导出备份、导入或清空。</div>' +
        '<p class="small muted" style="margin-top:12px"><b>请注意：</b>这是一款教育游戏，不是心理评估、筛查或诊断工具，也不能替代专业支持。如果孩子长时间情绪困扰、睡眠或进食明显变化、持续回避上学或社交，请联系学校心理老师、儿科医生或专业心理服务。</p>' +
        '<div class="row" style="margin-top:14px">' +
          '<button class="btn blue" data-export>导出备份 JSON</button>' +
          '<button class="btn ghost" data-import-btn>导入备份</button>' +
          '<input type="file" accept="application/json,.json" data-import-file style="display:none">' +
          '<button class="btn pink" data-reset>清空当前档案进度</button>' +
          navBtn('#/settings', '设置与档案', 'ghost') +
        '</div>' +
        (S.memoryOnly ? '<p class="small" style="color:#C0392B;margin-top:10px">当前浏览器不允许本地存储，记录只保留到关闭窗口。请用「导出备份」保存。</p>' : '') +
      '</div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-export]', function () { exportFile(); });
      U.delegate(root, 'click', '[data-import-btn]', function () { U.$('[data-import-file]', root).click(); });
      var file = U.$('[data-import-file]', root);
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            S.importSave(String(reader.result));
            UI.toast('备份已导入 ✅');
            window.SEL.render();
          } catch (e) {
            UI.toast(e && e.message ? e.message : '这个文件读不出来，换一个试试');
          } finally {
            file.value = '';   /* 允许再次选择同一个文件 */
          }
        };
        reader.readAsText(f);
      });
      U.delegate(root, 'click', '[data-reset]', function () {
        UI.confirm({ title: '清空进度？', art: '🧹', text: '会删掉这个档案的星星、关卡记录、签到和贴纸，无法恢复。建议先导出备份。', yes: '确认清空', danger: true },
          function () { S.resetProfile(p.id); UI.toast('已清空，可以重新开始啦'); window.SEL.render(); });
      });
    });
  }

  function exportFile() {
    try {
      var blob = new Blob([S.exportSave()], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = '心晴岛-备份-' + U.today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast('备份已下载 💾');
    } catch (e) { UI.toast('导出失败，请换个浏览器试试'); }
  }

  /* ==================== 档案 ==================== */
  function profile() {
    var profiles = S.profiles(), active = S.current();
    var avatars = [{ id: 'cloud', name: '团团' }, { id: 'owl', name: '咕咕' }, { id: 'fox', name: '小火苗' }];
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('小玩家档案', '一台电脑可以有好几个小玩家', 'PROFILES') +
      '<div class="grid grid-2">' +
        '<div class="card"><h3>现在是谁在玩？</h3><div class="stack" style="margin-top:12px">' +
          profiles.map(function (x) {
            return '<div class="profile-item ' + (x.id === active.id ? 'active' : '') + '">' +
              '<span style="width:52px">' + A.buddy(x.avatar, 'happy', 52) + '</span>' +
              '<div style="flex:1"><b>' + esc(x.name) + '</b><div class="small muted">⭐ ' + x.stars + ' · 签到 ' + x.checkins.length + ' 次</div></div>' +
              (x.id === active.id ? '<span class="chip green">正在玩</span>' : '<button class="btn tiny" data-switch="' + esc(x.id) + '">切换</button>') +
              '</div>';
          }).join('') + '</div></div>' +
        '<div class="card"><h3>新建一个档案 ➕</h3>' +
          '<p class="small muted">写个小昵称就好，不需要真名。</p>' +
          '<input class="text-input" data-new-name placeholder="比如：小探险家" maxlength="12">' +
          '<div class="avatar-pick" style="margin-top:14px" data-avatars>' + avatars.map(function (a, i) {
            return '<button class="avatar-opt ' + (i === 0 ? 'active' : '') + '" data-avatar="' + a.id + '">' +
              A.buddy(a.id, 'happy', 64) + '<div class="small">' + esc(a.name) + '</div></button>';
          }).join('') + '</div>' +
          '<div style="margin-top:16px"><button class="btn primary" data-create>建好了 →</button></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>管理</h3>' +
        '<div class="row">' +
          '<button class="btn ghost" data-del-profile ' + (profiles.length <= 1 ? 'disabled' : '') + '>删除当前档案</button>' +
          navBtn('#/settings', '声音与动效设置', 'ghost') +
          navBtn('#/parent', '家长专区', 'ghost') +
        '</div></div>';
    return wrap(html, function (root) {
      var pick = 'cloud';
      U.delegate(root, 'click', '[data-avatar]', function (e, t) {
        pick = t.getAttribute('data-avatar');
        U.$$('.avatar-opt', root).forEach(function (b) { b.classList.remove('active'); });
        t.classList.add('active'); Audio.sfx('tap');
      });
      U.delegate(root, 'click', '[data-switch]', function (e, t) {
        S.setActive(t.getAttribute('data-switch')); Audio.sfx('pop'); window.SEL.render();
      });
      U.delegate(root, 'click', '[data-create]', function () {
        if (S.profiles().length >= 12) { UI.toast('一台电脑最多 12 个小玩家档案'); return; }
        var v = U.$('[data-new-name]', root).value.trim();
        S.createProfile(v || '小探险家', pick);
        Audio.sfx('win'); UI.toast('新档案建好啦 🎉'); window.SEL.render();
      });
      U.delegate(root, 'click', '[data-del-profile]', function () {
        UI.confirm({ title: '删除这个档案？', art: '🗑️', text: '「' + active.name + '」的所有记录都会被删掉，无法恢复。', yes: '确认删除', danger: true },
          function () { S.removeProfile(active.id); UI.toast('档案已删除'); window.SEL.render(); });
      });
    });
  }

  /* ==================== 设置 ==================== */
  function settings() {
    var p = S.current();
    function row(label, desc, key) {
      var on = p.settings[key] === true;
      return '<div class="setting-row"><div><b>' + label + '</b><div class="small muted">' + desc + '</div></div>' +
        '<button class="switch ' + (on ? 'on' : '') + '" data-toggle="' + key + '" role="switch" aria-checked="' +
        (on ? 'true' : 'false') + '" aria-label="' + label + '"></button></div>';
    }
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('设置', '让软件用起来更舒服', 'SETTINGS') +
      '<div class="card">' +
        row('朗读文字 🔊', '点小喇叭或进入关卡时，读出文字给小朋友听', 'voice') +
        row('游戏音效 🎵', '点击、配对、收星星时的小声音', 'sfx') +
        row('减少动画 🍃', '关掉漂浮和弹跳，画面更安静', 'reduceMotion') +
        '<div class="setting-row"><div><b>小玩家档案</b><div class="small muted">切换、新建或删除档案</div></div>' +
          navBtn('#/profile', '去管理 →', 'tiny ghost') + '</div>' +
        '<div class="setting-row"><div><b>导出备份 💾</b><div class="small muted">把所有记录存成一个文件</div></div>' +
          '<button class="btn tiny blue" data-export>导出 JSON</button></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>关于心晴岛</h3>' +
        '<p class="muted">面向 6-10 岁儿童的社会情绪学习游戏，参考 CASEL 五大能力框架，用情境故事、配对、排序、呼吸练习和每日心情签到，把「认识情绪—练习方法—用到生活里」串成一条闭环。全部内容离线运行，无广告、无账号、无数据上传。</p>' +
        '<p class="small muted"><b>边界：</b>这是教育游戏，不是心理评估或诊断工具，也不构成任何医疗建议。孩子若持续困扰，请寻求学校心理老师或专业人士的帮助。</p>' +
        '<p class="small muted">版本 ' + esc(appVersion() || '未知') + ' · Web 版与 Windows 桌面版共用同一份内容</p></div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-export]', function () { exportFile(); });
    });
  }

  window.SEL.screens = {
    home: home, map: map, island: island, level: level, emotions: emotions,
    checkin: checkin, strategies: strategies, runStrategy: runStrategy,
    garden: garden, stickers: stickers, parent: parent, profile: profile,
    settings: settings, help: help, exportFile: exportFile,
    TYPE_NAME: TYPE_NAME, ISLAND_LABEL: ISLAND_LABEL
  };
})();
