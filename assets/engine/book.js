// Book mode — the deck is a book. StPageFlip turns the pages: the first two and
// last two pages are stiff covers, inner pages curl and can be dragged by hand.
// The presenter window has no live book; it shows static spreads instead.

const Deck = (window.Deck ??= {});
Deck.modes ??= {};

const model = Deck.bookModel;
const FLIP_MS = 800;
const BUSY_STATES = ['flipping', 'user_fold'];

let deck = null;
let pages = [];
let count = 0;
let start = 0;            // first page of the visible spread
let pageFlip = null;      // StPageFlip instance, audience window only
let presenter = null;     // presenter panes, presenter window only
const els = {};
let pendingRemote = null; // spread requested by the other window; not echoed back
let queued = null;        // turn requested while a page was still moving
let ready = false;

const state = () => ({ type: 'state', page: start });
const isBusy = () => pageFlip !== null && BUSY_STATES.includes(pageFlip.getState());

// ---------------------------------------------------------------- pages

function preparePages() {
  pages = [...deck.querySelectorAll(':scope > .page')];
  if (pages.length < model.MIN_PAGES) return false;

  const blank = model.blankPageIndex(pages.length);
  if (blank !== -1) {
    const filler = document.createElement('section');
    filler.className = 'page page-blank';
    pages[blank].before(filler);
    pages.splice(blank, 0, filler);
  }
  count = pages.length;

  pages.forEach((page, i) => {
    const canvas = document.createElement('div');
    canvas.className = 'page-canvas';
    canvas.append(...page.childNodes);
    page.append(canvas);
    page.dataset.index = String(i);
    page.dataset.density = model.isStiff(i, count) ? 'hard' : 'soft';
  });
  return true;
}

function showTooFewPages() {
  deck.insertAdjacentHTML('beforeend', `
    <section class="book-error">
      <h2>A book needs at least ${model.MIN_PAGES} pages</h2>
      <p>Front cover, inside front cover, inside back cover and back cover. This book has ${pages.length}.</p>
    </section>`);
}

function pageTitle(page, index) {
  return page.dataset.title
    ?? page.querySelector('h1, h2, h3')?.textContent.trim()
    ?? `Page ${index + 1}`;
}

// ---------------------------------------------------------------- live book

function buildScene() {
  deck.parentElement.insertAdjacentHTML('beforeend', `
    <div class="scene">
      <div class="book-shift" style="--flip-ms: ${FLIP_MS}ms">
        <div class="book"></div>
      </div>
    </div>`);
  els.scene = deck.parentElement.querySelector('.scene');
  els.shift = els.scene.querySelector('.book-shift');
  els.book = els.scene.querySelector('.book');
}

function createBook() {
  pageFlip = new window.St.PageFlip(els.book, {
    width: model.PAGE_WIDTH,
    height: model.PAGE_HEIGHT,
    size: 'stretch',
    minWidth: 100,
    maxWidth: 4000,
    minHeight: 141,
    maxHeight: 5656,
    showCover: true,
    usePortrait: false,
    autoSize: false,
    disableFlipByClick: true,
    mobileScrollSupport: false,
    flippingTime: FLIP_MS,
    maxShadowOpacity: 0.5,
    startPage: start,
  });
  pageFlip.on('flip', (e) => onFlip(e.data));
  pageFlip.on('changeState', (e) => onState(e.data));
  pageFlip.loadFromHTML(pages);

  // Registered after StPageFlip's own resize listener, so its bounds are current
  addEventListener('resize', applyLayout);
  applyLayout();
}

function applyLayout() {
  if (!pageFlip) return;
  const { pageWidth } = pageFlip.getBoundsRect();
  els.shift.style.setProperty('--page-scale', pageWidth / model.PAGE_WIDTH);
  els.shift.style.transform = `translateX(${model.closedOffset(start, count, pageWidth)}px)`;
}

function onFlip(newStart) {
  start = newStart;
  if (!ready) return;
  applyLayout();
  const silent = pendingRemote === start;
  if (silent) pendingRemote = null;
  spreadChanged({ silent });
}

function onState(flipState) {
  // Opening a closed book: slide to the open position while the cover turns
  if (flipState === 'flipping' && (start === 0 || start === count - 1)) {
    els.shift.style.transform = 'translateX(0px)';
  }
  if (BUSY_STATES.includes(flipState)) return;

  // At rest again (also after a drag that snapped back)
  applyLayout();
  if (queued) {
    const { target, silent } = queued;
    queued = null;
    turnTo(target, { silent });
  }
}

// ---------------------------------------------------------------- navigation

// StPageFlip 2.0.7's flipNext/flipPrev start from a point that ignores the book's
// offset inside its block, so its corner check rejects them while
// disableFlipByClick is on. Start the turn from a real bottom corner instead,
// preparing the spread index the way its own flipToPage does.
function flipTo(target) {
  const collection = pageFlip.getPageCollection();
  const current = collection.getCurrentSpreadIndex();
  const next = collection.getSpreadIndexByPage(target);
  if (next === null || next === current) return;

  const forward = next > current;
  collection.setCurrentSpreadIndex(forward ? next - 1 : next + 1);
  const rect = pageFlip.getBoundsRect();
  pageFlip.getFlipController().flip({
    x: rect.left + (forward ? rect.width - 10 : 10),
    y: rect.top + rect.height - 2,
  });
}

function turnTo(page, { silent = false } = {}) {
  const target = model.spreadStart(page, count);

  if (!pageFlip) {
    if (target === start) return;
    start = target;
    spreadChanged({ silent });
    return;
  }
  if (isBusy()) {
    queued = { target, silent };
    return;
  }
  if (target === start) return;
  if (silent) pendingRemote = target;
  flipTo(target);
}

// Runs for every new spread, however it was reached
function spreadChanged({ silent }) {
  Deck.setHash(model.hashFromStart(start));
  refresh();
  if (!silent) Deck.send(state());
}

// Re-renders everything that depends on the visible spread
function refresh() {
  if (presenter) {
    const visible = model.spreadPages(start, count).map((p) => p + 1);
    presenter.count.textContent = `${visible.length === 1 ? 'Page' : 'Pages'} ${visible.join('–')} of ${count}`;
  }
}

// ---------------------------------------------------------------- mode

Deck.modes.book = {
  handlesTouch: true,

  init({ deck: root, presenter: panes }) {
    deck = root;
    if (!preparePages()) {
      showTooFewPages();
      return;
    }
    start = model.startFromHash(Deck.hashNumber(), count);

    if (panes) {
      presenter = panes;
    } else {
      buildScene();
      createBook();
    }
    ready = true;
    refresh();
  },

  next: () => turnTo(model.nextSpread(queued?.target ?? start, count)),
  prev: () => turnTo(model.prevSpread(queued?.target ?? start, count)),
  first: () => turnTo(0),
  last: () => turnTo(count - 1),

  goToHash(n, { silent = false } = {}) {
    if (count === 0) return;
    const target = model.startFromHash(n, count);
    if (target === start) {
      Deck.setHash(model.hashFromStart(start));
      return;
    }
    if (!pageFlip) {
      start = target;
      spreadChanged({ silent });
      return;
    }
    if (silent) pendingRemote = target;
    pageFlip.turnToPage(target); // no animation; fires 'flip'
  },

  state,

  receive(msg) {
    if (msg.type === 'state') turnTo(msg.page, { silent: true });
  },
};

// Read-only hooks for the browser tests
Deck.book = {
  get start() { return start; },
  get count() { return count; },
  get idle() { return !isBusy() && queued === null; },
  get bounds() {
    const block = els.book?.querySelector('.stf__block')?.getBoundingClientRect();
    const rect = pageFlip?.getBoundsRect();
    return block && rect
      ? { left: block.left + rect.left, top: block.top + rect.top, width: rect.width, height: rect.height, pageWidth: rect.pageWidth }
      : null;
  },
};
