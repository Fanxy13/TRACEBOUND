// Procedural character rig: squash & stretch, lean, stride, blinking visor
// and a spring-driven light-thread antenna. Used for the player and (as a
// tinted hologram) for every echo.

import { SKIN_ART, PART_SCALE } from './skins.js';

const INV = 1 / PART_SCALE;
const ADD = 1; // Phaser.BlendModes.ADD

export class CharacterView {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.holo = !!opts.holo;
    this.tint = opts.tint ?? 0xffffff;
    this.alpha = 1;
    // Drawn slightly larger than the hitbox for readability on small screens
    this.baseScale = 1.15;
    this.root = scene.add.container(0, 0).setDepth(opts.depth ?? 50).setScale(this.baseScale);
    this.trail = [];
    if (this.holo) {
      for (let i = 0; i < 3; i++) {
        const img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setScale(INV).setAlpha(0);
        this.root.add(img);
        this.trail.push(img);
      }
    }
    this.shadow = scene.add.image(0, 0, 'soft').setTint(0x000000).setAlpha(0.35).setScale(0.55, 0.14);
    this.aura = scene.add.image(0, -18, 'glow').setBlendMode(ADD).setAlpha(this.holo ? 0.28 : 0.16).setScale(0.55);
    this.thread = scene.add.graphics();
    this.footB = scene.add.image(0, 0, '__DEFAULT').setScale(INV);
    this.rig = scene.add.container(0, 0);
    this.body = scene.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setScale(INV);
    this.visor = scene.add.image(2, -19, '__DEFAULT').setScale(INV);
    this.rig.add([this.body, this.visor]);
    this.footF = scene.add.image(0, 0, '__DEFAULT').setScale(INV);
    this.beadGlow = scene.add.image(0, 0, 'glow').setBlendMode(ADD).setScale(0.22).setAlpha(0.6);
    this.bead = scene.add.image(0, 0, '__DEFAULT').setScale(INV);
    this.root.add([this.shadow, this.aura, this.thread, this.footB, this.rig, this.footF, this.beadGlow, this.bead]);
    if (this.holo) {
      this.ring = scene.add.image(0, -1, 'ring').setScale(0.2, 0.06).setAlpha(0);
      this.root.addAt(this.ring, 0);
    }

    this.sx = 1; this.sy = 1; this.svx = 0; this.svy = 0;
    this.phase = 0;
    this.facing = 1;
    this.t = Math.random() * 10;
    this.blinkAt = 1 + Math.random() * 3;
    this.blink = 0;
    this.bx = 0; this.by = 0; this.bvx = 0; this.bvy = 0; this.beadInit = false;
    this.lastX = null; this.lastY = null;
    this.flash = 0;
    this.special = null;
    this.setSkin(opts.skin || 'tracer');
    this.setTint(this.tint);
  }

  setSkin(id) {
    this.skin = id;
    this.art = SKIN_ART[id] || SKIN_ART.tracer;
    const h = this.holo ? '_h' : '';
    this.body.setTexture(`c_${id}_body${h}`);
    this.visor.setTexture(`c_${id}_visor${h}`);
    this.footB.setTexture(`c_${id}_foot${h}`);
    this.footF.setTexture(`c_${id}_foot${h}`);
    this.bead.setTexture(`c_${id}_bead${h}`);
    for (const t of this.trail) t.setTexture(`c_${id}_body${h}`);
    this.threadColor = this.holo ? this.tint : parseInt(this.art.thread.slice(1), 16);
    this.beadGlow.setTint(this.holo ? this.tint : parseInt(this.art.bead.slice(1), 16));
    this.aura.setTint(this.holo ? this.tint : parseInt(this.art.bead.slice(1), 16));
  }

  setTint(c) {
    this.tint = c;
    if (!this.holo) return;
    for (const o of [this.body, this.visor, this.footB, this.footF, this.bead, ...this.trail]) o.setTint(c);
    this.beadGlow.setTint(c);
    this.aura.setTint(c);
    if (this.ring) this.ring.setTint(c);
    this.threadColor = c;
  }

  setAlpha(a) { this.alpha = a; this.root.setAlpha(a); }

  setVisible(v) { this.root.setVisible(v); }

  setDepth(d) { this.root.setDepth(d); }

  /** Impulses from gameplay events. */
  jump(boost) { this.sx = boost ? 0.72 : 0.8; this.sy = boost ? 1.32 : 1.22; this.svx = 0; this.svy = 0; }

  land(v) {
    const k = Math.min(1, Math.max(0.25, v / 900));
    this.sx = 1 + 0.32 * k; this.sy = 1 - 0.28 * k; this.svx = 0; this.svy = 0;
  }

  poke() { this.flash = 1; this.sx = 1.12; this.sy = 0.9; }

  resetMotion(x, y) {
    this.lastX = x; this.lastY = y;
    this.beadInit = false;
    this.sx = this.sy = 1; this.svx = this.svy = 0;
    for (const t of this.trail) t.setAlpha(0);
    this.trailPos = null;
  }

  /**
   * @param dt seconds
   * @param s { x, y (feet), vx, vy, grounded, facing, carrying, inert }
   */
  update(dt, s) {
    this.t += dt;
    const root = this.root;
    root.setPosition(s.x, s.y);
    let vx = s.vx, vy = s.vy;
    if (vx === undefined) {
      vx = this.lastX === null ? 0 : (s.x - this.lastX) / Math.max(dt, 1e-3);
      vy = this.lastY === null ? 0 : (s.y - this.lastY) / Math.max(dt, 1e-3);
      vx = Math.max(-600, Math.min(600, vx));
    }
    this.lastX = s.x; this.lastY = s.y;
    if (s.facing) this.facing = s.facing;
    const f = this.facing;
    const speed = Math.abs(vx);
    const run = Math.min(1, speed / 240);
    const grounded = s.grounded;

    // Squash & stretch spring back to 1
    const k = 260, d = 18;
    this.svx += ((1 - this.sx) * k - this.svx * d) * dt;
    this.svy += ((1 - this.sy) * k - this.svy * d) * dt;
    this.sx += this.svx * dt;
    this.sy += this.svy * dt;
    let sx = this.sx, sy = this.sy;
    if (!grounded) {
      const stretch = Math.max(-0.12, Math.min(0.12, -vy / 5000));
      sy += stretch; sx -= stretch * 0.7;
    } else {
      sy += Math.sin(this.t * 2.6) * 0.014 * (1 - run);
    }
    if (s.carrying) { sy *= 0.95; sx *= 1.04; }

    // Stride
    if (grounded && speed > 8) this.phase += dt * (6 + speed * 0.055);
    const stride = grounded ? run : 0;
    const bob = grounded ? -Math.abs(Math.sin(this.phase)) * 2.3 * stride : 0;
    const lean = Math.max(-0.14, Math.min(0.14, vx / 1800)) + (grounded ? 0 : Math.max(-0.08, Math.min(0.08, vx / 3500)));

    this.rig.setPosition(0, bob);
    this.rig.setScale(sx * f, sy);
    this.rig.setRotation(lean);

    // Feet
    if (grounded) {
      const a = Math.sin(this.phase), b = Math.cos(this.phase);
      this.footF.setPosition(5 * f + a * 4.5 * stride * f, -2.6 - Math.max(0, b) * 3.4 * stride);
      this.footB.setPosition(-5 * f - a * 4.5 * stride * f, -2.6 - Math.max(0, -b) * 3.4 * stride);
    } else {
      const tuck = vy < 0 ? -5.5 : -3.5;
      this.footF.setPosition(4.5 * f, tuck);
      this.footB.setPosition(-4.5 * f, tuck + 1);
    }
    this.footF.setScale(INV * f, INV);
    this.footB.setScale(INV * f, INV);
    this.shadow.setVisible(grounded);
    this.shadow.setScale(0.5 + run * 0.08, 0.13);

    // Visor: blink, look direction, flash on interaction
    this.blinkAt -= dt;
    if (this.blinkAt <= 0) { this.blink = 0.1; this.blinkAt = 2.2 + Math.random() * 3.5; }
    if (this.blink > 0) this.blink -= dt;
    const look = Math.max(-2, Math.min(2, vy / 300));
    this.visor.setPosition(2.5, -19 + look * 0.6);
    this.visor.setScale(INV, INV * (this.blink > 0 ? 0.18 : 1));
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      if (this.flash > 0.5) this.visor.setTintFill(0xffffff);
      else if (this.holo) this.visor.setTint(this.tint);
      else this.visor.clearTint();
    }

    // Antenna thread: head anchor in world space, bead on a spring
    const cos = Math.cos(lean), sin = Math.sin(lean);
    const hx = 0, hy = -(this.art.anchor || 33) * sy + bob;
    const ax = hx * cos - hy * sin;
    const ay = hx * sin + hy * cos;
    const rod = this.art.rod;
    const tx = ax + (rod ? -2 * f : -7 * f) + Math.sin(this.t * 1.7) * 1.2;
    const ty = ay + (rod ? -8 : -7) + Math.cos(this.t * 2.1) * 0.8;
    if (!this.beadInit) { this.bx = tx; this.by = ty; this.bvx = this.bvy = 0; this.beadInit = true; }
    // Bead lives in local space; counter the root's motion so it lags behind
    const mdx = (vx * dt) || 0, mdy = (vy * dt) || 0;
    this.bx -= mdx * 0.55; this.by -= mdy * 0.55;
    const kk = rod ? 900 : 180, dd = rod ? 40 : 11;
    this.bvx += ((tx - this.bx) * kk - this.bvx * dd) * dt;
    this.bvy += ((ty - this.by) * kk - this.bvy * dd) * dt;
    this.bx += this.bvx * dt;
    this.by += this.bvy * dt;
    const maxLen = 13;
    const dx = this.bx - ax, dy = this.by - ay;
    const len = Math.hypot(dx, dy);
    if (len > maxLen) { this.bx = ax + (dx / len) * maxLen; this.by = ay + (dy / len) * maxLen; }
    this.bead.setPosition(this.bx, this.by);
    this.beadGlow.setPosition(this.bx, this.by);
    this.beadGlow.setAlpha(0.45 + Math.sin(this.t * 4) * 0.12);
    const g = this.thread;
    g.clear();
    g.lineStyle(1.6, this.threadColor, this.holo ? 0.8 : 0.9);
    g.beginPath();
    g.moveTo(ax, ay);
    const cxp = ax + (rod ? 0 : 1 * f), cyp = ay - 6;
    // quadratic curve by sampling
    for (let i = 1; i <= 6; i++) {
      const u = i / 6;
      const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cxp + u * u * this.bx;
      const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cyp + u * u * this.by;
      g.lineTo(x, y);
    }
    g.strokePath();

    this.aura.setPosition(0, -18 + bob);

    // Echo extras: afterimages and an "idle" ring once the trace ended
    if (this.holo) {
      if (!this.trailPos) this.trailPos = [];
      this.trailTick = (this.trailTick || 0) + dt;
      if (this.trailTick > 0.045) {
        this.trailTick = 0;
        this.trailPos.unshift({ x: s.x, y: s.y + bob, r: lean, sx: sx * f, sy });
        if (this.trailPos.length > 7) this.trailPos.pop();
      }
      const moving = speed > 30 || Math.abs(vy) > 60;
      this.trail.forEach((img, i) => {
        const p = this.trailPos[(i + 1) * 2];
        if (!p || !moving) { img.setAlpha(Math.max(0, img.alpha - dt * 3)); return; }
        img.setPosition(p.x - s.x, p.y - s.y);
        img.setScale(INV * p.sx, INV * p.sy);
        img.setRotation(p.r);
        img.setAlpha(0.22 - i * 0.06);
      });
      if (this.ring) {
        const want = s.inert ? 0.55 : 0;
        this.ring.setAlpha(this.ring.alpha + (want - this.ring.alpha) * Math.min(1, dt * 6));
        this.ring.setScale(0.2 + Math.sin(this.t * 3) * 0.015, 0.06);
      }
      this.aura.setAlpha(s.inert ? 0.18 + Math.sin(this.t * 3) * 0.05 : 0.28);
    }
  }

  destroy() { this.root.destroy(); }
}
