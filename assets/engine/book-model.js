// Book model — pure book logic with no DOM access, unit-tested in Node.
// Pages are 0-based. Spreads follow StPageFlip with showCover:
// [0], [1, 2], [3, 4], …, [count - 1].

const Deck = (window.Deck ??= {});

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1414;
const MIN_PAGES = 4;
const ZOOM_FILL = 0.85;
const TAB_MAX_HEIGHT = 120;
const BOOK_MARGIN_X = 0.04; // of the scene width, on each side
const BOOK_MARGIN_Y = 0.05; // of the scene height, at top and bottom

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Index where a blank page goes to make the page count even, or -1
const blankPageIndex = (count) => (count % 2 === 1 ? count - 2 : -1);

// Covers and their insides are stiff
const isStiff = (page, count) => page < 2 || page >= count - 2;

const spreadStart = (page, count) => {
  const p = clamp(page, 0, count - 1);
  if (p === 0 || p === count - 1) return p;
  return p % 2 === 1 ? p : p - 1;
};

const spreadPages = (start, count) =>
  start === 0 || start === count - 1 ? [start] : [start, start + 1];

const nextSpread = (start, count) => (start === 0 ? 1 : Math.min(start + 2, count - 1));
const prevSpread = (start, count) => (start === count - 1 ? count - 3 : Math.max(start - 2, 0));

const startFromHash = (n, count) => spreadStart(n - 1, count);
const hashFromStart = (start) => start + 1;

// StPageFlip keeps the spine centred, so a closed book is shifted by half a page
const closedOffset = (start, count, pageWidth) => {
  if (start === 0) return -pageWidth / 2;
  if (start === count - 1) return pageWidth / 2;
  return 0;
};

const stackCounts = (start, count) => {
  const visible = spreadPages(start, count);
  return { left: start, right: count - 1 - visible[visible.length - 1] };
};

// depth runs from 0 next to the visible pages to 1 at the outer edge
const pageAtStackDepth = (side, depth, start, count) => {
  const { left, right } = stackCounts(start, count);
  const d = clamp(depth, 0, 0.999999);
  if (side === 'left') return left === 0 ? null : start - 1 - Math.floor(d * left);
  if (right === 0) return null;
  const visible = spreadPages(start, count);
  return visible[visible.length - 1] + 1 + Math.floor(d * right);
};

const tabSide = (chapterPage, start, count) => {
  const visible = spreadPages(start, count);
  return chapterPage <= visible[visible.length - 1] ? 'left' : 'right';
};

const tabLayout = (chapters, pageHeight, pageScale) => {
  if (chapters.length === 0) return [];
  const height = Math.min(TAB_MAX_HEIGHT * pageScale, pageHeight / chapters.length);
  return chapters.map((chapter, i) => ({ ...chapter, top: i * height, height }));
};

// Transform (origin 0 0) that centres target in viewport at 85 % of the limiting side
const zoomTransform = (target, viewport) => {
  const scale = ZOOM_FILL * Math.min(viewport.width / target.width, viewport.height / target.height);
  return {
    scale,
    x: viewport.width / 2 - (target.x + target.width / 2) * scale,
    y: viewport.height / 2 - (target.y + target.height / 2) * scale,
  };
};

const notesLabels = (start, count) =>
  spreadPages(start, count).length === 1 ? ['Cover'] : ['Left', 'Right'];

// Largest open (two-page) book that fits the scene inside its margins, centred.
// StPageFlip needs a container of exactly this size: it draws turning stiff pages
// as if the book filled its container.
const fitBook = (scene) => {
  const width = scene.width * (1 - 2 * BOOK_MARGIN_X);
  const height = scene.height * (1 - 2 * BOOK_MARGIN_Y);
  const pageWidth = Math.min(width / 2, (height * PAGE_WIDTH) / PAGE_HEIGHT);
  const pageHeight = (pageWidth * PAGE_HEIGHT) / PAGE_WIDTH;
  return {
    left: (scene.width - 2 * pageWidth) / 2,
    top: (scene.height - pageHeight) / 2,
    width: 2 * pageWidth,
    height: pageHeight,
  };
};

Deck.bookModel = {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MIN_PAGES,
  blankPageIndex,
  isStiff,
  spreadStart,
  spreadPages,
  nextSpread,
  prevSpread,
  startFromHash,
  hashFromStart,
  closedOffset,
  stackCounts,
  pageAtStackDepth,
  tabSide,
  tabLayout,
  zoomTransform,
  notesLabels,
  fitBook,
};
