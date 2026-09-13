import { test, expect } from '@playwright/test';

const BOOK = '/presentation.html';

async function openBook(page, url = BOOK) {
  await page.goto(url);
  await page.waitForFunction(() => window.Deck?.book?.count > 0);
}

const shiftX = (page) =>
  page.locator('.book-shift').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test('opens closed on the front cover, shifted to the centre', async ({ page }) => {
  await openBook(page);
  await expect(page.locator('.book .page')).toHaveCount(8);
  await expect(page.locator('.book .page[data-density="hard"]')).toHaveCount(4);
  const fits = await page.evaluate(() => {
    const book = window.Deck.book.bounds;
    const box = document.querySelector('.book-shift').getBoundingClientRect();
    return book.height <= box.height + 1 && book.top >= box.top - 1;
  });
  expect(fits).toBe(true);
  expect(await page.evaluate(() => window.Deck.book.start)).toBe(0);
  await expect(page).toHaveURL(/#1$/);
  await expect.poll(() => shiftX(page)).toBeLessThan(-10);
});

test('arrow keys turn one spread at a time and open the book', async ({ page }) => {
  await openBook(page);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#2$/);
  await expect.poll(() => shiftX(page)).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#4$/);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#2$/);
});

test('a hash restores its spread and right-hand pages normalise', async ({ page }) => {
  await openBook(page, `${BOOK}#5`);
  await expect(page).toHaveURL(/#4$/);
  expect(await page.evaluate(() => window.Deck.book.start)).toBe(3);
  await page.reload();
  await page.waitForFunction(() => window.Deck?.book?.count > 0);
  expect(await page.evaluate(() => window.Deck.book.start)).toBe(3);
});

test('Home and End close the book on either cover', async ({ page }) => {
  await openBook(page, `${BOOK}#4`);
  await page.keyboard.press('End');
  await expect(page).toHaveURL(/#8$/);
  await expect.poll(() => shiftX(page)).toBeGreaterThan(10);
  await page.keyboard.press('Home');
  await expect(page).toHaveURL(/#1$/);
  await expect.poll(() => shiftX(page)).toBeLessThan(-10);
});

test('dragging the right-hand corner turns the page', async ({ page }) => {
  await openBook(page, `${BOOK}#2`);
  await expect.poll(() => shiftX(page)).toBe(0);
  const b = await page.evaluate(() => window.Deck.book.bounds);
  const y = b.top + b.height - 8;
  await page.mouse.move(b.left + b.width - 8, y);
  await page.mouse.down();
  await page.mouse.move(b.left + 40, y, { steps: 25 });
  await page.mouse.up();
  await expect(page).toHaveURL(/#4$/);
});

test('an odd page count gets a blank page before the inside back cover', async ({ page }) => {
  await openBook(page, '/tests/fixtures/book-odd.html');
  expect(await page.evaluate(() => window.Deck.book.count)).toBe(6);
  await expect(page.locator('.book .page').nth(3)).toHaveClass(/page-blank/);
});

test('fewer than four pages shows an explanation', async ({ page }) => {
  await page.goto('/tests/fixtures/book-short.html');
  await expect(page.locator('.book-error')).toContainText('at least 4 pages');
});
