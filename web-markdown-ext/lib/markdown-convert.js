// Web to Markdown - 共享转换封装
// 同时用于页面上下文（content script 右键流程）与弹窗上下文（popup）。
// 依赖先行加载的全局变量：TurndownService、turndownPluginGfm。

(function (global) {
  'use strict';

  function createService() {
    const service = new TurndownService({
      headingStyle: 'atx',        // # 风格标题
      codeBlockStyle: 'fenced',   // ``` 围栏代码块
      bulletListMarker: '-',
      emDelimiter: '*'
    });
    service.use(turndownPluginGfm.gfm);

    // 剔除 base64 内联图片，避免超大 data URL 污染 Markdown 源码
    service.addRule('skipInlineImages', {
      filter: function (node) {
        return node.nodeName === 'IMG' && /^data:/i.test(node.getAttribute('src') || '');
      },
      replacement: function () {
        return '';
      }
    });

    return service;
  }

  // HTML -> Markdown，附带元信息头（标题、来源、时间）
  global.wmdToMarkdown = function (html, meta) {
    meta = meta || {};
    const md = createService()
      .turndown(html)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const header = [
      '# ' + (meta.title || '未命名页面'),
      '',
      '> 来源：' + (meta.url || ''),
      '> 时间：' + new Date().toLocaleString(),
      '',
      '---',
      ''
    ].join('\n');

    return header + '\n' + md + '\n';
  };
})(typeof window !== 'undefined' ? window : self);
