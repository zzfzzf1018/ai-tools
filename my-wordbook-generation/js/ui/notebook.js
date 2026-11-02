/* 单词书 · 生词本 */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};
  const ui = WB.ui;

  function selectNode(value, options, handler) {
    const node = ui.el('select', { class: 'select', onchange: handler },
      options.map(function (item) {
        return ui.el('option', { value: item[0] }, item[1]);
      })
    );
    node.value = value;
    return node;
  }

  function render(root) {
    const selected = new Set();
    let keyword = '';
    let tier = 'all';
    let source = 'all';
    let status = 'all';
    let sort = 'recent';
    let editing = null;
    let listWrap = null;

    function allItems() {
      const notebook = WB.store.getNotebook();
      const cards = WB.store.getCards();
      return Object.keys(notebook).map(function (key) {
        return {
          key: key,
          entry: notebook[key],
          word: WB.words.lookup(key) || { w: key, ph: '', zh: [], t: 0 },
          card: cards[key] || null
        };
      });
    }

    function filtered() {
      const items = allItems();
      const query = keyword.trim().toLowerCase();
      return items.filter(function (item) {
        if (query) {
          const haystack = (item.word.w + ' ' + (item.word.zh || []).join(' ')).toLowerCase();
          if (haystack.indexOf(query) === -1) return false;
        }
        if (tier !== 'all' && item.word.t !== Number(tier)) return false;
        if (source !== 'all' && item.entry.source !== source) return false;
        if (status === 'mastered' && !item.entry.mastered) return false;
        if (status === 'learning' && item.entry.mastered) return false;
        if (status === 'leech' && !item.entry.leech) return false;
        return true;
      }).sort(function (a, b) {
        if (sort === 'alpha') return a.word.w.localeCompare(b.word.w);
        if (sort === 'tier') {
          if (a.word.t !== b.word.t) return a.word.t - b.word.t;
          return a.word.w.localeCompare(b.word.w);
        }
        return String(b.entry.addedAt || '').localeCompare(String(a.entry.addedAt || ''));
      });
    }

    function commitNote(key, value) {
      if (editing !== key) return;
      WB.store.updateNotebook(key, { note: String(value || '').trim() });
      editing = null;
      refreshList();
      ui.toast('备注已保存');
    }

    function row(item) {
      const word = item.word;
      const entry = item.entry;
      const checked = selected.has(item.key);
      const meta = [
        ui.chip('L' + (word.t || '?'), 'accent'),
        ui.chip(ui.sourceLabel(entry.source), 'plain'),
        entry.mastered ? ui.chip('已掌握', 'info') : null,
        entry.leech ? ui.chip('难词', 'danger') : null,
        item.card ? ui.chip('复习 ' + (item.card.reps || 0) + ' 次', 'plain') : null
      ];

      const actions = [
        ui.el('button', {
          class: 'btn sm ghost',
          type: 'button',
          onclick: function () {
            editing = editing === item.key ? null : item.key;
            refreshList();
          }
        }, editing === item.key ? '收起备注' : '备注'),
        ui.el('button', {
          class: 'btn sm',
          type: 'button',
          onclick: function () {
            WB.store.updateNotebook(item.key, { mastered: !entry.mastered });
            refreshList();
            ui.toast(entry.mastered ? '已标记为学习中' : '已标记为掌握');
          }
        }, entry.mastered ? '取消掌握' : '标记掌握'),
        ui.el('button', {
          class: 'btn sm danger',
          type: 'button',
          onclick: function () {
            if (!ui.confirm('从生词本移除“' + word.w + '”？')) return;
            WB.store.removeNotebook(item.key);
            selected.delete(item.key);
            if (editing === item.key) editing = null;
            refreshList();
            ui.toast('已从生词本移除');
          }
        }, '移除')
      ];

      let noteNode = null;
      if (entry.note && editing !== item.key) {
        noteNode = ui.el('div', { class: 'nb-note' }, '备注：' + entry.note);
      }
      let editor = null;
      if (editing === item.key) {
        editor = ui.el('input', {
          class: 'input nb-note-input',
          type: 'text',
          placeholder: '写一句自己的记忆线索',
          value: entry.note || '',
          onkeydown: function (event) {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.target.blur();
            } else if (event.key === 'Escape') {
              editing = null;
              refreshList();
            }
          },
          onblur: function (event) { commitNote(item.key, event.target.value); }
        });
      }

      return ui.el('div', { class: 'nb-row' + (checked ? ' selected' : '') },
        ui.el('input', {
          class: 'check',
          type: 'checkbox',
          checked: checked,
          'aria-label': '选择 ' + word.w,
          onchange: function (event) {
            if (event.target.checked) selected.add(item.key);
            else selected.delete(item.key);
            refreshList();
          }
        }),
        ui.el('div', null,
          ui.el('div', { class: 'nb-word' },
            word.w,
            word.ph ? ui.el('span', { class: 'ph' }, '/' + word.ph + '/') : null,
            ui.speakButton(word.w)
          ),
          ui.el('div', { class: 'nb-zh' }, (word.zh || []).join('；')),
          ui.el('div', { class: 'nb-meta' }, meta),
          noteNode,
          editor
        ),
        ui.el('div', { class: 'nb-actions' }, actions)
      );
    }

    function refreshList() {
      if (!listWrap) return;
      listWrap.innerHTML = '';
      const items = filtered();
      const total = Object.keys(WB.store.getNotebook()).length;
      const visibleSelected = items.filter(function (item) { return selected.has(item.key); }).length;
      const allCheck = ui.el('input', {
        class: 'check',
        type: 'checkbox',
        checked: items.length > 0 && visibleSelected === items.length,
        onchange: function (event) {
          items.forEach(function (item) {
            if (event.target.checked) selected.add(item.key);
            else selected.delete(item.key);
          });
          refreshList();
        }
      });
      allCheck.indeterminate = visibleSelected > 0 && visibleSelected < items.length;

      const selectBar = ui.el('div', { class: 'nb-selectbar' },
        ui.el('label', { class: 'checkline' }, allCheck, '全选当前列表'),
        ui.el('span', null, '已选 ' + selected.size + ' 词 · 当前显示 ' + items.length + ' / 共 ' + total + ' 词'),
        ui.el('div', { class: 'row' },
          ui.el('button', {
            class: 'btn sm',
            type: 'button',
            disabled: selected.size === 0,
            onclick: function () {
              const words = Array.from(selected).map(function (key) { return WB.words.lookup(key); }).filter(Boolean);
              if (!words.length) { ui.toast('请先选择单词', 'warn'); return; }
              WB.session.startWords(words);
              WB.main.go('review');
            }
          }, '复习选中'),
          ui.el('button', {
            class: 'btn sm ghost',
            type: 'button',
            disabled: selected.size === 0,
            onclick: function () {
              selected.clear();
              refreshList();
            }
          }, '清除选择')
        )
      );

      listWrap.appendChild(selectBar);

      if (!items.length) {
        listWrap.appendChild(ui.empty(
          total ? '没有符合条件的单词' : '生词本还是空的',
          total ? '试试清除搜索词或切换筛选条件。' : '学习时点“加入生词本”，或答错的词会自动收进来。',
          total ? null : ui.el('button', {
            class: 'btn primary',
            type: 'button',
            onclick: function () { WB.main.go('learn'); }
          }, '去学习新词')
        ));
        return;
      }

      const list = ui.el('div', { class: 'nb-list' }, items.map(row));
      listWrap.appendChild(list);

      if (editing) {
        const input = list.querySelector('.nb-note-input');
        if (input) setTimeout(function () { input.focus(); }, 0);
      }
    }

    function draw() {
      root.innerHTML = '';
      const notebook = WB.store.getNotebook();
      const total = Object.keys(notebook).length;
      const mastered = Object.keys(notebook).filter(function (key) { return notebook[key].mastered; }).length;

      const search = ui.el('input', {
        class: 'input nb-search',
        type: 'search',
        placeholder: '搜索单词或释义',
        value: keyword,
        oninput: function (event) { keyword = event.target.value; refreshList(); }
      });

      const toolbar = ui.el('div', { class: 'nb-toolbar card' },
        search,
        selectNode(tier, [['all', '全部档位'], ['1', 'L1 日常'], ['2', 'L2 影视'], ['3', 'L3 阅读']], function (event) {
          tier = event.target.value;
          refreshList();
        }),
        selectNode(source, [['all', '全部来源'], ['learn', '新词学习'], ['review', '复习答错'], ['manual', '手动添加'], ['leech', '难词']], function (event) {
          source = event.target.value;
          refreshList();
        }),
        selectNode(status, [['all', '全部状态'], ['learning', '学习中'], ['mastered', '已掌握'], ['leech', '难词']], function (event) {
          status = event.target.value;
          refreshList();
        }),
        selectNode(sort, [['recent', '按加入时间'], ['alpha', '按字母'], ['tier', '按档位']], function (event) {
          sort = event.target.value;
          refreshList();
        })
      );

      const exportBar = ui.el('div', { class: 'row', style: 'margin-top:12px' },
        ui.el('span', { class: 'muted tiny' }, '导出：'),
        selectNode('csv', [
          ['csv', 'CSV（Excel 可直接打开）'],
          ['xlsx', 'XLSX 工作簿'],
          ['txt', 'TXT 纯文本'],
          ['md', 'Markdown 表格'],
          ['json', 'JSON 全量备份'],
          ['anki', 'Anki 导入（TSV）']
        ], function () {}),
        ui.el('button', {
          class: 'btn primary sm',
          type: 'button',
          onclick: function () {
            const select = exportBar.querySelector('select');
            const format = select ? select.value : 'csv';
            const keys = selected.size ? Array.from(selected) : null;
            const result = WB.exporter.exportNotebook(format, keys);
            if (result === 'empty') {
              ui.toast('生词本为空，没有可导出的内容', 'warn');
            } else if (result === 'xlsx-csv') {
              ui.toast('XLSX 组件未加载，已改为导出 CSV', 'warn');
            } else if (result === 'ok') {
              ui.toast(format === 'json' ? '已导出全量备份' : '已开始下载生词本文件');
            }
          }
        }, '导出')
      );

      listWrap = ui.el('div', null);

      root.appendChild(ui.pageHead(
        '生词本',
        '共 ' + total + ' 个词，已掌握 ' + mastered + ' 个。不认识的词会自动收进这里。',
        null
      ));
      root.appendChild(toolbar);
      root.appendChild(exportBar);
      root.appendChild(listWrap);
      refreshList();
    }

    draw();
  }

  WB.ui.notebook = { render: render };
})();
