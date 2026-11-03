// Web to Markdown - 内容脚本
// 职责：页面内提取（正文/选区）、相对链接转绝对、高亮预览、图片处理、右键流程的转换+复制+Toast。
// 由 background.js / popup.js 通过 chrome.scripting.executeScript 按需注入。

(() => {
  'use strict';

  // 防止重复注入导致重复注册监听
  if (window.__wmdLoaded) return;
  window.__wmdLoaded = true;

  let settings = null;
  let settingsReady = null; // Promise：首次 await 时触发加载并缓存

  // 按需加载配置（懒加载，不阻塞消息监听注册）
  function ensureSettings() {
    if (settings) return Promise.resolve(settings);
    if (!settingsReady) {
      settingsReady = new Promise((resolve) => {
        if (window.wmdConfig) {
          window.wmdConfig.load().then((s) => {
            settings = s;
            resolve(s);
          });
        } else {
          settings = { imageHandling: 'keep-url', imageDownloadDir: 'wmd-images' };
          resolve(settings);
        }
      });
    }
    return settingsReady;
  }

  // 消息监听
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;

    // 弹窗路径：仅提取，返回 HTML，由 popup 转换展示
    if (msg.type === 'wmd:extract') {
      (async () => {
        try {
          const data = extract(msg.mode);
          // 如果启用图片本地化，先下载图片并替换 URL
          const s = await ensureSettings();
          if (s.imageHandling === 'download-local') {
            data.html = processImages(data.html, data.url);
          }
          sendResponse({ ok: true, data });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true; // 异步响应，保持通道开放
    }

    // 右键/快捷键路径：页面内完成转换并复制，Toast 反馈
    if (msg.type === 'wmd:convert') {
      (async () => {
        try {
          const data = extract(msg.mode);
          const s = await ensureSettings();
          let html = data.html;
          if (s.imageHandling === 'download-local') {
            html = processImages(html, data.url);
          }
          const md = window.wmdToMarkdown(html, { title: data.title, url: data.url });
          await copyText(md);
          toast('Markdown 已复制到剪贴板');
        } catch (e) {
          toast('转换失败：' + e.message, true);
        }
      })();
      return;
    }

    // 预览模式：高亮正文区域并让用户确认
    if (msg.type === 'wmd:preview-start') {
      try {
        const articleHTML = extract('article').html;
        showPreviewOverlay();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return true;
    }
  });

  // 提取页面内容，返回 { title, html, url }；失败抛出带中文信息的 Error
  function extract(mode) {
    if (mode === 'selection') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !sel.toString().trim()) {
        throw new Error('没有选中内容，请先在页面上选中文字');
      }
      const box = document.createElement('div');
      for (let i = 0; i < sel.rangeCount; i++) {
        box.appendChild(sel.getRangeAt(i).cloneContents());
      }
      absolutize(box);
      return {
        title: document.title + '（选区）',
        html: box.innerHTML,
        url: location.href
      };
    }

    // article 模式：Readability 在文档副本上运行，避免改动原页面
    const docClone = document.cloneNode(true);
    const article = new Readability(docClone).parse();
    if (!article || !article.content || !article.content.trim()) {
      throw new Error('未能提取到正文，请改用选中内容转换');
    }
    const box = document.createElement('div');
    box.innerHTML = article.content;
    absolutize(box);
    return {
      title: article.title || document.title,
      html: box.innerHTML,
      url: location.href
    };
  }

  // 将容器内所有 href/src 相对路径转为绝对路径
  function absolutize(root) {
    root.querySelectorAll('[href]').forEach((el) => {
      try {
        el.setAttribute('href', new URL(el.getAttribute('href'), location.href).href);
      } catch { /* 忽略非法 URL，保留原值 */ }
    });
    root.querySelectorAll('[src]').forEach((el) => {
      try {
        el.setAttribute('src', new URL(el.getAttribute('src'), location.href).href);
      } catch { /* 忽略非法 URL，保留原值 */ }
    });
  }

  // === 图片处理 ===
  // 扫描 HTML 中的 img，替换 URL 为相对路径，并通知 background 下载
  function processImages(html, pageUrl) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const imgs = wrapper.querySelectorAll('img');
    const downloadDir = (settings && settings.imageDownloadDir) || 'wmd-images';

    imgs.forEach((img, idx) => {
      const src = img.getAttribute('src');
      if (!src || /^data:/i.test(src)) {
        img.remove(); // 剔除 data URL
        return;
      }
      // 计算文件名：从 URL 提取或用索引
      let filename = (() => {
        try {
          const url = new URL(src, pageUrl);
          const path = url.pathname;
          const name = path.split('/').pop();
          if (name && /\.[a-zA-Z0-9]{2,5}$/.test(name)) return name;
        } catch {}
        return 'image-' + (idx + 1) + '.png';
      })();
      // 防重名 + 长度限制
      if (filename.length > 60) filename = filename.slice(-60);

      // 改为相对路径
      img.setAttribute('src', downloadDir + '/' + filename);

      // 通知 background 下载此图片（静默）
      chrome.runtime.sendMessage({
        type: 'wmd:download-image',
        url: src,
        filename: downloadDir + '/' + filename
      });
    });

    return wrapper.innerHTML;
  }

  // === 高亮预览 ===

  let previewOverlay = null;
  let previewBar = null;

  function showPreviewOverlay() {
    hidePreviewOverlay();

    // 半透明蒙层（pointer-events:none 让穿透点击不会阻断）
    previewOverlay = document.createElement('div');
    previewOverlay.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'bottom:0',
      'background:rgba(0,0,0,0.4)', 'z-index:2147483646',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(previewOverlay);

    // 找到正文容器并加黄色高亮背景
    const articleEl = findReadableArticle();
    if (articleEl) {
      articleEl.style.backgroundColor = '#fef3c7';
      articleEl.style.outline = '3px solid #f59e0b';
      articleEl.style.outlineOffset = '2px';
      articleEl.classList.add('__wmd-preview-target');
    }

    // 底部操作栏（在遮罩之上）
    previewBar = document.createElement('div');
    previewBar.innerHTML = [
      '<div style="background:#fff;padding:12px 16px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;font:14px/1.4 &quot;Segoe UI&quot;,&quot;Microsoft YaHei&quot;,sans-serif;">',
      '<span style="color:#1e293b;">以下区域将被转换为 Markdown，是否继续？</span>',
      '<button id="__wmd-preview-ok" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:13px;">确认转换</button>',
      '<button id="__wmd-preview-cancel" style="padding:6px 16px;background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;font-size:13px;">取消</button>',
      '</div>'
    ].join('');
    previewBar.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:2147483647', 'pointer-events:auto'
    ].join(';');
    document.body.appendChild(previewBar);

    previewBar.querySelector('#__wmd-preview-ok').addEventListener('click', () => {
      hidePreviewOverlay();
      chrome.runtime.sendMessage({ type: 'wmd:preview-result', confirmed: true });
    });
    previewBar.querySelector('#__wmd-preview-cancel').addEventListener('click', () => {
      hidePreviewOverlay();
      chrome.runtime.sendMessage({ type: 'wmd:preview-result', confirmed: false });
    });
  }

  function hidePreviewOverlay() {
    if (previewOverlay) { previewOverlay.remove(); previewOverlay = null; }
    if (previewBar) { previewBar.remove(); previewBar = null; }
    // 恢复正文样式
    const target = document.querySelector('.__wmd-preview-target');
    if (target) {
      target.style.backgroundColor = '';
      target.style.outline = '';
      target.style.outlineOffset = '';
      target.classList.remove('__wmd-preview-target');
    }
  }

  // 尝试找到页面的主要正文容器（启发式）
  function findReadableArticle() {
    const candidates = [
      'article',
      '[role="main"]',
      'main',
      '[itemprop="articleBody"]',
      '.article-content',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.markdown-body',
      '.prose'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 200) return el;
    }
    return null;
  }

  // === 剪贴板 ===

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  // === 页面 Toast ===

  function toast(message, isError = false) {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = [
      'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
      'padding:10px 16px', 'border-radius:6px',
      'font:14px/1.4 "Segoe UI","Microsoft YaHei",sans-serif',
      'color:#fff', `background:${isError ? '#dc2626' : '#16a34a'}`,
      'box-shadow:0 2px 8px rgba(0,0,0,.3)', 'transition:opacity .3s'
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }
})();
