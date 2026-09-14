// Definitions shared by the dev server and the build script.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
};

// Types the build embeds as data: URIs
export const isMedia = (type) => /^(image|font|video|audio)\//.test(type ?? '');

// Build warning when embedded media make the single-file build heavy
export function mediaWarning(sizes, limitBytes = 25 * 1024 * 1024) {
  const total = sizes.reduce((sum, { bytes }) => sum + bytes, 0);
  if (total <= limitBytes) return null;

  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  const largest = [...sizes]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map(({ file, bytes }) => `${mb(bytes).padStart(6)} MB  ${file}`);
  return [`Warning: embedded media totals ${mb(total)} MB (limit ${mb(limitBytes)} MB). Largest files:`, ...largest].join('\n');
}
