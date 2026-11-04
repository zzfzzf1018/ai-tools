/* ===== 互动探索引擎 =====
   支持 6 种探索类型（内容里 explore.type 指定）：
   - count-click : 点一点数一数
   - drag-group  : 拖一拖平均分
   - number-line : 数轴滑一滑
   - area-tiles  : 铺方格（面积/乘法）
   - balance     : 天平平衡（等量关系）
   - ten-frame   : 十格框凑十
   全部使用 Pointer Events，鼠标 / 触屏通用。
*/
(function () {

  /* ---------- 通用拖拽（Pointer Events） ---------- */
  function makeDraggable(el, payload, onDrop) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const ghost = el.cloneNode(true);
      ghost.style.position = 'fixed';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = 500;
      ghost.style.opacity = '.9';
      document.body.appendChild(ghost);
      el.classList.add('dragging');

      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      moveGhost(e.clientX, e.clientY);

      function moveGhost(x, y) {
        ghost.style.left = (x - offX) + 'px';
        ghost.style.top = (y - offY) + 'px';
      }

      const move = (ev) => {
        moveGhost(ev.clientX, ev.clientY);
        document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const zone = under && under.closest('.drop-zone');
        if (zone) zone.classList.add('drag-over');
      };

      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        ghost.remove();
        el.classList.remove('dragging');
        document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const zone = under && under.closest('.drop-zone');
        if (zone) onDrop(payload, el, zone);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  const engines = {};

  /* ---------- 1. 点一点数一数 ---------- */
  engines['count-click'] = function (box, cfg, done) {
    const n = cfg.count;
    const item = cfg.item || '⭐';
    let clicked = 0;
    const ws = document.createElement('div');
    ws.className = 'explore-workspace';
    const tray = document.createElement('div');
    tray.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:520px;';
    for (let i = 0; i < n; i++) {
      const it = document.createElement('span');
      it.className = 'drag-item';
      it.textContent = item;
      const onCount = () => {
        if (it.dataset.on) return;
        it.dataset.on = '1';
        clicked++;
        it.style.transform = 'scale(1.25)';
        it.style.filter = 'drop-shadow(0 0 6px var(--primary))';
        counter.textContent = clicked;
        Rewards.float(it, '✨');
        if (clicked === n) {
          setTimeout(() => {
            counter.textContent = `${n} 个！`;
            showWrapUp(ws, cfg.wrapup || `一共数出了 ${n} 个！`, done);
          }, 450);
        }
      };
      it.addEventListener('pointerdown', onCount);
      it.addEventListener('click', onCount);
      tray.appendChild(it);
    }
    const counter = document.createElement('div');
    counter.className = 'explore-counter';
    counter.textContent = '👆 点一个数一个';
    ws.appendChild(counter);
    ws.appendChild(tray);
    box.appendChild(ws);
  };

  /* ---------- 2. 拖一拖平均分 ---------- */
  engines['drag-group'] = function (box, cfg, done) {
    const total = cfg.total, groups = cfg.groups, per = total / groups;
    const item = cfg.item || '🍬';
    let placed = 0;
    const ws = document.createElement('div');
    ws.className = 'explore-workspace';

    const pool = document.createElement('div');
    pool.className = 'drop-zone';
    pool.style.cssText = 'border-style:solid;min-height:64px;max-width:480px;';
    pool.dataset.zoneId = 'pool';

    const zonesRow = document.createElement('div');
    zonesRow.style.cssText = 'display:flex;gap:22px;flex-wrap:wrap;justify-content:center;';
    const zoneList = [];
    const labels = cfg.groupLabels || [];
    for (let i = 0; i < groups; i++) {
      const z = document.createElement('div');
      z.className = 'drop-zone';
      z.dataset.zoneId = 'g' + i;
      z.dataset.need = per;
      z.innerHTML = `<div class="zone-label">${labels[i] || ('第 ' + (i + 1) + ' 份')}（0/${per}）</div>`;
      zonesRow.appendChild(z);
      zoneList.push(z);
    }

    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn-secondary';
    checkBtn.textContent = '✅ 分好啦，检查一下';
    checkBtn.disabled = true;

    const allItems = [];
    for (let i = 0; i < total; i++) {
      const it = document.createElement('span');
      it.className = 'drag-item';
      it.style.fontSize = '32px';
      it.textContent = item;
      pool.appendChild(it);
      allItems.push(it);
      makeDraggable(it, { home: pool }, (payload, el, zone) => {
        if (el.parentElement === zone) return;
        if (zone !== pool && zone.children.length - 1 >= per) {
          zone.style.animation = 'shake .4s';
          setTimeout(() => zone.style.animation = '', 400);
          return;
        }
        zone.appendChild(el);
        updateCounts();
      });
    }

    function updateCounts() {
      placed = zoneList.reduce((s, z) => s + (z.querySelectorAll('.drag-item').length), 0);
      zoneList.forEach(z => {
        const c = z.querySelectorAll('.drag-item').length;
        z.querySelector('.zone-label').textContent =
          (z.dataset.label || z.querySelector('.zone-label').textContent.replace(/（.*）/, '')) + `（${c}/${per}）`;
      });
      checkBtn.disabled = placed !== total;
    }
    zoneList.forEach(z => { z.dataset.label = z.querySelector('.zone-label').textContent.replace(/（.*）/, ''); });

    checkBtn.addEventListener('click', () => {
      const ok = zoneList.every(z => z.querySelectorAll('.drag-item').length === per);
      if (ok) {
        zoneList.forEach(z => z.style.borderColor = 'var(--secondary)');
        showWrapUp(ws, cfg.wrapup || `每人 ${per} 个，分得一样多！这就是"平均分"。`, done);
      } else {
        ws.style.animation = 'shake .4s';
        setTimeout(() => ws.style.animation = '', 400);
        UI.toast('每份要一样多哦，再调整一下～');
      }
    });

    const poolLabel = document.createElement('div');
    poolLabel.className = 'zone-label';
    poolLabel.textContent = '先从这里拖出去吧 ↓';
    pool.prepend(poolLabel);

    ws.appendChild(pool);
    ws.appendChild(zonesRow);
    ws.appendChild(checkBtn);
    box.appendChild(ws);
  };

  /* ---------- 3. 数轴滑一滑 ---------- */
  engines['number-line'] = function (box, cfg, done) {
    const min = cfg.min ?? 0, max = cfg.max ?? 10, step = cfg.step || 1;
    const target = cfg.target;
    // 小数步长（如 0.1）累加会产生 0.7000000000000001 这类浮点误差，统一按步长精度取整
    const decimals = Math.min(6, (String(step).split('.')[1] || '').length + 2);
    const norm = (v) => Number(v.toFixed(decimals));
    const eps = Math.abs(step) / 1000;
    const wrap = document.createElement('div');
    wrap.className = 'explore-workspace number-line-wrap';
    const nl = document.createElement('div');
    nl.className = 'number-line';
    nl.innerHTML = '<div class="nl-track"></div>';
    const ticks = Math.round((max - min) / step);
    for (let i = 0; i <= ticks; i++) {
      const v = norm(min + i * step);
      const pct = (i / ticks) * 100;
      const t = document.createElement('div');
      t.className = 'nl-tick';
      t.style.left = pct + '%';
      nl.appendChild(t);
      const num = document.createElement('div');
      num.className = 'nl-num';
      num.style.left = pct + '%';
      num.textContent = v;
      nl.appendChild(num);
    }
    const marker = document.createElement('div');
    marker.className = 'nl-marker';
    marker.textContent = cfg.marker || '🚀';
    nl.appendChild(marker);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0; slider.max = ticks; slider.step = 1; slider.value = Math.round(((cfg.start ?? min) - min) / step);
    slider.addEventListener('input', () => {
      marker.style.left = (slider.value / ticks) * 100 + '%';
      readout.textContent = '现在是：' + norm(min + slider.value * step);
    });
    marker.style.left = (slider.value / ticks) * 100 + '%';

    const readout = document.createElement('div');
    readout.style.cssText = 'font-size:22px;font-weight:bold;color:var(--title);';
    readout.textContent = '现在是：' + norm(min + slider.value * step);

    const btn = document.createElement('button');
    btn.className = 'btn-big';
    btn.textContent = '🚀 出发！';
    btn.addEventListener('click', () => {
      const v = norm(min + slider.value * step);
      if (Math.abs(v - target) <= eps) {
        showWrapUp(wrap, cfg.wrapup || `找到了 ${target}！数轴上每格一样宽，位置和数一一对应。`, done);
      } else {
        wrap.style.animation = 'shake .4s';
        setTimeout(() => wrap.style.animation = '', 400);
        UI.toast(v < target ? '再往右滑一点～' : '再往左滑一点～');
      }
    });

    wrap.appendChild(nl);
    wrap.appendChild(slider);
    wrap.appendChild(readout);
    wrap.appendChild(btn);
    box.appendChild(wrap);
  };

  /* ---------- 4. 铺方格 ---------- */
  engines['area-tiles'] = function (box, cfg, done) {
    const rows = cfg.rows, cols = cfg.cols;
    let filled = 0;
    const need = rows * cols;
    const wrap = document.createElement('div');
    wrap.className = 'explore-workspace';
    const counter = document.createElement('div');
    counter.className = 'explore-counter';
    counter.textContent = '已铺 0 格';
    const grid = document.createElement('div');
    grid.className = 'tile-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 44px)`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'tile-cell';
        cell.dataset.rc = r + ',' + c;
        cell.addEventListener('click', () => {
          if (cell.classList.contains('filled')) return;
          cell.classList.add('filled');
          cell.textContent = cfg.fillItem || '🟦';
          filled++;
          counter.textContent = `已铺 ${filled} 格`;
          if (filled === need) {
            setTimeout(() => {
              const formula = cfg.wrapup || `每行 ${cols} 格，有 ${rows} 行：${cols} × ${rows} = ${need}。`;
              showWrapUp(wrap, formula + ' 这就是面积！', done);
            }, 350);
          }
        });
        grid.appendChild(cell);
      }
    }
    wrap.appendChild(counter);
    wrap.appendChild(grid);
    box.appendChild(wrap);
  };

  /* ---------- 5. 天平平衡 ---------- */
  engines['balance'] = function (box, cfg, done) {
    const ws = document.createElement('div');
    ws.className = 'explore-workspace balance-wrap';
    const beamRow = document.createElement('div');
    beamRow.style.cssText = 'display:flex;align-items:center;gap:0;transform-origin:center;';
    const leftPan = document.createElement('div');
    leftPan.className = 'balance-pan';
    leftPan.innerHTML = `<div class="pan-label">${cfg.leftLabel}</div>`;
    const rightPan = document.createElement('div');
    rightPan.className = 'balance-pan';
    rightPan.innerHTML = `<div class="pan-label">${cfg.rightLabel}</div>`;
    (cfg.rightItems || []).forEach(t => {
      const s = document.createElement('span');
      s.className = 'weight-chip';
      s.style.cursor = 'default';
      s.textContent = t;
      rightPan.appendChild(s);
    });
    const beam = document.createElement('div');
    beam.className = 'balance-beam';
    beamRow.appendChild(leftPan);
    beamRow.appendChild(beam);
    beamRow.appendChild(rightPan);
    const post = document.createElement('div');
    post.className = 'balance-post';

    const bank = document.createElement('div');
    bank.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
    const bankLabel = document.createElement('div');
    bankLabel.className = 'zone-label';
    bankLabel.textContent = '点击砝码放到左边的盘子里：';
    (cfg.weights || []).forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'weight-chip';
      chip.textContent = w;
      chip.addEventListener('click', () => {
        const s = document.createElement('span');
        s.className = 'weight-chip';
        s.style.cursor = 'pointer';
        s.textContent = w;
        s.addEventListener('click', () => {
          s.remove();
          chip.classList.remove('used');
          tilt();
        });
        leftPan.appendChild(s);
        chip.classList.add('used');
        tilt();
      });
      bank.appendChild(chip);
    });

    function tilt() {
      const leftVal = [...leftPan.querySelectorAll('.weight-chip')].reduce((s, c) => s + (+c.textContent || 0), 0);
      const rightVal = (cfg.rightValue ?? 0) + (cfg.rightItems || []).reduce((s, v) => s + (+v || 0), 0);
      const eq = Math.abs(leftVal - rightVal) < 1e-9 * Math.max(1, Math.abs(rightVal));
      if (leftVal === 0) beamRow.style.transform = 'rotate(0deg)';
      else if (leftVal < rightVal) beamRow.style.transform = 'rotate(4deg)';
      else if (leftVal > rightVal) beamRow.style.transform = 'rotate(-4deg)';
      else beamRow.style.transform = 'rotate(0deg)';
      if (eq && leftVal > 0) {
        setTimeout(() => showWrapUp(ws, cfg.wrapup || `两边一样重！${cfg.leftLabel} = ${rightVal}。相等就是"平衡"。`, done), 500);
      }
    }

    ws.appendChild(beamRow);
    ws.appendChild(post);
    ws.appendChild(bankLabel);
    ws.appendChild(bank);
    box.appendChild(ws);
  };

  /* ---------- 6. 十格框凑十 ---------- */
  engines['ten-frame'] = function (box, cfg, done) {
    const start = cfg.start, target = cfg.target ?? 10;
    const need = target - start;
    let filled = 0;
    const ws = document.createElement('div');
    ws.className = 'explore-workspace';
    const counter = document.createElement('div');
    counter.className = 'explore-counter';
    const frame = document.createElement('div');
    frame.className = 'ten-frame';
    for (let i = 0; i < target; i++) {
      const cell = document.createElement('div');
      cell.className = 'tf-cell';
      if (i < start) {
        cell.classList.add('filled');
        cell.textContent = cfg.item || '🔵';
      } else {
        cell.addEventListener('click', () => {
          if (cell.classList.contains('filled')) return;
          cell.classList.add('filled');
          cell.textContent = cfg.fillItem || '🟡';
          filled++;
          counter.textContent = `${start} + ${filled} = ${target}`;
          if (filled === need) {
            setTimeout(() => showWrapUp(ws, cfg.wrapup || `${start} + ${need} = ${target}！凑满一格真好用。`, done), 400);
          }
        });
      }
      frame.appendChild(cell);
    }
    counter.textContent = `${start} + ? = ${target}`;
    ws.appendChild(counter);
    ws.appendChild(frame);
    box.appendChild(ws);
  };

  /* ---------- 探索完成收尾条 ---------- */
  function showWrapUp(ws, text, done) {
    const old = ws.querySelector('.explore-wrapup');
    if (old) old.remove();
    const wu = document.createElement('div');
    wu.className = 'hint-box explore-wrapup';
    wu.style.textAlign = 'center';
    wu.innerHTML = `<span class="hint-label">💡 发现</span>${text}`;
    const btn = document.createElement('div');
    btn.style.marginTop = '14px';
    const b = document.createElement('button');
    b.className = 'btn-big';
    b.textContent = '我学会啦，去闯关 ➜';
    b.addEventListener('click', () => done && done());
    btn.appendChild(b);
    wu.appendChild(btn);
    ws.appendChild(wu);
    wu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const Explore = {
    mount(box, cfg, done) {
      box.innerHTML = '';
      const fn = engines[cfg.type];
      if (!fn) {
        box.innerHTML = `<div class="empty-state">未知的探索类型：${cfg.type}</div>`;
        return;
      }
      const panel = document.createElement('div');
      panel.className = 'explore-panel';
      const t = document.createElement('div');
      t.className = 'explore-title';
      t.textContent = cfg.title || '动手试一试';
      const ins = document.createElement('div');
      ins.className = 'explore-instruction';
      ins.textContent = cfg.instruction || '👇 试一试吧';
      const ws = document.createElement('div');
      panel.appendChild(t);
      panel.appendChild(ins);
      panel.appendChild(ws);
      box.appendChild(panel);

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        done && done();
      };

      // 允许跳过探索，避免孩子卡在互动环节无法进入闯关
      const skip = document.createElement('button');
      skip.className = 'btn-secondary explore-skip';
      skip.textContent = '跳过探索 ➜';
      skip.addEventListener('click', finish);
      panel.appendChild(skip);

      fn(ws, cfg, finish);
    }
  };

  window.Explore = Explore;
})();
