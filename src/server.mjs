// Tiny local server: every /api/data request rescans from disk (no cache),
// so a browser refresh is always current. Zero dependencies (ADR-0001).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, scanAll } from './scan.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = process.env.DASHBOARD_CONFIG || path.join(ROOT, 'dashboard.config.json');
const INDEX = path.join(ROOT, 'public', 'index.html');

const config = loadConfig(CONFIG_PATH);
const port = Number(process.env.PORT || config.port || 5111);

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(INDEX));
  } else if (url === '/api/data') {
    try {
      const data = scanAll(loadConfig(CONFIG_PATH));
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    }
  } else {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`project dashboard → http://localhost:${port}`);
});
