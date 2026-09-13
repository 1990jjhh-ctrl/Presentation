# HTML Presentation Template

Slides are plain HTML files, styled with CSS, on a fixed 1920×1080 canvas that
scales to any screen. It has no dependencies. You only need Node 20 or newer.

## Start a new presentation

```sh
cp -r template "My Talk"
cd "My Talk"
npm start          # http://localhost:8000, reloads when you save a file
```

## Structure

```
presentation.html   Deck shell: title, language, and the ordered list of slides
slides/             One file per slide
assets/theme.css    How slides look (colours, fonts, layouts). Edit this.
assets/deck.css     Engine styles: scaling, presenter view, print
assets/deck.js      Engine: loading, navigation, fragments, presenter sync
assets/images/      Images used by slides
scripts/            Dev server and build script
```

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

## Presenting

| Key                            | Action                                   |
| ------------------------------ | ---------------------------------------- |
| → ↓ Space PageDown             | Next step or slide                       |
| ← ↑ Shift+Space PageUp         | Previous                                 |
| Home / End                     | First / last slide                       |
| F                              | Fullscreen                               |
| S                              | Open the presenter view in a new window  |
| B or .                         | Black screen                             |

The presenter view shows the current slide, the next step, your notes, a timer
(click it to reset) and a clock. It stays in sync with the audience window.
Presentation clickers work because they send PageUp and PageDown. The URL
hash (`#5`) holds the current slide, so reloading keeps your place.

## Sharing and exporting

```sh
npm run build
```

This writes `dist/<folder name>.html`, a single file with every slide, style,
script and image embedded. You can open it directly from disk without a server.

**PDF:** open the deck in Chrome, press Ctrl+P, and choose *Save as PDF*. Each
slide prints on its own page with all fragments shown.

> Opening `presentation.html` directly from disk (`file://`) won't load the
> slides, because browsers block that. Use `npm start` or the built file.
