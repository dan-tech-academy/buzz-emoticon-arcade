import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const dev = process.argv.includes('--dev');
const root = resolve(dev ? '.' : 'dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const port = Number(process.env.PORT || (dev ? 5173 : 4173));
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    // Only public game routes, never checkout metadata or private files.
    const allowed = pathname === '/index.html' || pathname === '/icon.png' || pathname === '/manifest.webmanifest' || /^\/src\/[a-z-]+\.(?:js|css)$/.test(pathname) || /^\/emotes\/[a-z-]+\.png$/.test(pathname);
    if (!allowed) throw new Error('Not found');
    const publicAsset = dev && (pathname.startsWith('/emotes/') || ['/icon.png','/manifest.webmanifest'].includes(pathname));
    const path = resolve(root, `.${publicAsset ? '/public' : ''}${pathname}`);
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Not found');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`BUZZ! listening on ${port}`));
