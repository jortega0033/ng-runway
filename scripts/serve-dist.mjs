/**
 * Tiny static server for the production build, used by the Playwright e2e tests.
 * No dependencies. Serves dist/ng-runway/browser and falls back to index.html for app routes.
 *
 *   node scripts/serve-dist.mjs [port]
 *
 * Set BASE_HREF (for example "/ng-runway/") to serve the app under a sub-path like GitHub Pages does.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist/ng-runway/browser');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4300);
const prefix = (process.env.BASE_HREF ?? '/').replace(/\/?$/, '/');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No build found in ${root}. Run "npm run build" first.`);
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(prefix)) {
    res.writeHead(302, { location: prefix });
    res.end();
    return;
  }
  // Strip the prefix, then keep the path inside the build folder (no "../" escapes).
  const relative = normalize(decodeURIComponent(url.pathname.slice(prefix.length))).replace(
    /^([/\\]*\.\.)+/,
    '',
  );
  let file = join(root, relative);
  const isFile = existsSync(file) && statSync(file).isFile();
  // Real files are served as they are; app routes (no file extension) get index.html.
  if (!isFile) {
    if (extname(relative)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    file = join(root, 'index.html');
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}${prefix}`));
