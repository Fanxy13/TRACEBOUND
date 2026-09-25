// Visuals for every mechanism. Views read the simulation state each frame;
// meaning is carried by shape and motion (glyphs, open/closed, depressed),
// with colour only as reinforcement.

import { TILE, TPS } from '../sim/constants.js';
import { hexNum } from './canvas.js';

const T = TILE;
const ADD = 1;

const COL = {
  off: 0x5b6680,
  offDark: 0x2a3144,
  metal: 0x3a4256,
  metalDark: 0x1c2130,
  laser: 0xff4d6a,
  core: 0xffe07a,
  white: 0xffffff,
};

export class MechLayer {
  constructor(scene, world, th) {
    this.scene = scene;
    this.th = th;
    this.accent = hexNum(th.accent);
    this.edge = hexNum(th.edge);
    this.views = [];
    this.glyphOf = new Map();
    let gi = 0;
    for (const t of world.triggers) {
      if (!this.glyphOf.has(t.letter)) this.glyphOf.set(t.letter, gi++ % 8);
    }
    this.wires = scene.add.graphics().setDepth(5);
    this.packets = scene.add.graphics().setDepth(6).setBlendMode(ADD);
    this.buildWires(world);
    for (const t of world.triggers) this.views.push(makeTriggerView(this, t));
    for (const r of world.receivers) this.views.push(makeReceiverView(this, r, world));
    this.coreViews = world.cores.map((c) => new CoreView(this, c));
    this.shardViews = world.shards.map((s) => new ShardView(this, s));
    this.exit = new ExitView(this, world.exit);
    this.t = 0;
  }

  glyphKey(letter) { return 'g_' + (this.glyphOf.get(letter) ?? 0); }

  buildWires(world) {
    this.links = [];
    for (const r of world.receivers) {
      const [rx, ry] = attachPoint(r);
      for (const t of r.inputs) {
        const tx = t.ix, ty = t.y + t.h - 3;
        // L-shaped route along the trigger's floor line, then up/down to the receiver
        const pts = [[tx, ty], [rx, ty], [rx, ry]];
        let len = 0;
        for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        this.links.push({ t, r, pts, len: Math.max(1, len) });
      }
    }
  }

  /** Called on every loop restart with the fresh world. */
  bind(world) {
    const trig = new Map(world.triggers.map((t) => [t.ref, t]));
    const rec = new Map(world.receivers.map((r) => [r.ref, r]));
    for (const v of this.views) v.obj = trig.get(v.obj.ref) || rec.get(v.obj.ref) || v.obj;
    for (const l of this.links) { l.t = trig.get(l.t.ref) || l.t; l.r = rec.get(l.r.ref) || l.r; }
    this.coreViews.forEach((v, i) => { v.obj = world.cores[i]; v.snap = true; });
    this.shardViews.forEach((v, i) => { v.obj = world.shards[i]; });
    for (const v of this.views) if (v.reset) v.reset();
  }

  update(dt, world, alpha) {
    this.t += dt;
    this.drawWires(world);
    for (const v of this.views) v.update(dt, world, alpha);
    for (const v of this.coreViews) v.update(dt, world, alpha);
    for (const v of this.shardViews) v.update(dt);
    this.exit.update(dt);
  }

  drawWires(world) {
    const g = this.wires, p = this.packets;
    g.clear();
    p.clear();
    for (const l of this.links) {
      const on = l.t.powered;
      g.lineStyle(3, on ? this.accent : COL.off, on ? 0.35 : 0.16);
      g.beginPath();
      g.moveTo(l.pts[0][0], l.pts[0][1]);
      for (let i = 1; i < l.pts.length; i++) g.lineTo(l.pts[i][0], l.pts[i][1]);
      g.strokePath();
      const r = l.r;
      if (r.hist) {
        // Delay line: show the signal travelling along the wire
        const D = r.delayTicks;
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const age = Math.floor(u * D);
          const idx = (((world.tick - 1 - age) % D) + D) % D;
          const lit = age < world.tick ? r.hist[idx] : 0;
          if (!lit) continue;
          const [x, y] = pointAt(l, u);
          p.fillStyle(this.accent, 0.9);
          p.fillCircle(x, y, 3.2);
        }
      } else if (on) {
        const n = Math.max(1, Math.floor(l.len / 70));
        for (let i = 0; i < n; i++) {
          const u = ((this.t * 110) / l.len + i / n) % 1;
          const [x, y] = pointAt(l, u);
          p.fillStyle(this.accent, 0.85);
          p.fillCircle(x, y, 2.6);
        }
      }
    }
  }

  destroy() {
    this.wires.destroy();
    this.packets.destroy();
    for (const v of this.views) v.destroy();
    for (const v of this.coreViews) v.destroy();
    for (const v of this.shardViews) v.destroy();
    this.exit.destroy();
  }
}

function pointAt(l, u) {
  let d = u * l.len;
  for (let i = 1; i < l.pts.length; i++) {
    const [x0, y0] = l.pts[i - 1], [x1, y1] = l.pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (d <= seg || i === l.pts.length - 1) {
      const k = seg ? Math.min(1, d / seg) : 0;
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
    d -= seg;
  }
  return l.pts[l.pts.length - 1];
}

function attachPoint(r) {
  if (r.kind === 'door' || r.kind === 'laser') return [r.x + r.w / 2, r.y + r.h - 4];
  if (r.kind === 'lift') return [r.x0 + r.w / 2, r.y0 + 7];
  return [r.x + r.w / 2, r.y + r.h / 2];
}

function makeTriggerView(layer, t) {
  switch (t.kind) {
    case 'plate': return new PlateView(layer, t);
    case 'lever': return new LeverView(layer, t);
    case 'button': return new ButtonView(layer, t);
    default: return new SocketView(layer, t);
  }
}

function makeReceiverView(layer, r, world) {
  switch (r.kind) {
    case 'door': return new DoorView(layer, r);
    case 'bridge': return new BridgeView(layer, r);
    case 'lift': return new LiftView(layer, r);
    default: return new LaserView(layer, r, world);
  }
}

class View {
  constructor(layer, obj) {
    this.layer = layer;
    this.scene = layer.scene;
    this.obj = obj;
    this.parts = [];
  }

  add(o) { this.parts.push(o); return o; }

  destroy() { for (const p of this.parts) p.destroy(); }

  update() {}
}

// ------------------------------------------------------------------ plate

class PlateView extends View {
  constructor(layer, t) {
    super(layer, t);
    const s = this.scene;
    const x = t.x + t.w / 2, y = t.y + t.h;
    this.x = x; this.y = y;
    this.glow = this.add(s.add.image(x, y - 8, 'glow').setBlendMode(ADD).setAlpha(0).setScale(t.w / 60, 0.45).setTint(layer.accent).setDepth(29));
    this.g = this.add(s.add.graphics().setDepth(30));
    this.icon = this.add(s.add.image(x, y - 28, layer.glyphKey(t.letter)).setScale(0.28).setDepth(31));
    this.press = 0;
    this.draw();
  }

  draw() {
    const t = this.obj, g = this.g, w = t.w - 6, x0 = t.x + 3, y = this.y;
    const on = this.press;
    g.clear();
    g.fillStyle(COL.metalDark, 1);
    g.fillRoundedRect(x0 - 1, y - 8, w + 2, 8, 3);
    const lift = 6 - on * 4.5;
    g.fillStyle(on > 0.5 ? this.layer.accent : 0x6f7c99, 1);
    g.fillRoundedRect(x0 + 2, y - 8 - lift, w - 4, lift + 3, 3);
    g.fillStyle(0xffffff, on > 0.5 ? 0.9 : 0.35);
    g.fillRect(x0 + 5, y - 8 - lift + 1, w - 10, 2);
  }

  update(dt) {
    const target = this.obj.powered ? 1 : 0;
    const prev = this.press;
    this.press += (target - this.press) * Math.min(1, dt * 22);
    if (Math.abs(prev - this.press) > 0.01) this.draw();
    this.glow.setAlpha(this.press * 0.85);
    this.icon.setTint(this.obj.powered ? this.layer.accent : 0xdfe6f5);
    this.icon.setY(this.y - 28 - Math.sin(this.layer.t * 3) * 2);
  }
}

// ------------------------------------------------------------------ lever

class LeverView extends View {
  constructor(layer, t) {
    super(layer, t);
    const s = this.scene;
    const x = t.ix, y = t.y + t.h;
    this.x = x; this.y = y;
    this.base = this.add(s.add.graphics().setDepth(30));
    this.base.fillStyle(COL.metalDark, 1);
    this.base.fillRoundedRect(x - 16, y - 10, 32, 10, 4);
    this.base.fillStyle(0x4a5470, 1);
    this.base.fillCircle(x, y - 10, 8);
    this.base.fillStyle(0xffffff, 0.15);
    this.base.fillCircle(x - 2, y - 12, 3);
    this.stick = this.add(s.add.container(x, y - 10).setDepth(31));
    const rod = s.add.graphics();
    rod.fillStyle(0xdfe6f5, 1);
    rod.fillRoundedRect(-2.5, -27, 5, 27, 2.5);
    this.knob = s.add.image(0, -28, 'dot').setScale(1.3);
    this.knobGlow = s.add.image(0, -28, 'glow').setScale(0.4).setBlendMode(ADD);
    this.stick.add([rod, this.knobGlow, this.knob]);
    this.icon = this.add(s.add.image(x, y - 56, layer.glyphKey(t.letter)).setScale(0.28).setDepth(31));
    this.angle = t.on ? 0.6 : -0.6;
    this.stick.setRotation(this.angle);
  }

  reset() { this.angle = this.obj.on ? 0.6 : -0.6; }

  update(dt) {
    const on = this.obj.on;
    const target = on ? 0.6 : -0.6;
    this.angle += (target - this.angle) * Math.min(1, dt * 18);
    this.stick.setRotation(this.angle);
    const c = on ? this.layer.accent : 0xff8a5c;
    this.knob.setTint(c);
    this.knobGlow.setTint(c).setAlpha(on ? 1 : 0.45);
    this.icon.setTint(on ? this.layer.accent : 0xdfe6f5);
  }
}

// ----------------------------------------------------------------- button

class ButtonView extends View {
  constructor(layer, t) {
    super(layer, t);
    const s = this.scene;
    this.x = t.ix; this.y = t.y + t.h;
    this.g = this.add(s.add.graphics().setDepth(30));
    this.ring = this.add(s.add.graphics().setDepth(31));
    this.glow = this.add(s.add.image(this.x, this.y - 14, 'glow').setBlendMode(ADD).setScale(0.45).setAlpha(0).setTint(layer.accent).setDepth(29));
    this.icon = this.add(s.add.image(this.x, this.y - 50, layer.glyphKey(t.letter)).setScale(0.26).setDepth(31));
    this.clock = this.add(s.add.image(this.x, this.y - 50, 'i_clock').setScale(0.16).setDepth(31).setAlpha(0));
  }

  update(dt) {
    const t = this.obj, g = this.g, x = this.x, y = this.y;
    const active = t.timer > 0;
    if (!active && this.lastActive === false) return;
    this.lastActive = active;
    g.clear();
    g.fillStyle(COL.metalDark, 1);
    g.fillRoundedRect(x - 15, y - 24, 30, 24, 5);
    g.fillStyle(active ? this.layer.accent : 0xff8a5c, 1);
    g.fillCircle(x, y - 15, active ? 7.5 : 9);
    g.fillStyle(0xffffff, active ? 0.85 : 0.35);
    g.fillCircle(x - 2.5, y - 17.5, 2.5);
    const r = this.ring;
    r.clear();
    if (active) {
      const frac = t.timer / t.dur;
      r.lineStyle(3.5, this.layer.accent, 1);
      r.beginPath();
      r.arc(x, y - 15, 13.5, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
      r.strokePath();
    } else {
      r.lineStyle(2, 0x6f7c99, 0.8);
      r.strokeCircle(x, y - 15, 13.5);
    }
    this.glow.setAlpha(active ? 0.6 : 0);
    this.icon.setTint(active ? this.layer.accent : 0xdfe6f5);
    this.icon.setX(x - 9);
    this.clock.setX(x + 10).setAlpha(0.9).setTint(active ? this.layer.accent : 0xdfe6f5);
    void dt;
  }
}

// ----------------------------------------------------------------- socket

class SocketView extends View {
  constructor(layer, t) {
    super(layer, t);
    const s = this.scene;
    this.x = t.ix; this.y = t.iy;
    this.g = this.add(s.add.graphics().setDepth(30));
    this.glow = this.add(s.add.image(this.x, this.y, 'glow').setBlendMode(ADD).setScale(0.6).setAlpha(0).setTint(COL.core).setDepth(29));
    this.icon = this.add(s.add.image(this.x, t.y - 12, layer.glyphKey(t.letter)).setScale(0.26).setDepth(31));
    this.draw(false);
    this.last = null;
  }

  draw(on) {
    const g = this.g, x = this.x, y = this.y;
    g.clear();
    g.fillStyle(COL.metalDark, 1);
    g.fillRoundedRect(x - 18, y + 10, 36, 10, 3);
    g.fillStyle(0x0a0d16, 0.8);
    g.fillCircle(x, y, 14);
    g.lineStyle(3.5, on ? COL.core : 0xb6a36a, 1);
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = x + Math.cos(a) * 17, py = y + Math.sin(a) * 17;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
  }

  update() {
    const on = !!this.obj.core;
    if (on !== this.last) { this.draw(on); this.last = on; }
    this.glow.setAlpha(on ? 0.75 + Math.sin(this.layer.t * 5) * 0.15 : 0);
    this.icon.setTint(on ? COL.core : 0xffffff);
  }
}

// ------------------------------------------------------------------- door

class DoorView extends View {
  constructor(layer, r) {
    super(layer, r);
    const s = this.scene;
    this.cx = r.x + r.w / 2;
    this.frame = this.add(s.add.graphics().setDepth(26));
    this.panel = this.add(s.add.graphics().setDepth(27));
    this.badges = this.add(s.add.graphics().setDepth(28));
    this.icons = r.inputs.map((t) => this.add(s.add.image(this.cx, 0, layer.glyphKey(t.letter)).setScale(0.26).setDepth(28)));
    if (r.inv) this.bars = r.inputs.map(() => this.add(s.add.graphics().setDepth(28)));
    if (r.hist) this.add(s.add.image(this.cx, r.y + 10, 'i_hourglass').setScale(0.14).setDepth(28).setAlpha(0.9));
    if (r.cycle) this.clockG = this.add(s.add.graphics().setDepth(28));
    this.open = r.open ? 1 : 0;
    const f = this.frame;
    f.fillStyle(COL.metalDark, 1);
    f.fillRect(r.x + 4, r.y, 6, r.h);
    f.fillRect(r.x + r.w - 10, r.y, 6, r.h);
    f.fillStyle(COL.metal, 1);
    f.fillRect(r.x + 5, r.y, 2, r.h);
  }

  reset() { this.open = this.obj.open ? 1 : 0; this.dirty = true; }

  update(dt, world) {
    const r = this.obj;
    const target = r.open ? 1 : 0;
    const prevOpen = this.open;
    this.open += (target - this.open) * Math.min(1, dt * 16);
    if (Math.abs(target - this.open) < 0.002) this.open = target;
    const moving = Math.abs(prevOpen - this.open) > 0.0005 || this.dirty !== false;
    this.dirty = false;
    const half = (r.h / 2) * (1 - this.open);
    const x0 = r.x + 9, w = r.w - 18;
    if (moving) {
      const g = this.panel;
      g.clear();
      if (half > 0.5) {
        for (const [yy, hh, top] of [[r.y, half, true], [r.y + r.h - half, half, false]]) {
          g.fillStyle(0x3d4868, 1);
          g.fillRect(x0, yy, w, hh);
          g.fillStyle(0x56648c, 1);
          g.fillRect(x0 + 2, yy, 4, hh);
          // hazard stripes
          g.fillStyle(this.layer.accent, 0.28);
          for (let sy = yy - 20; sy < yy + hh; sy += 14) {
            const a = Math.max(yy, sy), b = Math.min(yy + hh, sy + 7);
            if (b > a) g.fillRect(x0 + 8, a, w - 10, b - a);
          }
          g.fillStyle(r.open ? this.layer.accent : 0xffffff, 0.95);
          if (top) g.fillRect(x0, yy + hh - 3, w, 3); else g.fillRect(x0, yy, w, 3);
        }
      }
    }
    const n = this.icons.length;
    this.icons.forEach((ic, i) => {
      const y = r.y + r.h / 2 + (i - (n - 1) / 2) * 22;
      ic.setPosition(this.cx, y);
      const lit = r.inputs[i].powered;
      ic.setTint(lit ? this.layer.accent : 0xffffff);
      ic.setAlpha(this.open > 0.9 ? 0.6 : 1);
      if (this.bars) {
        const b = this.bars[i];
        b.clear();
        b.lineStyle(3, 0xff6b81, 1);
        b.lineBetween(this.cx - 9, y + 9, this.cx + 9, y - 9);
      }
    });
    if (this.clockG) {
      const c = r.cycle;
      const tsec = world.tick / TPS - (c[2] || 0);
      const phase = (((tsec % c[0]) + c[0]) % c[0]) / c[0];
      const g2 = this.clockG;
      const y = r.y + 12;
      g2.clear();
      g2.fillStyle(0x10131c, 0.9);
      g2.fillCircle(this.cx, y, 9);
      g2.lineStyle(3, this.layer.accent, 0.45);
      g2.beginPath();
      g2.arc(this.cx, y, 7, -Math.PI / 2, -Math.PI / 2 + (c[1] / c[0]) * Math.PI * 2, false);
      g2.strokePath();
      g2.lineStyle(2, 0xffffff, 1);
      const a = -Math.PI / 2 + phase * Math.PI * 2;
      g2.lineBetween(this.cx, y, this.cx + Math.cos(a) * 7, y + Math.sin(a) * 7);
    }
  }
}

// ----------------------------------------------------------------- bridge

class BridgeView extends View {
  constructor(layer, r) {
    super(layer, r);
    this.g = this.add(this.scene.add.graphics().setDepth(20));
    this.glow = this.add(this.scene.add.image(r.x + r.w / 2, r.y + r.h / 2, 'glow').setBlendMode(ADD).setDepth(19).setTint(layer.accent).setScale(r.w / 60, r.h / 40).setAlpha(0));
    this.icon = this.add(this.scene.add.image(r.x + 14, r.y + r.h / 2, layer.glyphKey(r.inputs[0]?.letter ?? 'a')).setScale(0.22).setDepth(21));
    this.fill = r.on ? 1 : 0;
  }

  reset() { this.fill = this.obj.on ? 1 : 0; this.drawnOnce = false; }

  update(dt) {
    const r = this.obj;
    const prev = this.fill;
    this.fill += ((r.on ? 1 : 0) - this.fill) * Math.min(1, dt * 14);
    this.frame = (this.frame || 0) + 1;
    const settled = Math.abs(prev - this.fill) < 0.001;
    if (settled && this.drawnOnce && (this.fill < 0.02 || this.frame % 3)) return;
    this.drawnOnce = true;
    const g = this.g;
    g.clear();
    const cells = Math.round(r.w / T) * Math.round(r.h / T);
    const cols = Math.round(r.w / T);
    const t = this.layer.t;
    for (let i = 0; i < cells; i++) {
      const cx = r.x + (i % cols) * T, cy = r.y + Math.floor(i / cols) * T;
      const k = Math.max(0, Math.min(1, this.fill * (cols + 2) - Math.abs(i - (cols - 1) / 2) * 0.6));
      if (k > 0.02) {
        g.fillStyle(this.layer.accent, 0.35 * k);
        g.fillRect(cx + 2, cy + 2, T - 4, T - 4);
        g.fillStyle(0xffffff, 0.7 * k);
        g.fillRect(cx + 2, cy + 2, T - 4, 2);
        g.lineStyle(2, this.layer.accent, 0.9 * k);
        g.strokeRect(cx + 2, cy + 2, T - 4, T - 4);
        const sh = (t * 60 + i * 13) % (T - 8);
        g.fillStyle(0xffffff, 0.12 * k);
        g.fillRect(cx + 4 + sh, cy + 6, 3, T - 12);
      }
      if (k < 0.98) {
        g.lineStyle(1.5, this.layer.accent, 0.35 * (1 - k));
        dashRect(g, cx + 3, cy + 3, T - 6, T - 6, 5);
      }
    }
    this.glow.setAlpha(this.fill * 0.25);
    this.icon.setTint(r.on ? 0xffffff : this.layer.accent).setAlpha(0.5 + this.fill * 0.5);
  }
}

function dashRect(g, x, y, w, h, d) {
  const seg = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.floor(len / (d * 2));
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * d) / len, b = ((i * 2 + 1) * d) / len;
      g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
  };
  seg(x, y, x + w, y); seg(x + w, y, x + w, y + h); seg(x + w, y + h, x, y + h); seg(x, y + h, x, y);
}

// ------------------------------------------------------------------- lift

class LiftView extends View {
  constructor(layer, r) {
    super(layer, r);
    const s = this.scene;
    const rail = this.add(s.add.graphics().setDepth(8));
    const x0 = r.x0 + r.w / 2, y0 = r.y0 + 7, x1 = r.x1 + r.w / 2, y1 = r.y1 + 7;
    rail.lineStyle(2, this.layer.accent, 0.22);
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += 12) {
      const a = d / len, b = Math.min(1, (d + 6) / len);
      rail.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    }
    rail.fillStyle(this.layer.accent, 0.35);
    rail.fillCircle(x0, y0, 3);
    rail.fillCircle(x1, y1, 3);
    this.g = this.add(s.add.graphics().setDepth(27));
    this.glow = this.add(s.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(layer.accent).setScale(r.w / 70, 0.3).setAlpha(0.3).setDepth(26));
    this.icons = r.inputs.map((t) => this.add(s.add.image(0, 0, layer.glyphKey(t.letter)).setScale(0.2).setDepth(28)));
    this.stripe = 0;
  }

  drawSlab() {
    const r = this.obj, g = this.g, w = r.w, h = r.h;
    g.clear();
    g.fillStyle(0x2b3245, 1);
    g.fillRoundedRect(0, 0, w, h, 4);
    g.fillStyle(this.layer.accent, 0.5);
    for (let sx = 2; sx < w - 8; sx += 12) g.fillTriangle(sx, h - 2, sx + 6, h - 2, sx + 10, 6);
    g.fillStyle(0xd9e2f4, 1);
    g.fillRoundedRect(0, 0, w, 5, 2);
    g.fillStyle(this.layer.accent, 1);
    g.fillRect(3, 1, w - 6, 1.5);
    this.drawn = true;
  }

  update(dt, world, alpha) {
    const r = this.obj;
    if (!this.drawn) this.drawSlab();
    // Interpolate between the previous and current tick
    const px = r.x - r.vx * (1 - alpha), py = r.y - r.vy * (1 - alpha);
    this.g.setPosition(px, py);
    const w = r.w, h = r.h;
    this.glow.setPosition(px + w / 2, py + 2).setAlpha(r.moving ? 0.5 : 0.25);
    const n = this.icons.length;
    this.icons.forEach((ic, i) => {
      ic.setPosition(px + w / 2 + (i - (n - 1) / 2) * 16, py + h + 10);
      ic.setTint(r.inputs[i].powered ? this.layer.accent : 0xffffff);
    });
    void world; void dt;
  }
}

// ------------------------------------------------------------------ laser

class LaserView extends View {
  constructor(layer, r, world) {
    super(layer, r);
    const s = this.scene;
    this.cx = r.x + r.w / 2;
    this.em = this.add(s.add.graphics().setDepth(69));
    this.beam = this.add(s.add.graphics().setDepth(70).setBlendMode(ADD));
    this.core = this.add(s.add.graphics().setDepth(71));
    this.glow = this.add(s.add.image(this.cx, r.y + r.h / 2, 'glow').setBlendMode(ADD).setTint(COL.laser).setScale(0.5, r.h / 60).setDepth(68));
    this.icons = r.inputs.map((t, i) => this.add(s.add.image(this.cx, r.y + r.h - 24 - i * 18, layer.glyphKey(t.letter)).setScale(0.22).setDepth(72)));
    this.warn = this.add(s.add.image(this.cx, r.y + 18, 'i_bolt').setScale(0.18).setDepth(72).setTint(COL.laser));
    const e = this.em;
    for (const y of [r.y, r.y + r.h - 8]) {
      e.fillStyle(COL.metalDark, 1);
      e.fillRoundedRect(this.cx - 11, y, 22, 8, 2);
      e.fillStyle(0xffd24a, 1);
      for (let i = 0; i < 3; i++) e.fillTriangle(this.cx - 9 + i * 7, y + 8, this.cx - 5 + i * 7, y + 8, this.cx - 7 + i * 7, y);
    }
    this.seed = 0;
    this.pts = [];
    this.timer = 0;
    void world;
  }

  update(dt) {
    const r = this.obj;
    const on = r.active;
    this.timer -= dt;
    if (this.timer > 0 && on === this.wasOn) return;
    this.wasOn = on;
    if (this.timer <= 0) {
      this.timer = 0.05;
      this.pts = [];
      const n = Math.max(4, Math.round(r.h / 14));
      for (let i = 0; i <= n; i++) this.pts.push([this.cx + (i === 0 || i === n ? 0 : (Math.random() - 0.5) * 9), r.y + 8 + (i / n) * (r.h - 16)]);
    }
    const b = this.beam, c = this.core;
    b.clear(); c.clear();
    if (on) {
      b.lineStyle(9, COL.laser, 0.35);
      b.beginPath(); this.pts.forEach(([x, y], i) => (i ? b.lineTo(x, y) : b.moveTo(x, y))); b.strokePath();
      c.lineStyle(2.5, 0xffffff, 0.95);
      c.beginPath(); this.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokePath();
      this.glow.setAlpha(0.35 + Math.random() * 0.1);
    } else {
      c.lineStyle(1.5, COL.laser, 0.3);
      for (let y = r.y + 10; y < r.y + r.h - 10; y += 12) c.lineBetween(this.cx, y, this.cx, y + 5);
      this.glow.setAlpha(0);
    }
    this.warn.setAlpha(on ? 1 : 0.35);
    this.icons.forEach((ic, i) => ic.setTint(r.inputs[i].powered ? this.layer.accent : 0xffffff));
  }
}

// ------------------------------------------------------------ core & shard

class CoreView extends View {
  constructor(layer, c) {
    super(layer, c);
    const s = this.scene;
    this.glow = this.add(s.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(COL.core).setScale(0.55).setDepth(39));
    this.img = this.add(s.add.image(0, 0, 'core').setTint(COL.core).setScale(0.8).setDepth(40));
    this.x = c.x + c.w / 2; this.y = c.y + c.h / 2;
    this.snap = true;
  }

  update(dt, world, alpha) {
    const c = this.obj;
    let tx = c.px + (c.x - c.px) * alpha + c.w / 2;
    let ty = c.py + (c.y - c.py) * alpha + c.h / 2;
    if (c.holder) {
      const h = c.holder;
      const hx = h.px + (h.x - h.px) * alpha, hy = h.py + (h.y - h.py) * alpha;
      tx = hx + h.w / 2 + h.facing * 4;
      ty = hy - c.h / 2 - 4;
    }
    if (this.snap) { this.x = tx; this.y = ty; this.snap = false; }
    this.x += (tx - this.x) * Math.min(1, dt * 30);
    this.y += (ty - this.y) * Math.min(1, dt * 30);
    const bob = c.holder || c.socket ? 0 : Math.sin(this.layer.t * 3 + c.id) * 1.5;
    this.img.setPosition(this.x, this.y + bob).setRotation(this.layer.t * 0.8);
    this.glow.setPosition(this.x, this.y + bob).setAlpha(0.55 + Math.sin(this.layer.t * 6) * 0.12);
    this.img.setDepth(c.holder ? 56 : 40);
    this.glow.setDepth(c.holder ? 55 : 39);
    void world;
  }
}

class ShardView extends View {
  constructor(layer, sd) {
    super(layer, sd);
    const s = this.scene;
    this.x = sd.x + sd.w / 2; this.y = sd.y + sd.h / 2;
    this.glow = this.add(s.add.image(this.x, this.y, 'glow').setBlendMode(ADD).setTint(0x9fe8ff).setScale(0.6).setDepth(33));
    this.img = this.add(s.add.image(this.x, this.y, 'shardGem').setScale(0.8).setDepth(34));
    this.t = Math.random() * 6;
  }

  update(dt) {
    this.t += dt;
    const vis = !this.obj.taken;
    this.img.setVisible(vis);
    this.glow.setVisible(vis);
    if (!vis) return;
    const y = this.y + Math.sin(this.t * 2.4) * 3;
    this.img.setY(y).setScale(0.8 * (0.85 + Math.abs(Math.cos(this.t * 1.3)) * 0.15), 0.8);
    this.glow.setY(y).setAlpha(0.5 + Math.sin(this.t * 4) * 0.15);
  }
}

// ------------------------------------------------------------------- exit

class ExitView extends View {
  constructor(layer, ex) {
    super(layer, ex);
    const s = this.scene;
    const x = ex.x + ex.w / 2, y = ex.y + ex.h / 2;
    this.x = x; this.y = y;
    this.glow = this.add(s.add.image(x, y, 'glow').setBlendMode(ADD).setTint(layer.accent).setScale(0.9, 1.4).setAlpha(0.7).setDepth(28));
    this.s1 = this.add(s.add.image(x, y, 'swirl').setBlendMode(ADD).setTint(layer.accent).setScale(0.36, 0.62).setDepth(29));
    this.s2 = this.add(s.add.image(x, y, 'swirl').setBlendMode(ADD).setTint(0xffffff).setScale(0.26, 0.46).setAlpha(0.8).setDepth(29));
    this.frame = this.add(s.add.graphics().setDepth(28));
    const f = this.frame;
    f.lineStyle(3, layer.accent, 0.85);
    f.strokeEllipse(x, y, 34, 66);
    f.fillStyle(0x0a0d16, 0.55);
    f.fillEllipse(x, y, 28, 58);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.s1.setRotation(this.t * 2.2);
    this.s2.setRotation(-this.t * 3.1);
    this.glow.setAlpha(0.55 + Math.sin(this.t * 2.5) * 0.15);
  }
}
