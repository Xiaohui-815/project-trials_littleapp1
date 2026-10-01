import { test, expect } from '@playwright/test';

test('missing cloud configuration never presents fake sign-in or a password form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '账本已就绪，等待连接' })).toBeVisible();
  await expect(page.getByRole('button', { name: '等待开通测试环境' })).toBeDisabled();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
});

test('desktop flow: create, validate, edit, filter, delete and refresh route', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?preview=1#/overview');
  await expect(page.getByRole('heading', { name: '月度收入趋势' })).toBeVisible();
  await page.getByRole('button', { name: '新增收入', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('积分数').fill('0.001');
  await dialog.getByLabel('收入来源').fill('测试业务收入');
  await dialog.getByRole('button', { name: '保存收入' }).click();
  await expect(dialog.getByRole('alert')).toContainText('最多');
  await dialog.getByLabel('积分数').fill('123.45');
  await dialog.getByLabel('备注').fill('端到端测试记录');
  await dialog.getByRole('button', { name: '保存收入' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: '收入明细', exact: true }).click();
  let row = page.getByRole('row').filter({ hasText: '测试业务收入' });
  await expect(row).toContainText('+123.45');
  await row.getByRole('button', { name: /编辑/ }).click();
  await dialog.getByLabel('积分数').fill('0.30');
  await dialog.getByRole('button', { name: '保存收入' }).click();
  await expect(row).toContainText('+0.30');
  await row.getByRole('button', { name: /删除/ }).click();
  await dialog.getByRole('button', { name: '保留记录' }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /删除/ }).click();
  await dialog.getByRole('button', { name: '确认删除' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('link', { name: '月度与年度统计' }).click();
  await page.getByLabel('选择年份').selectOption('2023');
  await expect(page.getByRole('heading', { name: '这段时间还没有收入记录' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '月度与年度统计', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('modal keyboard focus and signout removes account data', async ({ page }) => {
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: '新增收入', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: '新增收入', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: '打开你的积分账本' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('save failure preserves input and a retry succeeds without duplicate records', async ({ page }) => {
  // Inject a transient error into the development-only adapter; no fault hook ships in the app.
  await page.route('**/src/preview/client.ts', async route => {
    const response = await route.fetch();
    const original = await response.text();
    expect(original).toContain('async save(input) {');
    const body = original.replace('async save(input) {', 'async save(input) { if (!window.__testSaveFailed) { window.__testSaveFailed = true; throw new Error("测试网络中断，请重试。"); }');
    await route.fulfill({ response, body });
  });
  await page.goto('/?preview=1');
  await page.getByRole('button', { name: '新增收入', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('积分数').fill('88.88');
  await dialog.getByLabel('收入来源').fill('失败重试测试');
  await dialog.getByRole('button', { name: '保存收入' }).click();
  await expect(dialog.getByRole('alert')).toContainText('网络中断');
  await expect(dialog.getByLabel('积分数')).toHaveValue('88.88');
  await expect(dialog.getByLabel('收入来源')).toHaveValue('失败重试测试');
  await dialog.getByRole('button', { name: '保存收入' }).click();
  await page.getByRole('link', { name: '收入明细', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '失败重试测试' })).toHaveCount(1);
});

for (const width of [1280, 1440, 1920, 390]) {
  test(`layout at ${width}px has no page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?preview=1');
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/overview-${width}.png`, fullPage: true });
  });
}
