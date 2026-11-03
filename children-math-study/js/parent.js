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
    }
  };

  window.Parent = Parent;
})();
