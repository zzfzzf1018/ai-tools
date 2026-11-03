// Web to Markdown - 内容脚本
// 职责：页面内提取（正文/选区）、相对链接转绝对、右键流程的转换+复制+Toast。
// 由 background.js / popup.js 通过 chrome.scripting.executeScript 按需注入。

(() => {
  // 防止重复注入导致重复注册监听
  if (window.__wmdLoaded) return;
  window.__wmdLoaded = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string') return;

    // 弹窗路径：仅提取，返回 HTML，由 popup 转换展示
    if (msg.type === 'wmd:extract') {
      try {
        sendResponse({ ok: true, data: extract(msg.mode) });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
      return;
    }

    // 右键/快捷键路径：页面内完成转换并复制，Toast 反馈
    if (msg.type === 'wmd:convert') {
      (async () => {
        try {
          const { title, html, url } = extract(msg.mode);
          const md = window.wmdToMarkdown(html, { title, url });
          await copyText(md);
          toast('Markdown 已复制到剪贴板');
        } catch (e) {
          toast('转换失败：' + e.message, true);
        }
      })();
      return;
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

  // 写剪贴板：优先 navigator.clipboard，失败回退 execCommand
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

  // 页面右上角浮动提示，2.5s 自动消失
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
