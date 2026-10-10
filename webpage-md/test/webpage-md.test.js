import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { extractPage, validateUrl } from '../src/extract.js';
import { fetchPage } from '../src/fetch.js';
import { savePage } from '../src/cli.js';

const exec = promisify(execFile);
const cli = path.resolve(import.meta.dirname, '..', 'src', 'cli.js');
const paragraph = 'This original test article explains how to collect useful page content, '
  + 'preserve its structure, and keep supplementary navigation separate. '
  + 'Each paragraph contains enough context for an article extraction algorithm. ';
const html = `<!doctype html><html lang="en"><head><title>Example article</title></head><body>
  <header><nav><a href="/home">Navigation only</a></nav></header>
  <main><article id="article">
    <h1>Example article</h1>
    <p>${paragraph.repeat(4)} <a href="../reference">Reference</a></p>
    <h2>Useful details</h2>
    <p>${paragraph.repeat(4)}</p>
    <aside class="sidebar">Sidebar backup only</aside>
    <ul><li>First item</li><li>Second item</li></ul>
    <blockquote>A quotation</blockquote>
    <pre><code class="language-js">const answer = 42;\nconsole.log(answer);</code></pre>
    <table><thead><tr><th>Key</th><th>Value</th></tr></thead>
    <tbody><tr><td>answer</td><td>42</td></tr></tbody></table>
    <p><del>Removed words</del> <img src="/image.png" alt="Diagram"></p>
  </article></main>
  <footer>Footer backup only</footer>
  <script>SECRET_SCRIPT</script><style>SECRET_STYLE</style>
  <div hidden>SECRET_HIDDEN</div>
</body></html>`;
const url = 'https://example.org/library/chapter';

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'webpage-md-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function server(t, handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    instance.closeAllConnections();
    instance.close(resolve);
  }));
  return `http://127.0.0.1:${instance.address().port}`;
}

test('automatic extraction separates article and supplementary content', () => {
  const result = extractPage(html, { url });
  assert.equal(result.metadata.extraction, 'readability');
  assert.ok(result.metadata.textLength > 1000);
  assert.match(result.content, /Useful details/);
  assert.doesNotMatch(result.content, /Navigation only|Footer backup only|Sidebar backup only/);
  assert.match(result.extras, /Navigation only/);
  assert.match(result.extras, /Footer backup only/);
  assert.match(result.extras, /Sidebar backup only/);
  assert.doesNotMatch(result.extras, /This original test article|Useful details|const answer/);
  assert.doesNotMatch(result.content + result.extras, /SECRET_/);
});

test('reconstructed div paragraphs retain provenance without deleting identical backup text', () => {
  const prose = paragraph.repeat(6);
  const page = `<title>Div article</title><nav>Navigation only</nav>
    <aside class="sidebar"><h2>Backup heading</h2><p>${paragraph}</p></aside>
    <article><div>${prose}</div><div>Second section. ${prose}
    <a href="/reference">Reference</a></div></article><footer>Footer only</footer>`;
  const result = extractPage(page, { url });
  assert.ok(result.content.includes(prose.trim()));
  assert.match(result.content, /Second section/);
  assert.match(result.content, /\[Reference\]\(https:\/\/example.org\/reference\)/);
  assert.doesNotMatch(result.extras, /Second section|Reference/);
  assert.equal(result.extras.split(paragraph.trim()).length - 1, 1);
  assert.match(result.extras, /Backup heading/);
  assert.match(result.extras, /Navigation only/);
  assert.match(result.extras, /Footer only/);
  assert.doesNotMatch(result.content + result.extras, /data-webpage-md/);
});

test('same-title headings outside the selected article remain in supplementary content', () => {
  const page = `<title>Shared title</title><aside class="sidebar">
    <h1>Shared title</h1><p>Backup introduction</p></aside>
    <article id="body"><h1>Shared title</h1><p>${paragraph.repeat(6)}</p></article>`;
  for (const selector of [undefined, '#body']) {
    const result = extractPage(page, { url, selector });
    assert.equal(result.title, 'Shared title');
    assert.doesNotMatch(result.content, /^# Shared title/m);
    assert.match(result.extras, /^# Shared title/m);
    assert.match(result.extras, /Backup introduction/);
    assert.doesNotMatch(result.extras, /This original test article/);
  }
});

test('lazy images and noscript image fallbacks are restored in both extraction modes', () => {
  const page = `<head><title>Images</title><base href="https://cdn.example.org/assets/"></head>
    <body><article id="body"><p>${paragraph.repeat(6)}</p>
    <img src="/placeholder.gif" data-src="actual.jpg" alt="Lazy">
    <img src="/placeholder.gif" data-original="original.jpg" alt="Original">
    <img data-lazy-src="lazy.jpg" alt="No source">
    <img src="/placeholder.gif" alt="Fallback">
    <noscript><img src="fallback.jpg"></noscript>
    <noscript><img src="standalone.jpg" alt="Standalone"></noscript>
    <img src="static.jpg" alt="Static"></article>
    <footer><img src="/placeholder.gif" data-src="backup.jpg" alt="Backup"></footer></body>`;
  for (const selector of [undefined, '#body']) {
    const result = extractPage(page, { url, selector });
    for (const [alt, name] of [
      ['Lazy', 'actual'], ['Original', 'original'], ['No source', 'lazy'],
      ['Fallback', 'fallback'], ['Standalone', 'standalone'], ['Static', 'static'],
    ]) {
      assert.ok(result.content.includes(`![${alt}](https://cdn.example.org/assets/${name}.jpg)`));
    }
    assert.doesNotMatch(result.content + result.extras, /placeholder/);
    assert.match(result.extras, /!\[Backup\]\(https:\/\/cdn.example.org\/assets\/backup.jpg\)/);
    assert.doesNotMatch(result.extras, /!\[(Lazy|Original|Fallback|Static)\]/);
  }
});

test('image restoration does not promote unsafe URLs or arbitrary noscript content', () => {
  const result = extractPage(`<title>Images</title><article id="body">
    <p>${paragraph.repeat(6)}</p>
    <img src="/static.jpg" data-src="javascript:alert(1)" alt="Safe">
    <noscript><img src="javascript:alert(1)" alt="Unsafe"></noscript>
    <noscript><p>Hidden fallback text</p><img src="/unrelated.jpg"></noscript>
    </article>`, { url, selector: '#body' });
  assert.match(result.content, /!\[Safe\]\(https:\/\/example.org\/static.jpg\)/);
  assert.doesNotMatch(result.content + result.extras, /javascript:|Unsafe|Hidden fallback text|unrelated.jpg/);
});

test('tracking preserves mixed paragraphs and selectors targeting existing spans', () => {
  const result = extractPage(`<title>Mixed text</title><article>
    <div>Opening text <strong>important words</strong><br><br>Second paragraph.</div>
    <pre><code class="language-js">const message = "original";\n  console.log(message);</code></pre>
    </article>`, { url, selector: 'article' });
  assert.match(result.content, /Opening text \*\*important words\*\*/);
  assert.match(result.content, /Second paragraph/);
  assert.match(result.content, /```js\nconst message = "original";\n  console.log\(message\);/);
  assert.equal(result.extras, '');
  const span = extractPage('<title>Span</title><body><span>Original span text</span></body>',
    { url, selector: 'span' });
  assert.equal(span.content, 'Original span text');
  assert.equal(span.extras, '');
});

test('selector preserves Markdown structure and resolves relative resources', () => {
  const result = extractPage(html, { url, selector: '#article' });
  assert.equal(result.title, 'Example article');
  assert.equal(result.metadata.language, 'en');
  assert.doesNotMatch(result.content, /^# Example article/m);
  assert.match(result.content, /## Useful details/);
  assert.match(result.content, /-\s+First item/);
  assert.match(result.content, /> A quotation/);
  assert.match(result.content, /```js\nconst answer = 42;/);
  assert.match(result.content, /\|\s*Key\s*\|\s*Value\s*\|/);
  assert.match(result.content, /~~Removed words~~/);
  assert.match(result.content, /\[Reference\]\(https:\/\/example.org\/reference\)/);
  assert.match(result.content, /!\[Diagram\]\(https:\/\/example.org\/image.png\)/);
  assert.match(result.extras, /\[Navigation only\]\(https:\/\/example.org\/home\)/);
  assert.doesNotMatch(result.extras, /First item|Sidebar backup only|Example article/);
});

test('base URL, unsafe links and short article warnings are handled', () => {
  const result = extractPage(`<html><head><base href="https://cdn.example.org/assets/"></head>
    <body><article><p>Small example <a href="javascript:alert(1)">unsafe</a>
    <img src="picture.png" alt="Picture"></p></article></body></html>`,
  { url, selector: 'article' });
  assert.match(result.content, /https:\/\/cdn.example.org\/assets\/picture.png/);
  assert.doesNotMatch(result.content, /javascript:/);
  assert.equal(result.warnings.length, 1);
});

test('invalid URLs, ambiguous selectors and empty pages fail explicitly', () => {
  assert.throws(() => validateUrl('file:///local.html'), /HTTP/);
  assert.throws(() => validateUrl('https://user:password@example.org'), /credentials/);
  assert.throws(() => extractPage(html, { url, selector: '.missing' }), /matched 0/);
  assert.throws(() => extractPage(html, { url, selector: 'p' }), /exactly one/);
  assert.throws(() => extractPage('<html><body></body></html>', { url }), /No article/);
});

test('selecting body removes its direct text from the supplementary output', () => {
  const result = extractPage('<body>Original body text<p>A paragraph.</p></body>',
    { url, selector: 'body' });
  assert.match(result.content, /Original body text/);
  assert.equal(result.extras, '');
});

test('fetch follows redirects and decodes non-UTF-8 HTML', async (t) => {
  const base = await server(t, (request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: '/article' }).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=windows-1252' });
    response.end(Buffer.from('<article><p>caf\xe9</p></article>', 'latin1'));
  });
  const fetched = await fetchPage(`${base}/redirect`);
  assert.equal(fetched.url, `${base}/article`);
  assert.match(fetched.html, /caf\u00e9/);
});

test('fetch rejects HTTP errors and non-HTML responses', async (t) => {
  const base = await server(t, (request, response) => {
    if (request.url === '/error') response.writeHead(403).end('Forbidden');
    else response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
  });
  await assert.rejects(fetchPage(`${base}/error`), /HTTP 403/);
  await assert.rejects(fetchPage(`${base}/json`), /Expected an HTML page/);
});

test('request timeout is enforced', async (t) => {
  const base = await server(t, () => {});
  await assert.rejects(fetchPage(base, { timeout: 30 }), { name: 'TimeoutError' });
});

test('saving creates UTF-8 outputs and never overwrites an earlier run', async (t) => {
  const output = await temporaryDirectory(t);
  const result = extractPage(html, { url, selector: '#article' });
  const options = {
    output,
    requestedUrl: url,
    fetchedAt: '2026-10-10T07:00:00.000Z',
    rendered: false,
    contentType: 'text/html',
  };
  const first = await savePage(result, options);
  const second = await savePage(result, options);
  assert.notEqual(first, second);
  assert.deepEqual((await readdir(first)).sort(), ['content.md', 'extras.md', 'metadata.json']);
  assert.match(await readFile(path.join(first, 'content.md'), 'utf8'),
    /^# \[Example article\]\(<https:\/\/example.org\/library\/chapter>\)/);
  const metadata = JSON.parse(await readFile(path.join(first, 'metadata.json'), 'utf8'));
  assert.equal(metadata.requestedUrl, url);
  assert.equal(metadata.rendered, false);
  assert.deepEqual(metadata.warnings, []);
});

test('heading links to the original URL and records the redirected URL', async (t) => {
  const output = await temporaryDirectory(t);
  const result = extractPage(html, { url, selector: '#article' });
  result.title = 'Title [with] *markup*';
  const originalUrl = 'https://example.org/old?value=(one)';
  const directory = await savePage(result, {
    output, requestedUrl: originalUrl, fetchedAt: '2026-10-10T07:00:00.000Z',
    rendered: false, contentType: 'text/html',
  });
  const content = await readFile(path.join(directory, 'content.md'), 'utf8');
  assert.equal(content.split('\n')[0],
    '# [Title \\[with\\] \\*markup\\*](<https://example.org/old?value=(one)>)');
  assert.ok(content.includes(`> Source: <${originalUrl}>`));
  assert.ok(content.includes(`> Final URL: <${url}>`));
});

test('Windows wrapper installs dependencies, reuses them and forwards CLI arguments', {
  skip: process.platform !== 'win32',
  timeout: 180000,
}, async (t) => {
  const workspace = await temporaryDirectory(t);
  const root = path.resolve(import.meta.dirname, '..');
  for (const file of ['package.json', 'package-lock.json', 'run.ps1', 'run.cmd', 'src']) {
    await cp(path.join(root, file), path.join(workspace, file), { recursive: true });
  }
  const base = await server(t, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  });
  const output = path.join(workspace, 'custom output');
  const args = [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(workspace, 'run.ps1'),
    `${base}/article?value=one&next=two`, '--selector', '#article', '--output', output,
  ];
  const first = await exec('powershell.exe', args, { cwd: os.tmpdir(), timeout: 120000 });
  assert.match(first.stdout, /Installing project dependencies/);
  assert.match(first.stdout, /Saved:/);
  const second = await exec('powershell.exe', args, { cwd: os.tmpdir(), timeout: 30000 });
  assert.doesNotMatch(second.stdout, /Installing project dependencies/);
  assert.equal((await readdir(output)).length, 2);
  const rendered = await exec(process.env.ComSpec || 'cmd.exe', [
    '/d', '/s', '/c',
    `""${path.join(workspace, 'run.cmd')}" "${base}/article?value=one&next=two" --selector "#article" --output "${output}" --render --wait-for "#article""`,
  ], { cwd: os.tmpdir(), timeout: 60000, windowsVerbatimArguments: true });
  assert.match(rendered.stdout, /Preparing Chromium/);
  assert.match(rendered.stdout, /Saved:/);
  assert.equal((await readdir(output)).length, 3);
  await rm(path.join(workspace, 'node_modules', 'turndown'), { recursive: true });
  const repaired = await exec('powershell.exe', args, { timeout: 120000 });
  assert.match(repaired.stdout, /Installing project dependencies/);
  assert.match(repaired.stdout, /Saved:/);
  await assert.rejects(exec('powershell.exe', [
    ...args, '--timeout', '0',
  ], { timeout: 30000 }), (error) => error.code === 1 && /Error:/.test(error.stderr));
});

test('CLI completes URL-to-files flow against a real HTTP server', async (t) => {
  const output = await temporaryDirectory(t);
  const base = await server(t, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  });

  const { stdout, stderr } = await exec(process.execPath, [
    cli, `${base}/article`, '--output', output, '--selector', '#article',
  ], { timeout: 15000 });
  assert.equal(stderr, '');
  assert.match(stdout, /Saved:/);
  const directories = await readdir(output);
  assert.equal(directories.length, 1);
  const content = await readFile(path.join(output, directories[0], 'content.md'), 'utf8');
  assert.match(content, /This original test article/);
  assert.doesNotMatch(content, /Navigation only|Footer backup only/);
});

test('rendering waits for dynamically inserted content', async (t) => {
  const base = await server(t, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`
      <html><head><title>Rendered article</title></head><body>
      <nav>Render navigation only</nav><div id="root"></div>
      <script>setTimeout(() => {
        document.getElementById('root').innerHTML =
          '<article id="dynamic"><h1>Rendered article</h1><p>${paragraph.repeat(3)}</p></article>';
      }, 100);</script></body></html>`);
  });
  const fetched = await fetchPage(base, { render: true, waitFor: '#dynamic' });
  const result = extractPage(fetched.html, { url: fetched.url, selector: '#dynamic' });
  assert.match(result.content, /This original test article/);
  assert.doesNotMatch(result.content, /Render navigation only/);
  assert.match(result.extras, /Render navigation only/);
});

test('CLI help succeeds and invalid arguments do not create output', async (t) => {
  const output = await temporaryDirectory(t);
  const { stdout } = await exec(process.execPath, [cli, '--help']);
  assert.match(stdout, /Usage:/);
  for (const args of [
    [url, '--timeout', '0'],
    [url, '--wait-for', 'article'],
    ['file:///local.html'],
    [url, '--unknown'],
  ]) {
    await assert.rejects(
      exec(process.execPath, [cli, ...args, '--output', output]),
      (error) => error.code === 1 && error.stderr.includes('Error:'),
    );
  }
  assert.deepEqual(await readdir(output), []);
});
