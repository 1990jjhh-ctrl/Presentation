// Deck engine core — loads slide or page files, starts the mode named in
// <main class="deck" data-mode="…">, and owns keys, touch, URL hash, window sync,
// black screen, fullscreen and the presenter view shell.
//
// A mode registers itself as Deck.modes[name] = {
//   handlesTouch,                 true if the mode handles swipes itself
//   init({ deck, presenter }),    presenter is null in the audience window
//   next(), prev(), first(), last(),
//   escape(),                     optional
//   goToHash(n, { silent }),      n is the 1-based number from the URL hash
//   state(),                      message describing the current position
//   receive(msg),                 apply a message from the other window
// }

const Deck = (window.Deck ??= {});
Deck.modes ??= {};
Deck.isPresenter = new URLSearchParams(location.search).has('presenter');

let mode = null;

Deck.hashNumber = () => parseInt(location.hash.slice(1), 10) || 1;
Deck.setHash = (n) => history.replaceState(null, '', `#${n}`);

// Scales a fixed-size target to fit inside viewport, centred
Deck.fitToViewport = (viewport, target, width, height) => {
  const fit = () => {
    const { clientWidth: w, clientHeight: h } = viewport;
    const scale = Math.min(w / width, h / height);
    target.style.transform = `translate(${(w - width * scale) / 2}px, ${(h - height * scale) / 2}px) scale(${scale})`;
  };
  new ResizeObserver(fit).observe(viewport);
  fit();
};

// ---------------------------------------------------------------- loading

// Replaces each <div data-slide="…"> or <div data-page="…"> with that file's contents.
// The build step does the same ahead of time, so built decks skip this.
async function loadPlaceholders(deck) {
  const placeholders = [...deck.querySelectorAll('[data-slide], [data-page]')];
  await Promise.all(placeholders.map(async (el) => {
    const src = el.dataset.slide ?? el.dataset.page;
    const kind = el.dataset.page ? 'page' : 'slide';
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      el.outerHTML = await res.text();
    } catch (err) {
      const hint = location.protocol === 'file:'
        ? 'Browsers block loading files from <code>file://</code>. Run <code>npm start</code>, or open the built file in <code>dist/</code>.'
        : err.message;
      el.outerHTML = `<section class="${kind} ${kind}-error"><h2>Could not load <code>${src}</code></h2><p>${hint}</p></section>`;
    }
  }));
}

// ---------------------------------------------------------------- syncing
// The audience window and presenter window mirror each other. BroadcastChannel
// covers same-origin windows; postMessage to the opener covers file:// in
// browsers that give every file its own origin.

const channel = 'BroadcastChannel' in window ? new BroadcastChannel(`deck:${location.pathname}`) : null;
let peer = window.opener;

Deck.send = (msg) => {
  channel?.postMessage(msg);
  if (peer && !peer.closed) peer.postMessage({ deck: msg }, '*');
};

function receive(msg) {
  if (!msg?.type || !mode) return;
  if (msg.type === 'blackout') setBlackout(msg.on, { silent: true });
  else if (msg.type === 'hello') Deck.send(mode.state());
  else mode.receive(msg);
}

channel?.addEventListener('message', (e) => receive(e.data));
window.addEventListener('message', (e) => {
  if (e.source === peer) receive(e.data?.deck);
});

function openPresenter() {
  peer = window.open(`${location.pathname}?presenter${location.hash}`, 'deck-presenter', 'popup,width=1280,height=800');
}

function setBlackout(on, { silent = false } = {}) {
  document.body.classList.toggle('blackout', on);
  if (!silent) Deck.send({ type: 'blackout', on });
}

// ---------------------------------------------------------------- presenter shell

function buildPresenterShell() {
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
      <p class="p-keys">→ / Space next · ← previous · Esc zoom out · B black screen · F fullscreen</p>
    </section>`;
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

  document.title = `Presenter · ${document.title}`;
  return {
    current: ui.querySelector('.p-current'),
    next: ui.querySelector('.p-next'),
    notes: ui.querySelector('.p-notes-body'),
    count: ui.querySelector('.p-count'),
  };
}

// ---------------------------------------------------------------- input

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}

document.addEventListener('keydown', (e) => {
  if (!mode || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;

  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'n': mode.next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'p': mode.prev(); break;
    case ' ': e.shiftKey ? mode.prev() : mode.next(); break;
    case 'Home': mode.first(); break;
    case 'End': mode.last(); break;
    case 'Escape': if (!mode.escape) return; mode.escape(); break;
    case 'f': toggleFullscreen(); break;
    case 'b': case '.': setBlackout(!document.body.classList.contains('blackout')); break;
    case 's': if (!Deck.isPresenter) openPresenter(); break;
    default: return;
  }
  e.preventDefault();
});

let touchX = null;
addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
addEventListener('touchend', (e) => {
  if (touchX === null || !mode || mode.handlesTouch) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) dx < 0 ? mode.next() : mode.prev();
});

addEventListener('hashchange', () => mode?.goToHash(Deck.hashNumber(), { silent: false }));

if (!Deck.isPresenter) {
  let idleTimer;
  // Capture phase, so book mode's zoom (which stops mousemove propagation) cannot mute it
  addEventListener('mousemove', () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000);
  }, true);
}

// ---------------------------------------------------------------- start

async function start() {
  const deck = document.querySelector('.deck');
  const name = deck.dataset.mode ?? 'slides';
  const selected = Deck.modes[name];
  if (!selected) {
    deck.insertAdjacentHTML('beforeend', `<section class="slide slide-error active"><h2>Unknown mode <code>${name}</code></h2><p>Use <code>data-mode="slides"</code> or <code>data-mode="book"</code>.</p></section>`);
    return;
  }

  await loadPlaceholders(deck);
  const presenter = Deck.isPresenter ? buildPresenterShell() : null;
  await selected.init({ deck, presenter });
  mode = selected;
  mode.goToHash(Deck.hashNumber(), { silent: true });
  Deck.send({ type: 'hello' });
}

// Module scripts run before DOMContentLoaded, so every mode is registered by then
document.addEventListener('DOMContentLoaded', start);
