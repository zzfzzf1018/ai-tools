#!/usr/bin/env node
/**
 * 生成 GitHub Release 说明
 * 用法：node scripts/release-notes.mjs [版本号]
 * 从 CHANGELOG.md 提取对应版本段落，附上产物信息。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = process.argv[2] || pkg.version;

function extractChangelog(ver) {
  const file = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith(`## [${ver}]`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## \[/.test(l.trim()));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

function fileInfo(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const size = fs.statSync(abs).size;
  return `${(size / 1024).toFixed(0)} KB`;
}

const changelog = extractChangelog(version);
const singleFile = `word-memory-${version}.html`;
const singleSize = fileInfo('dist/word-memory.html');
const versionJsonPath = path.join(ROOT, 'dist/version.json');
const hash = fs.existsSync(versionJsonPath)
  ? JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')).singleFileHash
  : '';

const parts = [];
parts.push(`## WordMemory v${version}`);
parts.push('');

if (changelog) {
  parts.push(changelog);
  parts.push('');
}

parts.push('### 下载');
parts.push('');
if (singleSize) {
  parts.push(`- \`${singleFile}\`（${singleSize}）—— 单文件离线版，下载后双击即可使用`);
} else {
  parts.push(`- \`${singleFile}\` —— 单文件离线版`);
}
parts.push('- 源码包（Source code）—— 可自行构建 Web 版');
parts.push('');

if (hash) {
  parts.push('### 校验');
  parts.push('');
  parts.push('```');
  parts.push(`单文件产物指纹（SHA-256 前 16 位）：${hash}`);
  parts.push('```');
  parts.push('');
}

parts.push('### 使用');
parts.push('');
parts.push('1. 下载 `' + singleFile + '`');
parts.push('2. 双击用浏览器打开');
parts.push('3. 直接开始学习，进度保存在浏览器本地');
parts.push('');
parts.push('> 首次使用建议每天 10–20 个新词，坚持比冲刺更重要。');

process.stdout.write(`${parts.join('\n')}\n`);
