// Servidor local de teste: entrega apenas dist/, sem Vite e sem fallback de SPA.
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../dist');
const prefix = '/memofreq/';
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function serve(request: IncomingMessage, response: ServerResponse) {
  try {
    const path = decodeURIComponent(
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );
    if (
      !path.startsWith(prefix) ||
      !['GET', 'HEAD'].includes(request.method ?? '')
    ) {
      response.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice(prefix.length) || 'index.html');
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end();
  }
}

createServer((request, response) => {
  void serve(request, response);
}).listen(4174, '127.0.0.1');
