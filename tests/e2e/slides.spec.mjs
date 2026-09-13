import { test, expect } from '@playwright/test';

const DECK = '/tests/fixtures/slides.html';

test('loads every slide and shows the first', async ({ page }) => {
  await page.goto(DECK);
  await expect(page.locator('.deck > .slide')).toHaveCount(7);
  await expect(page.locator('.slide.active')).toHaveClass(/layout-title/);
});

test('keys step through fragments and slides and update the hash', async ({ page }) => {
  await page.goto(`${DECK}#3`);
  const active = page.locator('.slide.active');
  await expect(active.locator('h2')).toHaveText('A Content Slide');
  await expect(active.locator('.fragment.visible')).toHaveCount(0);

  await page.keyboard.press('ArrowRight');
  await expect(active.locator('.fragment.visible')).toHaveCount(1);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#4$/);

  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#3$/);
  await expect(page.locator('.slide.active .fragment.visible')).toHaveCount(2);
});

test('presenter window follows the audience window', async ({ page, context }) => {
  await page.goto(DECK);
  const presenter = await context.newPage();
  await presenter.goto(`${DECK}?presenter`);
  await expect(presenter.locator('.presenter')).toBeVisible();

  await page.bringToFront();
  await page.keyboard.press('End');
  await expect(presenter.locator('.p-count')).toHaveText('Slide 7 of 7');
});
