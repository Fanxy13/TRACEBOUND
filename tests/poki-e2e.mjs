// Optional browser check of the Poki SDK integration with a mocked SDK:
//   npx http-server . -p 8080 -c-1 &   then   node tests/poki-e2e.mjs
// Verifies event order: no gameplayStart before input, no duplicates,
// nothing sent while an ad runs, audio muted during ads, rewards opt-in.

import { createRequire } from 'module';

let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch (e) { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const MOCK = `
window.__poki = [];
window.__adActive = false;
const log = (e) => window.__poki.push({ e, ad: window.__adActive, t: Math.round(performance.now()) });
window.PokiSDK = {
  init: () => { log('init'); return Promise.resolve(); },
  gameLoadingFinished: () => log('gameLoadingFinished'),
  gameplayStart: () => log('gameplayStart'),
  gameplayStop: () => log('gameplayStop'),
  commercialBreak: (cb) => { log('commercialBreak'); window.__adActive = true; if (cb) cb(); return new Promise((r) => setTimeout(() => { window.__adActive = false; log('commercialBreak:end'); r(); }, 300)); },
  rewardedBreak: (o) => { log('rewardedBreak'); window.__adActive = true; if (o && o.onStart) o.onStart(); return new Promise((r) => setTimeout(() => { window.__adActive = false; log('rewardedBreak:end'); r(true); }, 300)); },
  measure: (c, w, a) => log('measure:' + c + ':' + w + ':' + a),
};`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
await ctx.route('**/poki-sdk.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.argv[2] || 'http://localhost:8080/index.html?tbdebug');
await page.waitForFunction(() => window.TBX && window.TBX.game && window.TBX.game.scene.getScene('game').state === 'ready', null, { timeout: 30000 });
await page.waitForTimeout(500);

const problems = [];
const events = async () => page.evaluate(() => window.__poki.map((x) => x.e));
let ev = await events();
if (!ev.includes('init') || !ev.includes('gameLoadingFinished')) problems.push('init/loadingFinished missing');
if (ev.includes('gameplayStart')) problems.push('gameplayStart before first input');

// First input starts gameplay
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(400);
await page.keyboard.up('ArrowRight');
ev = await events();
if (ev.filter((e) => e === 'gameplayStart').length !== 1) problems.push('expected one gameplayStart after input');
if (!ev.includes('measure:level:1-1:start')) problems.push('level start not measured');

// Pause / resume
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.evaluate(() => window.TBX.bus.emit('cmd', 'resume'));
await page.waitForTimeout(300);
ev = await events();
const tail = ev.filter((e) => e.startsWith('gameplay'));
if (tail.join(',') !== 'gameplayStart,gameplayStop,gameplayStart') problems.push('pause/resume sequence wrong: ' + tail.join(','));

// Complete the level with the scripted solution, then continue (commercial break)
await page.evaluate(async () => {
  const { Bot } = await import('/src/sim/bot.js');
  const gs = window.TBX.game.scene.getScene('game');
  gs.bot = new Bot('>4.3 j >9.5 s e >17.5 .');
  if (gs.state === 'ready') gs.beginRun();
});
await page.waitForFunction(() => window.TBX.game.scene.getScene('ui').menuKind === 'complete', null, { timeout: 30000 });
await page.evaluate(() => { const gs = window.TBX.game.scene.getScene('game'); gs.bot = null; });
const mutedDuringAd = await page.evaluate(() => new Promise((resolve) => {
  const A = window.TBX;
  A.game.scene.getScene('ui').goNext();
  setTimeout(() => resolve(A.audio.muted.has('ad') && A.input.blocked), 120);
}));
if (!mutedDuringAd) problems.push('audio/input not paused during commercial break');
await page.waitForFunction(() => window.TBX.game.scene.getScene('game').def.id === '1-2' && window.TBX.game.scene.getScene('game').state === 'ready', null, { timeout: 30000 });
ev = await page.evaluate(() => window.__poki);
const duringAd = ev.filter((x) => x.ad && !x.e.startsWith('commercialBreak') && !x.e.startsWith('rewardedBreak'));
if (duringAd.length) problems.push('SDK events during ad: ' + duringAd.map((x) => x.e).join(','));
const names = ev.map((x) => x.e);
if (!names.includes('measure:level:1-1:complete')) problems.push('level complete not measured');
if (!names.includes('commercialBreak')) problems.push('no commercial break between levels');
const iStop = names.lastIndexOf('gameplayStop'), iBreak = names.indexOf('commercialBreak');
if (iStop > iBreak) problems.push('gameplayStop must come before the break');

// Rewarded extra echo from the pause menu (opt-in)
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(200);
await page.keyboard.up('ArrowLeft');
await page.evaluate(() => window.TBX.bus.emit('cmd', 'pause'));
await page.waitForTimeout(200);
const capBefore = await page.evaluate(() => window.TBX.game.scene.getScene('game').session.capacity);
await page.evaluate(() => window.TBX.game.scene.getScene('ui').askExtraEcho());
await page.waitForTimeout(700);
const capAfter = await page.evaluate(() => window.TBX.game.scene.getScene('game').session.capacity);
if (capAfter !== capBefore + 1) problems.push(`rewarded extra echo not granted (${capBefore} -> ${capAfter})`);
ev = await events();
if (!ev.includes('measure:booster:extra-echo:complete')) problems.push('booster not measured');

// No duplicated consecutive gameplay events overall
const gp = ev.filter((e) => e === 'gameplayStart' || e === 'gameplayStop');
for (let i = 1; i < gp.length; i++) if (gp[i] === gp[i - 1]) { problems.push('duplicate ' + gp[i]); break; }
if (errors.length) problems.push('page errors: ' + errors.join(' | '));

console.log(ev.join('\n'));
console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nPoki integration OK');
await browser.close();
process.exit(problems.length ? 1 : 0);
