/* ===== 星星商店：头像 / 挂件装扮 + 勋章预览 =====
   余额 = 累计获得的星星 - 已消费；重玩拿到更高星级会自动增加余额。
   已解锁的装扮可随时免费切换佩戴，购买后立刻检查是否解锁新勋章。
*/
(function () {

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = s => (window.UI ? UI.esc(s) : String(s == null ? '' : s));

  const ITEMS = [
    { id: 'avatar-fox', type: 'avatar', emoji: '🦊', name: '小狐狸', price: 0, desc: '最初的冒险伙伴' },
    { id: 'avatar-cat', type: 'avatar', emoji: '🐱', name: '橘小猫', price: 5, desc: '爱数小鱼干' },
    { id: 'avatar-panda', type: 'avatar', emoji: '🐼', name: '圆滚滚', price: 8, desc: '最爱竹子与加法' },
    { id: 'avatar-rabbit', type: 'avatar', emoji: '🐰', name: '跳跳兔', price: 10, desc: '数数跳得最快' },
    { id: 'avatar-unicorn', type: 'avatar', emoji: '🦄', name: '彩虹马', price: 14, desc: '来自糖果乐园' },
    { id: 'avatar-dragon', type: 'avatar', emoji: '🐲', name: '小恐龙', price: 18, desc: '乘法口诀守护者' },
    { id: 'avatar-robot', type: 'avatar', emoji: '🤖', name: '闪闪机器人', price: 22, desc: '和你一起听题' },
    { id: 'avatar-crown', type: 'avatar', emoji: '👑', name: '数学国王', price: 30, desc: '全岛最会算的人' },

    { id: 'accessory-none', type: 'accessory', emoji: '', name: '不佩戴', price: 0, desc: '清清爽爽' },
    { id: 'accessory-sparkle', type: 'accessory', emoji: '✨', name: '闪闪星', price: 6, desc: '答对时亮一下' },
    { id: 'accessory-bow', type: 'accessory', emoji: '🎀', name: '糖果蝴蝶结', price: 8, desc: '甜甜的一整天' },
    { id: 'accessory-star', type: 'accessory', emoji: '🌟', name: '小金星', price: 10, desc: '攒星星的证明' },
    { id: 'accessory-orb', type: 'accessory', emoji: '🔮', name: '智慧水晶球', price: 14, desc: '提示都藏在里面' },
    { id: 'accessory-medal', type: 'accessory', emoji: '🏅', name: '冠军奖牌', price: 18, desc: '零失误通关纪念' },
    { id: 'accessory-rainbow', type: 'accessory', emoji: '🌈', name: '彩虹桥', price: 22, desc: '连着每一座小岛' },
    { id: 'accessory-rocket', type: 'accessory', emoji: '🚀', name: '小火箭', price: 28, desc: '飞向深空数学院' }
  ];

  function byId(id) { return ITEMS.find(x => x.id === id) || null; }
  function isEquipped(item) {
    const p = Save.data.player;
    return item.type === 'avatar' ? (p.avatar || '🦊') === item.emoji
      : (p.accessory || '') === item.emoji;
  }
  function avatarText() {
    const p = Save.data.player || {};
    return (p.avatar || '🦊') + (p.accessory || '');
  }
  function avatarHtml() {
    const p = Save.data.player || {};
    return `<span class="shop-avatar">${esc(p.avatar || '🦊')}${
      p.accessory ? `<span class="shop-acc">${esc(p.accessory)}</span>` : ''
    }</span>`;
  }

  const Shop = {
    items: ITEMS,
    avatarText,
    avatarHtml,

    render(container) {
      container.innerHTML = '';
      const wrap = el('div', 'shop-wrap');
      container.appendChild(wrap);
      const available = Save.availableStars();
      const total = Save.totalStars();
      const spent = Save.data.wallet.spent || 0;
      const owned = Save.ownedItems().length;
      const p = Save.data.player;

      const head = el('div', 'card shop-head');
      head.innerHTML = `
        <h2>🛍️ 星星商店</h2>
        <div class="shop-hero">${avatarHtml()}</div>
        <div class="shop-player">${esc(p.name)} 的冒险形象</div>
        <div class="shop-balance">
          <div class="sb-box"><b>⭐ ${available}</b><span>可用星星</span></div>
          <div class="sb-box"><b>${total}</b><span>累计获得</span></div>
          <div class="sb-box"><b>${spent}</b><span>已兑换</span></div>
          <div class="sb-box"><b>${owned}/${ITEMS.length}</b><span>已解锁</span></div>
        </div>
        <p class="parent-note">闯关拿星星、单元小测拿满星、重玩刷新更高星级，都能攒下可用星星。已解锁的装扮可以随时免费换着戴～</p>
      `;
      wrap.appendChild(head);

      const renderSection = (type, title, icon) => {
        const sec = el('div', 'card shop-section');
        sec.innerHTML = `<h3>${icon} ${title}</h3>`;
        const grid = el('div', 'shop-grid');
        ITEMS.filter(it => it.type === type).forEach(item => {
          const has = Save.owns(item.id);
          const on = isEquipped(item);
          const afford = available >= item.price;
          const state = on ? '佩戴中' : (has ? '已解锁' : (afford ? `⭐ ${item.price} 兑换` : `还差 ${item.price - available} 颗`));
          const card = el('div', 'shop-item' + (on ? ' equipped' : '') + (!has && !afford ? ' locked' : ''));
          card.innerHTML = `
            <div class="si-emoji">${item.emoji ? esc(item.emoji) : '🚫'}</div>
            <div class="si-name">${esc(item.name)}</div>
            <div class="si-desc">${esc(item.desc)}</div>
            <button class="btn-secondary si-btn">${on ? '✅ 佩戴中' : (has ? '👕 戴上它' : state)}</button>
          `;
          card.querySelector('.si-btn').onclick = () => this.tap(item, container);
          grid.appendChild(card);
        });
        sec.appendChild(grid);
        wrap.appendChild(sec);
      };
      renderSection('avatar', '换一个冒险伙伴', '🦊');
      renderSection('accessory', '加一件小挂件', '✨');

      const foot = el('div', 'shop-foot');
      foot.innerHTML = `
        <button class="btn-secondary" id="sp-badges">🎖️ 看看我的勋章</button>
        <button class="btn-secondary" id="sp-home">🏠 回到首页</button>
      `;
      wrap.appendChild(foot);
      foot.querySelector('#sp-badges').onclick = () => App.navigate('parent');
      foot.querySelector('#sp-home').onclick = () => App.navigate('home');
    },

    async tap(item, container) {
      const has = Save.owns(item.id);
      if (isEquipped(item)) { UI.toast('这个已经戴在身上啦～'); return; }
      if (has) {
        await Save.equip(item.type, item.emoji);
        UI.updateAvatar();
        UI.toast(`换好啦：${item.name}`, 'var(--secondary)');
        this.render(container);
        return;
      }
      const available = Save.availableStars();
      if (available < item.price) {
        UI.toast(`还差 ${item.price - available} 颗星星，去闯关赚一赚吧～`, '#f87171');
        return;
      }
      UI.overlay(`
        <div class="overlay-card">
          <div class="shop-confirm-emoji">${item.emoji ? esc(item.emoji) : '🚫'}</div>
          <h2>兑换「${esc(item.name)}」？</h2>
          <div class="overlay-text">花费 <b>⭐ ${item.price}</b> 颗星星，兑换后马上就能戴上，随时可以免费换回来。</div>
          <div class="overlay-actions">
            <button class="btn-secondary" id="sp-cancel">再想想</button>
            <button class="btn-big" id="sp-ok">⭐ 兑换并戴上</button>
          </div>
        </div>`, () => {
        document.getElementById('sp-cancel').onclick = () => UI.closeOverlay();
        document.getElementById('sp-ok').onclick = async () => {
          const ok = await Save.buy(item.id, item.price);
          if (!ok) { UI.closeOverlay(); UI.toast('星星不够啦，去闯关赚一赚～', '#f87171'); return; }
          await Save.equip(item.type, item.emoji);
          UI.closeOverlay();
          UI.updateAvatar();
          UI.updateStars();
          UI.toast(`兑换成功：${item.name}！`, 'var(--secondary)');
          if (window.Speech) Speech.autoSpeak(() => `兑换成功，${item.name}已经戴好啦`);
          this.render(container);
          const fresh = await Rewards.checkBadges();
          if (fresh.length) Rewards.showBadgeOverlay(fresh);
        };
      });
    },

    // 供离线自检
    _byId: byId
  };

  window.Shop = Shop;
})();
