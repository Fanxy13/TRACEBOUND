// One loop of a level. The world is re-simulated from t=0 every loop: the
// player acts live while every echo is bound to its recorded trace. Echoes
// affect mechanisms exactly like the player, and if the world no longer allows
// their trace (a closed door, a missing platform) they collapse - a paradox.

import {
  TILE, TPS, DT, PHYS, BODY_W, BODY_H, CORE_SIZE,
  T_SOLID, T_ONEWAY, T_SPIKE, T_SPIKE_DOWN, T_GLASS,
  G_AIR, G_STATIC, G_ECHO_BASE,
} from './constants.js';
import { RecordingBuilder, F_LEFT, F_GROUND, F_CARRY, F_RISE } from './recording.js';

const EPS = 1e-4;
const LIFT_THICK = 14;
const SUPPORT_TOL = 3;

function overlap(a, b, m = 0) {
  return a.x + a.w > b.x + m && a.x < b.x + b.w - m && a.y + a.h > b.y + m && a.y < b.y + b.h - m;
}

function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

export class World {
  /**
   * @param level parsed level
   * @param opts { stats:{speedMul, range, sync}, echoes: Recording[], recId, mirror, shardsTaken }
   */
  constructor(level, opts) {
    this.L = level;
    this.W = level.w * TILE;
    this.H = level.h * TILE;
    this.tick = 0;
    this.stats = opts.stats;
    this.mirrorAxis = opts.mirror ? opts.mirror * TILE : 0;
    this.events = [];
    this.status = 'run';
    this.nextRef = 2;
    this.rec = new RecordingBuilder(opts.recId || 0);

    const sp = level.spawn;
    this.player = this.makeBody('player', sp.x - BODY_W / 2, sp.y - BODY_H);
    this.player.alive = true;

    this.echoes = (opts.echoes || []).map((rec, i) => {
      const e = this.makeBody('echo', sp.x - BODY_W / 2, sp.y - BODY_H);
      e.rec = rec;
      e.index = i;
      e.mirror = !!opts.mirror;
      e.state = 'play';
      e.ref = G_ECHO_BASE + rec.id;
      if (e.mirror) e.x = this.mirrorX(e.x);
      e.px = e.x; e.py = e.y;
      return e;
    });

    this.buildObjects(opts.shardsTaken || new Set());
    this.buildSolids();
    this.updateTriggers(true);
    this.updateReceivers(true);
    this.buildSolids();
  }

  makeBody(kind, x, y) {
    return {
      kind, x, y, w: BODY_W, h: BODY_H, px: x, py: y, vx: 0, vy: 0,
      grounded: true, groundRef: G_STATIC, facing: 1,
      coyote: 0, jumpBuf: 0, jumping: false, carry: null,
      landed: 0, airTime: 0,
    };
  }

  mirrorX(x, w = BODY_W) { return 2 * this.mirrorAxis - x - w; }

  emit(type, data) { this.events.push(Object.assign({ type, tick: this.tick }, data)); }

  // ------------------------------------------------------------------ objects

  buildObjects(shardsTaken) {
    this.triggers = [];
    this.receivers = [];
    this.lifts = [];
    this.doors = [];
    this.bridges = [];
    this.lasers = [];
    this.byLetter = new Map();

    for (const o of this.L.objects) {
      const base = {
        letter: o.letter, def: o.def, cx: o.cx, cy: o.cy, cw: o.cw, ch: o.ch,
        x: o.cx * TILE, y: o.cy * TILE, w: o.cw * TILE, h: o.ch * TILE,
        ref: this.nextRef++, powered: false, changedAt: -999,
      };
      if (!this.byLetter.has(o.letter)) this.byLetter.set(o.letter, []);
      this.byLetter.get(o.letter).push(base);
      if (o.trigger) {
        base.kind = o.def.t;
        base.to = o.def.to || '';
        if (base.kind === 'plate') {
          base.sensor = { x: base.x + 3, y: base.y + base.h - 9, w: base.w - 6, h: 9 };
        } else if (base.kind === 'lever') {
          base.on = !!o.def.on;
        } else if (base.kind === 'button') {
          base.timer = 0;
          base.dur = Math.round((o.def.dur || 3) * TPS);
        } else if (base.kind === 'socket') {
          base.core = null;
        }
        base.ix = base.x + base.w / 2;
        base.iy = base.y + base.h / 2;
        this.triggers.push(base);
      } else {
        base.kind = o.def.t;
        base.inputs = [];
        base.all = !!o.def.all;
        base.inv = !!o.def.inv;
        base.cycle = o.def.cycle || null;
        base.delayTicks = Math.round((o.def.delay || 0) * TPS);
        base.hist = base.delayTicks ? new Uint8Array(base.delayTicks) : null;
        base.solid = false;
        if (base.kind === 'door') {
          base.open = false;
          this.doors.push(base);
        } else if (base.kind === 'bridge') {
          base.on = false;
          this.bridges.push(base);
        } else if (base.kind === 'laser') {
          base.active = true;
          this.lasers.push(base);
        } else if (base.kind === 'lift') {
          const d = o.def.move || [0, -3];
          base.x0 = base.x; base.y0 = base.y;
          base.x1 = base.x + d[0] * TILE; base.y1 = base.y + d[1] * TILE;
          base.len = Math.hypot(base.x1 - base.x0, base.y1 - base.y0) || 1;
          base.speed = (o.def.speed || 2.5) * TILE;
          base.mode = o.def.mode || 'hold';
          base.u = o.def.start || 0;
          base.dir = 1;
          base.dwell = Math.round((o.def.wait || 0) * TPS);
          base.h = LIFT_THICK;
          base.x = base.x0 + (base.x1 - base.x0) * base.u;
          base.y = base.y0 + (base.y1 - base.y0) * base.u;
          base.vx = 0; base.vy = 0;
          this.lifts.push(base);
        }
        this.receivers.push(base);
      }
    }
    for (const r of this.receivers) {
      for (const t of this.triggers) if (t.to.includes(r.letter)) r.inputs.push(t);
    }

    this.cores = this.L.cores.map((c, i) => ({
      id: i, x: c.x - CORE_SIZE / 2, y: c.y - CORE_SIZE, w: CORE_SIZE, h: CORE_SIZE,
      px: c.x - CORE_SIZE / 2, py: c.y - CORE_SIZE, vy: 0,
      holder: null, socket: null, groundRef: G_STATIC,
    }));

    const ex = this.L.exit;
    this.exit = { x: ex.x + 8, y: ex.y + 16, w: ex.w - 16, h: ex.h - 16 };
    this.shards = this.L.shards.map((s, i) => ({ id: i, x: s.x - 12, y: s.y - 12, w: 24, h: 24, taken: shardsTaken.has(i) }));
  }

  // ---------------------------------------------------------------- queries

  tileAt(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.L.w || cy >= this.L.h) return T_SOLID;
    return this.L.tiles[cy * this.L.w + cx];
  }

  isSolidTile(cx, cy) {
    const t = this.tileAt(cx, cy);
    return t === T_SOLID || t === T_GLASS;
  }

  /** Dynamic solids that bodies collide with. */
  buildSolids() {
    const s = [];
    for (const d of this.doors) if (d.solid) s.push({ x: d.x + 6, y: d.y, w: d.w - 12, h: d.h, oneWay: false, ref: d.ref, obj: d });
    for (const b of this.bridges) if (b.solid) s.push({ x: b.x, y: b.y, w: b.w, h: b.h, oneWay: false, ref: b.ref, obj: b });
    for (const l of this.lifts) s.push({ x: l.x, y: l.y, w: l.w, h: l.h, oneWay: true, ref: l.ref, obj: l });
    if (this.stats.sync >= 1) {
      for (const e of this.echoes) {
        if (e.state === 'gone') continue;
        s.push({ x: e.x + 1, y: e.y, w: e.w - 2, h: 6, oneWay: true, ref: e.ref, obj: e, echo: true });
      }
    }
    this.solids = s;
    return s;
  }

  // ------------------------------------------------------------- collisions

  /**
   * Sweep a body along one axis against static tiles and dynamic solids.
   * Returns the ref of what it hit (0 if nothing).
   */
  moveX(b, dx, ignore) {
    if (dx === 0) return 0;
    const top = b.y, bot = b.y + b.h;
    const cy0 = Math.floor((top + EPS) / TILE), cy1 = Math.floor((bot - EPS) / TILE);
    let hit = 0;
    if (dx > 0) {
      const r0 = b.x + b.w;
      let r1 = r0 + dx;
      for (let c = Math.floor(r0 / TILE); c * TILE < r1; c++) {
        if (c * TILE < r0 - EPS) continue;
        let blocked = false;
        for (let cy = cy0; cy <= cy1; cy++) if (this.isSolidTile(c, cy)) { blocked = true; break; }
        if (blocked) { r1 = c * TILE; hit = G_STATIC; break; }
      }
      for (const s of this.solids) {
        if (s.oneWay || s.obj === ignore || s.obj === b) continue;
        if (s.y < bot - EPS && s.y + s.h > top + EPS && s.x >= r0 - EPS && s.x < r1) { r1 = s.x; hit = s.ref; }
      }
      b.x = r1 - b.w;
    } else {
      const l0 = b.x;
      let l1 = l0 + dx;
      for (let c = Math.floor((l0 - EPS) / TILE); (c + 1) * TILE > l1; c--) {
        if ((c + 1) * TILE > l0 + EPS) continue;
        let blocked = false;
        for (let cy = cy0; cy <= cy1; cy++) if (this.isSolidTile(c, cy)) { blocked = true; break; }
        if (blocked) { l1 = (c + 1) * TILE; hit = G_STATIC; break; }
      }
      for (const s of this.solids) {
        if (s.oneWay || s.obj === ignore || s.obj === b) continue;
        const sr = s.x + s.w;
        if (s.y < bot - EPS && s.y + s.h > top + EPS && sr <= l0 + EPS && sr > l1) { l1 = sr; hit = s.ref; }
      }
      b.x = l1;
    }
    return hit;
  }

  moveY(b, dy, ignore) {
    if (dy === 0) return 0;
    const left = b.x, right = b.x + b.w;
    const cx0 = Math.floor((left + EPS) / TILE), cx1 = Math.floor((right - EPS) / TILE);
    let hit = 0;
    if (dy > 0) {
      const b0 = b.y + b.h;
      let b1 = b0 + dy;
      for (let r = Math.floor(b0 / TILE); r * TILE < b1; r++) {
        if (r * TILE < b0 - EPS) continue;
        let blocked = false;
        for (let c = cx0; c <= cx1; c++) {
          const t = this.tileAt(c, r);
          if (t === T_SOLID || t === T_GLASS || t === T_ONEWAY) { blocked = true; break; }
        }
        if (blocked) { b1 = r * TILE; hit = G_STATIC; break; }
      }
      for (const s of this.solids) {
        if (s.obj === ignore || s.obj === b) continue;
        if (s.x < right - EPS && s.x + s.w > left + EPS && s.y >= b0 - EPS && s.y < b1) { b1 = s.y; hit = s.ref; }
      }
      b.y = b1 - b.h;
    } else {
      const h0 = b.y;
      let h1 = h0 + dy;
      for (let r = Math.floor((h0 - EPS) / TILE); (r + 1) * TILE > h1; r--) {
        if ((r + 1) * TILE > h0 + EPS) continue;
        let blocked = false;
        for (let c = cx0; c <= cx1; c++) if (this.isSolidTile(c, r)) { blocked = true; break; }
        if (blocked) { h1 = (r + 1) * TILE; hit = G_STATIC; break; }
      }
      for (const s of this.solids) {
        if (s.oneWay || s.obj === ignore || s.obj === b) continue;
        const sb = s.y + s.h;
        if (s.x < right - EPS && s.x + s.w > left + EPS && sb <= h0 + EPS && sb > h1) { h1 = sb; hit = s.ref; }
      }
      b.y = h1;
    }
    return hit;
  }

  /** True if the box overlaps a static solid tile or a (non one-way) dynamic solid. */
  blocked(box, ignore, margin = 0.5) {
    const cx0 = Math.floor((box.x + margin) / TILE), cx1 = Math.floor((box.x + box.w - margin) / TILE);
    const cy0 = Math.floor((box.y + margin) / TILE), cy1 = Math.floor((box.y + box.h - margin) / TILE);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (this.isSolidTile(cx, cy)) return true;
    for (const s of this.solids) {
      if (s.oneWay || s.obj === ignore) continue;
      if (overlap(box, s, margin)) return true;
    }
    return false;
  }

  overlapsDynamic(box, margin = 0.5) {
    for (const s of this.solids) {
      if (s.oneWay) continue;
      if (overlap(box, s, margin)) return s;
    }
    return null;
  }

  hazardAt(box) {
    const cx0 = Math.floor(box.x / TILE), cx1 = Math.floor((box.x + box.w - EPS) / TILE);
    const cy0 = Math.floor(box.y / TILE), cy1 = Math.floor((box.y + box.h - EPS) / TILE);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const t = this.tileAt(cx, cy);
        if (t === T_SPIKE) {
          if (overlap(box, { x: cx * TILE + 6, y: cy * TILE + TILE * 0.55, w: TILE - 12, h: TILE * 0.45 })) return true;
        } else if (t === T_SPIKE_DOWN) {
          if (overlap(box, { x: cx * TILE + 6, y: cy * TILE, w: TILE - 12, h: TILE * 0.45 })) return true;
        }
      }
    }
    for (const l of this.lasers) {
      if (l.active && overlap(box, { x: l.x + 13, y: l.y, w: l.w - 26, h: l.h })) return true;
    }
    return false;
  }

  /** Is there something directly under the feet of this box? */
  hasSupport(b, ignoreEcho) {
    const feet = b.y + b.h;
    const cx0 = Math.floor((b.x + 1) / TILE), cx1 = Math.floor((b.x + b.w - 1) / TILE);
    const row = Math.round(feet / TILE);
    if (Math.abs(row * TILE - feet) <= SUPPORT_TOL) {
      for (let c = cx0; c <= cx1; c++) {
        const t = this.tileAt(c, row);
        if (t === T_SOLID || t === T_GLASS || t === T_ONEWAY) return true;
      }
    }
    for (const s of this.solids) {
      if (s.obj === ignoreEcho) continue;
      if (s.x < b.x + b.w - 1 && s.x + s.w > b.x + 1 && Math.abs(s.y - feet) <= SUPPORT_TOL) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------- step

  /**
   * Advance one tick. input: { left, right, jump, jumpPressed, interact }
   */
  step(input) {
    if (this.status !== 'run') return;
    const k = this.tick;
    this.buildSolids();

    // A. Echoes follow their traces
    for (const e of this.echoes) this.updateEcho(e, k);
    this.buildSolids();

    // B. Player
    this.updatePlayer(input);

    // C. Lifts move and carry what stands on them
    this.updateLifts();
    this.buildSolids();

    // D. Actions: older echoes first, then the live player
    for (const e of this.echoes) {
      if (e.state !== 'play') continue;
      const act = e.rec.actionAt(k);
      if (act) this.echoAction(e, act);
    }
    if (input.interact && this.player.alive) {
      const act = this.playerAction(this.player);
      // In mirror rooms the reflection acts somewhere else, so every press counts
      if (act) this.rec.action(k, this.mirrorAxis ? 'use' : act);
      else if (this.mirrorAxis) this.rec.action(k, 'use');
    }

    // E. Cores
    this.updateCores();

    // F/G. Triggers and receivers
    this.updateTriggers(false);
    this.updateReceivers(false);
    this.buildSolids();

    // H. Echo consistency
    for (const e of this.echoes) this.checkEcho(e, k);

    // I. Player outcome
    this.checkPlayer();

    // J. Record
    const p = this.player;
    let f = 0;
    if (p.facing < 0) f |= F_LEFT;
    if (p.grounded) f |= F_GROUND;
    if (p.carry) f |= F_CARRY;
    if (p.vy < 0 && !p.grounded) f |= F_RISE;
    this.rec.push(p.x, p.y, f);

    this.tick++;
  }

  get time() { return this.tick / TPS; }

  // ----------------------------------------------------------------- player

  updatePlayer(input) {
    const p = this.player;
    p.px = p.x; p.py = p.y;
    if (!p.alive) return;
    const st = this.stats;

    // Ride an echo (Sync)
    if (p.grounded && p.groundRef >= G_ECHO_BASE) {
      const e = this.echoes.find((q) => q.ref === p.groundRef && q.state !== 'gone');
      if (e) {
        this.moveX(p, e.x - e.px);
        this.moveY(p, e.y - e.py, e);
      }
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) p.facing = dir;
    const carryMul = p.carry ? PHYS.carrySpeed : 1;
    const maxV = PHYS.speed * st.speedMul * carryMul;
    const target = dir * maxV;
    let a;
    if (p.grounded) {
      if (dir === 0) a = PHYS.decel;
      else a = (p.vx !== 0 && Math.sign(p.vx) !== dir) ? PHYS.accel * PHYS.turnBoost : PHYS.accel;
    } else {
      a = dir === 0 ? PHYS.airDecel : ((p.vx !== 0 && Math.sign(p.vx) !== dir) ? PHYS.airAccel * 1.4 : PHYS.airAccel);
    }
    p.vx = approach(p.vx, target, a * DT);

    if (input.jumpPressed) p.jumpBuf = PHYS.buffer;
    if (p.grounded) p.coyote = PHYS.coyote;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      let v = PHYS.jumpV * (p.carry ? PHYS.carryJump : 1);
      const fromEcho = p.groundRef >= G_ECHO_BASE;
      if (fromEcho && st.sync >= 2) v *= PHYS.echoBoost;
      p.vy = -v;
      p.jumpBuf = 0;
      p.coyote = 0;
      p.jumping = true;
      p.grounded = false;
      p.groundRef = G_AIR;
      this.emit('jump', { x: p.x + p.w / 2, y: p.y + p.h, boost: fromEcho && st.sync >= 2 });
    }
    if (p.jumpBuf > 0) p.jumpBuf--;
    if (p.coyote > 0 && !p.grounded) p.coyote--;
    if (p.jumping && !input.jump && p.vy < 0) { p.vy *= PHYS.jumpCut; p.jumping = false; }
    if (p.vy >= 0) p.jumping = false;

    let g = PHYS.gravity;
    if (input.jump && Math.abs(p.vy) < PHYS.apexBand) g *= PHYS.apexGrav;
    p.vy = Math.min(p.vy + g * DT, PHYS.fallMax);

    const hx = this.moveX(p, p.vx * DT);
    if (hx) p.vx = 0;
    const wasGrounded = p.grounded;
    const fallV = p.vy;
    const hy = this.moveY(p, p.vy * DT);
    if (p.vy > 0) {
      if (hy) {
        p.grounded = true;
        p.groundRef = hy;
        if (!wasGrounded) {
          p.landed = fallV;
          this.emit('land', { x: p.x + p.w / 2, y: p.y + p.h, v: fallV, who: 'player' });
        }
        p.vy = 0;
      } else {
        p.grounded = false;
        p.groundRef = G_AIR;
      }
    } else if (p.vy < 0) {
      p.grounded = false;
      p.groundRef = G_AIR;
      if (hy) { p.vy = 0; p.jumping = false; this.emit('bonk', { x: p.x + p.w / 2, y: p.y }); }
    }
    if (p.grounded) p.airTime = 0; else p.airTime++;
  }

  // ------------------------------------------------------------------ echoes

  updateEcho(e, k) {
    e.px = e.x; e.py = e.y;
    if (e.state === 'gone') return;
    const rec = e.rec;
    if (k < rec.len) {
      let x = rec.x[k];
      const f = rec.f[k];
      e.facing = (f & F_LEFT) ? -1 : 1;
      if (e.mirror) { x = this.mirrorX(x); e.facing = -e.facing; }
      e.x = x;
      e.y = rec.y[k];
      e.grounded = !!(f & F_GROUND);
      e.rising = !!(f & F_RISE);
      e.recCarry = !!(f & F_CARRY);
    } else {
      if (e.state === 'play') {
        e.state = 'inert';
        e.vy = 0;
        this.emit('echoEnd', { echo: e, x: e.x + e.w / 2, y: e.y + e.h / 2 });
      }
      // Inert: a simple body that only falls
      e.vy = Math.min(e.vy + PHYS.gravity * DT, PHYS.fallMax);
      const hy = this.moveY(e, e.vy * DT, e);
      if (hy) {
        if (!e.grounded && e.vy > 300) this.emit('land', { x: e.x + e.w / 2, y: e.y + e.h, v: e.vy, who: 'echo' });
        e.vy = 0; e.grounded = true; e.groundRef = hy;
      } else { e.grounded = false; e.groundRef = G_AIR; }
      if (e.y > this.H + 200) this.paradox(e, 'fall');
    }
  }

  checkEcho(e, k) {
    if (e.state === 'gone') return;
    const box = { x: e.x, y: e.y, w: e.w, h: e.h };
    if (this.overlapsDynamic(box, 1.5)) return this.paradox(e, 'blocked');
    if (this.hazardAt({ x: e.x + 3, y: e.y + 3, w: e.w - 6, h: e.h - 3 })) return this.paradox(e, 'hazard');
    if (e.state === 'play') {
      if (e.mirror && this.blocked(box, null, 1.5)) return this.paradox(e, 'blocked');
      if (e.grounded && !this.hasSupport(e, e)) return this.paradox(e, 'fall');
    }
  }

  paradox(e, reason) {
    if (e.state === 'gone') return;
    e.state = 'gone';
    if (e.carry) this.dropCore(e, true);
    this.emit('paradox', { echo: e, reason, x: e.x + e.w / 2, y: e.y + e.h / 2 });
  }

  // ------------------------------------------------------------------- lifts

  updateLifts() {
    for (const l of this.lifts) {
      const ox = l.x, oy = l.y;
      const du = (l.speed * DT) / l.len;
      const p = l.powered;
      if (l.mode === 'hold') {
        l.u = approach(l.u, p ? 1 : 0, du);
      } else {
        const running = l.mode === 'loop' ? !p : p;
        if (running) {
          if (l.dwell > 0) l.dwell--;
          else {
            l.u += du * l.dir;
            if (l.u >= 1) { l.u = 1; l.dir = -1; l.dwell = 18; }
            if (l.u <= 0) { l.u = 0; l.dir = 1; l.dwell = 18; }
          }
        }
      }
      l.x = l.x0 + (l.x1 - l.x0) * l.u;
      l.y = l.y0 + (l.y1 - l.y0) * l.u;
      const dx = l.x - ox, dy = l.y - oy;
      l.vx = dx; l.vy = dy;
      l.moving = dx !== 0 || dy !== 0;
      if (!l.moving) continue;
      this.buildSolids();
      const riders = [];
      const p0 = this.player;
      if (p0.alive) riders.push(p0);
      for (const e of this.echoes) if (e.state === 'inert') riders.push(e);
      for (const c of this.cores) if (!c.holder && !c.socket) riders.push(c);
      for (const b of riders) {
        const onIt = b.groundRef === l.ref;
        const hOver = b.x < l.x + l.w - 1 && b.x + b.w > l.x + 1;
        const feet = b.y + b.h;
        // Scoop: a rising lift passes under the feet
        const scoop = !onIt && dy < 0 && hOver && feet > l.y - EPS && feet <= oy + 2 && (b.vy === undefined || b.vy >= 0);
        if (!onIt && !scoop) continue;
        if (onIt) this.moveX(b, dx, l);
        const targetY = l.y - b.h;
        const want = targetY - b.y;
        const before = b.y;
        this.moveY(b, want, l);
        if (Math.abs(b.y - targetY) > 0.5 && want < 0) {
          // Squeezed against a ceiling
          if (b === p0) this.kill('crush');
          else if (b.kind === 'echo') this.paradox(b, 'crush');
          else { b.y = before; }
          continue;
        }
        b.groundRef = l.ref;
        b.grounded = true;
        if (b.vy !== undefined && b.vy > 0) b.vy = 0;
      }
    }
  }

  // ----------------------------------------------------------------- actions

  nearest(list, b, range) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let best = null, bd = range;
    for (const o of list) {
      const d = Math.hypot(o.ix - cx, o.iy - cy);
      if (d <= bd) { bd = d; best = o; }
    }
    return best;
  }

  interactables() {
    const out = [];
    for (const t of this.triggers) if (t.kind === 'lever' || t.kind === 'button') out.push(t);
    for (const c of this.cores) {
      if (c.holder) continue;
      c.ix = c.x + c.w / 2; c.iy = c.y + c.h / 2;
      out.push(c);
    }
    return out;
  }

  /** What would the player interact with right now (for prompts). */
  focusTarget(b = this.player) {
    if (b.carry) {
      const sock = this.freeSocketNear(b);
      return sock ? { kind: 'socket', obj: sock } : { kind: 'drop', obj: b.carry };
    }
    const t = this.nearest(this.interactables(), b, this.stats.range);
    if (!t) return null;
    return { kind: t.kind || 'core', obj: t };
  }

  freeSocketNear(b) {
    const socks = this.triggers.filter((t) => t.kind === 'socket' && !t.core);
    return this.nearest(socks, b, this.stats.range + 12);
  }

  playerAction(b) {
    if (b.carry) { this.dropCore(b, false); return 'drop'; }
    const t = this.nearest(this.interactables(), b, this.stats.range);
    if (!t) { this.emit('nothing', { x: b.x + b.w / 2, y: b.y }); return null; }
    if (t.kind === 'lever') { this.toggleLever(t, b); return 'toggle'; }
    if (t.kind === 'button') { this.pressButton(t, b); return 'press'; }
    this.pickCore(t, b);
    return 'pick';
  }

  echoAction(e, act) {
    const range = this.stats.range;
    if (act === 'use') {
      // Context action resolved at the echo's own (mirrored) position
      if (e.carry) { this.dropCore(e, false); return; }
      const t = this.nearest(this.interactables(), e, range);
      if (!t) { this.emit('fail', { x: e.x + e.w / 2, y: e.y, echo: e }); return; }
      if (t.kind === 'lever') this.toggleLever(t, e);
      else if (t.kind === 'button') this.pressButton(t, e);
      else this.pickCore(t, e);
      return;
    }
    if (act === 'drop') {
      if (e.carry) this.dropCore(e, false); else this.emit('fail', { x: e.x + e.w / 2, y: e.y, echo: e });
      return;
    }
    if (act === 'toggle') {
      const t = this.nearest(this.triggers.filter((q) => q.kind === 'lever'), e, range);
      if (t) this.toggleLever(t, e); else this.emit('fail', { x: e.x + e.w / 2, y: e.y, echo: e });
      return;
    }
    if (act === 'press') {
      const t = this.nearest(this.triggers.filter((q) => q.kind === 'button'), e, range);
      if (t) this.pressButton(t, e); else this.emit('fail', { x: e.x + e.w / 2, y: e.y, echo: e });
      return;
    }
    if (act === 'pick') {
      if (e.carry) return;
      const cores = this.cores.filter((c) => !c.holder);
      for (const c of cores) { c.ix = c.x + c.w / 2; c.iy = c.y + c.h / 2; }
      const c = this.nearest(cores, e, range);
      if (c) this.pickCore(c, e); else this.emit('fail', { x: e.x + e.w / 2, y: e.y, echo: e });
    }
  }

  toggleLever(t, who) {
    t.on = !t.on;
    this.emit('lever', { obj: t, on: t.on, who: who.kind, x: t.ix, y: t.iy });
  }

  pressButton(t, who) {
    t.timer = t.dur;
    this.emit('button', { obj: t, who: who.kind, x: t.ix, y: t.iy });
  }

  pickCore(c, who) {
    if (c.socket) { c.socket.core = null; c.socket = null; }
    c.holder = who;
    who.carry = c;
    this.emit('pick', { core: c, who: who.kind, x: c.x + c.w / 2, y: c.y + c.h / 2 });
  }

  dropCore(who, forced) {
    const c = who.carry;
    if (!c) return;
    who.carry = null;
    c.holder = null;
    const sock = forced ? null : this.freeSocketNear(who);
    if (sock) {
      sock.core = c;
      c.socket = sock;
      c.x = sock.ix - c.w / 2;
      c.y = sock.iy - c.h / 2;
      c.vy = 0;
      this.emit('socket', { obj: sock, core: c, who: who.kind, x: sock.ix, y: sock.iy });
      return;
    }
    c.x = who.x + who.w / 2 - c.w / 2;
    c.y = who.y + who.h - c.h - 6;
    if (this.blocked(c, null, 0.5)) c.y = who.y + who.h - c.h;
    c.vy = 0;
    this.emit('drop', { core: c, who: who.kind, x: c.x + c.w / 2, y: c.y + c.h / 2 });
  }

  // ------------------------------------------------------------------- cores

  updateCores() {
    for (const c of this.cores) {
      c.px = c.x; c.py = c.y;
      if (c.holder) {
        const h = c.holder;
        c.x = h.x + h.w / 2 - c.w / 2 + h.facing * 4;
        c.y = h.y - c.h - 2;
        continue;
      }
      if (c.socket) continue;
      c.vy = Math.min(c.vy + PHYS.gravity * DT, PHYS.fallMax);
      const hy = this.moveY(c, c.vy * DT);
      if (hy) { if (c.vy > 400) this.emit('coreLand', { x: c.x + c.w / 2, y: c.y + c.h }); c.vy = 0; c.groundRef = hy; } else c.groundRef = G_AIR;
      if (c.y > this.H + 100) { const o = this.L.cores[c.id]; c.x = o.x - c.w / 2; c.y = o.y - c.h; c.vy = 0; }
    }
  }

  // ----------------------------------------------------------- mechanisms

  bodiesOnPlates() {
    const list = [];
    if (this.player.alive) list.push(this.player);
    for (const e of this.echoes) if (e.state !== 'gone') list.push(e);
    return list;
  }

  updateTriggers(init) {
    const bodies = this.bodiesOnPlates();
    for (const t of this.triggers) {
      let p = false;
      if (t.kind === 'plate') {
        for (const b of bodies) if (overlap(b, t.sensor)) { p = true; break; }
      } else if (t.kind === 'lever') {
        p = t.on;
      } else if (t.kind === 'button') {
        if (t.timer > 0 && !init) t.timer--;
        p = t.timer > 0;
      } else if (t.kind === 'socket') {
        p = !!t.core;
      }
      if (p !== t.powered) {
        t.powered = p;
        t.changedAt = this.tick;
        if (!init) this.emit(t.kind + (p ? 'On' : 'Off'), { obj: t, x: t.ix, y: t.iy });
      }
    }
  }

  cycleOpen(c) {
    const [period, open, offset = 0] = c;
    const t = this.tick / TPS - offset;
    const m = ((t % period) + period) % period;
    return m < open;
  }

  updateReceivers(init) {
    const newlySolid = [];
    for (const r of this.receivers) {
      let p;
      if (r.inputs.length) {
        p = r.all ? r.inputs.every((t) => t.powered) : r.inputs.some((t) => t.powered);
        if (r.hist) {
          // Signal travels along a delay line: output what came in delayTicks ago
          const i = this.tick % r.delayTicks;
          const out = init ? 0 : r.hist[i];
          if (!init) r.hist[i] = p ? 1 : 0;
          p = !!out;
        }
        if (r.cycle) p = p || this.cycleOpen(r.cycle);
      } else if (r.cycle) {
        p = this.cycleOpen(r.cycle);
      } else {
        p = false;
      }
      if (r.inv) p = !p;
      const changed = p !== r.powered;
      r.powered = p;
      if (changed) r.changedAt = this.tick;
      if (r.kind === 'door') {
        r.open = p;
        const solid = !p;
        if (solid && !r.solid && !init) newlySolid.push(r);
        r.solid = solid;
        if (changed && !init) this.emit(p ? 'doorOpen' : 'doorClose', { obj: r, x: r.x + r.w / 2, y: r.y + r.h / 2 });
      } else if (r.kind === 'bridge') {
        r.on = p;
        if (p && !r.solid && !init) newlySolid.push(r);
        r.solid = p;
        if (changed && !init) this.emit(p ? 'bridgeOn' : 'bridgeOff', { obj: r, x: r.x + r.w / 2, y: r.y + r.h / 2 });
      } else if (r.kind === 'laser') {
        const active = !p;
        if (changed && !init) this.emit(active ? 'laserOn' : 'laserOff', { obj: r, x: r.x + r.w / 2, y: r.y + r.h / 2 });
        r.active = active;
      }
    }
    if (newlySolid.length) {
      this.buildSolids();
      for (const r of newlySolid) this.pushOut(r);
    }
  }

  /** A door or bridge just became solid: shove bodies out of it. */
  pushOut(r) {
    const box = r.kind === 'door' ? { x: r.x + 6, y: r.y, w: r.w - 12, h: r.h } : { x: r.x, y: r.y, w: r.w, h: r.h };
    const p = this.player;
    if (p.alive && overlap(p, box, 0.5)) {
      if (!this.shove(p, box, r)) this.kill('crush');
    }
    for (const e of this.echoes) {
      if (e.state === 'inert' && overlap(e, box, 0.5)) this.paradox(e, 'blocked');
    }
    for (const c of this.cores) {
      if (c.holder || c.socket) continue;
      if (overlap(c, box, 0.5) && !this.shove(c, box, r)) {
        const o = this.L.cores[c.id]; c.x = o.x - c.w / 2; c.y = o.y - c.h; c.vy = 0;
      }
    }
  }

  shove(b, box, ignore) {
    const cx = b.x + b.w / 2, bcx = box.x + box.w / 2;
    const options = [
      { x: box.x - b.w, y: b.y },
      { x: box.x + box.w, y: b.y },
      { x: b.x, y: box.y - b.h },
      { x: b.x, y: box.y + box.h },
    ].map((o) => ({ ...o, d: Math.abs(o.x - b.x) + Math.abs(o.y - b.y) + ((o.x < b.x) !== (cx < bcx) && o.x !== b.x ? 6 : 0) }));
    options.sort((a, c) => a.d - c.d);
    for (const o of options) {
      const test = { x: o.x, y: o.y, w: b.w, h: b.h };
      if (!this.blocked(test, null, 0.5)) {
        b.x = o.x; b.y = o.y;
        if (b.vx !== undefined) b.vx = 0;
        this.emit('shove', { x: b.x + b.w / 2, y: b.y + b.h / 2 });
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ player

  kill(reason) {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    if (p.carry) this.dropCore(p, true);
    this.status = 'dead';
    this.emit('death', { reason, x: p.x + p.w / 2, y: p.y + p.h / 2 });
  }

  checkPlayer() {
    const p = this.player;
    if (!p.alive) return;
    if (this.blocked(p, null, 2)) return this.kill('crush');
    if (this.hazardAt({ x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 })) return this.kill('hazard');
    if (p.y > this.H + 40) return this.kill('fall');
    for (const s of this.shards) {
      if (!s.taken && overlap(p, s)) {
        s.taken = true;
        this.emit('shard', { shard: s, x: s.x + s.w / 2, y: s.y + s.h / 2 });
      }
    }
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const ex = this.exit;
    if (cx > ex.x && cx < ex.x + ex.w && cy > ex.y && cy < ex.y + ex.h) {
      this.status = 'complete';
      this.emit('complete', { x: cx, y: cy });
    }
  }
}
