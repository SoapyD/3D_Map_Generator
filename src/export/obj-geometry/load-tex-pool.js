import { readFileSync, readdirSync, existsSync } from 'fs';
import { PNG } from 'pngjs';
import path from 'path';

export function loadTexPool(packDir, category) {
  const dir = path.join(packDir, category);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.png'));
  return files.map(f => PNG.sync.read(readFileSync(path.join(dir, f))));
}
