/* ===== 家长视图 ===== */
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
        <p class="page-subtitle">学习进度 · 薄弱点分析 · 练习建议</p>
      `);

      // 总览
      const doneCount = Object.keys(d.completed).length;
      const totalLessons = Data.lessonIndex();
      const total = Object.keys(totalLessons).length;
      const stars = Save.totalStars();
      const overview = document.createElement('div');
      overview.className = 'card parent-section';
      overview.innerHTML = `
        <h3>📊 总览</h3>
        <div class="mastery-row"><div class="m-label">已完成知识点</div>
          <div class="m-bar"><div style="width:${total ? (doneCount / total * 100) : 0}%"></div></div>
          <div class="m-val">${doneCount}/${total}</div></div>
        <div class="mastery-row"><div class="m-label">累计星星</div>
          <div class="m-bar"><div style="width:${Math.min(100, stars / 90 * 100)}%"></div></div>
          <div class="m-val">${stars} ⭐</div></div>
        <div class="mastery-row"><div class="m-label">获得勋章</div>
          <div class="m-bar"><div style="width:${d.badges.length / Rewards.badges.length * 100}%"></div></div>
          <div class="m-val">${d.badges.length}/${Rewards.badges.length}</div></div>
      `;
      wrap.appendChild(overview);

      // 各年级掌握度
      const perGrade = document.createElement('div');
      perGrade.className = 'card parent-section';
      perGrade.innerHTML = '<h3>📚 各年级完成度</h3>';
      Data.grades.forEach(g => {
        const p = Data.gradeProgress(g);
        const row = document.createElement('div');
        row.className = 'mastery-row';
        row.innerHTML = `
          <div class="m-label">${g.emoji || '📘'} ${g.title}</div>
          <div class="m-bar"><div style="width:${p * 100}%"></div></div>
          <div class="m-val">${Math.round(p * 100)}%</div>`;
        perGrade.appendChild(row);
      });
      wrap.appendChild(perGrade);

      // 错题分析 + 建议
      const analysis = document.createElement('div');
      analysis.className = 'card parent-section';
      analysis.innerHTML = '<h3>🔍 薄弱点与建议</h3>';
      const wrongs = d.wrongBook;
      if (!wrongs.length) {
        analysis.insertAdjacentHTML('beforeend',
          '<div class="empty-state" style="padding:24px">目前没有需要复习的错题，非常棒！</div>');
      } else {
        // 按 lesson 聚合
        const byLesson = {};
        wrongs.forEach(w => {
          (byLesson[w.lessonId] = byLesson[w.lessonId] || []).push(w);
        });
        Object.entries(byLesson).forEach(([lid, list]) => {
          const hit = Data.findLesson(lid);
          const title = hit ? `${hit.grade.title} · ${hit.unit.title} · ${hit.lesson.title}` : lid;
          const box = document.createElement('div');
          box.className = 'suggest-box';
          const hardest = list.slice().sort((a, b) => b.count - a.count)[0];
          box.innerHTML = `
            <b>📌 ${title}</b>（${list.length} 道待巩固题）<br>
            建议和孩子重新玩一遍该课的"故事 + 探索"，再进入闯关；
            重点关注：<span style="color:var(--secondary);font-weight:bold">${hardest.prompt}</span>
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

      // 存档管理 + 设置
      const manage = document.createElement('div');
      manage.className = 'card parent-section';
      const soundOn = d.settings ? d.settings.sound !== false : true;
      manage.innerHTML = `
        <h3>🛠️ 存档与设置</h3>
        <p class="parent-note">进度默认保存在本机。换设备或重装前，建议先导出存档备份。</p>
        <div class="save-actions">
          <button class="btn-secondary" id="btn-export">⬇️ 导出存档</button>
          <button class="btn-secondary" id="btn-import">⬆️ 导入存档</button>
          <button class="btn-secondary" id="btn-reset">🗑️ 重置进度</button>
        </div>
        <label class="toggle-row">
          <input type="checkbox" id="opt-sound" ${soundOn ? 'checked' : ''}>
          🔊 答题音效
        </label>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      `;
      wrap.appendChild(manage);

      manage.querySelector('#btn-export').onclick = () => this.exportSave();
      manage.querySelector('#btn-import').onclick = () => manage.querySelector('#import-file').click();
      manage.querySelector('#btn-reset').onclick = () => this.confirmReset();
      const soundInput = manage.querySelector('#opt-sound');
      soundInput.onchange = async () => {
        await Save.setSound(soundInput.checked);
        if (soundInput.checked && window.Sound) window.Sound.correct();
      };
      const fileInput = manage.querySelector('#import-file');
      fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) this.importSave(f);
        fileInput.value = '';
      };

      // 勋章墙
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
          <div class="overlay-text">星星、勋章、错题本都会清空，且无法恢复。<br>建议先导出存档备份。</div>
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
