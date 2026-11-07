/**
 * WordMemory EXE 便携版入口（Node SEA 打包为单个 WordMemory.exe）
 * ------------------------------------------------------------
 * 启动流程：
 *   1. 确定数据目录（默认 EXE 同目录的 WordMemory-data/）
 *   2. 在 127.0.0.1 随机端口启动内置 HTTP 服务
 *   3. 用 Chrome / Edge 的 --app 模式打开独立窗口（无地址栏）
 *   4. 页面每 20 秒发送心跳；超过 2 分钟无心跳自动退出
 *
 * 环境变量（高级用途）：
 *   WM_DATA_DIR     指定数据目录
 *   WM_NO_BROWSER=1 只启动服务，不打开浏览器（自动化测试用）
 */

import { ASSETS } from 'virtual:assets';
import { createPortableServer } from './server.mjs';
import { resolveDataDir, openBrowser } from './env.mjs';

const VERSION = typeof __WM_VERSION__ !== 'undefined' ? __WM_VERSION__ : 'dev';
const IDLE_TIMEOUT = 120000;
const CHECK_INTERVAL = 5000;

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const dataDir = resolveDataDir();
  const service = createPortableServer({
    assets: ASSETS,
    dataDir,
    version: VERSION,
    logger: (msg) => log(`[服务] ${msg}`),
    onCloseRequest: () => shutdown(0),
  });

  const port = await service.listen(0);
  const url = `http://127.0.0.1:${port}/`;

  log('');
  log(`  WordMemory 便携版 v${VERSION}`);
  log(`  ────────────────────────────────────────────`);
  log(`  访问地址：${url}`);
  log(`  数据目录：${dataDir}`);
  log(`  关闭浏览器窗口后服务会自动退出；也可按 Ctrl+C 或直接关闭本窗口。`);
  log('');

  if (process.env.WM_NO_BROWSER === '1') {
    log('  WM_NO_BROWSER=1：未自动打开浏览器');
  } else {
    const result = openBrowser(url, dataDir);
    if (result.mode === 'manual') {
      log(`  未找到可用浏览器，请手动打开：${url}`);
    }
  }

  let stopped = false;
  function shutdown(code = 0) {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    service.close();
    log('  服务已停止，数据已保存在上述目录。');
    setTimeout(() => process.exit(code), 60);
  }

  const timer = setInterval(() => {
    if (service.isClosing) {
      shutdown(0);
      return;
    }
    if (service.idleMs > IDLE_TIMEOUT) {
      log('  页面已关闭，服务自动退出。');
      shutdown(0);
    }
  }, CHECK_INTERVAL);

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  process.on('uncaughtException', (err) => {
    log(`[错误] ${err.stack || err.message}`);
  });
}

main().catch((err) => {
  process.stderr.write(`便携版启动失败：${err.stack || err.message}\n`);
  process.exit(1);
});
