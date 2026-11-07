/* ===== 家长视图：成长报告 · 单元掌握度 · 语音设置 · 存档管理 ===== */
(function () {

  const Parent = {
    render(container) {
      const d = Save.data;
      container.innerHTML = '';

      const wrap = document.createElement('div');
      wrap.style.maxWidth = '860px';
      wrap.style.margin = '0 auto';

      wrap.insertAdjacentHTML('beforeend', `
        <h2 class="page-title">👨‍👩‍👧 家长视图</h2>
        <p class="page-subtitle">学习进度 · 成长曲线 · 朗读与存档设置</p>
      `);

      /* ---------- 成长报告 ---------- */
      const days = Save.lastDays(7);
      const today = days[days.length - 1] || { answers: 0, correct: 0 };
      const totalA = d.stats.answers || 0;
      const totalC = d.stats.correct || 0;
      const acc = totalA ? Math.round(totalC / totalA * 100) : 0;
      const maxA = Math.max(1, ...days.map(x => x.answers));
      const streak = Save.streak();

      const report = document.createElement('div');
      report.className = 'card parent-section';
      report.innerHTML = `
        <h3>📈 成长报告</h3>
        <div class="metric-grid">
          <div class="metric-box"><b>🔥 ${streak}</b><span>连续打卡（天）</span></div>
          <div class="metric-box"><b>${totalA}</b><span>累计答题</span></div>
          <div class="metric-box"><b>${acc}%</b><span>首次作答正确率</span></div>
          <div class="metric-box"><b>${today.answers}</b><span>今日答题</span></div>
        </div>
        <div class="chart-title">近 7 天练习量 <span>（柱子越高，练得越多）</span></div>
        <div class="chart-7d">
          ${days.map(day => `
            <div class="c7-col ${day.answers ? '' : 'c7-empty'}">
              <div class="c7-value">${day.answers || ''}</div>
              <div class="c7-track">
                <div class="c7-bar" style="height:${Math.max(3, Math.round(day.answers / maxA * 100))}%"></div>
              </div>
              <div class="c7-label">${day.label}</div>
              <div class="c7-week">周${day.weekday}</div>
            </div>`).join('')}
        </div>
        <p class="parent-note">正确率按每题「第一次作答」统计，连点错误选项不会重复计入；每日口算、听算、单元小测与错题复习都会记入。</p>
        <p class="parent-note">🔁 同类题变式训练 ${d.stats.variantSessions || 0} 次 · 变式题答对 ${d.stats.variantCorrect || 0}/${d.stats.variantTotal || 0} 题；变式全对会给对应错题记一次巩固。</p>
      `;
      wrap.appendChild(report);

      /* ---------- 语音与朗读设置 ---------- */
      const st = window.Speech ? Speech.status() : { supported: false, chineseVoices: 0 };
      const s = d.settings || {};
      const zhVoices = window.Speech ? Speech.chineseVoices() : [];
      const voiceOpts = [`<option value="">自动选择（推荐）</option>`]
        .concat(zhVoices.map(v => `<option value="${UI.esc(v.voiceURI)}" ${s.speechVoiceURI === v.voiceURI ? 'selected' : ''}>${UI.esc(v.name)} · ${UI.esc(v.lang)}</option>`))
        .join('');
      const speechSec = document.createElement('div');
      speechSec.className = 'card parent-section';
      speechSec.innerHTML = `
        <h3>🔊 语音朗读设置</h3>
        <p class="parent-note">题目、选项、提示、故事与探索说明都可以读给孩子听。使用系统自带中文语音，完全离线，不联网、不上传任何内容。</p>
        <div class="speech-status ${st.supported && st.chineseVoices ? 'ok' : 'warn'}">
          ${!st.supported
            ? '⚠️ 当前浏览器/系统不支持语音朗读，朗读按钮会自动隐藏，学习流程不受影响。'
            : (st.chineseVoices
              ? `✅ 已检测到 ${st.chineseVoices} 个中文语音${s.speechVoiceURI ? '' : '，当前为自动选择'}`
              : '⚠️ 暂未检测到中文语音。Windows 可在「设置 → 时间和语言 → 语音」添加中文语音包后重启应用。')}
        </div>
        <label class="toggle-row">
          <input type="checkbox" id="opt-speech" ${s.speech !== false ? 'checked' : ''}>
          🔊 开启语音朗读（顶栏 🔊 可一键开关）
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="opt-auto-read" ${s.autoRead !== false ? 'checked' : ''}>
          📖 进入题目自动读一遍
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="opt-read-options" ${s.readOptions !== false ? 'checked' : ''}>
          🔢 读题时一并朗读选项
        </label>
        <label class="toggle-row">
          <input type="checkbox" id="opt-sound" ${s.sound !== false ? 'checked' : ''}>
          🎵 答题音效（对/错的提示音）
        </label>
        <div class="setting-row">
          <label for="opt-rate">🐢 朗读语速</label>
          <input type="range" id="opt-rate" min="0.6" max="1.4" step="0.1" value="${s.speechRate || 0.9}">
          <span id="rate-val">${Number(s.speechRate || 0.9).toFixed(1)}×</span>
        </div>
        <div class="setting-row">
          <label for="opt-voice">🎙️ 朗读音色</label>
          <select id="opt-voice">${voiceOpts}</select>
        </div>
        <button class="btn-secondary" id="btn-try-voice" style="margin-top:10px">🔊 试听一句</button>
      `;
      wrap.appendChild(speechSec);

      const speechInput = speechSec.querySelector('#opt-speech');
      speechInput.onchange = async () => {
        await Save.setSpeechSetting('speech', speechInput.checked);
        if (window.Speech) {
          if (speechInput.checked) Speech.warmup(); else Speech.stop();
        }
        UI.updateVoice();
        UI.toast(speechInput.checked ? '语音朗读已开启' : '语音朗读已关闭', 'var(--secondary)');
      };
      speechSec.querySelector('#opt-auto-read').onchange = (e) =>
        Save.setSpeechSetting('autoRead', e.target.checked);
      speechSec.querySelector('#opt-read-options').onchange = (e) =>
        Save.setSpeechSetting('readOptions', e.target.checked);
      const soundInput = speechSec.querySelector('#opt-sound');
      soundInput.onchange = async () => {
        await Save.setSound(soundInput.checked);
        if (soundInput.checked && window.Sound) window.Sound.correct();
      };
      const rateInput = speechSec.querySelector('#opt-rate');
      rateInput.oninput = () => { speechSec.querySelector('#rate-val').textContent = Number(rateInput.value).toFixed(1) + '×'; };
      rateInput.onchange = () => Save.setSpeechSetting('speechRate', Number(rateInput.value));
      speechSec.querySelector('#opt-voice').onchange = (e) =>
        Save.setSpeechSetting('speechVoiceURI', e.target.value);
      speechSec.querySelector('#btn-try-voice').onclick = () => {
        if (!window.Speech || !Speech.supported) { UI.toast('当前设备不支持语音朗读', '#f87171'); return; }
        if (!Speech.enabled()) { UI.toast('请先开启语音朗读', '#f87171'); return; }
        Speech.warmup();
        Speech.speak('小朋友你好，我是闪闪。我们一起来听题，边听边算吧！');
      };

      /* ---------- 小档案 ---------- */
      const profile = document.createElement('div');
      profile.className = 'card parent-section';
      profile.innerHTML = `
        <h3>👶 小档案</h3>
        <div class="profile-row">
          ${window.Shop ? Shop.avatarHtml() : '🦊'}
          <div class="profile-info">
            <b>${UI.esc(d.player.name)}</b>
            <p>可用 ⭐ ${Save.availableStars()} 颗 · 已解锁 ${Save.ownedItems().length} 件装扮</p>
          </div>
          <button class="btn-secondary" id="btn-shop">🛍️ 去星星商店</button>
        </div>
        <div class="setting-row">
          <label for="opt-name">奖状上的名字</label>
          <input type="text" id="opt-name" maxlength="12" value="${UI.esc(d.player.name)}">
          <button class="btn-secondary" id="btn-save-name">保存</button>
        </div>
      `;
      wrap.appendChild(profile);
      profile.querySelector('#btn-shop').onclick = () => App.navigate('shop');
      profile.querySelector('#btn-save-name').onclick = async () => {
        await Save.setName(profile.querySelector('#opt-name').value);
        UI.toast('名字已保存，下次奖状就会用新名字啦', 'var(--secondary)');
      };

      /* ---------- 总览 ---------- */
      const totalLessons = Data.lessonIndex();
      const lessonIds = Object.keys(totalLessons);
      const total = lessonIds.length;
      // 只统计题库里真实存在的课程，导入存档里的无效 key 不会让完成度超过 100%
      const doneCount = lessonIds.filter(id => d.completed[id]).length;
      const stars = Save.totalStars();
      const overview = document.createElement('div');
      overview.className = 'card parent-section';
      overview.innerHTML = `
        <h3>📊 总览</h3>
        <div class="mastery-row"><div class="m-label">已完成知识点</div>
          <div class="m-bar"><div style="width:${total ? (doneCount / total * 100) : 0}%"></div></div>
          <div class="m-val">${doneCount}/${total}</div></div>
        <div class="mastery-row"><div class="m-label">累计星星</div>
          <div class="m-bar"><div style="width:${Math.min(100, total ? stars / (total * 3) * 100 : 0)}%"></div></div>
          <div class="m-val">${stars} ⭐</div></div>
        <div class="mastery-row"><div class="m-label">获得勋章</div>
          <div class="m-bar"><div style="width:${Math.min(100, d.badges.length / Rewards.badges.length * 100)}%"></div></div>
          <div class="m-val">${d.badges.length}/${Rewards.badges.length}</div></div>
      `;
      wrap.appendChild(overview);

      /* ---------- 各年级完成度 ---------- */
      const perGrade = document.createElement('div');
      perGrade.className = 'card parent-section';
      perGrade.innerHTML = '<h3>📚 各年级完成度</h3>';
      Data.grades.forEach(g => {
        const p = Data.gradeProgress(g);
        const cnt = Data.gradeCount(g.grade);
        const next = Data.nextToLearn(g.grade);
        const row = document.createElement('div');
        row.className = 'mastery-row';
        row.innerHTML = `
          <div class="m-label">${g.emoji || '📘'} ${g.title}</div>
          <div class="m-bar"><div style="width:${p * 100}%"></div></div>
          <div class="m-val">${cnt.done}/${cnt.total}</div>`;
        perGrade.appendChild(row);
        if (next && cnt.done < cnt.total) {
          const tip = document.createElement('p');
          tip.className = 'parent-note grade-next';
          tip.textContent = `当前进度：第 ${next.semesterIndex + 1} 学期 · 第 ${next.unitIndex + 1} 单元《${next.unit.title}》→ 下一步《${next.lesson.title}》`;
          perGrade.appendChild(tip);
        }
      });
      wrap.appendChild(perGrade);

      /* ---------- 单元掌握度（按教材顺序递进） ---------- */
      const unitSec = document.createElement('div');
      unitSec.className = 'card parent-section';
      unitSec.innerHTML = '<h3>🧩 单元掌握度</h3>';
      const keys = Data.allUnitKeys();
      let lastGrade = null;
      keys.forEach(k => {
        const meta = Data.unitMeta(k);
        const up = Data.unitProgress(k);
        if (!meta || !up) return;
        if (meta.grade.grade !== lastGrade) {
          lastGrade = meta.grade.grade;
          unitSec.insertAdjacentHTML('beforeend',
            `<div class="unit-group-title">${meta.grade.emoji} ${meta.grade.title}</div>`);
        }
        const rec = (d.unitQuiz || {})[k];
        const state = up.state === 'done' ? '✅ 已通关' :
          up.state === 'locked' ? '🔒 未解锁' :
            up.state === 'learning' ? '🔥 学习中' : '⏳ 待开始';
        const row = document.createElement('div');
        row.className = 'mastery-row unit-row';
        row.innerHTML = `
          <div class="m-label">${UI.esc(meta.unit.title)}</div>
          <div class="m-bar"><div style="width:${up.ratio * 100}%"></div></div>
          <div class="m-val">${up.done}/${up.total}</div>
          <div class="unit-row-state">${state}${rec ? ` · 小测 ${rec.correct}/${rec.total}` : ''}</div>`;
        unitSec.appendChild(row);
      });
      wrap.appendChild(unitSec);

      /* ---------- 错题分析 + 建议 ---------- */
      const analysis = document.createElement('div');
      analysis.className = 'card parent-section';
      analysis.innerHTML = '<h3>🔍 薄弱点与建议</h3>';
      const wrongs = d.wrongBook;
      if (!wrongs.length) {
        analysis.insertAdjacentHTML('beforeend',
          '<div class="empty-state" style="padding:24px">目前没有需要复习的错题，非常棒！</div>');
      } else {
        const byLesson = {};
        wrongs.forEach(w => {
          (byLesson[w.lessonId] = byLesson[w.lessonId] || []).push(w);
        });
        Object.entries(byLesson).forEach(([lid, list]) => {
          const hit = Data.findLesson(lid);
          const title = hit ? `${hit.grade.title} · ${hit.unit.title} · ${hit.lesson.title}` : UI.esc(lid);
          const box = document.createElement('div');
          box.className = 'suggest-box';
          const hardest = list.slice().sort((a, b) => b.count - a.count)[0];
          box.innerHTML = `
            <b>📌 ${title}</b>（${list.length} 道待巩固题）<br>
            建议和孩子重新玩一遍该课的"故事 + 探索"，再进入闯关；
            重点关注：<span style="color:var(--secondary);font-weight:bold">${UI.esc(hardest.prompt)}</span>
            （答错 ${hardest.count} 次）。
          `;
          const reBtn = document.createElement('button');
          reBtn.className = 'btn-secondary';
          reBtn.style.marginTop = '8px';
          reBtn.textContent = '▶ 带孩子重新学这一课';
          reBtn.onclick = () => App.navigate('lesson/' + lid);
          box.appendChild(reBtn);
          analysis.appendChild(box);
        });
      }
      wrap.appendChild(analysis);

      /* ---------- 存档管理 ---------- */
      const manage = document.createElement('div');
      manage.className = 'card parent-section';
      manage.innerHTML = `
        <h3>🛠️ 存档管理</h3>
        <p class="parent-note">进度默认保存在本机。换设备或重装前，建议先导出存档备份。</p>
        <div class="save-actions">
          <button class="btn-secondary" id="btn-export">⬇️ 导出存档</button>
          <button class="btn-secondary" id="btn-import">⬆️ 导入存档</button>
          <button class="btn-secondary" id="btn-reset">🗑️ 重置进度</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      `;
      wrap.appendChild(manage);

      manage.querySelector('#btn-export').onclick = () => this.exportSave();
      manage.querySelector('#btn-import').onclick = () => manage.querySelector('#import-file').click();
      manage.querySelector('#btn-reset').onclick = () => this.confirmReset();
      const fileInput = manage.querySelector('#import-file');
      fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) this.importSave(f);
        fileInput.value = '';
      };

      /* ---------- 勋章墙 ---------- */
      const badgeSec = document.createElement('div');
      badgeSec.className = 'card parent-section';
      badgeSec.innerHTML = '<h3>🎖️ 勋章墙</h3><div class="badge-grid">' +
        Rewards.badges.map(b => `
          <div class="badge-item ${d.badges.includes(b.id) ? '' : 'locked'}">
            <div class="badge-icon">${b.icon}</div>
            <h4>${b.name}</h4>
            <p>${b.desc}</p>
          </div>`).join('') + '</div>';
      wrap.appendChild(badgeSec);

      container.appendChild(wrap);
    },

    exportSave() {
      try {
        const json = JSON.stringify(Save.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `math-wonder-save-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        UI.toast('存档已导出', 'var(--secondary)');
      } catch (e) {
        UI.toast('导出失败：' + e.message, '#f87171');
      }
    },

    importSave(file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const obj = JSON.parse(reader.result);
          await Save.importSave(obj);
          UI.toast('存档已导入', 'var(--secondary)');
          App.navigate('parent');
        } catch (e) {
          UI.toast('导入失败：' + e.message, '#f87171');
        }
      };
      reader.onerror = () => UI.toast('读取文件失败', '#f87171');
      reader.readAsText(file);
    },

    confirmReset() {
      UI.overlay(`
        <div class="overlay-card">
          <div class="sparkle-guide">⚠️</div>
          <h2>确定重置全部进度？</h2>
          <div class="overlay-text">星星、勋章、错题本、打卡记录都会清空，且无法恢复。<br>建议先导出存档备份。</div>
          <div class="overlay-actions">
            <button class="btn-secondary" id="rst-cancel">取消</button>
            <button class="btn-big" id="rst-ok" style="background:#ef4444">确认重置</button>
          </div>
        </div>`, () => {
        document.getElementById('rst-cancel').onclick = () => UI.closeOverlay();
        document.getElementById('rst-ok').onclick = async () => {
          await Save.reset();
          UI.closeOverlay();
          UI.toast('进度已重置', 'var(--secondary)');
          App.navigate('home');
        };
      });
    }
  };

  window.Parent = Parent;
})();
