/**
 * Simple HTTP preview server.
 * Serves the GLB file and an HTML viewer page.
 */

import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startPreview(glbPath, port = 3000) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/' || req.url === '/index.html') {
        const html = await readFile(path.join(__dirname, 'viewer.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else if (req.url === '/model.glb') {
        const data = await readFile(glbPath);
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (err) {
      res.writeHead(500);
      res.end(err.message);
    }
  });

  server.listen(port, () => {
    console.log(`Preview: http://localhost:${port}`);
  });
}
