// Serves a built Angular app's folder on 127.0.0.1, with index.html for any
// unknown path, as a static host would: node test/e2e/serve.mjs <dir> <port>
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const [root, port] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.map': 'application/json', '.txt': 'text/plain' };

createServer((request, response) => {
  const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const body = readFileSync(file);
  response.writeHead(200, { 'content-type': `${types[extname(file)] ?? 'application/octet-stream'}; charset=utf-8`, 'content-length': body.length, 'cache-control': 'max-age=60' });
  response.end(body);
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on ${port}`));
