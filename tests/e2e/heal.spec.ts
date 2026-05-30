import { expect, test } from './fixtures';

test('migrates legacy "My location" labels from old storage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'lunitidal:lastLocation',
      JSON.stringify({
        stationId: 'ticon/benoa-163-idn-uhslc_fd',
        label: 'My location',
        km: 6,
        lat: -8.7,
        lon: 115.2,
      }),
    );
    localStorage.setItem(
      'lunitidal:favorites',
      JSON.stringify([{ id: '-8.700,115.200', label: 'My location', lat: -8.7, lon: 115.2 }]),
    );
  });

  await page.goto('/');
  await page.waitForSelector('svg[role="slider"]');

  // The restored current location is healed (station name, not "my location").
  await expect(page.locator('header.locbar')).not.toContainText(/my location/i);

  // The saved favorite is migrated too (scope to the favorites list — the sheet itself
  // contains the "Use my location" button which legitimately says "my location").
  await page.getByTestId('change-location').click();
  const favs = page.getByTestId('favorites');
  await expect(favs).toBeVisible();
  await expect(favs).toContainText('★'); // a favorite entry exists
  await expect(favs).not.toContainText(/my location/i); // and it's been relabelled
});
