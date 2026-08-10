const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.js');
const { chromium } = pw.default ?? pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const [,, modelPath, outPath, scaleArg] = process.argv;
if (!modelPath || !outPath) { console.error('usage: render.mjs model.json out.png [scale]'); process.exit(2); }

const model = readFileSync(resolve(modelPath), 'utf8');
const goSrc = readFileSync(resolve(__dir, '../../frontend/node_modules/gojs/release/go.js'), 'utf8');
const geo = JSON.parse(readFileSync(resolve(__dir, 'figures.json'), 'utf8'));
const scale = scaleArg ? Number(scaleArg) : 2;

/**
 * Inline "Arrow Display" (the brand face the source artwork is set in) as
 * base64 @font-face rules. Read from the tracked React Native assets rather
 * than the Angular `dist/` build, which is gitignored — without the real font
 * the headless browser silently falls back and every label comes out wrong.
 */
function fontCss() {
  const dir = resolve(__dir, '../../react-native-app/assets/fonts');
  return [['Regular', 400], ['Medium', 500], ['Bold', 700]].map(([name, weight]) => {
    const b64 = readFileSync(`${dir}/ArrowDisplay-${name}.ttf`).toString('base64');
    return `@font-face{font-family:'Arrow Display';font-style:normal;font-weight:${weight};`
      + `font-display:block;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
  }).join('\n');
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1080 }, deviceScaleFactor: 2 });
  page.on('console', m => { const t = m.text(); if (/error|Error|Uncaught/.test(t)) console.error('PAGE:', t); });
  page.on('pageerror', e => console.error('PAGEERROR:', e.message));
  await page.goto('file://' + resolve(__dir, 'render-harness.html'));
  await page.addStyleTag({ content: fontCss() });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      for (const f of ['400 16px "Arrow Display"', '500 16px "Arrow Display"', '700 16px "Arrow Display"']) await document.fonts.load(f);
      await document.fonts.ready;
    }
  });
  await page.addScriptTag({ content: goSrc });
  const dataUrl = await page.evaluate(async ({ model, geo, scale }) => {
    const diagram = window.buildDiagram(model, geo);
    await new Promise(r => setTimeout(r, 400));
    diagram.updateAllTargetBindings();
    await new Promise(r => setTimeout(r, 200));
    return diagram.makeImageData({ scale, background: 'white', type: 'image/png', maxSize: new window.go.Size(Infinity, Infinity) });
  }, { model, geo, scale });
  const b64 = dataUrl.split(',')[1];
  writeFileSync(resolve(outPath), Buffer.from(b64, 'base64'));
  console.log('wrote', outPath);
} finally {
  await browser.close();
}
