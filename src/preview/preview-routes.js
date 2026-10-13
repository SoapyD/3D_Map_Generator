/**
 * The single preview HTTP server shared by --preview (alias --visualize) and --preview-map.
 * ctx = { mode, glbPath|null, mapState, framesPath|null, textureSet } (textureSet = default pack when a request has no ?textures=).
 */

import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PREVIEW, LOADED_MAP } from '../config.js';
import { getTabState } from './tab-flags.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGES = {
  '/': 'shell.html',
  '/index.html': 'shell.html',
  '/model.html': 'viewer.html',
  '/viewer.html': 'viewer.html',
  '/visualizer.html': 'visualizer.html',
  '/loaded-map.html': path.join('loaded-map', 'loaded-map.html'),
};

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}

function unavailable(res, message) {
  send(res, 404, 'application/json', JSON.stringify({ ok: false, error: message }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > LOADED_MAP.maxUploadBytes) { reject(new Error('fixture too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function runFile(res, ctx, kind) {
  if (kind === 'frames') {
    if (ctx.mode !== PREVIEW.modes.run || !ctx.framesPath) return unavailable(res, PREVIEW.noVisualizeMessage);
    return send(res, 200, 'application/json', await readFile(ctx.framesPath, 'utf-8'));
  }
  if (!ctx.glbPath) return unavailable(res, PREVIEW.noRunMessage);
  if (kind === 'glb') {
    return send(res, 200, 'model/gltf-binary', await readFile(ctx.glbPath), { 'Access-Control-Allow-Origin': '*' });
  }
  return send(res, 200, 'application/json', await readFile(ctx.glbPath.replace(/\.glb$/, '_geometry.json'), 'utf-8'));
}

async function route(req, res, ctx) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const set = url.searchParams.get('textures') ?? ctx.textureSet;
  if (req.method === 'POST' && p === '/load-map') {
    return send(res, 200, 'application/json', JSON.stringify(ctx.mapState.load(await readBody(req))));
  }
  if (PAGES[p]) return send(res, 200, 'text/html', await readFile(path.join(here, PAGES[p]), 'utf-8'));
  if (p === '/tabs.json') return send(res, 200, 'application/json', JSON.stringify(getTabState(ctx.mode)));
  if (p === '/debug_frames.json') return runFile(res, ctx, 'frames');
  if (p === '/model.glb') return runFile(res, ctx, 'glb');
  if (p === '/geometry.json') return runFile(res, ctx, 'geometry');
  if (p === '/loaded-model.glb') {
    const glb = await ctx.mapState.glb(set);
    return glb ? send(res, 200, 'model/gltf-binary', glb) : unavailable(res, PREVIEW.noFixtureMessage);
  }
  if (p === '/texture-report.json') return send(res, 200, 'application/json', JSON.stringify(ctx.mapState.report(set)));
  return send(res, 404, 'text/plain', 'Not found');
}

export function createPreviewServer(ctx) {
  return http.createServer(async (req, res) => {
    try {
      await route(req, res, ctx);
    } catch (err) {
      send(res, 500, 'text/plain', err.message);
    }
  });
}
