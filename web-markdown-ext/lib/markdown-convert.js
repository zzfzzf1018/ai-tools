// Web to Markdown - 共享转换封装
// 同时用于页面上下文（content script 右键流程）与弹窗上下文（popup）。
// 依赖先行加载的全局变量：TurndownService、turndownPluginGfm、（可选）wmdConfig。

(function (global) {
  'use strict';

  // 获取配置：优先使用已加载的 wmdConfig，否则使用默认值
  function getSettings() {
    if (global.wmdConfig && typeof global.wmdConfig.getSync === 'function') {
      return global.wmdConfig.getSync();
    }
    // 无配置时的安全默认
    return {
      includeMetaHeader: true,
      obsidianFrontMatter: false,
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      detectCodeLanguage: true,
      fixHeadingLevels: true,
      preserveMath: true,
      imageHandling: 'keep-url'
    };
  }

  function createService(settings) {
    const service = new TurndownService({
      headingStyle: settings.headingStyle,
      codeBlockStyle: settings.codeBlockStyle,
      bulletListMarker: settings.bulletListMarker,
      emDelimiter: settings.emDelimiter
    });
    service.use(turndownPluginGfm.gfm);

    // 剔除 base64 内联图片
    service.addRule('skipInlineImages', {
      filter: function (node) {
        return node.nodeName === 'IMG' && /^data:/i.test(node.getAttribute('src') || '');
      },
      replacement: function () {
        return '';
      }
    });

    // 删除线：GFM <del> → ~~...~~
    service.addRule('strikethrough', {
      filter: function (node) {
        return node.nodeName === 'DEL' || node.nodeName === 'S' || node.nodeName === 'STRIKE';
      },
      replacement: function (content) {
        return '~~' + content + '~~';
      }
    });

    return service;
  }

  // 启发式语言检测：先看 class，再看内容特征
  function detectLanguage(codeEl, text) {
    // 1. 从 class 属性提取（highlight.js / prism.js 风格）
    const classAttr = codeEl.className || '';
    const langMatch = classAttr.match(/language-([a-zA-Z0-9+\-]+)/i) ||
                      classAttr.match(/lang-([a-zA-Z0-9+\-]+)/i) ||
                      classAttr.match(/\bhljs\s+language-([a-zA-Z0-9+\-]+)/i);
    if (langMatch) return langMatch[1].toLowerCase();

    // 2. 从 data 属性提取
    const dataLang = codeEl.getAttribute('data-lang') || codeEl.getAttribute('data-language');
    if (dataLang) return dataLang.toLowerCase();

    // 3. 内容特征匹配
    const features = [
      // Python
      { re: /^(def |import |from .+ import|print\(|class \w+[(:])/m, lang: 'python' },
      // JavaScript / TypeScript
      { re: /^(const |let |var |function |=>|import .+ from|export |class \w+[({])/m, lang: 'javascript' },
      { re: /:\s*(string|number|boolean|any|void|interface)\b/, lang: 'typescript' },
      // Java
      { re: /^(public |private |protected |class \w+|static |void \w+\()/m, lang: 'java' },
      // C/C++
      { re: /^(#include|<\w+>|int main|void \w+\(|struct \w+|class \w+)/m, lang: 'cpp' },
      // Go
      { re: /^(package |import \(|func |type \w+ struct|:=)/m, lang: 'go' },
      // Rust
      { re: /^(fn |let mut|use |impl |struct |enum |pub )/m, lang: 'rust' },
      // SQL
      { re: /\b(SELECT|INSERT INTO|UPDATE |DELETE FROM|CREATE TABLE|ALTER TABLE|JOIN |WHERE |GROUP BY|ORDER BY)\b/i, lang: 'sql' },
      // HTML
      { re: /<!DOCTYPE|<html|<head|<body|<div|<script|<style/i, lang: 'html' },
      // CSS
      { re: /[\.#]?[\w-]+\s*\{[^}]*\}/s, lang: 'css' },
      // Bash / Shell
      { re: /^(#!\/|echo |cd |ls |apt |yum |brew |git |docker |\$\{|sudo )/m, lang: 'bash' },
      // JSON
      { re: /^\s*[{[]/, lang: 'json' },
      // YAML
      { re: /^[a-zA-Z_-]+:\s*.+$/m, lang: 'yaml' },
      // Markdown
      { re: /^(# |\* |- |\[.+]\(.+\)|`[^`]+`)/m, lang: 'markdown' },
      // PHP
      { re: /^(<\?php|function \w+\(|echo |\$\w+\s*=)/m, lang: 'php' },
      // Ruby
      { re: /^(def |class |puts |require |end$)/m, lang: 'ruby' },
      // Lua
      { re: /^(function |local |require |end$)/m, lang: 'lua' },
      // Dockerfile
      { re: /^(FROM |RUN |COPY |ADD |EXPOSE |CMD |ENTRYPOINT )/m, lang: 'dockerfile' }
    ];
    for (const f of features) {
      if (f.re.test(text)) return f.lang;
    }
    return '';
  }

  // === HTML 预处理 ===

  // 1. KaTeX/MathJax → LaTeX 还原
  function restoreMath(html) {
    // 用 DOMParser 解析，因为传入的可能是完整 HTML 片段
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // KaTeX：查找 <span class="katex">，原始 LaTeX 通常在它前面或内部的注释/属性中
    wrapper.querySelectorAll('.katex').forEach((el) => {
      // 方式 1：父元素或自身的 data- 属性
      const dataAttrs = ['data-expr', 'data-latex', 'data-math', 'aria-label'];
      for (const attr of dataAttrs) {
        const val = el.getAttribute(attr) || (el.parentElement && el.parentElement.getAttribute(attr));
        if (val) {
          el.replaceWith(document.createTextNode('$' + val + '$'));
          return;
        }
      }
      // 方式 2：MathJax 原始脚本节点（如果还在）
      const next = el.nextElementSibling;
      if (next && next.tagName === 'SCRIPT' && (next.type === 'math/tex' || next.type === 'math/tex; mode=display')) {
        const tex = next.textContent || '';
        const delim = next.type.includes('mode=display') ? '$$' : '$';
        el.replaceWith(document.createTextNode(delim + tex + delim));
        next.remove();
        return;
      }
      // 方式 3：从 .katex-mathml 的 annotation 提取
      const mathml = el.querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
      if (mathml) {
        const tex = mathml.textContent || '';
        el.replaceWith(document.createTextNode('$' + tex + '$'));
        return;
      }
    });

    // MathJax v3：查找 mjx-container
    wrapper.querySelectorAll('mjx-container, mjx-math').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'mjx-container') {
        const display = el.getAttribute('display') === 'true' || el.classList.contains('display');
        const delim = display ? '$$' : '$';
        // 尝试从内部 annotation 获取
        const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
          el.replaceWith(document.createTextNode(delim + annotation.textContent + delim));
          return;
        }
        // 从 data 属获取
        const latex = el.getAttribute('data-latex') || el.getAttribute('data-original');
        if (latex) {
          el.replaceWith(document.createTextNode(delim + latex + delim));
        }
      }
    });

    // MathML 原生 <math> 标签：转换为可识别格式（不展开为 LaTeX，用占位符避免丢失）
    wrapper.querySelectorAll('math').forEach((el) => {
      const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
      const tex = annotation ? annotation.textContent : '';
      if (tex) {
        const display = el.getAttribute('display') === 'block';
        const delim = display ? '$$' : '$';
        el.replaceWith(document.createTextNode(delim + tex + delim));
      }
    });

    return wrapper.innerHTML;
  }

  // 2. 标题层级修正（避免正文出现多个 h1）
  function fixHeadingLevels(html, metaTitle) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // 找到页面的第一个 h1，如果它和 metaTitle 相同或很接近，把后续所有 h1 降为 h2
    const h1s = wrapper.querySelectorAll('h1');
    if (h1s.length <= 1) return wrapper.innerHTML;

    // 第一个 h1 如果是文章标题，从第二个 h1 开始降为 h2
    const firstH1 = h1s[0].textContent.trim();
    const isMainTitle = !metaTitle || firstH1 === metaTitle.trim() || firstH1.includes(metaTitle.trim()) || metaTitle.trim().includes(firstH1);

    const startIdx = isMainTitle ? 1 : 0;
    for (let i = startIdx; i < h1s.length; i++) {
      const h1 = h1s[i];
      const h2 = document.createElement('h2');
      h2.innerHTML = h1.innerHTML;
      h1.replaceWith(h2);
    }

    return wrapper.innerHTML;
  }

  // === 主转换函数 ===

  global.wmdToMarkdown = function (html, meta) {
    meta = meta || {};
    const settings = getSettings();

    // HTML 预处理
    let processedHtml = html;
    if (settings.preserveMath) processedHtml = restoreMath(processedHtml);
    if (settings.fixHeadingLevels) processedHtml = fixHeadingLevels(processedHtml, meta.title);

    // 收集代码块语言（从 HTML 中提取 class/data 属性 + 内容特征）
    const codeLangs = settings.detectCodeLanguage ? collectCodeLanguages(processedHtml) : null;

    // Turndown 转换
    let md = createService(settings)
      .turndown(processedHtml)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 后处理：给围栏代码块标注语言
    if (settings.detectCodeLanguage && settings.codeBlockStyle === 'fenced' && codeLangs) {
      md = annotateCodeBlocks(md, codeLangs);
    }

    // 构建输出头部
    let header = '';

    if (settings.obsidianFrontMatter) {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10);
      const timeStr = date.toISOString().slice(0, 19) + 'Z';
      const tags = generateTags(meta.url);
      const title = (meta.title || '未命名页面').replace(/"/g, '\\"');

      header = [
        '---',
        'title: "' + title + '"',
        'date: ' + dateStr,
        'source: "' + (meta.url || '') + '"',
        'tags:',
        '  - ' + tags.join('\n  - '),
        'created: ' + timeStr,
        '---',
        ''
      ].join('\n');
    } else if (settings.includeMetaHeader) {
      const lines = [
        '# ' + (meta.title || '未命名页面'),
        '',
        '> 来源：' + (meta.url || ''),
        '> 时间：' + new Date().toLocaleString()
      ];
      header = lines.join('\n') + '\n\n---\n\n';
    }

    return header + md + '\n';
  };

  // 从 HTML 中提取所有代码块的语言
  function collectCodeLanguages(html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const langs = [];
    wrapper.querySelectorAll('pre').forEach((pre) => {
      const codeEl = pre.querySelector('code') || pre;
      const text = codeEl.textContent || '';
      langs.push(detectLanguage(codeEl, text));
    });
    return langs;
  }

  // 给 Markdown 中的围栏代码块按顺序标注语言
  function annotateCodeBlocks(md, langs) {
    let idx = 0;
    return md.replace(/```\n([\s\S]*?)```/g, function (match, codeContent) {
      const lang = langs[idx++] || '';
      // 如果 Turndown 已经给了语言标注（```python\n...```），跳过
      // 我们的正则只匹配 ```\n...```（空语言），所以这里直接用检测结果
      // 如果检测不到，再尝试从代码内容特征检测（兜底）
      let finalLang = lang;
      if (!finalLang) {
        finalLang = detectLanguageFromText(codeContent);
      }
      return '```' + finalLang + '\n' + codeContent + '```';
    });
  }

  // 仅从代码内容检测语言（兜底）
  function detectLanguageFromText(text) {
    const features = [
      { re: /^(def |import |from .+ import|print\(|class \w+[(:])/m, lang: 'python' },
      { re: /^(const |let |var |function |=>|import .+ from|export |class \w+[({])/m, lang: 'javascript' },
      { re: /:\s*(string|number|boolean|any|void|interface)\b/, lang: 'typescript' },
      { re: /^(public |private |protected |class \w+|static |void \w+\()/m, lang: 'java' },
      { re: /^(#include|<\w+>|int main|void \w+\(|struct \w+|class \w+)/m, lang: 'cpp' },
      { re: /^(package |import \(|func |type \w+ struct|:=)/m, lang: 'go' },
      { re: /^(fn |let mut|use |impl |struct |enum |pub )/m, lang: 'rust' },
      { re: /\b(SELECT|INSERT INTO|UPDATE |DELETE FROM|CREATE TABLE|ALTER TABLE|JOIN |WHERE |GROUP BY|ORDER BY)\b/i, lang: 'sql' },
      { re: /<!DOCTYPE|<html|<head|<body|<div|<script|<style/i, lang: 'html' },
      { re: /[\.#]?[\w-]+\s*\{[^}]*\}/s, lang: 'css' },
      { re: /^(#!\/|echo |cd |apt |yum |brew |git |docker |\$\{|sudo )/m, lang: 'bash' },
      { re: /^\s*[{[]/, lang: 'json' },
      { re: /^[a-zA-Z_-]+:\s*.+$/m, lang: 'yaml' },
      { re: /^(<\?php|function \w+\(|echo |\$\w+\s*=)/m, lang: 'php' },
      { re: /^(def |class |puts |require )/m, lang: 'ruby' },
      { re: /^(FROM |RUN |COPY |ADD |EXPOSE |CMD |ENTRYPOINT )/m, lang: 'dockerfile' }
    ];
    for (const f of features) {
      if (f.re.test(text)) return f.lang;
    }
    return '';
  }

  // 根据 URL 生成简单标签
  function generateTags(url) {
    const tags = ['web-clipping'];
    if (!url) return tags;
    try {
      const host = new URL(url).hostname;
      // 去掉 www. 和 .com/.cn 等后缀
      const parts = host.replace(/^www\./, '').split('.');
      if (parts.length > 1) tags.push(parts[parts.length - 2]);
    } catch {}
    return tags;
  }

  // === 文件名模板解析（供 popup/content 使用） ===

  global.wmdResolveFilename = function (template, meta) {
    meta = meta || {};
    const now = new Date();
    const dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    let result = (global.wmdConfig && global.wmdConfig.getSync().filenameTemplate) || template;
    result = result.replace(/\{\{date\}\}/g, dateStr);
    result = result.replace(/\{\{title\}\}/g, (meta.title || 'page').trim());
    try {
      result = result.replace(/\{\{url-host\}\}/g, meta.url ? new URL(meta.url).hostname : '');
    } catch {
      result = result.replace(/\{\{url-host\}\}/g, '');
    }

    // 文件名清洗
    return result
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'page';
  };

})(typeof window !== 'undefined' ? window : self);
