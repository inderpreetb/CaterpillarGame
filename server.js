// Tiny dependency-free static server for Railway (or anywhere Node runs).
// Serves ./public on $PORT with a /health endpoint.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      // Unknown path: send the game anyway so old links and typos still land on it.
      res.writeHead(err && err.code === 'ENOENT' ? 200 : 404, { 'content-type': TYPES['.html'] });
      return fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🐛 The Very Hungry Caterpillar is listening on http://0.0.0.0:${PORT}`);
});
