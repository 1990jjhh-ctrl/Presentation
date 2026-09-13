import { test, expect } from '@playwright/test';

async function openSpread(page) {
  await page.goto('/presentation.html#4');
  await page.waitForFunction(() => window.Deck?.book?.count > 0 && window.Deck.book.idle);
}

const zoomState = (page) => page.evaluate(() => window.Deck.book.zoom);
const sceneScale = (page) =>
  page.locator('.scene').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

test('clicking a section zooms into it and Esc zooms out', async ({ page }) => {
  await openSpread(page);
  await page.locator('.book .page[data-index="3"] [data-zoom]').first().click();
  expect(await zoomState(page)).toEqual({ page: 3, index: 0 });
  await expect(page.locator('.viewport')).toHaveClass(/is-zoomed/);
  await expect.poll(() => sceneScale(page)).toBeGreaterThan(1.5);

  await page.keyboard.press('Escape');
  expect(await zoomState(page)).toBeNull();
  await expect.poll(() => sceneScale(page)).toBe(1);
});

test('Next zooms out instead of turning the page', async ({ page }) => {
  await openSpread(page);
  await page.locator('.book .page[data-index="4"] [data-zoom]').last().click();
  expect(await zoomState(page)).toEqual({ page: 4, index: 1 });

  await page.keyboard.press('ArrowRight');
  expect(await zoomState(page)).toBeNull();
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/#4$/);
});

test('clicking another section switches; clicking outside zooms out', async ({ page }) => {
  await openSpread(page);
  const sections = page.locator('.book .page[data-index="3"] [data-zoom]');
  await sections.nth(0).click();
  // The second section is off-screen while zoomed, so dispatch the click directly
  await sections.nth(1).dispatchEvent('click');
  expect(await zoomState(page)).toEqual({ page: 3, index: 1 });

  await page.mouse.click(5, 5);
  expect(await zoomState(page)).toBeNull();
});

test('dragging a corner does not turn the page while zoomed', async ({ page }) => {
  await openSpread(page);
  const b = await page.evaluate(() => window.Deck.book.bounds);
  await page.locator('.book [data-zoom]').first().click();

  const y = b.top + b.height - 8;
  await page.mouse.move(b.left + b.width - 8, y);
  await page.mouse.down();
  await page.mouse.move(b.left + 40, y, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/#4$/);
});

test('videos in a zoomed section play on zoom in and pause on zoom out', async ({ page }) => {
  await openSpread(page);
  await page.evaluate(() => {
    const calls = (window.mediaCalls = []);
    HTMLMediaElement.prototype.play = function play() { calls.push('play'); return Promise.resolve(); };
    HTMLMediaElement.prototype.pause = function pause() { calls.push('pause'); };
    document.querySelector('.book .page[data-index="4"] div[data-zoom]').append(document.createElement('video'));
  });

  await page.locator('.book .page[data-index="4"] div[data-zoom]').click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.mediaCalls)).toEqual(['play', 'pause']);
});

test('clicking a section in the presenter preview zooms the audience window', async ({ page, context }) => {
  await openSpread(page);
  const presenter = await context.newPage();
  await presenter.goto('/presentation.html?presenter#4');
  await expect(presenter.locator('.p-count')).toHaveText('Pages 4–5 of 8');

  await presenter.locator('.p-current .preview-page[data-index="4"] [data-zoom]').first().click();
  await expect.poll(() => zoomState(page)).toEqual({ page: 4, index: 0 });
  await expect(presenter.locator('.p-current .is-zoom-target')).toHaveCount(1);

  await presenter.keyboard.press('Escape');
  await expect.poll(() => zoomState(page)).toBeNull();
  await expect(presenter.locator('.p-current .is-zoom-target')).toHaveCount(0);
});
