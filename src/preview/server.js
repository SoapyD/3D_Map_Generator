/**
 * Simple HTTP preview server.
 * Serves the GLB file and an HTML viewer page.
 */

import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startPreview(glbPath, port = 3000, mode = 'preview') {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/' || req.url === '/index.html') {
        const html = await readFile(path.join(__dirname, 'viewer.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else if (req.url === '/visualizer.html') {
        const html = await readFile(path.join(__dirname, 'visualizer.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else if (req.url === '/debug_frames.json') {
        const data = await readFile(path.join(process.cwd(), 'output', 'debug_frames.json'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } else if (req.url === '/model.glb') {
        const data = await readFile(glbPath);
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      } else if (req.url === '/geometry.json') {
        const geometryPath = glbPath.replace(/\.glb$/, '_geometry.json');
        const data = await readFile(geometryPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
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

  const url = mode === 'visualize'
    ? `http://localhost:${port}/visualizer.html`
    : `http://localhost:${port}`;

  server.listen(port, () => {
    console.log(`Preview: ${url}`);
  });
}
