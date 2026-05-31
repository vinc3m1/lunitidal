import { expect, test } from './fixtures';

test.describe('Marine Card Interactive Sync and Drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the tide chart to render
    await page.waitForSelector('svg[role="slider"]');
    // Wait for the marine card and chart to load and render
    await page.waitForSelector('[data-testid="marine-chart-container"] svg');
  });

  test('shows where the waves are sampled — offshore label + map marker', async ({ page }) => {
    // The marine mock reports a grid cell several km offshore of the Benoa seed.
    await expect(page.getByTestId('marine-source')).toContainText('offshore');
    // And the home map marks that sampled cell.
    await expect(
      page.getByTestId('home-map').getByTestId('marine-sample-marker'),
    ).toBeVisible();
  });

  test('ensures Tide chart and Marine chart have identical widths for perfect scale alignment', async ({ page }) => {
    const tideBox = await page.locator('svg[role="slider"]').first().boundingBox();
    const marineBox = await page.locator('[data-testid="marine-chart-container"] svg').boundingBox();

    if (!tideBox || !marineBox) {
      throw new Error('Could not find bounding boxes for the charts');
    }

    // The two SVG charts must have exactly matching width dimensions so their scales align
    expect(marineBox.width).toBeCloseTo(tideBox.width, 1);
  });

  test('scrubbing/dragging the tide chart updates and syncs the marine card selected point', async ({ page }) => {
    const activeTime = page.getByTestId('marine-active-time');
    const initialTimeText = (await activeTime.innerText()).trim();

    const tideBox = await page.locator('svg[role="slider"]').first().boundingBox();
    if (!tideBox) throw new Error('No tide chart bounding box');

    // Drag the tide chart from 20% to 80% width
    await page.mouse.move(tideBox.x + tideBox.width * 0.2, tideBox.y + tideBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tideBox.x + tideBox.width * 0.8, tideBox.y + tideBox.height / 2, { steps: 10 });
    await page.mouse.up();

    // Verify that the active time readout on the marine card updated to a new snapped time
    const newTimeText = (await activeTime.innerText()).trim();
    expect(newTimeText).not.toBe(initialTimeText);
  });

  test('scrubbing/dragging the marine chart snaps to hour and syncs the tide chart', async ({ page }) => {
    const tideSlider = page.locator('svg[role="slider"]').first();
    const initialTideVal = await tideSlider.getAttribute('aria-valuenow');

    const marineBox = await page.locator('[data-testid="marine-chart-container"] svg').boundingBox();
    if (!marineBox) throw new Error('No marine chart bounding box');

    // Drag the marine chart from 30% to 70% width
    await page.mouse.move(marineBox.x + marineBox.width * 0.3, marineBox.y + marineBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(marineBox.x + marineBox.width * 0.7, marineBox.y + marineBox.height / 2, { steps: 10 });
    await page.mouse.up();

    // Verify that the tide chart's slider value updated and synced to the marine chart's snap point
    const newTideVal = await tideSlider.getAttribute('aria-valuenow');
    expect(newTideVal).not.toBe(initialTideVal);
  });
});
