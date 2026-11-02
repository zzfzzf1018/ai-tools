/* 单词书 · 生词本导出（CSV / XLSX / TXT / Markdown / JSON / Anki） */
(function () {
  'use strict';

  const WB = window.WB = window.WB || {};

  const COLS = ['单词', '音标', '释义', '档位', '来源', '加入日期', '掌握状态', '复习次数', '下次复习', '备注'];
  const FIELDS = ['w', 'ph', 'zh', 'tier', 'source', 'addedAt', 'mastered', 'reps', 'due', 'note'];
  const SOURCE_LABELS = { learn: '新词学习', review: '复习答错', manual: '手动添加', leech: '难词' };
  const MD_COLS = ['单词', '音标', '释义', '档位', '来源', '加入日期', '掌握状态', '备注'];
  const MD_FIELDS = ['w', 'ph', 'zh', 'tier', 'source', 'addedAt', 'mastered', 'note'];

  function sourceLabel(source) {
    return SOURCE_LABELS[source] || source || '';
  }

  function rows(keys) {
    const notebook = WB.store.getNotebook();
    const cards = WB.store.getCards();
    let list;
    if (Array.isArray(keys) && keys.length) {
      list = keys.filter(function (w) { return notebook[w]; });
    } else {
      list = Object.keys(notebook);
    }
    list.sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    return list.map(function (w) {
      const entry = notebook[w] || {};
      const word = WB.words.lookup(w) || { w: w, ph: '', zh: [], t: 0 };
      const card = cards[w] || null;
      return {
        w: word.w,
        ph: word.ph || '',
        zh: (word.zh || []).join('；'),
        tier: word.t ? 'L' + word.t : '-',
        source: sourceLabel(entry.source),
        addedAt: entry.addedAt || '',
        mastered: entry.mastered ? '已掌握' : '未掌握',
        reps: card ? String(card.reps || 0) : '0',
        due: card && card.due ? card.due : '',
        note: entry.note || ''
      };
    });
  }

  function csvCell(value) {
    const text = value == null ? '' : String(value);
    if (/[",\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function toCSV(data) {
    const lines = [COLS.join(',')];
    data.forEach(function (row) {
      lines.push(FIELDS.map(function (field) { return csvCell(row[field]); }).join(','));
    });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  function toTXT(data) {
    const lines = data.map(function (row) {
      const ph = row.ph ? ' /' + row.ph + '/' : '';
      return row.w + ph + '  ' + row.zh;
    });
    return lines.join('\r\n') + '\r\n';
  }

  function mdCell(value) {
    return String(value == null ? '' : value)
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');
  }

  function toMarkdown(data) {
    const head = '| ' + MD_COLS.join(' | ') + ' |';
    const split = '| ' + MD_COLS.map(function () { return '---'; }).join(' | ') + ' |';
    const lines = [
      '# 单词书 · 生词本',
      '',
      '导出日期：' + WB.date.today() + '　共 ' + data.length + ' 个单词。',
      '',
      head,
      split
    ];
    data.forEach(function (row) {
      lines.push('| ' + MD_FIELDS.map(function (field) { return mdCell(row[field]); }).join(' | ') + ' |');
    });
    return lines.join('\n') + '\n';
  }

  function tabCell(value) {
    return String(value == null ? '' : value)
      .replace(/\t/g, ' ')
      .replace(/\r?\n/g, ' ');
  }

  function toAnki(data) {
    const lines = ['#separator:Tab', '#html:false', '#columns:Front\tBack\tTags'];
    data.forEach(function (row) {
      const back = row.zh + (row.ph ? ' [' + row.ph + ']' : '');
      const tags = ['wordbook', row.tier !== '-' ? 'tier' + row.tier.slice(1) : 'untiered']
        .concat(row.source ? 'src-' + tabCell(row.source).replace(/ /g, '') : [])
        .join(' ');
      lines.push([row.w, back, tags].map(tabCell).join('\t'));
    });
    return lines.join('\n') + '\n';
  }

  function fullJSON() {
    return JSON.stringify(WB.store.exportAll(), null, 2);
  }

  function filename(ext) {
    return '单词书-生词本-' + WB.date.today() + '.' + ext;
  }

  function download(text, name, mime) {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 600);
    return true;
  }

  function toXLSX(data) {
    const XLSX = window.XLSX;
    if (!XLSX || !XLSX.utils) return false;
    const sheetData = [COLS].concat(data.map(function (row) {
      return FIELDS.map(function (field) { return row[field]; });
    }));
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    sheet['!cols'] = [
      { wch: 16 }, { wch: 15 }, { wch: 44 }, { wch: 7 }, { wch: 11 },
      { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 30 }
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '生词本');
    XLSX.writeFile(book, filename('xlsx'));
    return true;
  }

  function exportNotebook(format, keys) {
    const data = rows(keys);
    if (format === 'json') {
      download(fullJSON(), '单词书-备份-' + WB.date.today() + '.json', 'application/json;charset=utf-8');
      return 'ok';
    }
    if (!data.length) return 'empty';
    if (format === 'csv') {
      download(toCSV(data), filename('csv'), 'text/csv;charset=utf-8');
    } else if (format === 'txt') {
      download(toTXT(data), filename('txt'), 'text/plain;charset=utf-8');
    } else if (format === 'md') {
      download(toMarkdown(data), filename('md'), 'text/markdown;charset=utf-8');
    } else if (format === 'anki') {
      download(toAnki(data), filename('anki.csv'), 'text/csv;charset=utf-8');
    } else if (format === 'xlsx') {
      if (!toXLSX(data)) {
        download(toCSV(data), filename('csv'), 'text/csv;charset=utf-8');
        return 'xlsx-csv';
      }
    } else {
      return 'unknown';
    }
    return 'ok';
  }

  function exportAll() {
    download(fullJSON(), '单词书-备份-' + WB.date.today() + '.json', 'application/json;charset=utf-8');
    return 'ok';
  }

  WB.exporter = {
    COLS: COLS,
    FIELDS: FIELDS,
    rows: rows,
    toCSV: toCSV,
    toTXT: toTXT,
    toMarkdown: toMarkdown,
    toAnki: toAnki,
    fullJSON: fullJSON,
    filename: filename,
    download: download,
    toXLSX: toXLSX,
    exportNotebook: exportNotebook,
    exportAll: exportAll
  };
})();
