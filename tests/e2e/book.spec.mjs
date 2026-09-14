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

test('a key pressed while a page is turning is applied after the turn', async ({ page }) => {
  await openBook(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#4$/);
  await page.waitForFunction(() => window.Deck.book.idle);
  expect(await page.evaluate(() => window.Deck.book.start)).toBe(3);
});

test('StPageFlip draws into a box exactly the size of the book, also after a resize', async ({ page }) => {
  const mismatch = () => page.evaluate(() => {
    const shift = document.querySelector('.book-shift').getBoundingClientRect();
    const b = window.Deck.book.bounds;
    return Math.max(
      Math.abs(b.left - shift.left),
      Math.abs(b.top - shift.top),
      Math.abs(b.width - shift.width),
      Math.abs(b.height - shift.height),
    );
  });

  await openBook(page, `${BOOK}#2`);
  expect(await mismatch()).toBeLessThan(1);

  await page.setViewportSize({ width: 800, height: 1000 });
  await expect.poll(mismatch).toBeLessThan(1);
});

test('a turning cover stays attached to the spine', async ({ page }) => {
  await openBook(page);
  await expect.poll(() => shiftX(page)).toBeLessThan(-10);

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() =>
    getComputedStyle(document.querySelector('.book .page[data-index="1"]')).display !== 'none');
  await page.waitForTimeout(300);

  const gap = await page.evaluate(() => {
    const b = window.Deck.book.bounds;
    const inside = document.querySelector('.book .page[data-index="1"]').getBoundingClientRect();
    return Math.abs(inside.right - (b.left + b.pageWidth));
  });
  expect(gap).toBeLessThan(3);
});

test('a closed book is already centred on load and after a resize, without sliding', async ({ page }) => {
  await openBook(page);
  const expected = () => page.evaluate(() => -window.Deck.book.bounds.pageWidth / 2);
  expect(Math.abs((await shiftX(page)) - (await expected()))).toBeLessThan(1);

  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(100);
  expect(Math.abs((await shiftX(page)) - (await expected()))).toBeLessThan(1);
});

test('closing the book slides it to the centre while the cover turns', async ({ page }) => {
  await openBook(page, `${BOOK}#6`);
  await page.waitForFunction(() => window.Deck.book.idle);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.Deck.book.idle)).toBe(false);
  expect(await shiftX(page)).toBeGreaterThan(10);
  await page.waitForFunction(() => window.Deck.book.idle);
  await expect(page).toHaveURL(/#8$/);
});

test('a hash change while a page is turning lands on that spread', async ({ page }) => {
  await openBook(page, `${BOOK}#2`);
  await page.waitForFunction(() => window.Deck.book.idle);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.Deck.book.idle);
  await page.evaluate(() => { location.hash = '#6'; });
  await page.waitForFunction(() => window.Deck.book.idle && window.Deck.book.start === 5);
  await expect(page).toHaveURL(/#6$/);
});
