// Small static server for the game folder. usage: node tools/serve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain' };
export function serve(port = 0) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
  });
  return new Promise(ok => srv.listen(port, '127.0.0.1', () => ok({ srv, port: srv.address().port, url: 'http://127.0.0.1:' + srv.address().port })));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) serve(+(process.argv[2] || 8100)).then(s => console.log('Hundred Ghosts: ' + s.url + '/index.html'));
