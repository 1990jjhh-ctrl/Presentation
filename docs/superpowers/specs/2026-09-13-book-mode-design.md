# Book Mode — Design

Date: 2026-09-13
Status: Approved in conversation, pending written review

## Goal

Add a second presentation mode in which the deck is a realistic book: stiff hard
covers, soft pages that curl and reveal the next spread while turning, pages that
can be turned by hand, sections that can be zoomed into, and navigation by the page
stack's edge and chapter tabs.

This is the first of five sub-projects. The later ones — a lecture room overview,
camera moves between desk, whiteboard and blackboard, and drawing on the boards —
are out of scope here, but the book is built so it can later sit inside that room.

## Decisions

| Topic            | Decision                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| Page turn        | Curling soft pages that can also be dragged by hand; stiff covers        |
| Relation to slides | A mode chosen per presentation; classic slides remain fully supported  |
| Page shape       | Portrait, A4 proportions, authored on a 1000×1414 px canvas              |
| Zoom             | Click only, on demand                                                    |
| Page jumping     | Page-stack edge for any page, plus chapter tabs for marked pages        |
| Page-turn engine | StPageFlip 2.0.7 (MIT, 44 KB), vendored unmodified, behind an adapter   |

StPageFlip was chosen over a custom engine (far more work for the fold geometry,
shadows and dragging) and over WebGL (page HTML would become textures, making text,
video and clickable zoom sections hard). The adapter keeps the library replaceable.

## 1. Structure and authoring

### Choosing the mode

`presentation.html` remains the only entry point. The mode is an attribute:

```html
<main class="deck" data-mode="book">   <!-- or data-mode="slides" -->
```

Keys, clicker, URL hash, speaker notes, presenter view, live reload and
`npm run build` work in both modes.

### Listing pages

```html
<main class="deck" data-mode="book">
  <div data-page="pages/cover.html"></div>
  <div data-page="pages/inside-front.html"></div>
  <div data-page="pages/intro.html"></div>
  …
  <div data-page="pages/inside-back.html"></div>
  <div data-page="pages/back-cover.html"></div>
</main>
```

### Writing a page

```html
<section class="page" data-chapter="Edge detection" data-title="Edge detection">
  <h2>First-order derivative</h2>
  <figure data-zoom>
    <img src="assets/images/sobel.png" alt="">
    <figcaption>Sobel operator</figcaption>
  </figure>
  <aside class="notes">Speaker notes for this page</aside>
</section>
```

- `data-chapter="…"` — this page starts a chapter and gets a chapter tab.
- `data-title="…"` — label shown when hovering the page-stack edge; defaults to
  the page's first heading, then to "Page n".
- `data-zoom` — the element can be clicked to zoom into it.
- `aside.notes` — speaker notes, as in slide mode.

### Stiff pages and page count

- The first two pages (front cover, inside front cover) and the last two pages
  (inside back cover, back cover) are stiff. All other pages are soft.
- The total page count must be even so the back cover ends up alone. If it is odd,
  one blank soft page is inserted automatically before the inside back cover.
- A book needs at least four pages. With fewer, the engine shows an error page that
  explains the requirement.

### Engine files

The build inlines plain `<script src>` tags but does not bundle ES module imports,
so the engine becomes classic scripts sharing a `window.Deck` namespace. All of them
are always loaded; `core.js` starts the mode named in `data-mode`.

```
assets/engine/core.js        loading, state, keys, hash, sync, presenter view (from deck.js)
assets/engine/slides.js      classic slide mode (from deck.js)
assets/engine/book-model.js  pure book logic: padding, stiffness, spreads, hash, tabs, zoom maths
assets/engine/book.js        book mode: StPageFlip adapter, zoom, page-stack edge, chapter tabs
assets/vendor/page-flip.js   StPageFlip 2.0.7 browser build, unmodified
assets/deck.css              engine and slide-mode styles (existing)
assets/book.css              book look: paper, covers, spine, stack edge, tabs, zoom dimming
```

`assets/deck.js` is removed once its contents live in `core.js` and `slides.js`.

### Examples shipped

- `pages/` — an eight-page example book:

  | Page | File                  | Content                                                      |
  | ---- | --------------------- | ------------------------------------------------------------ |
  | 1    | `cover.html`          | Front cover (stiff)                                          |
  | 2    | `inside-front.html`   | Inside front cover (stiff)                                   |
  | 3    | `intro.html`          | Introduction, `data-chapter="Edge detection"`                |
  | 4    | `edges-left.html`     | First-order derivative (top), second-order derivative (bottom), both zoomable |
  | 5    | `edges-right.html`    | Canny (top, zoomable), summary (bottom, zoomable)            |
  | 6    | `reading.html`        | Further reading, `data-chapter="References"`                 |
  | 7    | `inside-back.html`    | Inside back cover (stiff)                                    |
  | 8    | `back-cover.html`     | Back cover (stiff)                                           |

  Pages 4 and 5 form one spread. Figures use placeholder SVGs.
- `slides/` — the existing slide examples, unchanged.
- `presentation.html` — starts in book mode; the slide-mode list is kept alongside
  in an HTML comment.

## 2. Layout, covers and turning

### Size

- The book is sized in real screen pixels with StPageFlip's `stretch` sizing, filling
  the window minus a margin, and recalculated on resize. No CSS transform scales the
  book, so StPageFlip's mouse mapping works without modification.
- Each page scales its 1000×1414 px content to the actual page size with a CSS
  transform on an inner wrapper, so text wraps identically on every screen.
- The book is placed on a plain surface with a soft shadow, inside a `.scene`
  container that a future room camera can transform.

### Covers, opening and closing

StPageFlip keeps the spine at the centre of its box, so a closed front cover sits in
the right half and a closed back cover in the left half. The adapter translates the
book horizontally by half a page width so that:

- the closed front cover is centred at the start;
- opening slides the book to the open position while the cover turns, leaving the
  open spread centred;
- turning past the inside back cover slides the book back so the closed back cover
  is centred.

Stiff pages turn as rigid boards; soft pages curl with the next spread visible behind
the fold.

### Controls

| Input                                  | Action                                      |
| -------------------------------------- | ------------------------------------------- |
| → ↓ Space PageDown, clicker            | Turn forward one sheet (animated)           |
| ← ↑ Shift+Space PageUp                 | Turn back one sheet (animated)              |
| Home / End                             | Front cover / back cover                    |
| Drag a page corner (mouse or touch)    | Turn by hand; can be stopped halfway        |
| Click a page corner                    | Turn that way                               |
| B / . · F · S                          | Black screen · fullscreen · presenter view  |

- StPageFlip runs with `showCover: true`, `usePortrait: false` and
  `disableFlipByClick: true`, so a click on a page only turns it at a corner.
- `.fragment` is not supported in book mode; spreads appear whole.

### URL hash

- `#n` is the 1-based number of the left-hand page of the visible spread.
- The closed front cover is `#1`; the closed back cover is the last page number.
- A hash naming a right-hand page is normalised to its spread. No hash means `#1`.
- Reloading restores the spread without animation.

### Presenter view

- Shows the current spread and the next spread (or "End of book"). The previews are
  static: clones of the spread's page elements placed side by side, without an
  StPageFlip instance, since a live book cannot be cloned.
- Notes list the visible pages' notes labelled "Left" and "Right" ("Cover" when
  closed). Timer and clock as in slide mode.

### Sync between windows

Messages extend the existing channel:

| Message                          | Meaning                                  |
| -------------------------------- | ---------------------------------------- |
| `{ type: 'state', page }`        | Show the spread containing `page`        |
| `{ type: 'zoom', page, index }`  | Zoom into the `index`-th `[data-zoom]` on `page` |
| `{ type: 'zoom', page: null }`   | Zoom out                                 |
| `{ type: 'blackout', on }`       | As in slide mode                         |
| `{ type: 'hello' }`              | As in slide mode                         |

A hand-dragged turn is sent when it completes (StPageFlip `flip` event).

## 3. Zoom

- Any element with `data-zoom` is zoomable. Hovering it with the mouse shows an
  outline and a zoom-in cursor in that window only (hover is not synced). Outlines
  are hidden while zoomed and when the idle cursor is hidden.
- The zoomable element stops `mousedown` and `touchstart` from reaching StPageFlip,
  so clicking it never starts a page turn.
- **Zoom in:** clicking animates a camera transform on the `.scene` container over
  0.6 s that centres the element and scales it by
  `0.85 × min(viewport width ÷ element width, viewport height ÷ element height)`,
  so it keeps its proportions and fills 85 % of whichever dimension limits it.
  A dimming layer at 60 % opacity covers everything except the zoomed element.
- **Videos** inside the zoomed element play on zoom-in and pause on zoom-out, keeping
  the author's `muted`, `loop` and `controls` attributes.
- **Zoom out:** Esc; Next or Previous (which zoom out instead of turning); or a click
  outside the zoomed element. Clicks inside it do not zoom out, so video controls
  work. Clicking another zoomable element while zoomed moves straight to it.
- While zoomed, page turns are blocked, including dragging, edge clicks and tabs.
- Resizing while zoomed recomputes the transform.
- Text is re-rasterised by the browser after the transition. Images should be about
  2000 px wide or more to stay sharp when zoomed; the README states this.
- **Presenter view:** clicking a zoomable element in the "Current" preview zooms the
  audience window; the preview itself stays unzoomed and outlines the zoomed element.

## 4. Page-stack edge, chapter tabs, build, print

### Page-stack edge

- Beside the open book the page stack is drawn with a thickness proportional to the
  number of pages on each side; a closed front cover shows it on the right only, a
  closed back cover on the left only.
- Hovering the edge highlights one page slice and shows a label: page number and
  title.
- Clicking turns to that page's spread with one animated turn
  (`pageFlip.flip(page)`); from a closed book it also slides the book open.
- Disabled while zoomed.

### Chapter tabs

- Every page with `data-chapter` gets a tab on the book's outer edge, labelled with
  the chapter name, in the theme's accent colour.
- A tab is on the right while its page is ahead of the visible spread and on the
  left once passed.
- Tabs are staggered top to bottom in chapter order. Tab height on screen is
  `min(120 × page scale, page height ÷ chapter count)`, where page scale is the
  on-screen page width divided by 1000.
- Clicking a tab jumps to its page like an edge click. Disabled while zoomed.

### Build

- `scripts/build.mjs` fills `data-page` placeholders the same way as `data-slide`,
  inlines the engine scripts and `assets/vendor/page-flip.js`, and embeds media as
  today.
- After building, it prints a warning when embedded media totals more than 25 MB,
  listing the five largest files.

### Print / PDF

- Book mode prints one A4 portrait sheet per page, front cover to back cover,
  content scaled to fit.
- Page-stack edge, tabs, zoom outlines and dimming are hidden.
- Slide mode prints as before.

## Testing

- **Logic (no dependencies):** `assets/engine/book-model.js` holds the pure functions —
  padding, stiffness, spread ↔ hash mapping, tab placement, zoom transform maths.
  `npm test` runs `node --test` over `tests/*.test.mjs`, which load the script with
  `node:vm`.
- **Browser (dev dependency):** `@playwright/test` 1.63 with a smoke suite,
  `npm run test:e2e`, covering: opening the book, turning, hash reload, edge jump,
  chapter tab, zoom in by click, zoom out by Esc and by Next, turns blocked while
  zoomed, and the built file opened from `file://`.
- The first implementation step verifies that Playwright's Chromium runs on this
  machine (headless Firefox hung earlier). If it does not, the browser suite is
  replaced by a manual checklist in the README and the logic tests remain.
- The template needs no dependencies to present or build; Playwright is used only
  for development tests.
- The look of the curl, paper and shadows is checked by the user at review points.

## Out of scope

- Fragments in book mode
- Riffling through intermediate pages when jumping
- Keyboard entry of a page number
- The lecture room, camera moves between scenes, whiteboard and blackboard, drawing
- Patching StPageFlip's mouse mapping for a scaled camera (needed with the room)

## Risks

- **StPageFlip is unmaintained** (last release 2022). Mitigation: it is vendored, and
  the adapter confines its API to `book.js`.
- **Large embedded videos** make the built file heavy. Mitigation: the build warning.
- **Sharpness while zoomed** depends on image resolution. Mitigation: README guidance.
