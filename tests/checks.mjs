// Extra invariants beyond "every level is solvable".

import { LEVELS } from '../src/levels/index.js';
import { Session } from '../src/sim/session.js';
import { World } from '../src/sim/world.js';
import { parseLevel } from '../src/sim/level.js';
import { Bot } from '../src/sim/bot.js';
import { BASE_RANGE } from '../src/sim/constants.js';

const BASE = { speedMul: 1, range: BASE_RANGE, sync: 0, memory: 0, extraEchoes: 0 };

function simulate(def, stats) {
  const s = new Session(def, stats, []);
  const trace = [];
  for (const script of def.sol) {
    const w = s.startLoop();
    const bot = new Bot(script);
    while (w.status === 'run' && w.tick < s.loopTicks) {
      const inp = bot.next(w);
      if (inp.rewind) break;
      w.step(inp);
      w.events.length = 0;
      trace.push(w.player.x.toFixed(4), w.player.y.toFixed(4));
      for (const e of w.echoes) trace.push(e.state, e.x.toFixed(4));
    }
    if (w.status !== 'run') return { status: w.status, trace: trace.join('|') };
    s.commit();
  }
  return { status: 'end', trace: trace.join('|') };
}

// Tiny deterministic PRNG for fuzzing
function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

export function runExtraChecks() {
  let failures = 0;
  const fail = (msg) => { failures++; console.log('FAIL check: ' + msg); };

  // 1. Determinism: the same inputs produce the same world, every time.
  for (const def of LEVELS) {
    const a = simulate(def, BASE);
    const b = simulate(def, BASE);
    if (a.trace !== b.trace || a.status !== b.status) fail(`${def.id} not deterministic`);
  }

  // 2. Upgrades never break a verified solution's physics (no crash, no NaN).
  const MAX = { speedMul: 1.21, range: BASE_RANGE + 72, sync: 2, memory: 9, extraEchoes: 2 };
  for (const def of LEVELS) {
    try { simulate(def, MAX); } catch (e) { fail(`${def.id} crashed with max stats: ${e.message}`); }
  }

  // 3. Fuzz: random input on every level must never produce NaN, escape the
  //    room, or leave a body inside a wall.
  for (const def of LEVELS) {
    const L = parseLevel(def);
    const r = rng(def.id.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
    const s = new Session(def, BASE, []);
    for (let loop = 0; loop < 4; loop++) {
      const w = s.startLoop();
      let held = { left: false, right: false, jump: false };
      for (let i = 0; i < Math.min(s.loopTicks, 900) && w.status === 'run'; i++) {
        if (r() < 0.08) held = { left: r() < 0.45, right: r() < 0.5, jump: r() < 0.3 };
        const inp = { ...held, jumpPressed: held.jump && r() < 0.2, interact: r() < 0.03 };
        w.step(inp);
        w.events.length = 0;
        const p = w.player;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) { fail(`${def.id} NaN position`); break; }
        if (p.alive && (p.x < -1 || p.y < -1 || p.x + p.w > L.w * 40 + 1)) { fail(`${def.id} player escaped room`); break; }
        if (p.alive && w.blocked(p, null, 3)) { fail(`${def.id} player inside solid at tick ${i}`); break; }
        for (const c of w.cores) if (!Number.isFinite(c.x + c.y)) fail(`${def.id} core NaN`);
      }
      if (w.status === 'run' || w.status === 'dead') {
        if (w.status === 'dead') s.discard(); else s.commit();
      } else break;
    }
  }

  // 4. Structural sanity for every level.
  const ids = new Set();
  for (const def of LEVELS) {
    if (ids.has(def.id)) fail(`duplicate id ${def.id}`);
    ids.add(def.id);
    const L = parseLevel(def);
    if (L.w > 32 || L.h > 18) fail(`${def.id} room too large ${L.w}x${L.h}`);
    const ex = L.exit;
    const above = L.tiles[(ex.cy - 1) * L.w + ex.cx];
    if (above !== 0) fail(`${def.id} exit portal blocked above`);
    if (def.echoes > 0 && !def.time) fail(`${def.id} echo level without loop time`);
  }

  // 5. Echoes are necessary: the final run alone (without its helpers) must not
  //    solve an echo level.
  for (const def of LEVELS) {
    if (!(def.echoes > 0) || def.sol.length < 2) continue;
    const s = new Session(def, BASE, []);
    const w = s.startLoop();
    const bot = new Bot(def.sol[def.sol.length - 1]);
    while (w.status === 'run' && w.tick < s.loopTicks) {
      const inp = bot.next(w);
      if (inp.rewind) break;
      w.step(inp);
      w.events.length = 0;
    }
    if (w.status === 'complete') fail(`${def.id} solvable without echoes`);
  }

  // 6. Replay fidelity: an echo replaying an unchanged world must follow its
  //    trace exactly and never paradox.
  for (const def of LEVELS) {
    if (!(def.echoes > 0) || def.mirror) continue;
    const s = new Session(def, BASE, []);
    const w0 = s.startLoop();
    const bot = new Bot(def.sol[0]);
    while (w0.status === 'run' && w0.tick < s.loopTicks) {
      const inp = bot.next(w0);
      if (inp.rewind) break;
      w0.step(inp);
      w0.events.length = 0;
    }
    if (w0.status !== 'run') continue;
    s.commit();
    const rec = s.echoes[s.echoes.length - 1];
    if (!rec) continue;
    const w1 = s.startLoop();
    for (let i = 0; i < rec.len; i++) {
      w1.step({});
      const e = w1.echoes[w1.echoes.length - 1];
      if (e.state === 'gone') { fail(`${def.id} echo paradox in unchanged world at tick ${i}`); break; }
      if (!def.mirror && Math.abs(e.x - rec.x[i]) > 1e-9) { fail(`${def.id} echo drift`); break; }
      w1.events.length = 0;
    }
  }
  return failures;
}
