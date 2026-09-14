import { test, expect } from '@playwright/test';

async function openBook(page, hash) {
  await page.goto(`/presentation.html${hash}`);
  await page.waitForFunction(() => window.Deck?.book?.count > 0 && window.Deck.book.idle);
}

test('the page stack shows hidden pages on the correct sides', async ({ page }) => {
  await openBook(page, '#2'); // spread [1, 2]: only the inside front cover lies to the left
  await expect(page.locator('.stack-left')).toBeVisible();
  await expect(page.locator('.stack-right')).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#4$/);
  await expect(page.locator('.stack-left')).toBeVisible();
  await expect(page.locator('.stack-right')).toBeVisible();
});

test('a closed book hides its pages under the covers', async ({ page }) => {
  await openBook(page, '#1');
  await expect(page.locator('.stack-left')).toBeHidden();
  await expect(page.locator('.stack-right')).toBeHidden();
  await expect(page.locator('.tab')).toHaveCount(2);
  await expect(page.locator('.tab').first()).toBeHidden();

  // The pages under the lifting cover appear at once; the side it lands on waits
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !window.Deck.book.idle);
  await expect(page.locator('.stack-left')).toBeHidden();
  await expect(page.locator('.tab').nth(0)).toBeHidden(); // 'Edge detection' ends up on the left
  await expect(page.locator('.stack-right')).toBeVisible();
  await expect(page.locator('.tab').nth(1)).toBeVisible();

  await page.waitForFunction(() => window.Deck.book.idle);
  await expect(page.locator('.stack-left')).toBeVisible();
  await expect(page.locator('.tab').nth(0)).toBeVisible();
  await page.keyboard.press('End');
  // The chapter tabs are gone before the closing cover comes down; the stack stays meanwhile
  // (read once, mid-turn: a retrying toBeHidden would also pass after the cover lands)
  await page.waitForFunction(() => !window.Deck.book.idle);
  expect(await page.evaluate(() => [...document.querySelectorAll('.tab')].every((t) => !t.checkVisibility())))
    .toBe(true);
  expect(await page.evaluate(() => !document.querySelector('.stack-left').hidden)).toBe(true);
  await page.waitForFunction(() => window.Deck.book.idle && window.Deck.book.start === 7);
  await expect(page.locator('.stack-left')).toBeHidden();
  await expect(page.locator('.stack-right')).toBeHidden();
  await expect(page.locator('.tab').first()).toBeHidden();
});

test('hovering the stack edge names a page and clicking turns to it', async ({ page }) => {
  await openBook(page, '#2'); // spread [1, 2]; the right stack holds pages 3–7
  const box = await page.locator('.stack-right').boundingBox();
  const y = box.y + box.height / 2;

  await page.mouse.move(box.x + box.width - 1, y);
  await expect(page.locator('.stack-label')).toHaveText('8 · Back cover');

  await page.mouse.move(box.x + 1, y);
  await expect(page.locator('.stack-label')).toHaveText('4 · Derivatives');

  await page.mouse.click(box.x + 1, y);
  await expect(page).toHaveURL(/#4$/);
});

test('chapter tabs sit on the right while ahead, move left once passed, and jump', async ({ page }) => {
  await openBook(page, '#2');
  const tabs = page.locator('.tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveText('Edge detection');
  await expect(tabs.nth(0)).toHaveAttribute('data-side', 'left'); // its page is visible
  await expect(tabs.nth(1)).toHaveAttribute('data-side', 'right');

  await tabs.nth(1).click();
  await expect(page).toHaveURL(/#6$/);
  await expect(tabs.nth(0)).toHaveAttribute('data-side', 'left');
  await expect(tabs.nth(1)).toHaveAttribute('data-side', 'left');
});

test('while zoomed, a tab click only zooms out', async ({ page }) => {
  await openBook(page, '#4');
  await page.locator('.book [data-zoom]').first().click();
  await page.locator('.tab').nth(1).dispatchEvent('click');
  expect(await page.evaluate(() => window.Deck.book.zoom)).toBeNull();
  await page.waitForTimeout(1200);
  await expect(page).toHaveURL(/#4$/);
});
