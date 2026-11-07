/* 心晴岛 · 全部页面。 */
(function () {
  'use strict';
  window.SEL = window.SEL || {};
  var U = window.SEL.utils, A = window.SEL.art, Audio = window.SEL.audio;
  var S = window.SEL.state, UI = window.SEL.ui, G = window.SEL.games;
  /* 运行时再取，避免脚本加载顺序一变就把 undefined 固死 */
  function E() { return window.SEL.expression; }

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
  function stripText(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
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

  /* 家长门共用逻辑：设置了 PIN 就用 4 位 PIN，否则用一道算术题。
     时间锁的「请大人来解锁」也走这里，避免两套入口两套规则。 */
  var trendDays = 14;

  function gateInner(pinMode, a, b) {
    if (pinMode) {
      return '<p class="muted">请输入家长 PIN（4 位数字）。</p>' +
        '<input type="password" inputmode="numeric" autocomplete="off" maxlength="4" data-gate-pin ' +
        'style="width:150px;font-size:26px;text-align:center;padding:10px;border:3px solid var(--line);border-radius:14px" aria-label="家长 PIN">' +
        '<p class="small muted" style="margin-top:12px">连续输错 5 次会锁定 1 分钟。</p>';
    }
    return '<p class="muted">这里放着孩子的进度记录。请大人来算一下：</p>' +
      '<h3 style="margin:14px 0">' + a + ' + ' + b + ' = ?</h3>' +
      '<input type="number" data-gate-input placeholder="?" aria-label="答案" ' +
      'style="width:110px;font-size:26px;text-align:center;padding:10px;border:3px solid var(--line);border-radius:14px">' +
      '<p class="small muted" style="margin-top:14px">这只是避免小朋友误入的小门槛，不是密码保护。</p>';
  }

  function gateCheck(root, pinMode, a, b) {
    var input = U.$('[data-gate-pin]', root) || U.$('[data-gate-input]', root);
    if (!input) return false;
    if (pinMode) {
      var r = S.verifyPin(input.value);
      if (r.locked) { UI.toast('输错次数太多，请等 ' + r.wait + ' 秒再试'); Audio.sfx('tryagain'); return false; }
      if (!r.ok) { UI.toast('PIN 不对，再试一次 🙂'); Audio.sfx('tryagain'); input.value = ''; return false; }
      return true;
    }
    var v = Number(input.value);
    if (v === a + b) return true;
    UI.toast('再算一次试试 🙂'); Audio.sfx('tryagain');
    return false;
  }

  /* 24 小时制用两个下拉，而不是 <input type="time">：
     后者在英文系统上会显示 08:30 PM，中文家长很容易看错。 */
  function timeField(attr, value, label) {
    var p = String(value || '20:30').split(':');
    var h = U.clamp(Number(p[0]) || 0, 0, 23);
    var m = U.clamp(Number(p[1]) || 0, 0, 59);
    var hours = '', mins = '';
    for (var i = 0; i < 24; i++) hours += '<option value="' + i + '"' + (i === h ? ' selected' : '') + '>' + U.pad(i) + '</option>';
    var list = [0, 15, 30, 45];
    if (list.indexOf(m) < 0) list.push(m);
    list.sort(function (a, b) { return a - b; });
    list.forEach(function (v) {
      mins += '<option value="' + v + '"' + (v === m ? ' selected' : '') + '>' + U.pad(v) + '</option>';
    });
    return '<span class="time-pick">' +
      '<select data-' + attr + '-h aria-label="' + U.esc(label) + '小时">' + hours + '</select>' +
      '<span class="time-colon">:</span>' +
      '<select data-' + attr + '-m aria-label="' + U.esc(label) + '分钟">' + mins + '</select></span>';
  }

  /* 供时间锁调用：不跳页面，就在弹窗里过家长门 */
  function gateModal(onPass) {
    var pinMode = S.pinSet();
    var a = 6 + Math.floor(Math.random() * 5), b = 4 + Math.floor(Math.random() * 6);
    UI.modal({
      title: pinMode ? '请输入家长 PIN' : '请大人来解锁',
      art: '🔒',
      body: gateInner(pinMode, a, b),
      actions: [
        { label: '取消', cls: 'ghost', close: true },
        { label: '解锁', cls: 'primary', act: 'ok' }
      ]
    }, function (act, ov) {
      if (act !== 'ok') return;
      if (gateCheck(ov, pinMode, a, b)) { UI.closeModal(); if (onPass) onPass(); }
    });
    var box = U.$('[data-gate-pin]', document.getElementById('overlay')) || U.$('[data-gate-input]', document.getElementById('overlay'));
    if (box) {
      box.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        if (gateCheck(box.parentNode, pinMode, a, b)) { UI.closeModal(); if (onPass) onPass(); }
      });
      try { box.focus(); } catch (e) {}
    }
  }

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
          '<div><b>' + st.checkinsTotal + '</b><span>记下的心情</span></div>' +
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
        '<a class="quick-card" href="#/map" data-nav="#/map"><span class="qc-icon">🏝️</span><b>' + S.data().islands.length + ' 座小岛</b><span>' + totalLevels() + ' 个互动关卡</span></a>' +
        '<a class="quick-card" href="#/emotions" data-nav="#/emotions"><span class="qc-icon">🎭</span><b>情绪图鉴</b><span>认出心里的小天气</span></a>' +
        '<a class="quick-card" href="#/strategies" data-nav="#/strategies"><span class="qc-icon">🧰</span><b>冷静工具箱</b><span>' + S.data().strategies.length + ' 个随时能用的小方法</span></a>' +
        '<a class="quick-card" href="#/garden" data-nav="#/garden"><span class="qc-icon">🌷</span><b>心情花园</b><span>看看记下的每一天</span></a>' +
        '<a class="quick-card" href="#/express" data-nav="#/express"><span class="qc-icon">🗣️</span><b>说一说</b><span>把心里的话大声说出来</span></a>' +
      '</div>' +

      '<div class="grid grid-2" style="margin-top:22px">' +
        '<div class="card"><h3>🌈 在这里，没有「答错」</h3>' +
          '<p class="muted">每个选择都会告诉你「接下来可能发生什么」。所有情绪都可以存在，我们只一起看看怎么表达更舒服。' +
          '每一关的题目、选项和反馈都会念给你听，点小喇叭或「再听一遍」随时重听；最后还有「说一说」，把心里的话大声讲出来。</p>' +
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
          '<p class="muted">选一个现在的情绪、说说为什么，再种一朵心情花；最后还可以给自己留一句话（不想写就跳过）。每天第一次签到会得 1 颗星，连着签几天还能在首页和成长记录里看到连续天数。</p></div>' +
        '<div class="card"><h3>🏝️ ' + S.data().islands.length + ' 座小岛 ' + totalLevels() + ' 关</h3>' +
          '<p class="muted">用星星解锁新岛，按顺序玩更顺。每关有情境选择、连一连、排顺序等 ' + gameTypeCount() + ' 种小游戏，完成得星星和贴纸。</p></div>' +
        '<div class="card"><h3>🧰 冷静工具箱</h3>' +
          '<p class="muted">' + S.data().strategies.length + ' 个随时能用的小方法：觉察、呼吸、应对、拉开距离、表达。生气或紧张时，跟着做一遍就好。</p></div>' +
        '<div class="card"><h3>🌷 心情花园</h3>' +
          '<p class="muted">记下的每一天都会开出一朵花。翻翻看，就能看见自己情绪的小天气是怎么变化的。</p></div>' +
        '<div class="card"><h3>🔊 题目会说话</h3>' +
          '<p class="muted">进入关卡，团团会把题目、玩法说明和每一个选项都念一遍；点过的卡片、出现的提示、过关时的话也会读出来。' +
          '想再听就点「再听一遍」，只听选项点「听选项」，不想听点「停一停」。家长可以在设置里关掉自动读题或调整语速。</p></div>' +
        '<div class="card"><h3>🗣️ 说一说 · 勇气小话筒</h3>' +
          '<p class="muted">先听团团念一句示范，再大声把「我觉得…因为…我希望…」说给自己或身边的人听，说完点「我说出来啦」。' +
          '不录音、不识别、不保存说过的话，只记次数；每天最多 3 颗勇气星，累计还能解锁贴纸。</p>' +
          '<button class="btn tiny ghost" data-nav="#/express">去说一说 →</button></div>' +
      '</div>' +

      '<div class="card" style="margin-top:18px"><h3>🔒 爸爸妈妈放心的小设计</h3>' +
        '<ul class="muted" style="margin:6px 0 0 18px;line-height:1.8">' +
          '<li>不需要账号、不联网、没有广告，所有内容都保存在这台电脑上。</li>' +
          '<li>「家长 / 老师专区」用一道算术题挡住小朋友，里面可以看进度、导出备份或清空数据。</li>' +
          '<li>每关的题目会用中文念出来，也可以点小喇叭重听（需要电脑已安装中文语音）；自动读题与语速可在设置里调整。</li>' +
          '<li>「说一说」不申请麦克风、不录音、不联网，也不保存孩子说过的任何一句话，只记次数与日期。</li>' +
        '</ul>' +
        '<button class="btn tiny ghost" data-nav="#/parent">去家长 / 老师专区 →</button></div>';
    return wrap(html);
  }

  /* ==================== 地图 ==================== */
  function map() {
    var p = S.current(), st = S.stats();
    var islands = D().islands || [];
    var html = backRow('#/home', '回首页') +
      UI.sectionHead(S.data().islands.length + ' 座小岛', '攒星星解锁新岛屿，按顺序玩更有趣', 'ADVENTURE MAP') +
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
        var teaser = esc(U.cut(teach, 24));
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
        /* 结算弹窗里的文字也一次连读完：奖励、今天学到、给大人的话都念出来 */
        Audio.readAuto(['这一关走完啦！' + (res.title || '完成啦'), res.feedback || '',
          '今天学到：' + stripText(lv.teach || ''),
          sticker ? '还解锁了新贴纸：' + (sticker.name || '') : '',
          '给大人：' + stripText(lv.tip || '')].filter(Boolean));
      }
    };
    var game = G.render(lv, ctx);
    var topic = E().levelTopic(lv);
    var html = '<div class="level-shell">' + backRow('#/island/' + is.id, '回' + is.name) +
      '<div class="level-head"><h2>' + esc(lv.title) + '</h2>' +
      '<span class="chip">' + esc(is.skill) + '</span>' + '<span class="chip blue">' + (TYPE_NAME[lv.type] || lv.type) + '</span>' +
      '<div style="margin-left:auto">' + UI.starRow(rec ? rec.stars : 0, 3) + '</div></div>' +
      UI.guideRow(lv.intro || '我们一起来试试看！', 'cloud', 'happy') +
      game.html +
      (topic ? E().card(topic, { hideable: true }) : '') +
      '<div class="center small muted" style="margin-top:20px">慢慢来，没有时间限制，也没有「答错」这回事 🌿</div></div>';
    return wrap(html, function (root) {
      /* 先挂播报条与状态回调，再挂载玩法：互动故事在首次 draw() 时就要用上
         同一套 onItem/onDone，否则故事关的播报条永远停在初始文案。 */
      G.startReading(root, game.read);
      game.mount(root);
      if (topic) E().mount(root, topic);
    });
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
    var state = { step: 0, emotion: null, intensity: 3, reason: '', strategy: null, note: '' };
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
            '<h4 style="margin:16px 0 8px">想给自己留一句话吗？（可以不写）✏️</h4>' +
            '<textarea class="text-input" data-note rows="2" maxlength="120" ' +
            'placeholder="比如：今天体育课跑步赢了，我特别开心" aria-label="今天想留下的一句话">' + esc(state.note) + '</textarea>' +
            '<div class="row" style="margin-top:18px"><button class="btn ghost" data-back>← 上一步</button>' +
            '<button class="btn green" data-plant>种下这朵花 🌱</button></div>';
        }
        body.innerHTML = s;
        bindInputs();
      }

      /* 每次重绘只需给新的滑块/输入框绑事件；事件委托在下面只注册一次，避免重复触发 */
      function bindInputs() {
        var range = U.$('[data-range]', body);
        if (range) range.addEventListener('input', function () {
          state.intensity = Number(range.value);
          var v = U.$('[data-val]', body); if (v) v.textContent = range.value;
        });
        var note = U.$('[data-note]', body);
        if (note) note.addEventListener('input', function () { state.note = note.value.slice(0, 120); });
      }

      (function bindOnce() {
        U.delegate(body, 'click', '[data-pick]', function (e, t) {
          var picked = list[Number(t.getAttribute('data-pick'))];
          if (!picked) return;
          /* 换了情绪，上一种情绪选过的原因就不该继续挂着 */
          if (state.emotion !== picked.id) state.reason = '';
          state.emotion = picked.id;
          /* 属于自动引导：家长关掉「自动读题」后，签到也不该突然出声 */
          Audio.sfx('select'); Audio.readAutoOne('你现在觉得' + picked.name);
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
            reason: state.reason, strategy: state.strategy, note: state.note, color: em.color || '#FFC94A'
          });
          state.note = '';
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
      '<div class="small muted" style="margin-top:10px">随时可以关掉，完整做完一次才会记下练习次数。</div></div>';
    UI.modal({ title: st.emoji + ' ' + st.name, body: body, actions: [{ label: '结束练习', cls: 'ghost', close: true }] }, function (act, ov) {
      if (act !== 'start') return;
      var run = U.$('[data-run]', ov);
      if (!run) return;
      var orb = U.$('[data-orb]', run), cue = U.$('[data-cue]', run);
      var left = seconds;
      U.$('[data-modal-act="start"]', run).disabled = true;
      Audio.unlock(); Audio.sfx('pop');
      /* 用 UI.every 登记，弹窗一关（closeModal）计时器立刻被清掉，不会在后台空转 */
      var tick = UI.every(function () {
        if (!document.body.contains(run)) { tick(); return; }
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
          tick();
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
    var counts = Object.create(null);
    flowers.forEach(function (f) { counts[f.emotion] = (counts[f.emotion] || 0) + 1; });
    var emotionName = Object.create(null);
    (D().emotions || []).forEach(function (e) { emotionName[e.id] = e; });
    var strategyName = Object.create(null);
    (D().strategies || []).forEach(function (x) { strategyName[x.id] = x.name; });
    var cap = S.limits ? S.limits.flowers : 365;
    var capped = flowers.length >= cap;
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('心情花园', '每一次签到，都会长出一朵花', 'MIND GARDEN') +
      '<div class="card soft" style="margin-bottom:18px"><div class="spread">' +
        '<div><b>🌷 ' + (capped ? '最近 ' : '一共 ') + flowers.length + ' 朵</b><div class="small muted">' +
        (capped ? '花园里最多摆出最近 ' + cap + ' 朵，更早的花会自动收进档案盒（导出备份时一并保存）。'
                : '这里有各种各样的心情，每一朵都好好留着。') + '</div></div>' +
        '<button class="btn ghost" data-nav="#/report">本周成长卡 🖨</button>' +
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
            (rec.note ? '<div class="feedback-box" style="text-align:left"><b>✏️ 那天写下的</b><div>' + esc(rec.note) + '</div></div>' : '') +
            (rec.strategy && strategyName[rec.strategy] ? '<p class="small muted">那天试的方法：' + esc(strategyName[rec.strategy]) + '</p>' : '') +
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
      var pinMode = S.pinSet();
      var a = 6 + Math.floor(Math.random() * 5), b = 4 + Math.floor(Math.random() * 6);
      var html = '<div class="gate card"><div style="font-size:48px">👨‍👩‍👧</div>' +
        '<h2>家长 / 老师专区</h2>' + gateInner(pinMode, a, b) +
        '<div style="margin-top:16px"><button class="btn primary" data-gate-ok>进入 →</button></div>' +
        '<div style="margin-top:10px">' + navBtn('#/home', '回首页') + '</div>' +
        (pinMode ? '' : '<p class="small muted">想要更稳一点？进入后可以设置 4 位家长 PIN。</p>') +
        '</div>';
      return wrap(html, function (root) {
        function check() {
          if (!gateCheck(root, pinMode, a, b)) return;
          try { window.sessionStorage.setItem('sunny-parent-ok', '1'); } catch (e) {}
          window.SEL.render();
        }
        U.delegate(root, 'click', '[data-gate-ok]', check);
        var inp = U.$('[data-gate-pin]', root) || U.$('[data-gate-input]', root);
        if (inp) {
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
          try { inp.focus(); } catch (e) {}
        }
      });
    }
    var p = S.current(), st = S.stats();
    var trend = S.checkinTrend(trendDays);
    var trendRecorded = trend.filter(function (x) { return x.avg !== null; });
    var trendAvg = trendRecorded.length
      ? trendRecorded.reduce(function (a, x) { return a + x.avg; }, 0) / trendRecorded.length : null;
    var effects = S.strategyEffect();
    var recs = S.recommendLevels(3);
    var usedMin = Math.floor(S.usageToday() / 60);
    var se = p.settings || {};
    var timeState = window.SEL.screentime.state();
    var pinOn = S.pinSet();
    var islands = D().islands || [];
    var labels = islands.map(function (i) { return i.skill || i.name; });
    var values = islands.map(function (i) { return p.skills[i.id] || 0; });
    var skillMax = Math.max.apply(null, values.concat([0]));
    var skillSum = values.reduce(function (a, b) { return a + b; }, 0);
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
    var emById = Object.create(null);
    emotions.forEach(function (e) { emById[e.id] = e; });
    var recent = p.checkins.slice(-7).reverse();
    var recentRows = recent.map(function (c) {
      var e = emById[c.emotion] || {};
      var words = String(c.note || c.reason || '');
      /* 窄屏下表格列很窄：日期用 11-05 这种紧凑写法，避免中文日期被折成两行 */
      return '<tr><td>' + esc(c.date.slice(5)) + '</td>' +
        '<td>' + esc(e.emoji || '') + ' ' + esc(e.name || c.emotion) + ' · ' + c.intensity + '格</td>' +
        '<td class="small">' + esc(U.cut(words, 12)) + '</td></tr>';
    }).join('');
    var effectRows = effects.map(function (e) {
      var dir = e.avgDelta < -0.05 ? 'down' : (e.avgDelta > 0.05 ? 'up' : 'flat');
      var word = dir === 'down' ? '↓ ' : (dir === 'up' ? '↑ ' : '≈ ');
      return '<tr class="' + (e.n < 3 ? 'slim' : '') + '"><td>' + esc(e.name) + '</td><td>' + e.n + ' 次</td>' +
        '<td class="' + dir + '">' + word + Math.abs(e.avgDelta).toFixed(1) + ' 格</td>' +
        '<td>' + Math.round(e.downRate * 100) + '%</td></tr>';
    }).join('');
    var html = backRow('#/home', '回首页') +
      UI.sectionHead('成长记录', '只记录练习过程，不给孩子的能力打分', 'FOR GROWN-UPS') +
      '<div class="kpi-grid">' +
        '<div class="kpi"><b>' + st.doneLevels + '/' + st.totalLevels + '</b><span>完成关卡</span></div>' +
        '<div class="kpi"><b>' + st.stars + '</b><span>收集星星</span></div>' +
        '<div class="kpi"><b>' + st.checkinsTotal + '</b><span>心情签到</span></div>' +
        '<div class="kpi"><b>' + st.streak + '</b><span>连续天数</span></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><div class="spread">' +
        '<div><h3>📌 本周建议 ' + recs.length + ' 关</h3>' +
        '<p class="small muted" style="margin:2px 0 0">按「练得最少的能力」挑的，不用自己对着雷达图找。</p></div>' +
        '<button class="btn tiny ghost" data-nav="#/report">看本周成长卡 →</button></div>' +
        (recs.length ? '<div class="rec-list">' + recs.map(function (r) {
          return '<button class="rec-item" data-nav="#/level/' + esc(r.level.id) + '">' +
            '<span class="rec-emoji">' + esc(r.island.emoji || '🏝️') + '</span>' +
            '<span style="flex:1"><b>' + esc(r.island.skill) + ' · ' + esc(r.level.title) + '</b>' +
            '<div class="small muted">' + esc(r.reason) + ' · ' + esc(TYPE_NAME[r.level.type] || r.level.type) + '</div></span>' +
            '<span class="rec-go">去玩 →</span></button>';
        }).join('') + '</div>' : '<p class="small muted">所有关卡都完成了，可以去花园看看这一周的心情。</p>') +
      '</div>' +
      '<div class="parent-grid" style="margin-top:20px">' +
        '<div class="card"><h3>五种能力的练习次数</h3>' +
          '<div class="radar-wrap">' + A.radar(values, labels) + '</div>' +
          '<p class="small muted center">' +
          (skillSum === 0
            ? '还没有练习记录：完成一关，或去冷静工具箱练一次，形状就会长出来。'
            : '这是「练过多少次」，不是能力高低，请不要用来比较孩子。图上最外圈 = 练得最多的那一项（' + skillMax + ' 次）。') +
          '</p></div>' +
        '<div class="card"><h3>最近 14 天签到</h3><div class="calendar">' + cal + '</div>' +
          '<h4 style="margin-top:20px">记下过的心情</h4>' +
          '<table class="data-table"><thead><tr><th>心情</th><th>次数（含归档）</th></tr></thead><tbody>' + emotionRows + '</tbody></table>' +
          '<h4 style="margin-top:20px">最近的签到</h4>' +
          (recent.length ? '<table class="data-table recent-table"><thead><tr><th>日期</th><th>心情</th><th>写下的话</th></tr></thead><tbody>' +
            recentRows + '</tbody></table>' : '<p class="small muted">还没有签到记录。</p>') +
          '<p class="small muted" style="margin-top:10px">' +
            (p.lastVisit ? '最近一次记录：' + esc(U.prettyDate(p.lastVisit)) : '还没有开始记录') + '</p>' +
          (st.archivedCheckins ? '<p class="small muted">另有 ' + st.archivedCheckins + ' 条更早的签到已自动归档，不会丢，包含在导出备份里。</p>' : '') + '</div>' +
      '</div>' +
      '<div class="parent-grid" style="margin-top:20px">' +
        '<div class="card"><div class="spread"><h3>情绪强度趋势</h3>' +
          '<div class="seg" role="group" aria-label="趋势区间">' +
            '<button class="' + (trendDays === 14 ? 'on' : '') + '" data-trend="14">14 天</button>' +
            '<button class="' + (trendDays === 30 ? 'on' : '') + '" data-trend="30">30 天</button>' +
          '</div></div>' +
          '<div class="trend-wrap">' + A.lineChart(trend, { caption: '每天平均强度（1–5 格）' }) + '</div>' +
          '<p class="small muted">' + (trendRecorded.length
            ? '近 ' + trendDays + ' 天里有 ' + trendRecorded.length + ' 天留下了记录，平均强度 ' + trendAvg.toFixed(1) + ' 格。'
            : '这段时间还没有签到记录。') +
            '强度没有好坏，若持续偏高或突然升高，可以多问一句「最近发生了什么」。</p></div>' +
        '<div class="card"><h3>方法有没有帮上忙</h3>' +
          (effects.length ? '<table class="data-table effect-table"><thead><tr><th>方法</th><th>样本</th><th>下一次强度变化</th><th>下降比例</th></tr></thead><tbody>' +
            effectRows + '</tbody></table>' +
            '<p class="small muted" style="margin-top:10px">只看「用了这个方法 → 一周内的下一次签到」，<b>灰色行</b>表示样本少于 3 次，先当作参考。强度下降也可能只是事情本身过去了，不等于方法一定有效。</p>'
            : '<p class="small muted">还没有可配对的记录。签到第 3 步会记下当天试的方法，下一次再签到时，这里就能看到前后变化。</p>') +
        '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>💬 可以一起试试的家庭小练习</h3>' +
        weak.map(function (w) {
          return '<div style="margin-top:12px"><b>' + esc(w.skill) + ' · ' + esc(w.name) + '</b><ul>' +
            (tips[w.id] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
        }).join('') +
        '<p class="small muted">优先推荐练习次数较少的两项。日常对话里用一次，比在软件里做十关更有用。</p></div>' +
      E().parentCard() +
      '<div class="card" style="margin-top:20px"><h3>每一关的情况</h3>' +
        '<table class="data-table"><thead><tr><th>能力</th><th>关卡</th><th>状态</th><th>星星</th></tr></thead><tbody>' + levelRows + '</tbody></table></div>' +
      '<div class="parent-grid" style="margin-top:20px">' +
        '<div class="card"><h3>⏳ 使用时长与睡前锁</h3>' +
          '<div class="setting-row"><div><b>每天最多玩</b><div class="small muted">到点会盖一层休息提醒，记录不受影响</div></div>' +
            '<select class="time-select" data-limit aria-label="每日使用上限">' +
            [0, 15, 30, 45, 60, 90].map(function (m) {
              return '<option value="' + m + '"' + ((Number(se.screenLimit) || 0) === m ? ' selected' : '') + '>' +
                (m ? m + ' 分钟' : '不限制') + '</option>';
            }).join('') + '</select></div>' +
          '<div class="setting-row"><div><b>睡前锁定</b><div class="small muted">这个时间段内不开放游戏</div></div>' +
            '<button class="switch ' + (se.bedtimeOn ? 'on' : '') + '" data-bed-toggle role="switch" ' +
            'aria-checked="' + (se.bedtimeOn ? 'true' : 'false') + '" aria-label="睡前锁定"></button></div>' +
          '<div class="row" style="margin-top:12px">' +
            '<span class="small">开始 ' + timeField('bed-start', se.bedtimeStart || '20:30', '睡前开始') + '</span>' +
            '<span class="small">结束 ' + timeField('bed-end', se.bedtimeEnd || '07:30', '睡前结束') + '</span>' +
          '</div>' +
          '<div class="row" style="margin-top:14px"><button class="btn tiny primary" data-save-time>保存设置</button></div>' +
          '<p class="small muted" style="margin-top:10px">今天已使用 ' + usedMin + ' 分钟' +
            (Number(se.screenLimit) ? '（上限 ' + se.screenLimit + ' 分钟）' : '（未设置上限）') + '。' +
            (timeState.locked ? '当前处于休息提醒状态。' : '') + '</p>' +
          '<p class="small muted">解锁入口只在时间锁卡片上，需要再过一次家长门；解锁后当天不再提醒。</p>' +
        '</div>' +
        '<div class="card"><h3>🔐 家长 PIN</h3>' +
          (pinOn
            ? '<p class="muted small">已设置 4 位 PIN，进入家长区与解除时间锁都需要它。忘记 PIN 只能清除浏览器数据（会丢掉记录），请先导出备份。</p>' +
              '<div class="row"><button class="btn tiny ghost" data-set-pin>修改 PIN</button>' +
              '<button class="btn tiny pink" data-clear-pin>清除 PIN</button></div>'
            : '<p class="muted small">多家庭共用一台设备时，可以设置 4 位 PIN 代替算术题。它只是防止误入，不是加密保险箱。</p>' +
              '<button class="btn tiny blue" data-set-pin>设置 4 位 PIN</button>') +
          '<p class="small muted" style="margin-top:12px">连续输错 5 次会锁定 1 分钟。</p>' +
        '</div>' +
      '</div>' +
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
      U.delegate(root, 'click', '[data-trend]', function (e, t) {
        var n = Number(t.getAttribute('data-trend'));
        if (n !== 14 && n !== 30) return;
        trendDays = n;
        Audio.sfx('tap');
        window.SEL.render();
      });
      U.delegate(root, 'click', '[data-bed-toggle]', function (e, t) {
        var on = !t.classList.contains('on');
        t.classList.toggle('on', on);
        t.setAttribute('aria-checked', on ? 'true' : 'false');
        Audio.sfx('tap');
      });
      U.delegate(root, 'click', '[data-save-time]', function () {
        var limit = Number(U.$('[data-limit]', root).value) || 0;
        function readTime(attr) {
          var h = U.$('[data-' + attr + '-h]', root), m = U.$('[data-' + attr + '-m]', root);
          if (!h || !m) return '';
          return U.pad(Number(h.value)) + ':' + U.pad(Number(m.value));
        }
        var start = readTime('bed-start'), end = readTime('bed-end');
        var on = U.$('[data-bed-toggle]', root).classList.contains('on');
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) { UI.toast('请把时间填完整'); return; }
        if (start === end) { UI.toast('睡前时段的开始和结束不能相同'); return; }
        S.setSetting('screenLimit', limit);
        S.setSetting('bedtimeOn', on);
        S.setSetting('bedtimeStart', start);
        S.setSetting('bedtimeEnd', end);
        Audio.sfx('win');
        UI.toast(limit || on ? '已保存，按新设置执行 🌙' : '已关闭时长限制');
        window.SEL.render();
      });
      U.delegate(root, 'click', '[data-set-pin]', function () {
        UI.modal({
          title: pinOn ? '修改家长 PIN' : '设置家长 PIN',
          art: '🔐',
          body: '<p class="small muted">输入 4 位数字。忘记后无法找回，只能清除浏览器数据，建议先导出备份。</p>' +
            '<input type="password" inputmode="numeric" maxlength="4" class="text-input" data-pin-1 placeholder="新的 4 位 PIN" aria-label="新的 PIN" style="text-align:center;margin-top:10px">' +
            '<input type="password" inputmode="numeric" maxlength="4" class="text-input" data-pin-2 placeholder="再输入一次" aria-label="确认 PIN" style="text-align:center;margin-top:10px">',
          actions: [{ label: '取消', cls: 'ghost', close: true }, { label: '保存', cls: 'primary', act: 'ok' }]
        }, function (act, ov) {
          if (act !== 'ok') return;
          var a = (U.$('[data-pin-1]', ov) || {}).value || '';
          var b = (U.$('[data-pin-2]', ov) || {}).value || '';
          if (!/^\d{4}$/.test(a)) { UI.toast('PIN 需要是 4 位数字'); return; }
          if (a !== b) { UI.toast('两次输入不一样'); return; }
          try { S.setPin(a); } catch (err) { UI.toast(err.message || '设置失败'); return; }
          UI.closeModal(); Audio.sfx('win'); UI.toast('PIN 已设置 🔐');
          window.SEL.render();
        });
      });
      U.delegate(root, 'click', '[data-clear-pin]', function () {
        UI.confirm({ title: '清除家长 PIN？', art: '🔓', text: '清除后家长区会回到算术题门槛。', yes: '清除', danger: true },
          function () { S.clearPin(); UI.toast('已清除 PIN'); window.SEL.render(); });
      });
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
        reader.onerror = function () { UI.toast('这个文件读不出来，换一个试试'); file.value = ''; };
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

  /* ==================== 成长周报 / 心情天气卡 ==================== */
  var WEATHER_WORD = {
    happy: ['晴天比较多 ☀️', '这一周，心里常常亮亮的。'],
    sad: ['下过一点小雨 🌧', '难过的日子也被好好记住了。'],
    angry: ['有过几阵小雷雨 ⛈', '生气的时候，你也在学着照顾自己。'],
    scared: ['起过一点雾 🌫', '害怕的时候，慢慢来也没关系。'],
    surprised: ['飘过几朵惊讶云 🌤', '这一周有不少新发现。'],
    calm: ['大多是微风 🍃', '平静的日子，也在悄悄积累力量。'],
    proud: ['有阳光洒下来 🌟', '为自己骄傲的时刻，值得记住。'],
    jealous: ['吹过一点酸酸的风 🍋', '羡慕的时候，说明你有很想要的东西。'],
    worried: ['云有点厚 ☁️', '担心的时候，说出来会轻一点。'],
    lonely: ['有几阵安静的风 🍂', '孤单的时候，可以去找一个人说说话。']
  };

  function report() {
    var p = S.current();
    var start = U.weekStart(U.today());
    var end = U.addDays(start, 6);
    var today = U.today();
    var days = [];
    var byDate = Object.create(null);
    p.checkins.forEach(function (c) {
      if (c.date < start || c.date > end) return;
      byDate[c.date] = c;   /* 同一天多次签到，取最后一次作为当天的"天气" */
    });
    for (var i = 0; i < 7; i++) {
      var d = U.addDays(start, i);
      days.push({ date: d, item: byDate[d] || null, future: d > today });
    }
    var weekCheckins = p.checkins.filter(function (c) { return c.date >= start && c.date <= end; });
    var recorded = days.filter(function (x) { return x.item; });
    var emById = Object.create(null);
    (D().emotions || []).forEach(function (e) { emById[e.id] = e; });
    var counts = Object.create(null);
    recorded.forEach(function (x) { counts[x.item.emotion] = (counts[x.item.emotion] || 0) + 1; });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var topEm = emById[top] || {};
    var avg = weekCheckins.length
      ? weekCheckins.reduce(function (a, c) { return a + (c.intensity || 0); }, 0) / weekCheckins.length : null;
    var flowerCount = p.flowers.filter(function (f) { return f.date >= start && f.date <= end; }).length;
    var strategyUsed = Object.create(null);
    var stNames = Object.create(null);
    (D().strategies || []).forEach(function (s) { stNames[s.id] = s; });
    weekCheckins.forEach(function (c) { if (c.strategy && stNames[c.strategy]) strategyUsed[c.strategy] = (strategyUsed[c.strategy] || 0) + 1; });
    var dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    var weather = WEATHER_WORD[top] || ['这一周有自己的天气 🌈', '每一种心情，都值得被看见。'];

    var strip = days.map(function (x, i) {
      var em = x.item ? (emById[x.item.emotion] || {}) : null;
      return '<div class="wk-day ' + (x.date === today ? 'today' : '') + (x.item ? ' has' : '') + (x.future ? ' future' : '') + '">' +
        '<span class="wk-name">' + dayNames[i] + '</span>' +
        '<span class="wk-face">' + (em ? esc(em.emoji || '🌤') : (x.future ? '·' : '—')) + '</span>' +
        (x.item ? '<span class="wk-level">' + x.item.intensity + ' 格</span>' : '<span class="wk-level muted">' + (x.future ? '' : '没记') + '</span>') +
        '</div>';
    }).join('');

    var html = backRow('#/home', '回首页') +
      UI.sectionHead('本周成长卡', '一张可以打印、贴在冰箱上的心情天气', 'WEEKLY CARD') +
      '<div class="report-card">' +
        '<div class="rc-head"><div>' +
          '<div class="eyebrow">SUNNY ISLES · WEEKLY</div>' +
          '<h2>' + esc(U.prettyDate(start)) + ' – ' + esc(U.prettyDate(end)) + '</h2>' +
          '<p class="muted small">' + esc(p.name) + ' 的一周</p>' +
        '</div><div class="rc-weather">' + (topEm.face ? A.face(topEm.face, 84, topEm.color) : A.buddy('cloud', 'calm', 84)) + '</div></div>' +
        '<div class="rc-title">' + weather[0] + '</div>' +
        '<p class="rc-line">' + weather[1] + '</p>' +
        '<div class="week-strip">' + strip + '</div>' +
        '<div class="rc-stats">' +
          '<div><b>' + recorded.length + '</b><span>记录天数</span></div>' +
          '<div><b>' + (avg === null ? '—' : avg.toFixed(1)) + '</b><span>平均强度</span></div>' +
          '<div><b>' + flowerCount + '</b><span>开出的花</span></div>' +
          '<div><b>' + Object.keys(strategyUsed).length + '</b><span>用过的方法</span></div>' +
        '</div>' +
        (Object.keys(strategyUsed).length
          ? '<div class="rc-methods"><span class="small muted">这一周试过：</span>' + Object.keys(strategyUsed).map(function (id) {
            return '<span class="chip purple">' + esc(stNames[id].emoji || '🌿') + ' ' + esc(stNames[id].name) + ' × ' + strategyUsed[id] + '</span>';
          }).join('') + '</div>'
          : '') +
        (S.expressionStats().week > 0 ? '<p class="rc-line small">🗣️ ' + E().reportLine() + '</p>' : '') +
        '<p class="rc-foot">' + (recorded.length
          ? '给大人：这一周孩子记录了 ' + weekCheckins.length + ' 次心情。可以挑其中一天，问问「那天后来发生了什么」，比追问「你为什么这样」更容易聊下去。'
          : '这一周还没有签到记录。可以从今天开始，每天花一分钟，种一朵心情花。') + '</p>' +
      '</div>' +
      '<div class="row no-print" style="margin-top:18px;justify-content:center">' +
        '<button class="btn primary" data-print>打印 / 存成 PDF 🖨</button>' +
        navBtn('#/checkin', '今天还没记，去签到', 'blue') +
        navBtn('#/garden', '看心情花园', 'ghost') +
      '</div>' +
      '<p class="small muted center no-print" style="margin-top:12px">打印时只会输出这张卡片；也可以按 Ctrl/⌘ + P 选择「另存为 PDF」。</p>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-print]', function () {
        Audio.sfx('tap');
        try { window.print(); } catch (e) { UI.toast('这个环境不支持打印，可以截图保存'); }
      });
    });
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
            var meta = [];
            if (x.createdAt) meta.push(esc(U.prettyDate(x.createdAt)) + ' 加入');
            if (x.lastVisit) meta.push('最近 ' + esc(U.prettyDate(x.lastVisit)));
            return '<div class="profile-item ' + (x.id === active.id ? 'active' : '') + '">' +
              '<span style="width:52px">' + A.buddy(x.avatar, 'happy', 52) + '</span>' +
              '<div style="flex:1"><b>' + esc(x.name) + '</b><div class="small muted">⭐ ' + x.stars + ' · 签到 ' + x.checkins.length + ' 次</div>' +
              (meta.length ? '<div class="small muted">' + meta.join(' · ') + '</div>' : '') + '</div>' +
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
        var cap = (S.limits && S.limits.profiles) || 12;
        if (S.profiles().length >= cap) { UI.toast('一台电脑最多 ' + cap + ' 个小玩家档案'); return; }
        var v = U.$('[data-new-name]', root).value.trim();
        var created = S.createProfile(v || '小探险家', pick);
        if (!created) { UI.toast('档案数量已达上限'); return; }
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
        row('朗读文字 🔊', '总开关：点小喇叭、自动读题、反馈与鼓励都用中文念出来', 'voice') +
        row('自动读题 📖', '进入关卡自动念题目、玩法、选项与反馈；关掉后仍可点小喇叭重听', 'autoRead') +
        '<div class="setting-row"><div><b>朗读语速 🐢</b><div class="small muted">念得快一点还是慢一点，选完马上试听一句</div></div>' +
          '<select class="time-select" data-rate aria-label="朗读语速">' +
          [0.7, 0.8, 0.9, 1, 1.1, 1.2].map(function (v) {
            return '<option value="' + v + '"' + (Number(p.settings.voiceRate) === v ? ' selected' : '') + '>' +
              (v < 0.9 ? '慢一点 ' : (v > 1 ? '快一点 ' : '')) + v.toFixed(1) + '×</option>';
          }).join('') + '</select></div>' +
        '<div class="setting-row"><div><b>说一说 · 勇气小话筒 🗣️</b>' +
          '<div class="small muted">不录音、不语音识别、不保存孩子说过的话，只记次数与日期</div></div>' +
          navBtn('#/express', '去说一说 →', 'tiny ghost') + '</div>' +
        row('游戏音效 🎵', '点击、配对、收星星时的小声音', 'sfx') +
        row('减少动画 🍃', '关掉漂浮和弹跳，画面更安静', 'reduceMotion') +
        '<div class="setting-row"><div><b>小玩家档案</b><div class="small muted">切换、新建或删除档案</div></div>' +
          navBtn('#/profile', '去管理 →', 'tiny ghost') + '</div>' +
        '<div class="setting-row"><div><b>本周成长卡 🖨</b><div class="small muted">一张可以打印的心情天气卡</div></div>' +
          navBtn('#/report', '去看看 →', 'tiny ghost') + '</div>' +
        (function () {
          var se = p.settings || {};
          var bits = [];
          if (Number(se.screenLimit)) bits.push('每天 ' + se.screenLimit + ' 分钟');
          if (se.bedtimeOn) bits.push('睡前 ' + esc(se.bedtimeStart) + '–' + esc(se.bedtimeEnd) + ' 锁定');
          return '<div class="setting-row"><div><b>使用时长与睡前锁 ⏳</b><div class="small muted">' +
            (bits.length ? bits.join(' · ') : '未开启') + '（在家长专区设置）</div></div>' +
            navBtn('#/parent', '去设置 →', 'tiny ghost') + '</div>';
        })() +
        '<div class="setting-row"><div><b>家长 PIN 🔐</b><div class="small muted">' +
          (S.pinSet() ? '已设置，进入家长区需要 PIN' : '未设置，目前用算术题挡住误入') + '</div></div>' +
          navBtn('#/parent', '去管理 →', 'tiny ghost') + '</div>' +
        '<div class="setting-row"><div><b>导出备份 💾</b><div class="small muted">把所有记录存成一个文件</div></div>' +
          '<button class="btn tiny blue" data-export>导出 JSON</button></div>' +
      '</div>' +
      '<div class="card" style="margin-top:20px"><h3>关于心晴岛</h3>' +
        '<p class="muted">面向 6-10 岁儿童的社会情绪学习游戏，参考 CASEL 五大能力框架，用情境故事、配对、排序、呼吸练习和每日心情签到，把「认识情绪—练习方法—用到生活里」串成一条闭环。全部内容离线运行，无广告、无账号、无数据上传。</p>' +
        '<p class="small muted"><b>边界：</b>这是教育游戏，不是心理评估或诊断工具，也不构成任何医疗建议。孩子若持续困扰，请寻求学校心理老师或专业人士的帮助。</p>' +
        '<p class="small muted">版本 ' + esc(appVersion() || '未知') + ' · Web 版与 Windows 桌面版共用同一份内容</p></div>';
    return wrap(html, function (root) {
      U.delegate(root, 'click', '[data-export]', function () { exportFile(); });
      U.delegate(root, 'change', '[data-rate]', function (e, t) {
        S.setSetting('voiceRate', Number(t.value));
        Audio.readAutoOne('这样念，速度可以吗？');
        UI.toast('朗读语速已经调好啦');
      });
    });
  }

  /* ==================== 说一说（勇气小话筒） ==================== */
  function express(topicId) { return E().page(topicId); }

  window.SEL.screens = {
    home: home, map: map, island: island, level: level, emotions: emotions,
    checkin: checkin, strategies: strategies, runStrategy: runStrategy,
    garden: garden, stickers: stickers, parent: parent, profile: profile,
    settings: settings, help: help, report: report, express: express, exportFile: exportFile,
    gateModal: gateModal,
    TYPE_NAME: TYPE_NAME, ISLAND_LABEL: ISLAND_LABEL
  };
})();
