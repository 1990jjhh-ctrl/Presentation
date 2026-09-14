// Dev server: serves the project and reloads the browser whenever a file changes.
// Usage: npm start   (PORT=9000 npm start to pick a port)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { MIME, root } from './shared.mjs';

const RELOAD_SNIPPET = `<script>new EventSource('/__reload').onmessage = () => location.reload();</script>`;
const clients = new Set();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(302, { Location: '/presentation.html' });
    res.end();
    return;
  }

  try {
    const file = join(root, normalize(decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + sep)) throw new Error('Outside project');

    let body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    if (type.startsWith('text/html')) {
      body = body.toString().replace(/<\/body>/i, (tag) => RELOAD_SNIPPET + tag);
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

let reloadTimer;
watch(root, { recursive: true }, (_event, filename) => {
  // Build output, test runs and local tooling write inside the project; don't reload for those
  if (!filename || /^(dist|node_modules|\.git|test-results|playwright-report|\.superpowers)([\\/]|$)/.test(filename)) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 100);
});

let port = Number(process.env.PORT) || 8000;
server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.log(`Port ${port} is busy, trying ${port + 1}…`);
  server.listen(++port);
});
server.on('listening', () => {
  console.log(`Presentation: http://localhost:${port}/`);
  console.log('Watching for changes — press Ctrl+C to stop.');
});
server.listen(port);
