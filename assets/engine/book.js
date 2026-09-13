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
let zoom = null;          // { page, index } of the zoomed [data-zoom] element
let queuedZoom = null;    // zoom requested while a page was still turning
let bookState = 'read';   // StPageFlip fires changeState before getState() updates, so mirror it here
let flipTarget = null;    // spread start of the turn currently in flight

const state = () => ({ type: 'state', page: start });
const isBusy = () => pageFlip !== null && BUSY_STATES.includes(bookState);

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
  bookState = flipState;
  // Opening a closed book: slide to the open position while the cover turns
  if (flipState === 'flipping' && (start === 0 || start === count - 1)) {
    els.shift.style.transform = 'translateX(0px)';
  }
  if (BUSY_STATES.includes(flipState)) return;

  // At rest again (also after a drag that snapped back)
  applyLayout();
  flipTarget = null;
  // StPageFlip assigns its new state only after this handler returns, so calls
  // back into the library wait until then
  if (queued || queuedZoom) queueMicrotask(replayQueued);
}

function replayQueued() {
  if (queued) {
    const { target, silent } = queued;
    queued = null;
    turnTo(target, { silent });
  }
  if (queuedZoom) {
    const { page, index, silent } = queuedZoom;
    queuedZoom = null;
    zoomTo(page, index, { silent });
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
  flipTarget = target;
  flipTo(target);
}

// Runs for every new spread, however it was reached
function spreadChanged({ silent }) {
  if (zoom && !model.spreadPages(start, count).includes(zoom.page)) zoomOut({ silent: true });
  Deck.setHash(model.hashFromStart(start));
  refresh();
  if (!silent) Deck.send(state());
}

// Re-renders everything that depends on the visible spread
function refresh() {
  if (presenter) refreshPresenter();
}

// ---------------------------------------------------------------- presenter view

function buildPresenterPreviews() {
  presenter.next.querySelector('.p-end').textContent = 'End of book';
  presenter.currentView = addPreview(presenter.current);
  presenter.nextView = addPreview(presenter.next);
}

function addPreview(pane) {
  pane.insertAdjacentHTML('beforeend', '<div class="viewport spread-viewport"><div class="spread-preview"></div></div>');
  const viewport = pane.lastElementChild;
  const spread = viewport.firstElementChild;
  Deck.fitToViewport(viewport, spread, model.PAGE_WIDTH * 2, model.PAGE_HEIGHT);
  return spread;
}

// Static copy of a spread, with each page where the open book would show it
function renderSpread(target, spreadStart) {
  const visible = model.spreadPages(spreadStart, count);
  target.replaceChildren(...visible.map((index, i) => {
    const side = visible.length === 2
      ? (i === 0 ? 'left' : 'right')
      : (index === 0 ? 'right' : 'left');
    const copy = document.createElement('div');
    copy.className = `preview-page ${pages[index].className} --${side}`;
    copy.dataset.index = String(index);
    copy.append(pages[index].querySelector('.page-canvas').cloneNode(true));
    return copy;
  }));
}

function refreshPresenter() {
  const visible = model.spreadPages(start, count);
  const next = model.nextSpread(start, count);
  const isEnd = next === start;

  renderSpread(presenter.currentView, start);
  presenter.next.classList.toggle('is-end', isEnd);
  if (!isEnd) renderSpread(presenter.nextView, next);

  const labels = model.notesLabels(start, count);
  presenter.notes.replaceChildren(...visible.map((index, i) => {
    const block = document.createElement('div');
    block.className = 'p-note';
    const label = document.createElement('strong');
    label.textContent = labels[i];
    const text = pages[index].querySelector('.notes')?.textContent.trim().replace(/[ \t]+/g, ' ');
    block.append(label, document.createTextNode(text || '—'));
    return block;
  }));

  const numbers = visible.map((p) => p + 1);
  presenter.count.textContent = `${numbers.length === 1 ? 'Page' : 'Pages'} ${numbers.join('–')} of ${count}`;
  markPresenterZoom();
}

// ---------------------------------------------------------------- zoom

const zoomables = (root) => [...root.querySelectorAll('[data-zoom]')];
const zoomState = () => (zoom ? { type: 'zoom', page: zoom.page, index: zoom.index } : { type: 'zoom', page: null });

function setupZoom() {
  els.viewport = deck.parentElement;
  els.hole = document.createElement('div');
  els.hole.className = 'zoom-hole';
  els.viewport.append(els.hole);

  // Pressing a zoomable section must not start a page turn
  for (const target of zoomables(els.book)) {
    target.addEventListener('mousedown', (e) => e.stopPropagation());
    target.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  // While zoomed, no press or pointer movement reaches StPageFlip
  const blockWhileZoomed = (e) => { if (zoom) e.stopPropagation(); };
  els.scene.addEventListener('mousedown', blockWhileZoomed, true);
  els.scene.addEventListener('touchstart', blockWhileZoomed, { capture: true, passive: true });
  addEventListener('mousemove', blockWhileZoomed, true);
  addEventListener('touchmove', blockWhileZoomed, { capture: true, passive: true });

  els.scene.addEventListener('click', (e) => {
    const target = e.target.closest('[data-zoom]');
    if (target && els.book.contains(target)) {
      const page = target.closest('.page');
      const pageIndex = Number(page.dataset.index);
      const index = zoomables(page).indexOf(target);
      if (zoom?.page === pageIndex && zoom.index === index) return; // keeps video controls usable
      zoomTo(pageIndex, index);
    } else if (zoom) {
      zoomOut();
    }
  });

  addEventListener('resize', () => { if (zoom) applyZoom(); });
}

function setupPresenterZoom() {
  presenter.currentView.addEventListener('click', (e) => {
    const target = e.target.closest('[data-zoom]');
    if (target) {
      const copy = target.closest('.preview-page');
      zoomTo(Number(copy.dataset.index), zoomables(copy).indexOf(target));
    } else if (zoom) {
      zoomOut();
    }
  });
}

function zoomTo(page, index, { silent = false } = {}) {
  // A page is still turning: apply the zoom once the book is at rest
  if (isBusy()) {
    queuedZoom = { page, index, silent };
    return;
  }

  const el = model.spreadPages(start, count).includes(page) ? zoomables(pages[page])[index] : null;
  if (!el) {
    // The audience tells the window that asked what it really shows
    if (silent && pageFlip) Deck.send(zoomState());
    return;
  }

  if (pageFlip) {
    if (zoom) setMedia(zoomables(pages[zoom.page])[zoom.index], false);
    zoom = { page, index };
    els.viewport.classList.add('is-zoomed');
    applyZoom();
    setMedia(el, true);
  } else {
    zoom = { page, index };
    markPresenterZoom();
  }
  if (!silent) Deck.send(zoomState());
}

function zoomOut({ silent = false } = {}) {
  queuedZoom = null;
  if (!zoom) return;
  if (pageFlip) {
    setMedia(zoomables(pages[zoom.page])[zoom.index], false);
    els.viewport.classList.remove('is-zoomed');
    els.scene.style.transform = '';
  }
  zoom = null;
  if (presenter) markPresenterZoom();
  if (!silent) Deck.send(zoomState());
}

function applyZoom() {
  const el = zoomables(pages[zoom.page])[zoom.index];
  const viewport = els.viewport.getBoundingClientRect();
  const camera = new DOMMatrix(getComputedStyle(els.scene).transform);
  const r = el.getBoundingClientRect();

  // Undo the current camera to get the element's place in the unzoomed scene
  const target = {
    x: (r.left - viewport.left - camera.e) / camera.a,
    y: (r.top - viewport.top - camera.f) / camera.a,
    width: r.width / camera.a,
    height: r.height / camera.a,
  };
  const t = model.zoomTransform(target, { width: viewport.width, height: viewport.height });
  els.scene.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;

  const w = target.width * t.scale;
  const h = target.height * t.scale;
  Object.assign(els.hole.style, {
    left: `${(viewport.width - w) / 2}px`,
    top: `${(viewport.height - h) / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
  });
}

function setMedia(el, play) {
  if (!el) return;
  const videos = el.matches('video') ? [el] : [...el.querySelectorAll('video')];
  for (const video of videos) {
    if (play) video.play().catch(() => {});
    else video.pause();
  }
}

function markPresenterZoom() {
  for (const el of presenter.currentView.querySelectorAll('.is-zoom-target')) {
    el.classList.remove('is-zoom-target');
  }
  if (!zoom) return;
  const copy = presenter.currentView.querySelector(`.preview-page[data-index="${zoom.page}"]`);
  if (copy) zoomables(copy)[zoom.index]?.classList.add('is-zoom-target');
}

// Keys, stack edge and tabs: zoom out first instead of turning
function navigate(target) {
  if (zoom) {
    zoomOut();
    return;
  }
  turnTo(target);
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
      buildPresenterPreviews();
      setupPresenterZoom();
    } else {
      buildScene();
      createBook();
      setupZoom();
    }
    ready = true;
    refresh();
  },

  next: () => navigate(model.nextSpread(queued?.target ?? flipTarget ?? start, count)),
  prev: () => navigate(model.prevSpread(queued?.target ?? flipTarget ?? start, count)),
  first: () => navigate(0),
  last: () => navigate(count - 1),
  escape: () => zoomOut(),

  goToHash(n, { silent = false } = {}) {
    if (count === 0) return;
    const target = model.startFromHash(n, count);
    if (target === start) {
      Deck.setHash(model.hashFromStart(start));
      return;
    }
    zoomOut({ silent });
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
    if (msg.type === 'state') {
      if (msg.page !== start) zoomOut({ silent: true });
      turnTo(msg.page, { silent: true });
    } else if (msg.type === 'zoom') {
      if (msg.page === null) zoomOut({ silent: true });
      else zoomTo(msg.page, msg.index, { silent: true });
    }
  },
};

// Read-only hooks for the browser tests
Deck.book = {
  get start() { return start; },
  get count() { return count; },
  get idle() { return !isBusy() && queued === null; },
  get zoom() { return zoom ? { page: zoom.page, index: zoom.index } : null; },
  get bounds() {
    const block = els.book?.querySelector('.stf__block')?.getBoundingClientRect();
    const rect = pageFlip?.getBoundsRect();
    return block && rect
      ? { left: block.left + rect.left, top: block.top + rect.top, width: rect.width, height: rect.height, pageWidth: rect.pageWidth }
      : null;
  },
};
