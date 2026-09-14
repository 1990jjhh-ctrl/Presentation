# HTML Presentation Template

Presentations are plain HTML files, styled with CSS. A presentation is either a
**slide deck** — 1920×1080 slides that scale to any screen — or a **book** whose
pages turn like paper. Presenting and building need only Node 20 or newer.

## Start a new presentation

```sh
cp -r template "My Talk"
cd "My Talk"
npm start          # http://localhost:8000, reloads when you save a file
```

## Structure

```
presentation.html   Title, mode, and the ordered list of slides or pages
slides/             One file per slide (slide mode)
pages/              One file per page (book mode)
assets/theme.css    Colours, fonts and slide layouts. Edit this.
assets/book.css     Paper, covers, zoom, page-stack edge and chapter tabs
assets/deck.css     Engine styles: scaling, presenter view, print
assets/engine/      Engine: core, slide mode, book mode, book logic
assets/vendor/      StPageFlip page-turning library (MIT licence)
assets/images/      Images used by slides and pages
scripts/            Dev server and build script
tests/              Unit and browser tests
```

## Choosing a mode

`presentation.html` contains one `<main class="deck">`, and its `data-mode`
picks the mode:

```html
<main class="deck" data-mode="book">   <!-- or data-mode="slides" -->
```

The template starts in book mode. The slide list is kept in a comment below the
book; swap the two to present slides.

## Slide mode

### Adding a slide

1. Create `slides/my-slide.html`:

   ```html
   <section class="slide">
     <h2>Heading</h2>
     <p>Content…</p>
     <aside class="notes">Speaker notes</aside>
   </section>
   ```

2. Add `<div data-slide="slides/my-slide.html"></div>` to `presentation.html` at
   the place where the slide should appear. To remove a slide, delete the line or
   comment it out.

### Layouts

Add a layout class to the `<section>`:

| Class             | Use                                                   |
| ----------------- | ----------------------------------------------------- |
| *(none)*          | Heading and body content                              |
| `layout-title`    | Opening slide (`.eyebrow`, `h1`, `.subtitle`, `.meta`)|
| `layout-section`  | Section divider in the accent colour                  |
| `layout-columns`  | Two columns inside `<div class="columns">`            |
| `layout-quote`    | `<blockquote>` with a `<cite>`                        |
| `layout-image`    | Image on the left, `<div class="text">` on the right  |
| `layout-end`      | Closing slide                                         |

Helpers: `.fragment` reveals an element on the next key press. `.accent` and
`.muted` change the text colour. `.eyebrow` is a small uppercase label. Add
`data-no-number` to a section to hide its page number.

## Book mode

### Adding a page

1. Create `pages/my-page.html`. Pages are drawn on a 1000×1414 px canvas
   (A4 proportions):

   ```html
   <section class="page" data-chapter="Edge detection">
     <h2>Heading</h2>
     <figure data-zoom>
       <img src="assets/images/figure.png" alt="">
       <figcaption>Caption</figcaption>
     </figure>
     <aside class="notes">Speaker notes</aside>
   </section>
   ```

2. Add `<div data-page="pages/my-page.html"></div>` to `presentation.html` in
   reading order.

The first two pages (front cover and its inside) and the last two (inside back
cover and back cover) are stiff; every other page curls. A book needs at least
four pages. If the number of pages is odd, a blank page is added before the
inside back cover.

### Page markup

| Markup                           | Effect                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| `data-chapter="…"`               | Starts a chapter and adds a tab on the book's edge             |
| `data-title="…"`                 | Name shown on the page-stack edge (default: the first heading) |
| `data-zoom`                      | Clicking the element zooms into it                             |
| `class="page cover"`             | Front cover; `back-cover` for the back                         |
| `class="page endpaper"`          | Patterned inside of a cover                                    |
| `<div class="halves">`           | Two sections stacked on one page                               |

### Zooming, turning and jumping

- **Zoom:** click a `data-zoom` element to magnify it while everything else dims.
  Esc, Next, Previous or a click outside zooms out. Videos inside play while
  zoomed. Use images about 2000 px wide so they stay sharp when magnified.
- **Turn:** keys and clickers turn one sheet; drag a page corner to turn by hand.
- **Jump:** hover the page-stack edge beside the book to see page numbers and
  titles, and click to jump. Chapter tabs jump to their chapter.

## Presenting

| Key                            | Action                                          |
| ------------------------------ | ----------------------------------------------- |
| → ↓ Space PageDown             | Next step, slide or sheet                       |
| ← ↑ Shift+Space PageUp         | Previous                                        |
| Home / End                     | First / last slide, or front / back cover       |
| Esc                            | Zoom out (book mode)                            |
| F                              | Fullscreen                                      |
| S                              | Open the presenter view in a new window         |
| B or .                         | Black screen                                    |

The presenter view shows the current and next slide or spread, your notes, a
timer (click it to reset) and a clock, and stays in sync with the audience
window. In book mode, clicking a section in the presenter's preview zooms the
audience screen. Presentation clickers work because they send PageUp and
PageDown. The URL hash holds your place — the slide number, or the first page
of the visible spread — so reloading keeps it.

## Sharing and exporting

```sh
npm run build
```

This writes `dist/<folder name>.html`, a single file with every slide or page,
style, script, image and video embedded. You can open it directly from disk
without a server. The build warns when embedded media add up to more than 25 MB.

**PDF:** open the presentation in Chrome, press Ctrl+P, and choose *Save as PDF*.
Slides print one per page with all fragments shown; books print one A4 page per
book page.

> Opening `presentation.html` directly from disk (`file://`) won't load the
> slides or pages, because browsers block that. Use `npm start` or the built file.

## Tests

```sh
npm test                                          # unit tests
npm install && npx playwright install chromium    # once, for browser tests
npm run test:e2e                                  # browser tests
```
