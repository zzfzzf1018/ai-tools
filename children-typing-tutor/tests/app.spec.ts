import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { lessons } from '../src/data/lessons';
import {
  award,
  BACKUP_MAX_BYTES,
  defaultProgress,
  exportBackup,
  readBackup,
} from '../src/lib/progress';

async function onboarding(page: Page) {
  await page.getByRole('button', { name: '开始冒险', exact: true }).click();
  await page.getByRole('button', { name: '坐好啦，下一步' }).click();
  await page.getByRole('button', { name: '找到空格了' }).click();
  await page.getByRole('button', { name: '出发，去找 F 和 J' }).click();
  await expect(page.getByRole('heading', { name: '找到 F 和 J' })).toBeVisible();
}
async function typeTarget(page: Page, errors = '') {
  const area = page.getByRole('group', { name: '打字练习区' });
  const text = (await page.locator('.target-text').getAttribute('aria-label'))!.replace(
    '目标文本：',
    '',
  );
  await area.focus();
  const resume = page.getByRole('button', { name: '继续练习', exact: true });
  if ((await resume.count()) > 0) await resume.last().click();
  if (errors) await page.keyboard.type(errors);
  const completed = await page.locator('.target-text .typed').count();
  await page.keyboard.type(text.slice(completed), { delay: 5 });
  await expect(page.getByRole('region', { name: '练习结果' })).toBeVisible();
}

test('development server loads React refresh while production keeps strict CSP', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5174');
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  await expect(page.getByText('网页练习版', { exact: true })).toBeVisible();
  await page.goto('/');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self';");
  expect(policy).not.toContain('unsafe-eval');
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('zero-beginner course: guided, failed checkpoint, retry, unlock, persistence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page);
  await page.getByRole('button', { name: '开始小测', exact: true }).click();
  await typeTarget(page, 'xxxxxxxx');
  await expect(page.getByRole('heading', { name: '再练一遍，会更稳！' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '再试一次', exact: true }).click();
  const area = page.getByRole('group', { name: '打字练习区' });
  await area.focus();
  await page.keyboard.type('x');
  await expect(page.locator('.input-message')).toContainText('再试一次');
  await page.getByRole('button', { name: '暂停练习', exact: true }).click();
  await expect(page.locator('.input-message')).toContainText('休息一下');
  await page.keyboard.type('f');
  await expect(page.locator('.target-text .typed')).toHaveCount(0);
  await page.getByRole('button', { name: '继续练习', exact: true }).last().click();
  await typeTarget(page);
  await expect(page.getByRole('heading', { name: '又前进了一小步！' })).toBeVisible();
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
  const rounds = await page.evaluate(
    () => JSON.parse(localStorage.getItem('typing-island-v2')!).rounds,
  );
  expect(rounds).toBe(3);
  await page.reload();
  await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('courses and games remain usable when randomUUID is unavailable on ordinary HTTP', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    Reflect.deleteProperty(Navigator.prototype, 'serviceWorker');
    Reflect.deleteProperty(window, 'caches');
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('在线学习中', { exact: true })).toBeVisible();
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page);
  await page.getByRole('button', { name: '开始小测', exact: true }).click();
  await typeTarget(page);
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await page.getByRole('button', { name: '趣味乐园', exact: true }).click();
  await page.getByRole('button', { name: '出发去旅行', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重新开始', exact: true }).click();
  await typeTarget(page);
  expect(errors).toEqual([]);
});

test('practice modes, both games, settings, reset confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  for (const kind of ['字母', '单词', '短句']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await page.getByRole('button', { name: '开始练习', exact: true }).click();
    await typeTarget(page);
    await page.getByRole('button', { name: '继续探索', exact: true }).click();
  }
  await page.getByRole('button', { name: '趣味乐园', exact: true }).click();
  for (const name of ['出发去旅行', '一起放气球']) {
    await page.getByRole('button', { name, exact: true }).click();
    if (name === '出发去旅行') {
      const bunny = page.locator('.game-stage.trail img');
      const before = (await bunny.boundingBox())!.x;
      await page.getByRole('group', { name: '打字练习区' }).focus();
      await page.keyboard.type('f');
      await expect.poll(async () => (await bunny.boundingBox())!.x).toBeGreaterThan(before);
    }
    await typeTarget(page);
    await page.getByRole('button', { name: '继续探索', exact: true }).click();
  }
  await page.getByRole('button', { name: '我的成长', exact: true }).click();
  await expect(page.locator('.badge.earned').filter({ hasText: '游戏好伙伴' })).toBeVisible();
  await page.getByRole('button', { name: '小岛设置', exact: true }).first().click();
  await page.getByRole('checkbox', { name: /减少动态效果/ }).check();
  await page.getByRole('checkbox', { name: /轻柔按键音/ }).check();
  await page.getByRole('button', { name: '重新开始整个小岛' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.locator('.app')).toHaveClass(/reduce-motion/);
  await expect(page.getByRole('button', { name: '关闭声音', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '小岛设置', exact: true }).first().click();
  await page.getByRole('button', { name: '重新开始整个小岛' }).click();
  await page.getByRole('button', { name: '确认清除记录' }).click();
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).rounds),
  ).toBe(0);
});

test('word balloon asks for a separator instead of claiming the game is complete', async ({
  page,
}) => {
  const progress = lessons
    .slice(0, 6)
    .reduce(
      (data, lesson) =>
        award(data, { id: `seed-${lesson.id}`, lessonId: lesson.id, accuracy: 100, seconds: 1 }),
      defaultProgress(),
    );
  await page.addInitScript(
    (data) => localStorage.setItem('typing-island-v2', JSON.stringify(data)),
    progress,
  );
  await page.goto('/');
  await page.getByRole('button', { name: '趣味乐园', exact: true }).click();
  await page.getByRole('button', { name: '一起放气球', exact: true }).click();
  await page.getByRole('group', { name: '打字练习区' }).focus();
  const text = (await page.locator('.target-text').getAttribute('aria-label'))!.replace(
    '目标文本：',
    '',
  );
  await page.keyboard.type(text.split(' ')[0]);
  await expect(page.locator('.target-text .current')).toHaveText('\u2423');
  await expect(page.locator('.game-stage .balloon-one span')).toHaveText('空格');
  await typeTarget(page);
  await expect(page.locator('.game-stage .balloon-one span')).toHaveText('完成');
});

test('Shift, space, apostrophe, exclamation and Caps Lock display the correct keyboard hints', async ({
  page,
}) => {
  const progress = lessons
    .slice(0, 17)
    .reduce(
      (data, lesson) =>
        award(data, { id: `finger-${lesson.id}`, lessonId: lesson.id, accuracy: 100, seconds: 1 }),
      defaultProgress(),
    );
  await page.addInitScript(
    (data) => localStorage.setItem('typing-island-v2', JSON.stringify(data)),
    progress,
  );
  await page.goto('/');
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  await page.getByRole('button', { name: '开始跟练' }).click();
  await expect(page.locator('.finger-hint')).toContainText('左食指 · F');
  await expect(page.locator('.finger-hint')).toContainText('右手 Shift');
  const area = page.getByRole('group', { name: '打字练习区' });
  await area.dispatchEvent('keydown', { key: 'CapsLock', modifierCapsLock: true });
  await expect(page.getByRole('status')).toContainText('Caps Lock 已开启');
  await page.keyboard.press('Shift+KeyF');
  await expect(page.locator('.key.target')).toHaveText('空格');
  await page.keyboard.press('Space');
  await expect(page.locator('.finger-hint')).toContainText('右食指 · J');
  await expect(page.locator('.finger-hint')).toContainText('左手 Shift');
  await typeTarget(page);
  await page.getByRole('button', { name: '开始小测', exact: true }).click();
  await typeTarget(page);
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await page.getByRole('button', { name: '继续学习', exact: true }).click();
  await expect(page.locator('.key.target')).toHaveText("'");
  await expect(page.locator('.finger-hint')).toContainText('右小指');
  await page.getByRole('button', { name: '开始跟练' }).click();
  await page.keyboard.type('Hi');
  await expect(page.locator('.key.target')).toHaveText('1');
  await expect(page.locator('.finger-hint')).toContainText('左小指 · !');
  await expect(page.locator('.finger-hint')).toContainText('右手 Shift');
  await page.keyboard.press('Shift+Digit1');
  await expect(page.locator('.target-text .typed')).toHaveCount(3);
});

test('navigation cancellation preserves session; window blur pauses it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('group', { name: '打字练习区' }).focus();
  await page.keyboard.type('a');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.input-message')).toContainText('休息一下');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '返回自由练习' }).click();
  await expect(page.getByRole('group', { name: '打字练习区' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '返回自由练习' }).click();
  await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeVisible();
});

test('web assets and lessons work after offline reload', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('已可离线学习', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  expect(
    await page.evaluate(
      async () =>
        !!(await caches.match(new URL('index.html', location.href).href, { ignoreSearch: true })),
    ),
  ).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '我的学习地图' })).toBeVisible();
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page);
  await expect(page.locator('.exercise img')).toHaveJSProperty('complete', true);
  await context.setOffline(false);
});

test('an available update cannot reload an active exercise or its result', async ({ page }) => {
  const updates: boolean[] = [];
  await page.exposeFunction('captureUpdate', (reload: boolean) => updates.push(reload));
  await page.route('**/assets/virtual_pwa-register-*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export function registerSW(options) { options.onNeedRefresh(); return async (reload) => globalThis.captureUpdate(reload); }',
    }),
  );
  await page.goto('/');
  const update = page.getByRole('button', { name: '更新版本', exact: true });
  await expect(update).toBeEnabled();
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await expect(update).toBeDisabled();
  await typeTarget(page);
  await expect(update).toBeDisabled();
  expect(updates).toEqual([]);
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await expect(update).toBeEnabled();
  await update.click();
  expect(updates).toEqual([true]);
});

test('a rejected update reports failure without unhandled errors or changing records', async ({
  page,
}) => {
  await page.route('**/assets/virtual_pwa-register-*.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export function registerSW(options) { options.onNeedRefresh(); return async () => { throw new Error("Worker update failed"); }; }',
    }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('typing-island-v2'));
  await page.getByRole('button', { name: '更新版本', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('更新暂未成功');
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
  expect(errors).toEqual([]);
});

test('timed practice excludes breaks, ends on deadline and completed navigation needs no warning', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '1 分钟', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('group', { name: '打字练习区' }).focus();
  await page.keyboard.type('a');
  await page.getByRole('button', { name: '暂停练习', exact: true }).click();
  await page.clock.fastForward(120000);
  await expect(page.getByRole('region', { name: '练习结果' })).toHaveCount(0);
  await page.getByRole('button', { name: '继续练习', exact: true }).last().click();
  await page.clock.fastForward(60100);
  await expect(page.getByRole('region', { name: '练习结果' })).toBeVisible();
  const savedSeconds = await page.evaluate(
    () => JSON.parse(localStorage.getItem('typing-island-v2')!).seconds,
  );
  expect(savedSeconds).toBe(60);
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: '返回自由练习' }).click();
  await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeVisible();
  expect(dialogs).toEqual([]);
});

test('three-minute practice ignores shortcuts, repetition and composition, preserves mistakes and pauses in background', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '3 分钟', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  const area = page.getByRole('group', { name: '打字练习区' });
  await area.focus();
  await page.keyboard.down('a');
  await page.keyboard.down('a');
  await page.keyboard.up('a');
  await page.keyboard.press('Control+a');
  for (const input of [
    { key: 's', isComposing: true },
    { key: 's', repeat: true },
    { key: 's', altKey: true },
    { key: 's', metaKey: true },
  ])
    await area.dispatchEvent('keydown', input);
  await expect(page.locator('.target-text .typed')).toHaveCount(1);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.target-text .typed')).toHaveCount(0);
  await page.keyboard.type('xa');
  await expect(page.locator('.target-text .typed')).toHaveCount(1);
  await expect(page.locator('.session-stats > span').first()).toContainText('66%');
  await page.clock.fastForward(10000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(240000);
  await expect(page.locator('.input-message')).toContainText('休息一下');
  await expect(page.getByRole('region', { name: '练习结果' })).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.input-message')).toContainText('休息一下');
  await page.getByRole('button', { name: '继续练习', exact: true }).last().click();
  await page.clock.fastForward(180000);
  await expect(page.getByRole('region', { name: '练习结果' })).toBeVisible();
  await page.clock.fastForward(240000);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!));
  expect(saved.seconds).toBe(180);
  expect(saved.rounds).toBe(1);
});

test('resume button supports Space without the exercise swallowing its keyboard event', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('button', { name: '暂停练习', exact: true }).click();
  const resumeButton = page
    .getByRole('group', { name: '打字练习区' })
    .getByRole('button', { name: '继续练习', exact: true });
  await resumeButton.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '暂停练习', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: '打字练习区' })).toBeFocused();
  await page.keyboard.type('a');
  await expect(page.locator('.target-text .typed')).toHaveCount(1);
});

test('keyboard completion focuses the result action and Enter continues the lesson', async ({
  page,
}) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page);
  await expect(page.getByRole('button', { name: '开始小测', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: '打字练习区' })).toBeFocused();
  await typeTarget(page);
  await expect(page.getByRole('button', { name: '继续探索', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
});

test('audio device rejections do not produce unhandled errors or block typing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    AudioContext.prototype.resume = () => Promise.reject(new Error('Audio device unavailable'));
    AudioContext.prototype.close = () => Promise.reject(new Error('Audio shutdown failed'));
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await typeTarget(page);
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始练习', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('blur just after deadline finishes before a delayed timer can run', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(performance, 'now', { configurable: true, value: () => 0 }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '自由练习', exact: true }).click();
  await page.getByRole('button', { name: '1 分钟', exact: true }).click();
  await page.getByRole('button', { name: '开始练习', exact: true }).click();
  await page.getByRole('group', { name: '打字练习区' }).focus();
  await page.keyboard.type('a');
  await page.evaluate(() => {
    Object.defineProperty(performance, 'now', { configurable: true, value: () => 60001 });
    window.dispatchEvent(new Event('blur'));
  });
  await expect(page.getByRole('region', { name: '练习结果' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).seconds))
    .toBe(60);
});

test('settings keyboard focus stays in dialog and returns to trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '小岛设置', exact: true }).last();
  await trigger.click();
  await expect(page.getByRole('button', { name: '关闭设置' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '重新开始整个小岛' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '关闭设置' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('reset confirmation preserves focus when its buttons are replaced', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '小岛设置', exact: true }).last();
  await trigger.click();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '重新开始整个小岛' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '关闭设置' })).toBeFocused();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '关闭设置' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '重新开始整个小岛' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('all twenty lessons complete with physical keyboard events and unlock in order', async ({
  page,
}) => {
  await page.goto('/');
  await onboarding(page);
  for (const lesson of lessons.slice(1)) {
    await expect(page.getByRole('heading', { name: lesson.title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '开始跟练' }).click();
    await typeTarget(page);
    await page.getByRole('button', { name: '开始小测', exact: true }).click();
    await typeTarget(page);
    await page.getByRole('button', { name: '继续探索', exact: true }).click();
    if (lesson.id < 20) {
      const next = page.locator('.lesson-tile').filter({ hasText: lessons[lesson.id].title });
      await expect(next).toBeEnabled();
      await next.click();
    }
  }
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!));
  expect(Object.keys(result.lessons)).toHaveLength(20);
  expect(
    Object.values(result.lessons).every((value) => (value as { stars: number }).stars === 3),
  ).toBe(true);
  expect(result.rounds).toBe(20);
  await page.getByRole('button', { name: '我的成长', exact: true }).click();
  await expect(page.locator('.badge.earned').filter({ hasText: '小小打字家' })).toBeVisible();
});

test('corrupt local data warns without breaking the first lesson', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('typing-island-v2', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('无法读取');
  await onboarding(page);
});

test('blocked storage keeps practice usable and shows save warning', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('Storage blocked', 'QuotaExceededError');
      },
    });
  });
  await page.goto('/');
  await onboarding(page);
  await expect(page.getByRole('alert')).toContainText('无法保存');
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page);
});

test('another tab receives progress and settings changes without overwriting new lessons', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  await onboarding(page);
  await second.getByRole('button', { name: '开启声音', exact: true }).click();
  await expect
    .poll(() => second.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).rounds))
    .toBe(1);
  await expect(page.getByRole('button', { name: '关闭声音', exact: true })).toBeVisible();
  await second.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await second.getByRole('button', { name: '重新开始整个小岛' }).click();
  await second.getByRole('button', { name: '确认清除记录' }).click();
  await expect(page.getByRole('button', { name: '开启声音', exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
  await second.close();
});

test('1.1 target-key statistics skip guided practice and drive allowed review', async ({
  page,
}) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await typeTarget(page, 'xxxx');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).keyStats),
  ).toEqual({});
  await page.getByRole('button', { name: '开始小测', exact: true }).click();
  await typeTarget(page, 'x');
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await page.getByRole('button', { name: '我的成长', exact: true }).click();
  await expect(page.locator('.mastery-key[data-key="f"]')).toContainText('85%');
  await expect(page.locator('.mastery-key[data-key="j"]')).toContainText('100%');
  await page.getByRole('button', { name: '大写', exact: true }).click();
  await expect(page.locator('.mastery-key[data-key="F"]')).toContainText('未练习');
  await page.getByRole('button', { name: '开始专项复习', exact: true }).click();
  await expect(page.getByRole('heading', { name: '错键专项复习', exact: true })).toBeVisible();
  await expect(page.locator('.target-text')).toHaveAttribute('aria-label', '目标文本：ffffff');
  await typeTarget(page);
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!));
  expect(data.rounds).toBe(3);
  expect(data.lessons['3']).toBeUndefined();
  expect(data.keyStats.f).toEqual({ attempts: 13, correct: 12 });
});

test('1.1 backup downloads canonical JSON and restores only after keyboard confirmation', async ({
  page,
}) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出记录', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Typing-Island-backup-.*\.json$/);
  const downloaded = await download.path();
  if (!downloaded) throw new Error('No backup download file');
  expect(readBackup(await readFile(downloaded, 'utf8')).data).toEqual(before);
  const incoming = award(
    award(defaultProgress(), { id: 'restore-1', accuracy: 100, seconds: 1, lessonId: 1 }),
    {
      id: 'restore-2',
      accuracy: 95,
      seconds: 2,
      lessonId: 2,
      keyStats: { j: { attempts: 2, correct: 1 } },
    },
  );
  const file = {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportBackup(incoming)),
  };
  await page.getByLabel('选择备份文件').setInputFiles(file);
  await expect(page.getByRole('region', { name: '备份预览' })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消导入', exact: true })).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!))).toEqual(
    before,
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '导入记录', exact: true })).toBeFocused();
  await page.getByLabel('选择备份文件').setInputFiles(file);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认替换记录', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('记录已恢复');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!))).toEqual(
    incoming,
  );
  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!))).toEqual(
    incoming,
  );
});

test('1.1 immediately closing settings does not cancel an exported backup', async ({ page }) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!));
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => {
    const exportButton = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('导出记录'),
    );
    exportButton?.click();
    document.querySelector<HTMLButtonElement>('button[aria-label="关闭设置"]')?.click();
  });
  const download = await downloadPromise;
  const filepath = await download.path();
  if (!filepath) throw new Error('Backup canceled when settings closed');
  expect(readBackup(await readFile(filepath, 'utf8')).data).toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('1.1 invalid and oversized backup files preserve current progress', async ({ page }) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  const before = await page.evaluate(() => localStorage.getItem('typing-island-v2'));
  for (const text of [
    '{',
    JSON.stringify({ ...defaultProgress(), version: 99 }),
    'x'.repeat(BACKUP_MAX_BYTES + 1),
  ]) {
    await page.getByLabel('选择备份文件').setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    await expect(page.getByRole('region', { name: '记录备份' }).getByRole('alert')).toBeVisible();
    await expect(page.getByRole('region', { name: '备份预览' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '导入记录', exact: true })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
  }
});

test('1.1 rejected storage and unfinished confirmation cannot overwrite records', async ({
  page,
}) => {
  await page.goto('/');
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  await page.keyboard.type('f');
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  const before = await page.evaluate(() => localStorage.getItem('typing-island-v2'));
  await page.getByLabel('选择备份文件').setInputFiles({
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportBackup(defaultProgress())),
  });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '确认替换记录', exact: true }).click();
  await expect(page.getByRole('region', { name: '记录备份' }).getByRole('alert')).toContainText(
    '已取消',
  );
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
  await page.evaluate(() =>
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    }),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认替换记录', exact: true }).click();
  await expect(page.getByRole('region', { name: '记录备份' }).getByRole('alert')).toContainText(
    '无法保存',
  );
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.locator('.target-text .typed')).toHaveCount(1);
  await expect(page.locator('.input-message')).toContainText('休息一下');
});

test('1.1 closing settings invalidates a pending file read and blocks repeated imports', async ({
  page,
}) => {
  await page.addInitScript(() => {
    File.prototype.text = () =>
      new Promise<string>((resolve) => Object.assign(globalThis, { finishBackupRead: resolve }));
  });
  await page.goto('/');
  await onboarding(page);
  const before = await page.evaluate(() => localStorage.getItem('typing-island-v2'));
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await page.getByLabel('选择备份文件').setInputFiles({
    name: 'pending.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('button', { name: '导入记录', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出记录', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '关闭设置' }).click();
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await page.evaluate(
    (text) =>
      (window as Window & { finishBackupRead?: (value: string) => void }).finishBackupRead?.(text),
    exportBackup(defaultProgress()),
  );
  await expect(page.getByRole('region', { name: '备份预览' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导入记录', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
});

test('1.1 upgrades legacy storage and imports legacy JSON without inventing statistics', async ({
  page,
}) => {
  const original = award(
    award(defaultProgress(), { id: 'legacy-1', accuracy: 100, seconds: 1, lessonId: 1 }),
    { id: 'legacy-2', accuracy: 95, seconds: 2, lessonId: 2 },
  );
  const legacy = { ...original, version: 1, keyStats: undefined };
  await page.goto('/');
  await page.evaluate(
    (data) => localStorage.setItem('typing-island-v1', JSON.stringify(data)),
    legacy,
  );
  await page.reload();
  await expect(page.getByRole('button', { name: /左手的小伙伴/ })).toBeEnabled();
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).version),
  ).toBe(2);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!).keyStats),
  ).toEqual({});
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await page.getByLabel('选择备份文件').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page.getByRole('button', { name: '确认替换记录', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('记录已恢复');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!))).toEqual(
    original,
  );
});

test('1.1 failed reset preserves both active and legacy records', async ({ page }) => {
  await page.goto('/');
  await onboarding(page);
  await page.evaluate(() => localStorage.setItem('typing-island-v1', 'legacy-record-to-preserve'));
  const before = await page.evaluate(() => localStorage.getItem('typing-island-v2'));
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await page.getByRole('button', { name: '重新开始整个小岛' }).click();
  await page.evaluate(() =>
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('Quota denied', 'QuotaExceededError');
      },
    }),
  );
  await page.getByRole('button', { name: '确认清除记录' }).click();
  await expect(page.getByRole('alert')).toContainText('无法保存');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v2'))).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v1'))).toBe(
    'legacy-record-to-preserve',
  );
  await page.getByRole('button', { name: '关闭设置' }).click();
  await expect(page.getByRole('heading', { name: '找到 F 和 J', exact: true })).toBeVisible();
});

test('1.1 explicit reset also clears the preserved legacy migration source', async ({ page }) => {
  const legacy = {
    ...award(defaultProgress(), { id: 'legacy-reset', accuracy: 100, seconds: 1, lessonId: 1 }),
    version: 1,
    keyStats: undefined,
  };
  await page.goto('/');
  await page.evaluate(
    (data) => localStorage.setItem('typing-island-v1', JSON.stringify(data)),
    legacy,
  );
  await page.reload();
  await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
  await page.getByRole('button', { name: '重新开始整个小岛' }).click();
  await page.getByRole('button', { name: '确认清除记录' }).click();
  expect(await page.evaluate(() => localStorage.getItem('typing-island-v1'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('typing-island-v2')!))).toEqual(
    defaultProgress(),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: '开始冒险', exact: true })).toBeVisible();
});

test('1.1 mastery and backup preview fit all required desktop and mobile viewports', async ({
  page,
}) => {
  const data = award(
    award(defaultProgress(), { id: 'visual-1', accuracy: 100, seconds: 1, lessonId: 1 }),
    {
      id: 'visual-2',
      accuracy: 80,
      seconds: 2,
      keyStats: {
        f: { attempts: 5, correct: 4 },
        j: { attempts: 5, correct: 5 },
        F: { attempts: 3, correct: 2 },
        '!': { attempts: 1, correct: 0 },
      },
    },
  );
  await page.goto('/');
  await page.evaluate(
    (value) => localStorage.setItem('typing-island-v2', JSON.stringify(value)),
    data,
  );
  await page.reload();
  await page.getByRole('button', { name: '我的成长', exact: true }).click();
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '小写', exact: true }).click();
    await expect(page.locator('.mastery-key[data-key="f"]')).toContainText('80%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/mastery-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: '大写', exact: true }).click();
    await expect(page.locator('.mastery-key[data-key="F"]')).toContainText('刚开始');
    await page.getByRole('button', { name: '数字与标点', exact: true }).click();
    await expect(page.locator('.mastery-key[data-key="!"]')).toContainText('0%');
    await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
    await page.getByLabel('选择备份文件').setInputFiles({
      name: 'visual.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exportBackup(data)),
    });
    await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '取消导入', exact: true })).toBeInViewport({
      ratio: 1,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/backup-preview-${width}.png` });
    await page.getByRole('button', { name: '取消导入', exact: true }).click();
    await page.getByRole('button', { name: '关闭设置' }).click();
  }
});

test('accepted large records remain readable without horizontal overflow', async ({ page }) => {
  const data = {
    ...defaultProgress(),
    rounds: Number.MAX_SAFE_INTEGER,
    seconds: Number.MAX_VALUE,
    days: { '2026-10-31': Number.MAX_SAFE_INTEGER },
  };
  await page.goto('/');
  await page.evaluate(
    (incoming) => localStorage.setItem('typing-island-v2', JSON.stringify(incoming)),
    data,
  );
  await page.reload();
  await page.getByRole('button', { name: '我的成长', exact: true }).click();
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 800],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole('heading', { name: '每一小步，都算数。', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/large-progress-${width}.png`, fullPage: true });
  }
});

test('responsive screenshots and asset checks', async ({ page }) => {
  await page.goto('/');
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('heading', { name: '我的学习地图' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          ),
        ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/map-${width}.png`, fullPage: true });
  }
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [name, label] of [
      ['自由练习', 'practice'],
      ['趣味乐园', 'games'],
      ['我的成长', 'progress'],
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `test-results/${label}-${width}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: '小岛设置', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/settings-${width}.png` });
    await page.getByRole('button', { name: '关闭设置' }).click();
  }
  await page.getByRole('button', { name: '学习地图', exact: true }).click();
  await onboarding(page);
  await page.getByRole('button', { name: '开始跟练' }).click();
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1280) await expect(page.locator('.keyboard')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/lesson-${width}.png`, fullPage: true });
  }
});
