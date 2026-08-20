import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:1360,height:820}, deviceScaleFactor:2 });
const errs=[]; p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message);});
p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,200)); });
await p.goto('file:///home/user/blk-drg-final/diagram-poc/samples/layers-poc/drill-down-poc.html',{waitUntil:'networkidle'});
await p.waitForTimeout(900);

const state = () => p.evaluate(()=>({
  crumbs:[...document.querySelectorAll('.crumb')].map(c=>c.textContent.replace(/\s+/g,' ').trim()),
  nodes: window.__poc.diagram.model.nodeDataArray.map(n=>n.text),
  level: window.__poc.path().at(-1).id,
}));
console.log('L1 root      :', JSON.stringify(await state()));
await p.screenshot({path:'/tmp/poc-1-system.png'});

// drill into "Flight/Drive Controller" (has child 'fcb')
await p.evaluate(()=>{ const d=window.__poc.diagram; window.__poc.drill(d.findNodeForKey('fcb')); });
await p.waitForTimeout(700);
console.log('L2 boards    :', JSON.stringify(await state()));
await p.screenshot({path:'/tmp/poc-2-boards.png'});

// drill into "MCU Board" (has child 'mcu_board')
await p.evaluate(()=>{ const d=window.__poc.diagram; window.__poc.drill(d.findNodeForKey('mcu')); });
await p.waitForTimeout(700);
console.log('L3 components:', JSON.stringify(await state()));
await p.screenshot({path:'/tmp/poc-3-components.png'});

// author a NEW level on a node with no child (IMU has none) — proves create-on-drill
await p.evaluate(()=>{ window.__poc.goTo?window.__poc.goTo(1):null; }); // no-op guard
// go back to boards via breadcrumb (click 2nd crumb)
await p.evaluate(()=>{ document.querySelectorAll('.crumb')[1].click(); });
await p.waitForTimeout(600);
console.log('back to L2   :', JSON.stringify(await state()));
// drill IMU (no child) -> creates a new empty level
await p.evaluate(()=>{ const d=window.__poc.diagram; window.__poc.drill(d.findNodeForKey('imu')); });
await p.waitForTimeout(600);
const created = await state();
console.log('created lvl  :', JSON.stringify(created));
// add two components to the fresh level from the palette (click-to-add)
await p.evaluate(()=>{ window.__poc.diagram.model.addNodeData({key:'a',kind:'sensor',text:'IMU IC',loc:'80 90'});
                       window.__poc.diagram.model.addNodeData({key:'b',kind:'passive',text:'Decoupling C',loc:'80 220'}); });
await p.waitForTimeout(500);
await p.screenshot({path:'/tmp/poc-4-authored.png'});

// full-window shot of L2 with breadcrumb for the hero image
await p.evaluate(()=>{ document.querySelectorAll('.crumb')[0].click(); });
await p.waitForTimeout(500);
await p.evaluate(()=>{ const d=window.__poc.diagram; window.__poc.drill(d.findNodeForKey('fcb')); });
await p.waitForTimeout(700);
await p.screenshot({path:'/tmp/poc-hero.png'});

console.log(errs.length? '\nERRORS: '+errs.join(' | ') : '\nno page errors');
await b.close();
