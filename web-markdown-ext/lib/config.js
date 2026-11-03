// Web to Markdown - 公共配置模块
// 所有模块（popup / content / background / markdown-convert）共享的设置读写。
// 运行在 chrome 扩展环境中（service worker / content script / popup）。

(function (global) {
  'use strict';

  // 默认配置 —— 用户首次安装时写入 storage
  const DEFAULTS = {
    // 输出格式
    includeMetaHeader: true,          // 元信息头（标题/来源/时间）
    obsidianFrontMatter: false,       // Obsidian YAML Front Matter
    headingStyle: 'atx',              // atx(#) / setext(=)
    codeBlockStyle: 'fenced',         // fenced(```) / indented
    bulletListMarker: '-',            // - / * / +
    emDelimiter: '*',                 // * / _

    // 内容处理
    detectCodeLanguage: true,         // 代码块语言自动检测
    fixHeadingLevels: true,           // 标题层级修正（正文 h1 降为 h2）
    preserveMath: true,               // 保留 LaTeX 数学公式
    imageHandling: 'keep-url',         // keep-url(保留URL) / download-local(下载本地)
    imageDownloadDir: 'wmd-images',   // 图片下载子目录名

    // 文件名模板（支持 {{date}} {{title}} {{url-host}}）
    filenameTemplate: '{{title}}',

    // 历史记录
    enableHistory: true,
    historyMaxItems: 10,

    // 预览
    showArticlePreview: true          // 转换前高亮预览正文区域
  };

  // 一次性缓存，避免每次读 storage
  let _cache = null;

  function ensureLoaded() {
    return new Promise((resolve) => {
      if (_cache) { resolve(_cache); return; }
      chrome.storage.local.get({ settings: DEFAULTS }, (result) => {
        _cache = Object.assign({}, DEFAULTS, result.settings || {});
        resolve(_cache);
      });
    });
  }

  function save(settings) {
    return new Promise((resolve) => {
      _cache = Object.assign({}, DEFAULTS, settings);
      chrome.storage.local.set({ settings: _cache }, resolve);
    });
  }

  // 供 content script 使用的同步版本（缓存必须已存在）
  function getSync() {
    return _cache || Object.assign({}, DEFAULTS);
  }

  function reset() {
    _cache = Object.assign({}, DEFAULTS);
    return save(DEFAULTS);
  }

  global.wmdConfig = {
    DEFAULTS: DEFAULTS,
    load: ensureLoaded,
    save: save,
    getSync: getSync,
    reset: reset
  };
})(typeof window !== 'undefined' ? window : self);
