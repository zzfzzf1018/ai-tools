/* ===== 奖励系统：星星、勋章、庆祝动效 ===== */
(function () {
  const BADGES = [
    { id: 'first-lesson', icon: '🏅', name: '首关达人', desc: '完成第一个知识点' },
    { id: 'perfect', icon: '💎', name: '满分之星', desc: '一次闯关零失误' },
    { id: 'star-50', icon: '🌟', name: '星星收藏家', desc: '累计获得 50 颗星星' },
    { id: 'grade-done', icon: '👑', name: '年级冠军', desc: '完成一个年级的全部内容' },
    { id: 'explore-10', icon: '🔬', name: '小小科学家', desc: '完成 10 次互动探索' },
    { id: 'streak-brave', icon: '🦁', name: '勇气徽章', desc: '错题本清零一次' }
  ];

  const PRAISE = ['太棒了！', '真厉害！', '答对啦！', '你真聪明！', '完美！', '好样的！'];
  const ENCOURAGE = ['没关系，再看一眼提示～', '差一点点，再试一次！', '勇敢的小数学家不怕错～'];

  const Rewards = {
    badges: BADGES,
    praise() { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; },
    encourage() { return ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]; },

    // 答题反馈漂浮动效
    float(el, emoji) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const f = document.createElement('div');
      f.className = 'float-feedback';
      f.textContent = emoji;
      f.style.left = (rect.left + rect.width / 2 - 20) + 'px';
      f.style.top = (rect.top + rect.height / 2 - 20) + 'px';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1000);
    },

    // 检查并授予勋章，返回新获得勋章列表
    async checkBadges() {
      const earned = [];
      const d = Save.data;
      const doneCount = Object.keys(d.completed).length;
      const totalStars = Save.totalStars();
      const exploreCount = Object.keys(d.exploreDone).length;

      if (doneCount >= 1) earned.push('first-lesson');
      if (totalStars >= 50) earned.push('star-50');
      if (exploreCount >= 10) earned.push('explore-10');
      for (const g of Data.grades) {
        if (Data.gradeProgress(g) >= 1) { earned.push('grade-done'); break; }
      }
      if (d.badges.includes('perfect-candidate')) earned.push('perfect');

      const fresh = [];
      for (const id of [...new Set(earned)]) {
        const added = await Save.addBadge(id);
        if (added) fresh.push(id);
      }
      return fresh;
    },

    // 勋章获得弹层
    showBadgeOverlay(badgeIds, onDone) {
      const list = badgeIds.map(id => BADGES.find(b => b.id === id)).filter(Boolean);
      if (!list.length) { onDone && onDone(); return; }
      const items = list.map(b => `
        <div class="badge-item">
          <div class="badge-icon">${b.icon}</div>
          <h4>${b.name}</h4>
          <p>${b.desc}</p>
        </div>`).join('');
      UI.overlay(`
        <div class="overlay-card">
          <div class="sparkle-guide">🎉</div>
          <h2>获得新勋章！</h2>
          <div class="badge-grid" style="margin:14px 0;">${items}</div>
          <div class="overlay-actions">
            <button class="btn-big" id="ov-btn">继续冒险 ➜</button>
          </div>
        </div>`, () => { document.getElementById('ov-btn').onclick = () => { UI.closeOverlay(); onDone && onDone(); }; });
    }
  };

  window.Rewards = Rewards;
})();
