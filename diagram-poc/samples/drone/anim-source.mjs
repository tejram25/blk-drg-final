/**
 * Frame 0 of an animated symbol, as the app's own code builds it.
 *
 * The build scripts run in node and the symbol code is TypeScript, so it is
 * compiled on demand rather than duplicated — the alternative is a second copy
 * of the SVG serialiser that can drift from the one the app draws with.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dir, '../../frontend/src/app/features/gojs-editor/gojs-symbols.ts');
const out = join(mkdtempSync(join(tmpdir(), 'sym-')), 'symbols.mjs');
execSync(`cd ${resolve(__dir, '../../frontend')} && npx esbuild ${src} --bundle --format=esm --outfile=${out}`,
         { stdio: 'pipe' });
const { animFrameSources } = await import(out);

export function animSource(shape) {
  const frames = animFrameSources(shape);
  if (!frames.length) throw new Error(`no animation frames for ${shape}`);
  return frames[0];
}
