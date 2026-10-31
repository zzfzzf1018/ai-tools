const { _electron: electron, chromium, expect } = require('@playwright/test');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const path = require('node:path');

async function completeExercise(page, next) {
  const text = (await page.locator('.target-text').getAttribute('aria-label')).replace(
    '目标文本：',
    '',
  );
  await page.getByRole('group', { name: '打字练习区' }).focus();
  if (await page.getByRole('button', { name: '继续练习', exact: true }).count())
    await page.getByRole('button', { name: '继续练习', exact: true }).last().click();
  await page.keyboard.type(text, { delay: 10 });
  await expect(page.getByRole('button', { name: next, exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
}

async function run() {
  const profile = await mkdtemp(path.join(tmpdir(), 'typing-island-'));
  const executablePath = process.env.DESKTOP_EXECUTABLE;
  const portable = executablePath?.endsWith('-portable.exe');
  const options = { args: [...(executablePath ? [] : ['.']), `--user-data-dir=${profile}`] };
  if (executablePath) options.executablePath = executablePath;
  async function launch() {
    if (!portable) return electron.launch(options);
    const port = await new Promise((resolve, reject) => {
      const server = createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
    const child = spawn(
      executablePath,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
      { stdio: 'ignore' },
    );
    const exited = new Promise((resolve, reject) => {
      child.once('exit', resolve);
      child.once('error', reject);
    });
    let browser;
    try {
      await expect(async () => {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      }).toPass({ timeout: 45000 });
      const context = browser.contexts()[0];
      await expect.poll(() => context.pages().length).toBeGreaterThan(0);
      const protocol = await browser.newBrowserCDPSession();
      const { processInfo } = await protocol.send('SystemInfo.getProcessInfo');
      const browserProcess = processInfo.find((process) => process.type === 'browser');
      if (!browserProcess) throw new Error('Desktop browser process not found');
      return {
        firstWindow: async () => context.pages()[0],
        close: async () => {
          await Promise.all(context.pages().map((page) => page.close()));
          await browser.close();
          await exited;
          await expect
            .poll(
              () => {
                try {
                  process.kill(browserProcess.id, 0);
                  return false;
                } catch (error) {
                  if (error.code === 'ESRCH') return true;
                  throw error;
                }
              },
              { timeout: 15000 },
            )
            .toBe(true);
        },
      };
    } catch (error) {
      child.kill();
      if (browser) await browser.close();
      await exited.catch(() => undefined);
      throw error;
    }
  }
  let application;
  try {
    application = await launch();
    let page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('桌面离线版', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '开始冒险', exact: true }).click();
    for (const name of ['坐好啦，下一步', '找到空格了', '出发，去找 F 和 J', '开始跟练'])
      await page.getByRole('button', { name, exact: true }).click();
    for (const next of ['开始小测', '继续探索']) await completeExercise(page, next);
    await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
    for (let lessonNumber = 3; lessonNumber <= 20; lessonNumber++) {
      await page.getByRole('button', { name: '继续学习', exact: true }).click();
      await page.getByRole('button', { name: '开始跟练', exact: true }).click();
      await completeExercise(page, '开始小测');
      await completeExercise(page, '继续探索');
    }
    await expect(page.locator('.lesson-number.completed')).toHaveCount(20);
    await page.getByRole('button', { name: '自由练习', exact: true }).click();
    for (const kind of ['字母', '单词', '短句']) {
      await page.getByRole('button', { name: kind, exact: true }).click();
      await page.getByRole('button', { name: '开始练习', exact: true }).click();
      await completeExercise(page, '继续探索');
    }
    await page.getByRole('button', { name: '趣味乐园', exact: true }).click();
    for (const name of ['出发去旅行', '一起放气球']) {
      await page.getByRole('button', { name, exact: true }).click();
      await completeExercise(page, '继续探索');
    }
    await page.getByRole('button', { name: '我的成长', exact: true }).click();
    await expect(page.locator('.badge.earned').filter({ hasText: '游戏好伙伴' })).toBeVisible();
    await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
    await page.getByRole('checkbox', { name: /减少动态效果/ }).check();
    await page.getByRole('checkbox', { name: /轻柔按键音/ }).check();
    await page.getByRole('button', { name: '关闭设置' }).click();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v1')).rounds),
    ).toBe(25);
    expect(await page.evaluate(() => window.open('about:blank') === null)).toBe(true);
    const secure = portable
      ? await page.evaluate(
          () =>
            typeof globalThis.require === 'undefined' && typeof globalThis.process === 'undefined',
        )
      : await application.evaluate(({ BrowserWindow }) => {
          const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
          return (
            preferences.contextIsolation && preferences.sandbox && !preferences.nodeIntegration
          );
        });
    if (!secure) throw new Error('Insecure desktop preferences');
    if (errors.length) throw new Error(errors.join('\n'));
    await application.close();
    application = await launch();
    page = await application.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: '关闭声音', exact: true })).toBeVisible();
    await expect(page.locator('.app')).toHaveClass(/reduce-motion/);
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('typing-island-v1')),
    );
    expect(restored.rounds).toBe(25);
    expect(restored.games).toBe(2);
    expect(Object.keys(restored.lessons)).toHaveLength(20);
    if (!portable) {
      await page.getByRole('button', { name: '自由练习', exact: true }).click();
      await page.getByRole('button', { name: '开始练习', exact: true }).click();
      await page.getByRole('group', { name: '打字练习区' }).focus();
      await page.keyboard.type('a');
      await application.evaluate(({ BrowserWindow, dialog }) => {
        globalThis.closePrompt = { calls: 0, choice: 1 };
        dialog.showMessageBoxSync = (_window, options) => {
          globalThis.closePrompt.calls++;
          globalThis.closePrompt.options = options;
          return globalThis.closePrompt.choice;
        };
        BrowserWindow.getAllWindows()[0].close();
      });
      await expect.poll(() => application.evaluate(() => globalThis.closePrompt.calls)).toBe(1);
      expect(
        await application.evaluate(({ BrowserWindow }) => ({
          count: BrowserWindow.getAllWindows().length,
          defaultId: globalThis.closePrompt.options.defaultId,
          cancelId: globalThis.closePrompt.options.cancelId,
        })),
      ).toEqual({ count: 1, defaultId: 1, cancelId: 1 });
      await expect(page.getByRole('group', { name: '打字练习区' })).toBeVisible();
      const closed = application.waitForEvent('close');
      await application.evaluate(({ BrowserWindow }) => {
        globalThis.closePrompt.choice = 0;
        BrowserWindow.getAllWindows()[0].close();
      });
      await closed;
      application = null;
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(
      'PASS desktop: all 20 courses, three practice modes, both games, result focus, secure preferences, settings and progress persistence',
    );
  } finally {
    if (application && !portable) {
      await application
        .evaluate(({ BrowserWindow }) => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.removeAllListeners('will-prevent-unload');
            window.webContents.on('will-prevent-unload', (event) => event.preventDefault());
          }
        })
        .catch(() => undefined);
    }
    if (application) await application.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
const watchdog = setTimeout(() => {
  console.error('Desktop smoke test did not reach its completion marker.');
  process.exit(1);
}, 120000);
run()
  .then(() => {
    clearTimeout(watchdog);
  })
  .catch((error) => {
    clearTimeout(watchdog);
    console.error(error);
    process.exitCode = 1;
  });
