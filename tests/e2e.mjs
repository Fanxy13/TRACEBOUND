// Optional end-to-end check in a real browser (needs Playwright + a server):
//   npx http-server . -p 8080 -c-1 &   then   node tests/e2e.mjs [ids] [url]
// Drives every level through the real GameScene with the scripted solutions
// and checks rendering, loop flow and the completion screen without errors.

import { createRequire } from 'module';

let chromium;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require('playwright'));
} catch (e) {
  const require = createRequire('/opt/node22/lib/node_modules/');
  ({ chromium } = require('playwright'));
}

const ids = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
const url = process.argv[3] || 'http://localhost:8080/index.html?tbdebug';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('poki') && !m.text().includes('ERR_')) errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.TBX && window.TBX.game && window.TBX.game.scene.getScene('game').state === 'ready', null, { timeout: 30000 });

const levels = await page.evaluate(async () => {
  const mod = await import('/src/levels/index.js');
  return mod.LEVELS.map((l) => ({ id: l.id, sol: l.sol }));
});

let failed = 0;
for (const lv of levels) {
  if (ids && !ids.includes(lv.id)) continue;
  const t0 = Date.now();
  const res = await page.evaluate(async (lv) => {
    const { Bot } = await import('/src/sim/bot.js');
    const App = window.TBX;
    const gs = App.game.scene.getScene('game');
    const ui = App.game.scene.getScene('ui');
    const wait = (fn, ms = 20000) => new Promise((resolve, reject) => {
      const t = Date.now();
      const iv = setInterval(() => {
        if (fn()) { clearInterval(iv); resolve(); } else if (Date.now() - t > ms) { clearInterval(iv); reject(new Error('timeout in state ' + gs.state)); }
      }, 20);
    });
    ui.closeMenu(true);
    App.bus.emit('cmd', 'load', lv.id);
    await wait(() => gs.state === 'ready' && gs.def && gs.def.id === lv.id);
    for (let i = 0; i < lv.sol.length; i++) {
      gs.bot = new Bot(lv.sol[i]);
      gs.beginRun();
      await wait(() => gs.state === 'ready' || gs.state === 'complete' || gs.state === 'dead', 60000);
      if (gs.state === 'dead') return { ok: false, why: 'died in loop ' + (i + 1) };
      if (gs.state === 'complete') break;
    }
    gs.bot = null;
    if (gs.state !== 'complete') return { ok: false, why: 'not complete, state ' + gs.state };
    await wait(() => ui.menuKind === 'complete', 8000);
    ui.cancelAuto();
    return { ok: true };
  }, lv).catch((e) => ({ ok: false, why: e.message }));
  if (!res.ok) failed++;
  console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${lv.id}  ${((Date.now() - t0) / 1000).toFixed(1)}s ${res.why || ''}`);
  if (errors.length) { console.log(errors.join('\n')); errors.length = 0; failed++; }
}
await page.screenshot({ path: process.env.SHOT || '/tmp/tb-e2e-last.png' });
await browser.close();
console.log(failed ? `${failed} problem(s)` : 'all good');
process.exit(failed ? 1 : 0);
