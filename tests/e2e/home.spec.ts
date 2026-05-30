import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
});

test('renders the tide chart with the day’s extremes', async ({ page }) => {
  const extremes = await page.locator('.extremes li').count();
  expect(extremes).toBeGreaterThanOrEqual(3);
  expect(extremes).toBeLessThanOrEqual(5);
  // area fill + curve line
  await expect(page.locator('svg[role="slider"] path')).toHaveCount(2);
});

test('shows an answer-first readout', async ({ page }) => {
  await expect(page.locator('.readout')).toContainText(/Rising|Falling/);
  await expect(page.locator('.readout')).toContainText(/\d/);
});

test('scrubbing the chart updates the readout', async ({ page }) => {
  const readout = page.locator('.readout');
  const before = (await readout.innerText()).trim();
  const box = await page.locator('svg[role="slider"]').boundingBox();
  if (!box) throw new Error('no chart box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(readout).not.toHaveText(before);
});

test('day navigation changes the displayed day', async ({ page }) => {
  const label = page.locator('.daynav .day');
  const today = (await label.innerText()).trim();
  await page.locator('.daynav button[aria-label="Next day"]').click();
  await expect(label).not.toHaveText(today);
});
