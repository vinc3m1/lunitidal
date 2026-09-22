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

test('time format selection switches tide times between 24 hr and AM/PM', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('seg-time').getByRole('button', { name: 'AM/PM' }).click();
  await page.getByTestId('nav-back').click();
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.locator('.extremes')).toContainText(/\b(AM|PM)\b/);

  await page.getByTestId('nav-settings').click();
  await page.getByTestId('seg-time').getByRole('button', { name: '24 hr' }).click();
  await page.getByTestId('nav-back').click();
  await page.waitForSelector('svg[role="slider"]');
  await expect(page.locator('.extremes')).not.toContainText(/\b(AM|PM)\b/);
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

test('marine On and Off buttons keep their named state when clicked again', async ({ page }) => {
  await page.goto('/settings');
  const on = page.getByTestId('seg-marine').getByRole('button', { name: 'On', exact: true });
  const off = page.getByTestId('seg-marine').getByRole('button', { name: 'Off', exact: true });
  await on.click();
  await on.click();
  await expect(on).toHaveAttribute('aria-pressed', 'true');
  await off.click();
  await off.click();
  await expect(off).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('nav-back').click();
  await expect(page.getByTestId('marine-card')).toHaveCount(0);
});

test('Auto theme follows system changes while explicit themes stay fixed', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Auto', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
