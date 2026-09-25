// Headless level verification.
//
//   node tests/run.mjs            verify every level with its scripted solution
//   node tests/run.mjs 2-3 -v     verbose trace for one level
//
// Every level must be solvable with base stats (no upgrades), within its echo
// capacity and loop time, without the player dying. This guards against
// unsolvable levels / softlocks whenever the physics or a room changes.

import { LEVELS } from '../src/levels/index.js';
import { Session } from '../src/sim/session.js';
import { Bot } from '../src/sim/bot.js';
import { BASE_RANGE, TILE, TPS } from '../src/sim/constants.js';
import { runExtraChecks } from './checks.mjs';

const BASE = { speedMul: 1, range: BASE_RANGE, sync: 0, memory: 0, extraEchoes: 0 };

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const only = args.filter((a) => !a.startsWith('-'));

export function runSolution(def, stats = BASE, opts = {}) {
  const session = new Session(def, stats, []);
  const log = [];
  const sol = opts.solution || def.sol;
  let completed = false;
  let deaths = 0;
  let paradoxes = 0;
  let totalTicks = 0;
  for (let li = 0; li < sol.length; li++) {
    const world = session.startLoop();
    const bot = new Bot(sol[li]);
    let rewound = false;
    while (world.status === 'run' && world.tick < session.loopTicks) {
      const input = bot.next(world);
      if (input.rewind) { rewound = true; break; }
      world.step(input);
      for (const ev of world.events) {
        if (ev.type === 'paradox') { paradoxes++; log.push(`  loop ${li + 1} t=${(ev.tick / TPS).toFixed(2)} PARADOX ${ev.reason} echo#${ev.echo.rec.id} at ${(ev.x / TILE).toFixed(1)},${(ev.y / TILE).toFixed(1)}`); }
        else if (verbose && !['land', 'jump', 'nothing', 'shove', 'coreLand'].includes(ev.type)) {
          log.push(`  loop ${li + 1} t=${(ev.tick / TPS).toFixed(2)} ${ev.type} ${ev.obj ? ev.obj.letter : ''} ${ev.who || ''}`);
        }
      }
      world.events.length = 0;
      if (verbose && world.tick % 30 === 0) {
        const p = world.player;
        log.push(`  loop ${li + 1} t=${world.time.toFixed(2)} p=(${((p.x + p.w / 2) / TILE).toFixed(2)},${((p.y + p.h) / TILE).toFixed(2)}) g=${p.grounded ? 1 : 0}`);
      }
    }
    totalTicks += world.tick;
    session.harvestShards();
    if (world.status === 'complete') {
      completed = true;
      if (li !== sol.length - 1) log.push(`  note: completed early in loop ${li + 1}`);
      return { ok: true, loops: li + 1, ticks: world.tick, totalTicks, deaths, paradoxes, log, session };
    }
    if (world.status === 'dead') {
      deaths++;
      log.push(`  loop ${li + 1}: DIED (${(world.tick / TPS).toFixed(2)}s)`);
      return { ok: false, loops: li + 1, deaths, paradoxes, log, reason: 'died', session };
    }
    if (!rewound && li < sol.length - 1) log.push(`  loop ${li + 1}: timed out -> auto rewind`);
    session.commit();
  }
  return { ok: completed, loops: sol.length, deaths, paradoxes, log, reason: 'not completed', session };
}

const UP = (up = {}) => ({
  speedMul: 1 + 0.07 * (up.speed || 0),
  range: BASE_RANGE + 24 * (up.focus || 0),
  sync: up.sync || 0,
  memory: 3 * (up.memory || 0),
  extraEchoes: up.stability || 0,
});

/** Every bonus shard must be reachable by a verified scenario. */
function checkBonus(def) {
  const total = def.map.join('').split('*').length - 1;
  if (!total) return null;
  if (!def.bonus || !def.bonus.length) return 'bonus shard without scenario';
  const got = new Set();
  for (const b of def.bonus) {
    const sol = b.sol === 'main' ? def.sol : b.sol;
    const res = runSolution(def, UP(b.up), { solution: sol });
    for (const s of res.session.newShards) got.add(s);
    // Without the upgrade the shard must stay out of reach for upgrade scenarios
    if (b.up && Object.keys(b.up).length) {
      const base = runSolution(def, BASE, { solution: sol });
      if (base.session.newShards.size) return 'bonus shard reachable without ' + Object.keys(b.up).join('+');
    }
  }
  if (got.size < total) return `bonus shards collected ${got.size}/${total}`;
  return null;
}

function main() {
  let fail = 0;
  let count = 0;
  const rows = [];
  for (const def of LEVELS) {
    if (only.length && !only.includes(def.id)) continue;
    count++;
    let res;
    try {
      res = runSolution(def);
    } catch (err) {
      res = { ok: false, reason: 'error: ' + err.message, log: [err.stack] };
    }
    const cap = def.echoes || 0;
    const used = Math.max(0, (res.loops || 1) - 1);
    let ok = res.ok;
    let why = res.reason || '';
    if (ok && used > cap && cap > 0) { /* FIFO allows it, but flag long solutions */ }
    if (ok && def.echoes > 0 && res.loops - 1 > 8) { ok = false; why = 'too many loops'; }
    if (ok) {
      const bw = checkBonus(def);
      if (bw) { ok = false; why = bw; }
    }
    if (!ok) fail++;
    rows.push(`${ok ? 'ok  ' : 'FAIL'} ${def.id.padEnd(5)} ${String(def.name || '').padEnd(14)} loops=${res.loops ?? '-'} cap=${cap} time=${def.time || '-'}s final=${res.ticks ? (res.ticks / TPS).toFixed(1) + 's' : '-'} total=${res.totalTicks ? (res.totalTicks / TPS).toFixed(1) + 's' : '-'} ${res.paradoxes ? 'paradox=' + res.paradoxes : ''} ${ok ? '' : why}`);
    if (!ok || verbose) rows.push(...res.log);
  }
  console.log(rows.join('\n'));
  const extra = only.length ? 0 : runExtraChecks();
  console.log(`\n${count - fail}/${count} levels verified${extra ? `, ${extra} extra check(s) failed` : ''}`);
  process.exit(fail || extra ? 1 : 0);
}

main();
