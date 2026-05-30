import { expect, test } from './fixtures';

test('switching to feet updates displayed heights', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('unit-ft').click();
  await page.getByTestId('nav-back').click();
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.locator('.readout')).toContainText('ft');
});

test('theme selection updates the document theme', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-settings').click();
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('marine toggle hides the marine card', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('marine-card').waitFor();
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('seg-marine').getByText('Off').click();
  await page.getByTestId('nav-back').click();
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.getByTestId('marine-card')).toHaveCount(0);
});
