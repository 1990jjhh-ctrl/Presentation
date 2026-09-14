import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('the built file works from disk without a server', async ({ page }) => {
  const output = execFileSync('node', ['scripts/build.mjs'], { cwd: root, encoding: 'utf8' });
  expect(output).toContain('— 8 pages,');

  const built = pathToFileURL(join(root, 'dist', `${basename(root)}.html`)).href;
  await page.goto(`${built}#4`);
  await page.waitForFunction(() => window.Deck?.book?.count === 8 && window.Deck.book.idle);
  await expect(page.locator('.book .page[data-index="3"] img').first())
    .toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);

  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#6$/);
});

test('printing a book gives one A4 page per book page', async ({ page }) => {
  await page.goto('/presentation.html#4');
  await page.waitForFunction(() => window.Deck?.book?.count === 8);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? [];
  expect(pages.length).toBe(8);
  const boxes = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+[\d.]+\s*\]/g) ?? [];
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    const [, width, height] = box.match(/([\d.]+)\s+([\d.]+)\s*\]$/);
    expect(Math.abs(Number(width) - 595)).toBeLessThan(2);
    expect(Math.abs(Number(height) - 842)).toBeLessThan(2);
  }
});
