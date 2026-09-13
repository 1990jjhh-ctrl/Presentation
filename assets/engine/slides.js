// Slide mode — 1920×1080 slides that fade, with fragments, page numbers,
// a progress bar and slide previews in the presenter view.

const Deck = (window.Deck ??= {});
Deck.modes ??= {};

const WIDTH = 1920;
const HEIGHT = 1080;

let deck = null;
let slides = [];
let index = 0;
let step = 0;
let progress = null;
let presenter = null;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const slidesIn = (root) => [...root.querySelectorAll(':scope > .slide')];
const fragmentCount = (i) => slides[i].querySelectorAll('.fragment').length;
const state = () => ({ type: 'state', index, step });

function numberSlides() {
  slides.forEach((slide, i) => {
    if (slide.hasAttribute('data-no-number')) return;
    const number = document.createElement('div');
    number.className = 'slide-number';
    number.textContent = i + 1;
    slide.append(number);
  });
}

function show(root, i, st) {
  slidesIn(root).forEach((slide, n) => {
    slide.classList.toggle('active', n === i);
    if (n === i) {
      slide.querySelectorAll('.fragment').forEach((f, k) => f.classList.toggle('visible', k < st));
    }
  });
}

function go(i, st = 0, { silent = false } = {}) {
  index = clamp(i, 0, slides.length - 1);
  step = clamp(st, 0, fragmentCount(index));
  show(deck, index, step);
  Deck.setHash(index + 1);

  if (progress) {
    progress.style.width = `${slides.length > 1 ? (index / (slides.length - 1)) * 100 : 100}%`;
  }
  if (presenter) updatePresenter();
  if (!silent) Deck.send(state());
}

function buildPresenter(panes) {
  const viewport = deck.parentElement;
  const nextViewport = viewport.cloneNode(true);
  panes.current.append(viewport);
  panes.next.append(nextViewport);
  presenter = { ...panes, nextDeck: nextViewport.querySelector('.deck') };
  Deck.fitToViewport(viewport, deck, WIDTH, HEIGHT);
  Deck.fitToViewport(nextViewport, presenter.nextDeck, WIDTH, HEIGHT);
}

function updatePresenter() {
  const hasMoreSteps = step < fragmentCount(index);
  const isEnd = !hasMoreSteps && index === slides.length - 1;

  presenter.next.classList.toggle('is-end', isEnd);
  if (hasMoreSteps) show(presenter.nextDeck, index, step + 1);
  else if (!isEnd) show(presenter.nextDeck, index + 1, 0);

  const aside = slides[index].querySelector('.notes');
  presenter.notes.textContent = aside ? aside.textContent.trim().replace(/[ \t]+/g, ' ') : '';
  presenter.count.textContent = `Slide ${index + 1} of ${slides.length}`;
}

Deck.modes.slides = {
  init({ deck: root, presenter: panes }) {
    deck = root;
    slides = slidesIn(deck);
    numberSlides();

    if (panes) {
      buildPresenter(panes);
    } else {
      progress = document.createElement('div');
      progress.className = 'progress';
      deck.append(progress);
      Deck.fitToViewport(deck.parentElement, deck, WIDTH, HEIGHT);
    }
  },

  next() {
    if (step < fragmentCount(index)) go(index, step + 1);
    else if (index < slides.length - 1) go(index + 1, 0);
  },

  prev() {
    if (step > 0) go(index, step - 1);
    else if (index > 0) go(index - 1, Infinity);
  },

  first: () => go(0),
  last: () => go(slides.length - 1, Infinity),
  goToHash: (n, options) => go(n - 1, 0, options),
  state,

  receive(msg) {
    if (msg.type === 'state') go(msg.index, msg.step, { silent: true });
  },
};
