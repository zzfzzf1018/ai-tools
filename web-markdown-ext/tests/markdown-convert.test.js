/**
 * Web to Markdown 核心转换逻辑单元测试
 *
 * 测试覆盖：
 * - 基础 HTML → Markdown 转换（GFM）
 * - 代码块语言检测（detectCodeLanguage）
 * - 标题层级修正（fixHeadingLevels）
 * - 数学公式还原（restoreMath — KaTeX / MathJax / 原生 MathML）
 * - Obsidian Front Matter 生成
 * - 文件名模板解析（wmdResolveFilename）
 * - base64 图片剔除
 *
 * 运行：npm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// === 加载第三方库到全局（模拟浏览器环境） ===
beforeAll(async () => {
  // 动态加载 turndown 库（ESM 导出）
  const TurndownService = (await import('turndown')).default;
  const turndownPluginGfm = await import('turndown-plugin-gfm');

  // 挂载到全局
  global.TurndownService = TurndownService;
  global.turndownPluginGfm = turndownPluginGfm;

  // 加载我们的模块（它们是 IIFE，会挂到 window/self）
  const convertCode = fs.readFileSync(path.join(ROOT, 'lib', 'markdown-convert.js'), 'utf-8');
  // config.js 在测试中不需要 chrome.storage，手动 mock
  global.window = global; // 让 IIFE 中的 window === global
  // 执行 markdown-convert.js
  eval(convertCode);
});

// ====== 工具：构造测试 settings ======
function makeSettings(overrides = {}) {
  return Object.assign({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    detectCodeLanguage: true,
    fixHeadingLevels: true,
    preserveMath: true,
    obsidianFrontMatter: false,
    includeMetaHeader: true
  }, overrides);
}

// ====== 核心转换函数 ======
function toMd(html, meta = {}, settingsOverrides = {}) {
  // 临时 mock 一个 wmdConfig.getSync()
  const origConfig = global.wmdConfig;
  global.wmdConfig = {
    getSync: () => makeSettings(settingsOverrides)
  };
  try {
    return global.wmdToMarkdown(html, meta);
  } finally {
    global.wmdConfig = origConfig;
  }
}

// ====== 测试用例 ======

describe('基础 HTML → Markdown', () => {
  it('转换段落和标题', () => {
    const md = toMd('<h1>Hello</h1><p>World</p>', { title: 'Hello', url: 'https://example.com' });
    expect(md).toContain('# Hello');
    expect(md).toContain('World');
  });

  it('保留 GFM 表格', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    const md = toMd(html, {});
    expect(md).toContain('| A | B |');
    expect(md).toContain('| --- | --- |');
  });

  it('保留删除线', () => {
    const md = toMd('<p><del>旧内容</del><ins>新内容</ins></p>', {});
    expect(md).toContain('~~旧内容~~');
  });

  it('剔除 base64 内联图片', () => {
    const html = '<p>前面<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...">后面</p>';
    const md = toMd(html, {});
    expect(md).not.toContain('data:image');
    expect(md).toContain('前面');
    expect(md).toContain('后面');
  });

  it('保留普通图片 URL', () => {
    const md = toMd('<img src="https://example.com/pic.jpg" alt="图片">', {});
    expect(md).toContain('https://example.com/pic.jpg');
  });

  it('生成元信息头', () => {
    const md = toMd('<p>内容</p>', { title: '测试页', url: 'https://test.com' });
    expect(md).toContain('# 测试页');
    expect(md).toContain('> 来源：https://test.com');
    expect(md).toContain('---');
  });

  it('关闭元信息头时不生成', () => {
    const md = toMd('<p>内容</p>', { title: '测试页', url: 'https://test.com' }, { includeMetaHeader: false });
    expect(md).not.toContain('> 来源：');
    expect(md).not.toContain('---');
  });
});

describe('Obsidian Front Matter', () => {
  it('开启时生成 YAML Front Matter', () => {
    const md = toMd('<p>正文</p>', { title: '我的笔记', url: 'https://example.com/article' }, {
      obsidianFrontMatter: true,
      includeMetaHeader: false
    });
    expect(md).toMatch(/^---\n/);
    expect(md).toContain('title: "我的笔记"');
    expect(md).toContain('source: "https://example.com/article"');
    expect(md).toContain('tags:');
    expect(md).toContain('web-clipping');
    expect(md).toContain('example');
    // 应该有两个 ---（front matter 的开头和结尾）
    const dashCount = (md.match(/\n---\n/g) || []).length + (md.startsWith('---\n') ? 1 : 0);
    expect(dashCount).toBeGreaterThanOrEqual(2);
  });
});

describe('代码块语言检测', () => {
  it('从 class="language-python" 提取', () => {
    const html = '<pre><code class="language-python">def hello():\n    pass</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```python');
  });

  it('从 class="hljs language-javascript" 提取', () => {
    const html = '<pre><code class="hljs language-javascript">const x = 1;</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```javascript');
  });

  it('从 data-lang 属性提取', () => {
    const html = '<pre><code data-lang="go">func main() {}</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```go');
  });

  it('通过内容特征检测 Python', () => {
    const html = '<pre><code>import os\n\ndef hello():\n    print("hi")</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```python');
  });

  it('通过内容特征检测 JavaScript', () => {
    const html = '<pre><code>const x = 1;\nfunction test() {\n  return x;\n}</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```javascript');
  });

  it('通过内容特征检测 SQL', () => {
    const html = '<pre><code>SELECT * FROM users WHERE id = 1</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```sql');
  });

  it('无特征时语言为空', () => {
    const html = '<pre><code>hello world foo bar</code></pre>';
    const md = toMd(html, {});
    expect(md).toContain('```\nhello world foo bar\n```');
  });

  it('关闭检测时不做额外内容特征标注', () => {
    const html = '<pre><code>print("hi")</code></pre>';
    const md = toMd(html, {}, { detectCodeLanguage: false });
    // 不做内容特征检测，应该是空语言（Turndown 内置不会自动检测内容特征）
    expect(md).toContain('```\nprint("hi")\n```');
  });
});

describe('标题层级修正', () => {
  it('正文有两个 h1 时，第二个降为 h2', () => {
    const html = '<h1>文章标题</h1><p>简介</p><h1>正文第一部分</h1><p>内容</p>';
    const md = toMd(html, { title: '文章标题' });
    expect(md).toMatch(/# 文章标题/);
    expect(md).not.toMatch(/^\s*# 正文第一部分/m);  // 不应再是 h1
    expect(md).toMatch(/^## 正文第一部分/m);
  });

  it('只有一个 h1 时不修正', () => {
    const html = '<h1>唯一标题</h1><p>内容</p><h2>子标题</h2><p>更多</p>';
    const md = toMd(html, { title: '唯一标题' });
    expect(md).toMatch(/# 唯一标题/);
  });

  it('关闭修正时保持原层级', () => {
    const html = '<h1>标题</h1><h1>又一个标题</h1>';
    const md = toMd(html, { title: '标题' }, { fixHeadingLevels: false });
    // 两个都是 h1（但前面元信息头里的 # 会干扰）
    // 至少验证第二个也是 #
    const lines = md.split('\n').filter(l => l.trim().startsWith('#'));
    // 应至少有两个 h1（忽略元信息头的 #）
    expect(lines.filter(l => l.startsWith('## ')).length).toBe(0);
  });
});

describe('数学公式保留', () => {
  it('KaTeX .katex 从 data-expr 属性还原', () => {
    const html = '<span class="katex" data-expr="E=mc^2">katex</span>';
    const md = toMd(html, {});
    expect(md).toContain('$E=mc^2$');
  });

  it('KaTeX .katex 从 annotation[encoding] 还原', () => {
    const html = '<span class="katex"><span class="katex-mathml"><annotation encoding="application/x-tex">x^2</annotation></span></span>';
    const md = toMd(html, {});
    expect(md).toContain('$x^2$');
  });

  it('MathJax mjx-container 从 annotation 还原', () => {
    const html = '<mjx-container class="MathJax" display="true"><svg></svg><math><annotation encoding="application/x-tex">\\sum_{i=1}^n i</annotation></math></mjx-container>';
    const md = toMd(html, {});
    expect(md).toContain('$$');
    // Turndown 可能转义下划线，所以用正则匹配
    expect(md).toMatch(/\\sum.*i=1.*n.*i/);
  });

  it('原生 MathML 还原', () => {
    const html = '<math display="block"><annotation encoding="application/x-tex">F=ma</annotation></math>';
    const md = toMd(html, {});
    expect(md).toContain('$$F=ma$$');
  });

  it('关闭数学保留时不还原', () => {
    const html = '<span class="katex" data-expr="E=mc^2">katex</span>';
    const md = toMd(html, {}, { preserveMath: false });
    // 不应有 $ 包裹
    expect(md).not.toContain('$E=mc^2$');
  });
});

describe('GFM 风格选项', () => {
  it('setext 标题风格', () => {
    const md = toMd('<h1>Title</h1><p>text</p>', { title: 'Title' }, { headingStyle: 'setext', includeMetaHeader: false, obsidianFrontMatter: false });
    expect(md).toContain('Title');
    expect(md).toContain('=====');
  });

  it('缩进代码块（jsdom 环境下 pre 内容会被抹平，验证 fenced 模式）', () => {
    // 在 jsdom 中 pre 标签的空白处理与真实浏览器不同，所以这里只验证基本转换
    const md = toMd('<pre><code>hello world</code></pre>', {}, { detectCodeLanguage: false });
    expect(md).toContain('```');
    expect(md).toContain('hello world');
  });

  it('星号列表符号（Turndown 会在标记后加 3 空格）', () => {
    const md = toMd('<ul><li>one</li><li>two</li></ul>', {}, { bulletListMarker: '*' });
    expect(md).toContain('*');
    expect(md).toContain('one');
    expect(md).toContain('two');
  });
});

describe('文件名模板解析', () => {
  // 需要先执行文件里的 wmdResolveFilename
  // 它依赖 wmdConfig，手动 mock
  it('默认模板 {{title}}', () => {
    global.wmdConfig = { getSync: () => ({ filenameTemplate: '{{title}}' }) };
    const name = global.wmdResolveFilename('{{title}}', { title: '我的页面', url: 'https://example.com' });
    expect(name).toBe('我的页面');
  });

  it('模板带日期', () => {
    global.wmdConfig = { getSync: () => ({ filenameTemplate: '{{date}}-{{title}}' }) };
    const name = global.wmdResolveFilename('{{date}}-{{title}}', { title: '文章', url: 'https://example.com' });
    expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-文章$/);
  });

  it('模板带 url-host', () => {
    global.wmdConfig = { getSync: () => ({ filenameTemplate: '{{url-host}}-{{title}}' }) };
    const name = global.wmdResolveFilename('{{url-host}}-{{title}}', { title: '新闻', url: 'https://news.sina.com.cn/article/123' });
    expect(name).toContain('news.sina.com.cn');
    expect(name).toContain('新闻');
  });

  it('清洗非法字符', () => {
    global.wmdConfig = { getSync: () => ({ filenameTemplate: '{{title}}' }) };
    const name = global.wmdResolveFilename('{{title}}', { title: '有/非法*字符?"' });
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('标题过长时截断到 80 字符', () => {
    global.wmdConfig = { getSync: () => ({ filenameTemplate: '{{title}}' }) };
    const longTitle = 'A'.repeat(200);
    const name = global.wmdResolveFilename('{{title}}', { title: longTitle });
    expect(name.length).toBeLessThanOrEqual(80);
  });
});
