/**
 * 便携版运行环境：数据目录与浏览器启动
 * 纯 Node 模块，可被单元测试直接导入。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

/**
 * 数据目录：优先 EXE 同目录（U 盘随身带），不可写时回退用户目录。
 *
 * electron-builder 的 portable 版启动时会把应用解压到临时目录，此时
 * process.execPath 指向解压副本，而不是用户放置 EXE 的位置。它提供
 * PORTABLE_EXECUTABLE_DIR 指向真正的 EXE 所在目录，必须优先使用它，
 * 否则数据会写进临时目录并在退出后被清理。
 *
 * @param {object} options
 * @param {string} options.portableDir electron-builder portable 提供的 EXE 所在目录
 * @param {boolean} options.packaged 是否为打包后的应用（开发模式写用户目录）
 */
export function resolveDataDir({
  execPath = process.execPath,
  home = os.homedir(),
  env = process.env,
  portableDir = '',
  packaged = true,
} = {}) {
  if (env.WM_DATA_DIR) {
    const custom = path.resolve(env.WM_DATA_DIR);
    fs.mkdirSync(custom, { recursive: true });
    return custom;
  }

  const candidates = [];
  if (portableDir) candidates.push(path.join(portableDir, 'WordMemory-data'));
  if (packaged) candidates.push(path.join(path.dirname(execPath), 'WordMemory-data'));
  candidates.push(path.join(home, 'WordMemory-data'));

  let lastError = null;
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`没有可写的数据目录：${lastError?.message || '未知原因'}`);
}

export function browserCandidates(env = process.env) {
  const pf = env['ProgramFiles'] || 'C:/Program Files';
  const pf86 = env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
  const local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return [
    path.join(local, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
    path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(pf, 'Microsoft/Edge/Application/msedge.exe'),
    path.join(local, 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];
}

export function findBrowser(env = process.env) {
  return browserCandidates(env).find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch {
      return false;
    }
  }) || null;
}

/**
 * 打开浏览器。
 * 有 Chromium 内核浏览器时用 --app 独立窗口 + 独立 profile，
 * 这样看起来像桌面应用，也不会污染用户日常浏览器配置。
 */
export function openBrowser(url, dataDir, { env = process.env, platform = process.platform } = {}) {
  const browser = findBrowser(env);
  if (browser && platform === 'win32') {
    const profile = path.join(dataDir, 'browser-profile');
    const child = spawn(
      browser,
      [
        `--app=${url}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=Translate,MediaRouter',
        '--window-size=1180,820',
      ],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();
    return { mode: 'app', browser };
  }
  if (browser) {
    const child = spawn(browser, [url], { detached: true, stdio: 'ignore' });
    child.unref();
    return { mode: 'app', browser };
  }
  if (platform === 'win32') {
    const child = spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' });
    child.unref();
    return { mode: 'default', browser: null };
  }
  return { mode: 'manual', browser: null };
}
