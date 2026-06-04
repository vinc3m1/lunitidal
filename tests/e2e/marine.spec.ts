import { expect, test } from './fixtures';

test.describe('Marine Card Interactive Sync and Drag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the tide chart to render
    await page.waitForSelector('svg[role="slider"]');
    // Wait for the marine card and chart to load and render
    await page.waitForSelector('[data-testid="marine-chart-container"] svg');
  });

  test('shows where the waves are sampled — distance + compass label + map marker', async ({ page }) => {
    // The marine mock reports a grid cell several km from the Benoa seed; the label states
    // the distance and a compass bearing toward that cell (e.g. "~5 km SE"), not "offshore".
    const source = page.getByTestId('marine-source');
    await expect(source).toContainText(/~[\d.]+\s*(km|mi)\s+(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)\b/);
    await expect(source).not.toContainText('offshore');
    // And the home map marks that sampled cell.
    await expect(
      page.getByTestId('home-map').getByTestId('marine-sample-marker'),
    ).toBeVisible();
  });

  test('the ⓘ button opens a popover explaining the grid-cell snapping', async ({ page }) => {
    const info = page.getByTestId('marine-info');
    await expect(info).toHaveCount(0); // closed by default
    await page.getByTestId('marine-info-btn').click();
    await expect(info).toBeVisible();
    await expect(info).toContainText(/grid|cell|water/i);
    // Escape closes it again.
    await page.keyboard.press('Escape');
    await expect(info).toHaveCount(0);
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

    const tideBox = await page.locator('svg[role="slider"]').first().boundingBox();
    if (!tideBox) throw new Error('No tide chart bounding box');

    // Scrub the tide chart to two fixed, far-apart positions and compare the marine readout at
    // each. Comparing two *controlled* positions — rather than "now" vs one position — keeps this
    // independent of the wall-clock time the suite runs at. (Previously, when the run landed near
    // the drag target's hour, the readout matched "now" and the test flaked.)
    const scrubTideTo = async (frac: number) => {
      await page.mouse.move(tideBox.x + tideBox.width * frac, tideBox.y + tideBox.height / 2);
      await page.mouse.down();
      await page.mouse.up();
    };

    await scrubTideTo(0.2);
    const earlyTime = (await activeTime.innerText()).trim();
    await scrubTideTo(0.8);

    // The marine active-time tracks the tide scrub to a different snapped hour.
    await expect(activeTime).not.toHaveText(earlyTime);
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
