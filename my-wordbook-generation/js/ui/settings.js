/* 单词书 · 设置 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  function sizeText(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function settingRow(label, desc, control) {
    return ui.el('div', { class: 'setting-row' },
      ui.el('div', { class: 'label' },
        ui.el('b', null, label),
        desc ? ui.el('span', null, desc) : null
      ),
      ui.el('div', { class: 'control' }, control)
    );
  }

  function render(root) {
    const settings = WB.store.getSettings();

    function save(patch) {
      const next = WB.store.updateSettings(patch);
      if (WB.main && WB.main.refreshChrome) WB.main.refreshChrome();
      return next;
    }

    const tierButtons = [1, 2, 3].map(function (level) {
      return ui.el('button', {
        type: 'button',
        dataset: { tier: String(level) },
        'aria-pressed': String(settings.tier === level),
        onclick: function () {
          const next = save({ tier: level });
          WB.session.reset('learn');
          tierButtons.forEach(function (button) {
            button.setAttribute('aria-pressed', String(Number(button.dataset.tier) === next.tier));
          });
          ui.toast('已切换到 ' + ui.tierTitle(next.tier));
        }
      }, 'L' + level + ' · ' + ui.num(WB.words.tierTarget(level)));
    });

    const themeButtons = [
      { value: 'auto', label: '跟随系统' },
      { value: 'light', label: '浅色' },
      { value: 'dark', label: '深色' }
    ].map(function (item) {
      return ui.el('button', {
        type: 'button',
        dataset: { theme: item.value },
        'aria-pressed': String(settings.theme === item.value),
        onclick: function () {
          const next = save({ theme: item.value });
          themeButtons.forEach(function (button) {
            button.setAttribute('aria-pressed', String(button.dataset.theme === next.theme));
          });
          if (WB.main && WB.main.applyTheme) WB.main.applyTheme();
        }
      }, item.label);
    });

    const modeInputs = Object.keys(WB.session.MODE_LABELS).map(function (mode) {
      return ui.el('label', { class: 'checkline' },
        ui.el('input', {
          type: 'checkbox',
          checked: !!settings.modes[mode],
          onchange: function (event) {
            const modes = Object.assign({}, WB.store.getSettings().modes);
            modes[mode] = event.target.checked;
            if (!Object.keys(modes).some(function (key) { return modes[key]; })) {
              event.target.checked = true;
              ui.toast('至少保留一种复习题型', 'warn');
              return;
            }
            save({ modes: modes });
          }
        }),
        WB.session.MODE_LABELS[mode]
      );
    });

    const notebookCount = Object.keys(WB.store.getNotebook()).length;
    const cardCount = Object.keys(WB.store.getCards()).length;

    root.appendChild(ui.pageHead('设置', '调整学习目标、复习方式与外观。', null));

    const learning = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '学习目标')),
      settingRow('词库目标', '三级词库逐级累积，切换后立即生效。',
        ui.el('div', { class: 'segmented' }, tierButtons)
      ),
      settingRow('每日新词', '建议保持稳定的少量输入，1–200。',
        ui.el('input', {
          class: 'input',
          type: 'number',
          min: '1',
          max: '200',
          value: String(settings.dailyNew),
          onchange: function (event) {
            const next = save({ dailyNew: event.target.value });
            event.target.value = String(next.dailyNew);
          }
        })
      ),
      settingRow('每日复习上限', '到期卡片太多时，避免一次负担过重，20–2000。',
        ui.el('input', {
          class: 'input',
          type: 'number',
          min: '20',
          max: '2000',
          value: String(settings.reviewCap),
          onchange: function (event) {
            const next = save({ reviewCap: event.target.value });
            event.target.value = String(next.reviewCap);
          }
        })
      ),
      settingRow('跳过基础功能词', 'the / and / of 等约 150 个词默认不出现在每日队列。',
        ui.el('label', { class: 'checkline' },
          ui.el('input', {
            type: 'checkbox',
            checked: settings.skipBasic,
            onchange: function (event) {
              save({ skipBasic: event.target.checked });
              WB.session.reset('learn');
            }
          }),
          '跳过'
        )
      )
    );

    const review = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '复习方式')),
      settingRow('启用题型', '复习时从已启用的题型中随机抽取。',
        null
      ),
      ui.el('div', { class: 'mode-grid', style: 'max-width:none;margin-bottom:8px' }, modeInputs),
      settingRow('自动收录不认识的词', '评分“忘记”或复习答错时，自动加入生词本。',
        ui.el('label', { class: 'checkline' },
          ui.el('input', {
            type: 'checkbox',
            checked: settings.autoAddUnknown,
            onchange: function (event) { save({ autoAddUnknown: event.target.checked }); }
          }),
          '自动收录'
        )
      )
    );

    const appearance = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '外观')),
      settingRow('主题', '一键切换纸墨风的浅色与深色外观。',
        ui.el('div', { class: 'segmented' }, themeButtons)
      )
    );

    const data = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '数据')),
      settingRow('本地数据', '共 ' + cardCount + ' 张卡片、' + notebookCount + ' 个生词，占用 ' + sizeText(WB.store.storageBytes()) + '。',
        ui.el('button', {
          class: 'btn sm',
          type: 'button',
          onclick: function () { WB.main.go('notebook'); }
        }, '查看生词本')
      ),
      settingRow('全量备份', '导出含设置、卡片、生词本、复习记录与每日统计的 JSON 文件。',
        ui.el('button', {
          class: 'btn',
          type: 'button',
          onclick: function () {
            WB.exporter.exportAll();
            ui.toast('已开始导出全量备份');
          }
        }, '导出 JSON')
      ),
      ui.el('p', { class: 'muted tiny', style: 'margin-top:12px' },
        '提示：桌面启动器（本地服务）与直接打开 index.html（file://）属于不同的页面来源，学习数据不互通，建议固定一种打开方式。')
    );

    const danger = ui.el('section', { class: 'card danger-zone' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '重置')),
      ui.el('p', { class: 'muted tiny', style: 'margin-bottom:12px' },
        '清空会删除本机保存的全部学习数据，且无法恢复。建议先导出全量备份。'),
      ui.el('button', {
        class: 'btn danger',
        type: 'button',
        onclick: function () {
          if (!ui.confirm('清空所有学习数据？包括卡片、生词本、统计与设置，此操作不可恢复。')) return;
          if (!ui.confirm('再次确认：真的要删除全部数据吗？')) return;
          WB.store.resetAll();
          WB.session.reset();
          if (WB.main) {
            WB.main.applyTheme();
            WB.main.go('start');
          }
          ui.toast('已清空所有学习数据');
        }
      }, '清空所有数据')
    );

    const meta = WB.words.meta || {};
    const about = ui.el('section', { class: 'card' },
      ui.el('div', { class: 'card-title' }, ui.el('h2', null, '关于')),
      ui.el('div', { class: 'about-list' },
        ui.el('div', null, '词库：', ui.el('b', null, 'ECDICT'), '　·　' + ui.num(WB.words.total) + ' 词（2,000 / 4,000 / 8,000 累积分档）'),
        ui.el('div', null, '许可：', ui.el('b', null, 'MIT'), '　·　版本 ' + (meta.version || '1.0.0') + '　·　构建于 ' + (meta.builtAt || '')),
        ui.el('div', null, '算法：', ui.el('b', null, 'SM-2 间隔重复'), '　·　主动回忆　·　错词强化'),
        ui.el('div', null, '存储：浏览器 localStorage，键名前缀 ', ui.el('b', null, 'wb:v1:'), '，不上传任何数据。')
      )
    );

    root.appendChild(ui.el('div', { class: 'settings' }, learning, review, appearance, data, danger, about));
  }

  WB.ui.settings = { render: render };
})();
