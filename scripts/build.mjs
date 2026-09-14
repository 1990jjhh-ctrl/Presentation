// Build: inlines slides, stylesheets, scripts and media into one self-contained
// HTML file in dist/ that opens straight from disk, a USB stick or an email.
// Usage: npm run build

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { MIME, isMedia, mediaWarning, root } from './shared.mjs';

// Bytes embedded per media file, for the size warning
const embedded = new Map();

const isRelative = (ref) => !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(ref);

function read(file) {
  if (!existsSync(file)) throw new Error(`File not found: ${relative(root, file)}`);
  return readFileSync(file, 'utf8');
}

function inlineMedia(text, baseDir) {
  const toDataUri = (ref) => {
    if (!isRelative(ref)) return null;
    const file = resolve(baseDir, decodeURI(ref.split(/[?#]/)[0]));
    const type = MIME[extname(file).toLowerCase()];
    if (!isMedia(type) || !existsSync(file) || !statSync(file).isFile()) return null;
    const data = readFileSync(file);
    const name = relative(root, file);
    embedded.set(name, (embedded.get(name) ?? 0) + data.length);
    return `data:${type};base64,${data.toString('base64')}`;
  };

  return text
    .replace(/\b(src|href|poster)=(["'])(.*?)\2/g, (match, attr, quote, ref) => {
      const uri = toDataUri(ref);
      return uri ? `${attr}=${quote}${uri}${quote}` : match;
    })
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (match, _quote, ref) => {
      const uri = toDataUri(ref);
      return uri ? `url("${uri}")` : match;
    });
}

let html = read(join(root, 'presentation.html'));

// Drop comments so commented-out slides and pages stay out of the build
html = html.replace(/<!--[\s\S]*?-->/g, '');

// Slides and pages
const counts = { slide: 0, page: 0 };
html = html.replace(/<(\w+)\b[^>]*\bdata-(slide|page)=(["'])(.*?)\3[^>]*>\s*<\/\1>/g, (_match, _tag, kind, _quote, src) => {
  counts[kind]++;
  return read(resolve(root, src)).trim();
});

// Media referenced from the page, slides and book pages
html = inlineMedia(html, root);

// Stylesheets, with their own url() references resolved relative to the CSS file
html = html.replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g, (tag) => {
  const href = tag.match(/\bhref=(["'])(.*?)\1/)?.[2];
  if (!href || !isRelative(href)) return tag;
  const file = resolve(root, href);
  return `<style>\n${inlineMedia(read(file), dirname(file))}</style>`;
});

// Scripts
html = html.replace(/<script\b([^>]*?)\s+src=(["'])(.*?)\2([^>]*)><\/script>/g, (tag, before, _quote, src, after) => {
  if (!isRelative(src)) return tag;
  const js = read(resolve(root, src)).replace(/<\/script/gi, '<\\/script');
  return `<script${before}${after}>\n${js}</script>`;
});

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `${basename(root)}.html`);
writeFileSync(out, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
const parts = [
  counts.slide && `${counts.slide} slides`,
  counts.page && `${counts.page} pages`,
].filter(Boolean).join(', ') || 'no slides or pages';
console.log(`Built ${relative(root, out)} — ${parts}, ${kb} KB`);

const warning = mediaWarning([...embedded].map(([file, bytes]) => ({ file, bytes })));
if (warning) console.warn(warning);
