import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDeck } from './load-engine.mjs';

const model = loadDeck('book-model.js').bookModel;

// Arrays and objects created inside the vm context have their own prototypes,
// so compare plain JSON copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('page canvas constants', () => {
  assert.equal(model.PAGE_WIDTH, 1000);
  assert.equal(model.PAGE_HEIGHT, 1414);
  assert.equal(model.MIN_PAGES, 4);
});

test('blankPageIndex pads odd books before the inside back cover', () => {
  assert.equal(model.blankPageIndex(8), -1);
  assert.equal(model.blankPageIndex(7), 5);
  assert.equal(model.blankPageIndex(5), 3);
});

test('isStiff marks the two outer pages at each end', () => {
  const stiff = [0, 1, 2, 3, 4, 5, 6, 7].filter((p) => model.isStiff(p, 8));
  assert.deepEqual(stiff, [0, 1, 6, 7]);
  assert.deepEqual([0, 1, 2, 3].filter((p) => model.isStiff(p, 4)), [0, 1, 2, 3]);
});

test('spreadStart maps any page to the first page of its spread', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((p) => model.spreadStart(p, 8)), [0, 1, 1, 3, 3, 5, 5, 7]);
  assert.equal(model.spreadStart(-3, 8), 0);
  assert.equal(model.spreadStart(99, 8), 7);
});

test('spreadPages lists the visible pages', () => {
  assert.deepEqual(plain(model.spreadPages(0, 8)), [0]);
  assert.deepEqual(plain(model.spreadPages(3, 8)), [3, 4]);
  assert.deepEqual(plain(model.spreadPages(7, 8)), [7]);
});

test('nextSpread and prevSpread walk spreads and stop at the covers', () => {
  const forward = [0];
  while (forward.at(-1) !== 7) forward.push(model.nextSpread(forward.at(-1), 8));
  assert.deepEqual(forward, [0, 1, 3, 5, 7]);
  assert.equal(model.nextSpread(7, 8), 7);

  const back = [7];
  while (back.at(-1) !== 0) back.push(model.prevSpread(back.at(-1), 8));
  assert.deepEqual(back, [7, 5, 3, 1, 0]);
  assert.equal(model.prevSpread(0, 8), 0);

  assert.equal(model.nextSpread(1, 4), 3);
  assert.equal(model.prevSpread(3, 4), 1);
});

test('hash numbers normalise to spreads', () => {
  assert.equal(model.startFromHash(1, 8), 0);
  assert.equal(model.startFromHash(2, 8), 1);
  assert.equal(model.startFromHash(3, 8), 1);
  assert.equal(model.startFromHash(8, 8), 7);
  assert.equal(model.startFromHash(50, 8), 7);
  assert.equal(model.hashFromStart(0), 1);
  assert.equal(model.hashFromStart(5), 6);
});

test('closedOffset centres closed covers', () => {
  assert.equal(model.closedOffset(0, 8, 400), -200);
  assert.equal(model.closedOffset(3, 8, 400), 0);
  assert.equal(model.closedOffset(7, 8, 400), 200);
});

test('stackCounts counts hidden pages on each side', () => {
  assert.deepEqual(plain(model.stackCounts(0, 8)), { left: 0, right: 7 });
  assert.deepEqual(plain(model.stackCounts(3, 8)), { left: 3, right: 3 });
  assert.deepEqual(plain(model.stackCounts(7, 8)), { left: 7, right: 0 });
});

test('pageAtStackDepth picks pages from the spine outwards', () => {
  // spread [3, 4]: left stack holds 0–2, right stack holds 5–7
  assert.equal(model.pageAtStackDepth('left', 0, 3, 8), 2);
  assert.equal(model.pageAtStackDepth('left', 0.5, 3, 8), 1);
  assert.equal(model.pageAtStackDepth('left', 1, 3, 8), 0);
  assert.equal(model.pageAtStackDepth('right', 0, 3, 8), 5);
  assert.equal(model.pageAtStackDepth('right', 1, 3, 8), 7);
  assert.equal(model.pageAtStackDepth('left', 0.5, 0, 8), null);
  assert.equal(model.pageAtStackDepth('right', 0.5, 7, 8), null);
});

test('tabSide puts visible and passed chapters on the left', () => {
  assert.equal(model.tabSide(2, 0, 8), 'right');
  assert.equal(model.tabSide(2, 1, 8), 'left');
  assert.equal(model.tabSide(5, 3, 8), 'right');
  assert.equal(model.tabSide(5, 7, 8), 'left');
});

test('tabLayout staggers tabs and caps their height', () => {
  const chapters = [{ page: 2, title: 'A' }, { page: 5, title: 'B' }];
  assert.deepEqual(plain(model.tabLayout(chapters, 1000, 0.5)), [
    { page: 2, title: 'A', top: 0, height: 60 },
    { page: 5, title: 'B', top: 60, height: 60 },
  ]);
  const many = Array.from({ length: 20 }, (_, i) => ({ page: i, title: String(i) }));
  const layout = model.tabLayout(many, 1000, 1);
  assert.equal(layout[0].height, 50);
  assert.equal(layout[19].top, 950);
  assert.deepEqual(plain(model.tabLayout([], 1000, 1)), []);
});

test('zoomTransform centres the target and fills 85 % of the limiting side', () => {
  const t = model.zoomTransform({ x: 100, y: 50, width: 200, height: 100 }, { width: 1000, height: 1000 });
  assert.equal(t.scale, 4.25);
  assert.equal(t.x + (100 + 100) * t.scale, 500);
  assert.equal(t.y + (50 + 50) * t.scale, 500);

  const tall = model.zoomTransform({ x: 0, y: 0, width: 100, height: 400 }, { width: 1600, height: 800 });
  assert.equal(tall.scale, 1.7);
});

test('notesLabels names the visible pages', () => {
  assert.deepEqual(plain(model.notesLabels(0, 8)), ['Cover']);
  assert.deepEqual(plain(model.notesLabels(3, 8)), ['Left', 'Right']);
  assert.deepEqual(plain(model.notesLabels(7, 8)), ['Cover']);
});

test('fitBook centres the largest open book inside the margins', () => {
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

  // Wide scene: the height limits the book
  const wide = plain(model.fitBook({ width: 1280, height: 720 }));
  const widePage = (720 * 0.9 * 1000) / 1414;
  close(wide.height, 648);
  close(wide.width, 2 * widePage);
  close(wide.left, (1280 - 2 * widePage) / 2);
  close(wide.top, 36);

  // Tall scene: the width limits the book
  const tall = plain(model.fitBook({ width: 800, height: 1000 }));
  close(tall.width, 736);
  close(tall.left, 32);
  close(tall.height, (368 * 1414) / 1000);
  close(tall.top, (1000 - (368 * 1414) / 1000) / 2);
});
