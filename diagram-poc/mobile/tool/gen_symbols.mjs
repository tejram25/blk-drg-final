import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync(
  '/home/user/blk-drg-final/diagram-poc/frontend/src/app/features/editor/electrical-shapes.ts',
  'utf8',
);

const lines = src.split('\n');
const out = [];
let skip = false;
let skipInterface = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Drop exported TS interfaces (flat, end at a lone `}`)
  if (/^export interface /.test(line)) { skipInterface = true; continue; }
  if (skipInterface) { if (line === '}') skipInterface = false; continue; }
  // Drop the exported helper functions with type annotations (keep PIN_NAMES + merge loop)
  if (/^export function (elecMeta|elecPinName)/.test(line)) { skip = true; }
  if (skip) { if (line === '}') skip = false; continue; }
  out.push(line);
}

let js = out.join('\n');
// Strip TypeScript type annotations that would break plain JS eval.
js = js
  .replace(/: Record<string, SymbolDef>/g, '')
  .replace(/: Record<string, \{ ref: string; value: string \}>/g, '')
  .replace(/: Record<string, string\[\]>/g, '')
  .replace(/: SymbolPath\[\]/g, '')
  .replace(/: SymbolText\[\]/g, '')
  .replace(/: \{ x: number; y: number \}\[\]/g, '')
  .replace(/\): SymbolDef \{/g, ') {')
  .replace(/\n\s*title: string,/g, '\n  title,')
  .replace(/\n\s*cfg: \{[^}]*\},/g, '\n  cfg,')
  .replace(/export const/g, 'const')
  .replace(/export function/g, 'function');

js += '\nreturn { symbols: ELECTRICAL_SYMBOLS, meta: ELECTRICAL_META };';

const data = new Function(js)();
const symbols = data.symbols;
const meta = data.meta;

// Emit Dart.
function dartNum(n) {
  return Number.isInteger(n) ? `${n}` : `${n}`;
}
const b = [];
b.push('// GENERATED from frontend/src/app/features/editor/electrical-shapes.ts');
b.push('// Do not edit by hand; re-run scripts/gen_symbols to regenerate.');
b.push("import 'dart:ui';");
b.push('');
b.push("import 'symbol_def.dart';");
b.push('');
b.push('const Map<String, SymbolDef> kElectricalSymbols = {');
for (const [key, def] of Object.entries(symbols)) {
  b.push(`  '${key}': SymbolDef(`);
  b.push(`    width: ${dartNum(def.width)},`);
  b.push(`    height: ${dartNum(def.height)},`);
  b.push('    paths: [');
  for (const p of def.paths) {
    const fill = p.fill ? ', fill: true' : '';
    b.push(`      SymbolPath('${p.d}'${fill}),`);
  }
  b.push('    ],');
  if (def.texts && def.texts.length) {
    b.push('    texts: [');
    for (const t of def.texts) {
      const size = t.size != null ? `, size: ${dartNum(t.size)}` : '';
      const bold = t.bold ? ', bold: true' : '';
      const anchor = t.anchor ? `, anchor: '${t.anchor}'` : '';
      const txt = String(t.text).replace(/'/g, "\\'");
      b.push(`      SymbolText(${dartNum(t.x)}, ${dartNum(t.y)}, '${txt}'${size}${bold}${anchor}),`);
    }
    b.push('    ],');
  }
  b.push('    pins: [');
  for (const p of def.pins) {
    b.push(`      Offset(${dartNum(p.x)}, ${dartNum(p.y)}),`);
  }
  b.push('    ],');
  b.push('  ),');
}
b.push('};');
b.push('');
b.push('const Map<String, ({String ref, String value})> kElectricalMeta = {');
for (const [key, m] of Object.entries(meta)) {
  const ref = String(m.ref).replace(/'/g, "\\'");
  const value = String(m.value).replace(/'/g, "\\'");
  b.push(`  '${key}': (ref: '${ref}', value: '${value}'),`);
}
b.push('};');
b.push('');

writeFileSync(
  '/home/user/blk-drg-final/diagram-poc/mobile/lib/features/editor/domain/electrical_symbols.g.dart',
  b.join('\n') + '\n',
);
console.log('symbols:', Object.keys(symbols).length, 'meta:', Object.keys(meta).length);
