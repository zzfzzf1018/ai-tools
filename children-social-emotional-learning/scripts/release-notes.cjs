const fs = require('node:fs');
const path = require('node:path');

/**
 * 从 CHANGELOG.md 提取指定版本的段落，生成 GitHub Release 说明（release notes）。
 * 用法：node scripts/release-notes.cjs <version> [outPath]
 *   - version  形如 1.0.1
 *   - outPath  输出文件路径（默认 projectRoot/release-assets/release-notes.md）
 * 生成的说明 = 「本版本改动」(CHANGELOG 对应段落) + 应用使用说明。
 */
const projectRoot = path.resolve(__dirname, '..');
const version = process.argv[2];
const outPath = process.argv[3] || path.join(projectRoot, 'release-assets', 'release-notes.md');

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Usage: node scripts/release-notes.cjs <version> [outPath]');
}

const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
const raw = fs.readFileSync(changelogPath, 'utf8');

function escapeRegExp(s) {
  return s.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
}

// 匹配 `## [<version>]` 标题行，截取到下一个 `## [` 或文件末尾之间的内容。
function extractSection(md, ver) {
  const re = new RegExp(`^##\\s+\\[${escapeRegExp(ver)}\\].*$`, 'm');
  const m = re.exec(md);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const next = rest.search(/^##\s+\[/m);
  const end = next === -1 ? rest.length : next;
  return rest.slice(0, end).trim();
}

const section = extractSection(raw, version);

const appIntro = [
  '面向 6–10 岁儿童的社会情绪学习（SEL）游戏软件「心晴岛」。',
  '',
  '**Windows x64**：下载 `SunnyIsles-SEL-*.exe` 单文件便携版，双击即可运行，无需安装；未签名，Windows 可能提示未知发布者，选择「仍要运行」即可。',
  '**Web 版**：下载 `SunnyIsles-SEL-*-web.zip`，解压后用浏览器打开 `index.html` 即可（或静态托管）。',
  '所有版本均完全离线运行，无账号、无网络请求、无遥测；学习记录仅保存在本机。',
  '下载完整性见 `SHA256SUMS.txt`。',
].join('\n');

let body = `## 本版本改动（${version}）\n\n`;
if (section) {
  body += section + '\n\n';
} else {
  body += '_（详见仓库 CHANGELOG.md）_\n\n';
}
body += '---\n\n' + appIntro + '\n';

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, body);
console.log(`Release notes written to ${outPath}`);
if (!section) {
  console.warn(`Warning: no CHANGELOG section found for version ${version}; used fallback.`);
}
