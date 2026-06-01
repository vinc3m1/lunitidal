import { expect, test } from './fixtures';

const REPO_URL = 'https://github.com/vinc3m1/lunitidal';

test('global footer shows disclaimer, data credits, and author/github/license links', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');

  const footer = page.locator('main > footer');
  await expect(footer).toContainText('not for navigation');
  await expect(footer).toContainText(/TICON-4/);
  await expect(footer).toContainText('Vince Mi');

  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', REPO_URL);
  await expect(footer.getByRole('link', { name: 'MIT License' })).toHaveAttribute(
    'href',
    `${REPO_URL}/blob/main/LICENSE`,
  );
});

test('topbar has a GitHub source link next to settings', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');

  const github = page.getByTestId('nav-github');
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute('href', REPO_URL);
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /noopener/);
});

test('settings About lists data-source credits and license', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');
  await page.getByTestId('nav-settings').click();

  const about = page.locator('section.card', { hasText: 'Credits' });
  await expect(about).toContainText('TICON-4 / UHSLC');
  await expect(about).toContainText('Open-Meteo');
  await expect(about).toContainText('OpenFreeMap');
  await expect(about.getByRole('link', { name: 'MIT License' })).toHaveAttribute(
    'href',
    `${REPO_URL}/blob/main/LICENSE`,
  );
});
