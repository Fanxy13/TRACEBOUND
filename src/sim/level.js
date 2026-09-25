// Parses hand-authored ASCII rooms into level data.
//
// Legend
//   #  wall            =  one-way ledge      |  glass (solid, see-through)
//   ^  floor spikes    v  ceiling spikes     .  empty
//   P  player spawn    X  exit portal        *  bonus shard
//   o  energy core
//   a-z  triggers (plate, lever, button, socket) defined in `obj`
//   A-Z  receivers (door, bridge, lift, laser) defined in `obj`
// Connected cells that share a letter form one object.

import {
  TILE, T_EMPTY, T_SOLID, T_ONEWAY, T_SPIKE, T_SPIKE_DOWN, T_GLASS,
} from './constants.js';

const TILE_CHARS = {
  '#': T_SOLID, '=': T_ONEWAY, '^': T_SPIKE, 'v': T_SPIKE_DOWN, '|': T_GLASS,
};

export const TRIGGER_TYPES = ['plate', 'lever', 'button', 'socket'];
export const RECEIVER_TYPES = ['door', 'bridge', 'lift', 'laser'];

const cache = new WeakMap();

export function parseLevel(def) {
  if (cache.has(def)) return cache.get(def);
  const rows = def.map;
  const h = rows.length;
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  let spawn = null;
  let exit = null;
  const shards = [];
  const cores = [];
  const letters = new Map();

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) throw new Error(`${def.id}: row ${y} has width ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch in TILE_CHARS) { tiles[y * w + x] = TILE_CHARS[ch]; continue; }
      tiles[y * w + x] = T_EMPTY;
      if (ch === '.' || ch === ' ') continue;
      if (ch === 'P') { spawn = { x: x * TILE + TILE / 2, y: (y + 1) * TILE }; continue; }
      if (ch === 'X') { exit = { x: x * TILE, y: (y - 1) * TILE, w: TILE, h: TILE * 2, cx: x, cy: y }; continue; }
      if (ch === '*') { shards.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }); continue; }
      if (ch === 'o') { cores.push({ x: x * TILE + TILE / 2, y: (y + 1) * TILE }); continue; }
      if (/[a-zA-Z]/.test(ch) && ch !== 'P' && ch !== 'X' && ch !== 'o' && ch !== 'v') {
        if (!letters.has(ch)) letters.set(ch, []);
        letters.get(ch).push([x, y]);
        continue;
      }
      throw new Error(`${def.id}: unknown map char '${ch}' at ${x},${y}`);
    }
  }
  if (!spawn) throw new Error(`${def.id}: no spawn`);
  if (!exit) throw new Error(`${def.id}: no exit`);

  const objects = [];
  for (const [letter, cells] of letters) {
    const odef = def.obj && def.obj[letter];
    if (!odef) throw new Error(`${def.id}: no obj definition for '${letter}'`);
    const isTrigger = letter === letter.toLowerCase();
    if (isTrigger && !TRIGGER_TYPES.includes(odef.t)) throw new Error(`${def.id}: '${letter}' must be a trigger`);
    if (!isTrigger && !RECEIVER_TYPES.includes(odef.t)) throw new Error(`${def.id}: '${letter}' must be a receiver`);
    for (const comp of components(cells)) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [cx, cy] of comp) {
        x0 = Math.min(x0, cx); y0 = Math.min(y0, cy);
        x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      }
      objects.push({
        letter, def: odef, trigger: isTrigger,
        cx: x0, cy: y0, cw: x1 - x0 + 1, ch: y1 - y0 + 1,
      });
    }
  }
  // Lifts that rest on the floor keep the floor underneath them solid
  for (const o of objects) {
    if (o.def.t === 'lift' && o.def.floor) {
      for (let x = o.cx; x < o.cx + o.cw; x++) for (let y = o.cy; y < o.cy + o.ch; y++) tiles[y * w + x] = T_SOLID;
    }
  }
  // Every trigger target must exist
  for (const o of objects) {
    if (!o.trigger) continue;
    for (const target of (o.def.to || '')) {
      if (!letters.has(target)) throw new Error(`${def.id}: '${o.letter}' targets missing '${target}'`);
    }
  }
  objects.sort((a, b) => (a.letter < b.letter ? -1 : a.letter > b.letter ? 1 : a.cy - b.cy || a.cx - b.cx));

  const level = { def, id: def.id, w, h, tiles, spawn, exit, shards, cores, objects };
  cache.set(def, level);
  return level;
}

function components(cells) {
  const key = (x, y) => x + ',' + y;
  const set = new Set(cells.map(([x, y]) => key(x, y)));
  const seen = new Set();
  const out = [];
  for (const [sx, sy] of cells) {
    if (seen.has(key(sx, sy))) continue;
    const comp = [];
    const stack = [[sx, sy]];
    seen.add(key(sx, sy));
    while (stack.length) {
      const [x, y] = stack.pop();
      comp.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dy);
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy]); }
      }
    }
    out.push(comp);
  }
  return out;
}
