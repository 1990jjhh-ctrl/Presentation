import { test, expect } from '@playwright/test';

test('presenter view shows the current and next spread with labelled notes', async ({ page }) => {
  await page.goto('/presentation.html?presenter#4');
  await expect(page.locator('.p-count')).toHaveText('Pages 4–5 of 8');

  const current = page.locator('.p-current .preview-page');
  await expect(current).toHaveCount(2);
  await expect(current.first()).toHaveAttribute('data-index', '3');
  await expect(page.locator('.p-next .preview-page').first()).toHaveAttribute('data-index', '5');

  const notes = page.locator('.p-notes-body');
  await expect(notes).toContainText('Left');
  await expect(notes).toContainText('Compare the thick Sobel edges');
  await expect(notes).toContainText('Right');
  await expect(notes).toContainText('Canny is the method we use');
});

test('a closed cover shows one page, and the last spread shows "End of book"', async ({ page }) => {
  await page.goto('/presentation.html?presenter#1');
  await expect(page.locator('.p-current .preview-page')).toHaveCount(1);
  await expect(page.locator('.p-notes-body')).toContainText('Cover');

  await page.keyboard.press('End');
  await expect(page.locator('.p-next')).toHaveClass(/is-end/);
  await expect(page.locator('.p-end')).toHaveText('End of book');
});

test('presenter and audience windows follow each other', async ({ page, context }) => {
  await page.goto('/presentation.html');
  await page.waitForFunction(() => window.Deck?.book?.count > 0);

  const presenter = await context.newPage();
  await presenter.goto('/presentation.html?presenter');
  await expect(presenter.locator('.p-count')).toHaveText('Page 1 of 8');

  await presenter.bringToFront();
  await presenter.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#2$/);

  await page.bringToFront();
  await page.keyboard.press('ArrowRight');
  await expect(presenter.locator('.p-count')).toHaveText('Pages 4–5 of 8');
});

test('the presenter window keeps the original pages hidden', async ({ page }) => {
  await page.goto('/presentation.html?presenter#4');
  await expect(page.locator('.p-count')).toHaveText('Pages 4–5 of 8');
  await expect(page.locator('main.deck')).toBeHidden();
});

test('only the Current preview offers zoom', async ({ page }) => {
  await page.goto('/presentation.html?presenter#2');
  await expect(page.locator('.p-count')).toHaveText('Pages 2–3 of 8');
  const next = page.locator('.p-next .preview-page[data-index="3"] [data-zoom]').first();
  expect(await next.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('zoom-in');
});
