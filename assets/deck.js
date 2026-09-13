// Deck engine — loads slide files, scales the 1920×1080 canvas to the window,
// and handles navigation, fragments, speaker notes and the presenter view.

const WIDTH = 1920;
const HEIGHT = 1080;

const deck = document.querySelector('.deck');
const isPresenter = new URLSearchParams(location.search).has('presenter');

let slides = [];
let index = 0;
let step = 0;
let progress = null;
let presenter = null;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const slidesIn = (root) => [...root.querySelectorAll(':scope > .slide')];
const fragmentCount = (i) => slides[i].querySelectorAll('.fragment').length;
const slideFromHash = () => (parseInt(location.hash.slice(1), 10) || 1) - 1;

// ---------------------------------------------------------------- loading

// Replaces each <div data-slide="…"> placeholder with the contents of that file.
// The build step does the same thing ahead of time, so built decks skip this.
async function loadSlides() {
  const placeholders = [...deck.querySelectorAll('[data-slide]')];
  await Promise.all(placeholders.map(async (el) => {
    const src = el.dataset.slide;
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      el.outerHTML = await res.text();
    } catch (err) {
      const hint = location.protocol === 'file:'
        ? 'Browsers block loading slide files from <code>file://</code>. Run <code>npm start</code>, or open the built file in <code>dist/</code>.'
        : err.message;
      el.outerHTML = `<section class="slide slide-error"><h2>Could not load <code>${src}</code></h2><p>${hint}</p></section>`;
    }
  }));
}

function numberSlides() {
  slides.forEach((slide, i) => {
    if (slide.hasAttribute('data-no-number')) return;
    const number = document.createElement('div');
    number.className = 'slide-number';
    number.textContent = i + 1;
    slide.append(number);
  });
}

// ---------------------------------------------------------------- rendering

function fitToViewport(viewport) {
  const target = viewport.querySelector('.deck');
  new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = viewport;
    const scale = Math.min(w / WIDTH, h / HEIGHT);
    target.style.transform = `translate(${(w - WIDTH * scale) / 2}px, ${(h - HEIGHT * scale) / 2}px) scale(${scale})`;
  }).observe(viewport);
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
  history.replaceState(null, '', `#${index + 1}`);

  if (progress) {
    progress.style.width = `${slides.length > 1 ? (index / (slides.length - 1)) * 100 : 100}%`;
  }
  if (presenter) updatePresenter();
  if (!silent) send({ type: 'state', index, step });
}

function next() {
  if (step < fragmentCount(index)) go(index, step + 1);
  else if (index < slides.length - 1) go(index + 1, 0);
}

function prev() {
  if (step > 0) go(index, step - 1);
  else if (index > 0) go(index - 1, Infinity);
}

function setBlackout(on, { silent = false } = {}) {
  document.body.classList.toggle('blackout', on);
  if (!silent) send({ type: 'blackout', on });
}

// ---------------------------------------------------------------- syncing
// The audience window and presenter window mirror each other. BroadcastChannel
// covers same-origin windows; postMessage to the opener covers file:// in
// browsers that give every file its own origin.

const channel = 'BroadcastChannel' in window ? new BroadcastChannel(`deck:${location.pathname}`) : null;
let peer = window.opener;

function send(msg) {
  channel?.postMessage(msg);
  if (peer && !peer.closed) peer.postMessage({ deck: msg }, '*');
}

function receive(msg) {
  if (msg?.type === 'state') go(msg.index, msg.step, { silent: true });
  else if (msg?.type === 'blackout') setBlackout(msg.on, { silent: true });
  else if (msg?.type === 'hello') send({ type: 'state', index, step });
}

channel?.addEventListener('message', (e) => receive(e.data));
window.addEventListener('message', (e) => {
  if (e.source === peer) receive(e.data?.deck);
});

function openPresenter() {
  peer = window.open(`${location.pathname}?presenter${location.hash}`, 'deck-presenter', 'popup,width=1280,height=800');
}

// ---------------------------------------------------------------- presenter view

function buildPresenter() {
  const viewport = deck.parentElement;
  const nextViewport = viewport.cloneNode(true);

  const ui = document.createElement('div');
  ui.className = 'presenter';
  ui.innerHTML = `
    <section class="p-pane p-current"><h3>Current</h3></section>
    <section class="p-pane p-next"><h3>Next</h3><p class="p-end">End of presentation</p></section>
    <section class="p-pane p-notes"><h3>Notes</h3><div class="p-notes-body"></div></section>
    <section class="p-pane p-info">
      <div class="p-count"></div>
      <div class="p-timer" title="Click to reset">00:00</div>
      <div class="p-clock"></div>
      <p class="p-keys">→ / Space next · ← previous · B black screen · F fullscreen</p>
    </section>`;
  ui.querySelector('.p-current').append(viewport);
  ui.querySelector('.p-next').append(nextViewport);
  document.body.append(ui);

  const timer = ui.querySelector('.p-timer');
  const clock = ui.querySelector('.p-clock');
  const pad = (n) => String(n).padStart(2, '0');
  let started = Date.now();
  const tick = () => {
    const s = Math.floor((Date.now() - started) / 1000);
    timer.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  timer.addEventListener('click', () => { started = Date.now(); tick(); });
  setInterval(tick, 1000);
  tick();

  presenter = {
    nextPane: ui.querySelector('.p-next'),
    nextDeck: nextViewport.querySelector('.deck'),
    notes: ui.querySelector('.p-notes-body'),
    count: ui.querySelector('.p-count'),
  };
  document.title = `Presenter · ${document.title}`;
}

function updatePresenter() {
  const { nextPane, nextDeck, notes, count } = presenter;
  const hasMoreSteps = step < fragmentCount(index);
  const isEnd = !hasMoreSteps && index === slides.length - 1;

  nextPane.classList.toggle('is-end', isEnd);
  if (hasMoreSteps) show(nextDeck, index, step + 1);
  else if (!isEnd) show(nextDeck, index + 1, 0);

  const aside = slides[index].querySelector('.notes');
  notes.textContent = aside ? aside.textContent.trim().replace(/[ \t]+/g, ' ') : '';
  count.textContent = `Slide ${index + 1} of ${slides.length}`;
}

// ---------------------------------------------------------------- input

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;

  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'n': next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'p': prev(); break;
    case ' ': e.shiftKey ? prev() : next(); break;
    case 'Home': go(0); break;
    case 'End': go(slides.length - 1, Infinity); break;
    case 'f': toggleFullscreen(); break;
    case 'b': case '.': setBlackout(!document.body.classList.contains('blackout')); break;
    case 's': if (!isPresenter) openPresenter(); break;
    default: return;
  }
  e.preventDefault();
});

let touchX = null;
addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
});

addEventListener('hashchange', () => go(slideFromHash()));

// ---------------------------------------------------------------- start

await loadSlides();
slides = slidesIn(deck);
numberSlides();

if (isPresenter) {
  buildPresenter();
} else {
  progress = document.createElement('div');
  progress.className = 'progress';
  deck.append(progress);

  let idleTimer;
  addEventListener('mousemove', () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000);
  });
}

document.querySelectorAll('.viewport').forEach(fitToViewport);
go(slideFromHash(), 0, { silent: true });
send({ type: 'hello' });
