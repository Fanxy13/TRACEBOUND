// Animated full-screen world background (behind the room).

import { App } from '../app.js';
import { theme } from '../game/config.js';
import { bake, hexNum, rgba, seeded } from '../render/canvas.js';

const ADD = 1;

export class BgScene extends Phaser.Scene {
  constructor() { super('bg'); }

  create() {
    this.world = 0;
    this.layers = [];
    this.t = 0;
    this.px = 0.5; this.py = 0.5;
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(100).setAlpha(0.85);
    App.bus.on('world', (w) => this.setWorld(w));
    App.bus.on('layout', () => this.relayout());
    App.bus.on('focus', (x, y) => { this.px = x; this.py = y; });
    this.setWorld(1);
  }

  relayout() {
    const W = this.scale.width, H = this.scale.height;
    this.vignette.setDisplaySize(W, H);
    if (this.grad) this.grad.setDisplaySize(W, H);
    for (const l of this.layers) if (l.place) l.place(W, H);
  }

  setWorld(w) {
    if (w === this.world) return;
    this.world = w;
    const th = theme(w);
    const old = [...this.layers, this.grad].filter(Boolean);
    for (const o of old) {
      const obj = o.obj || o;
      this.tweens.add({ targets: obj, alpha: 0, duration: 600, onComplete: () => { if (o.destroy) o.destroy(); else obj.destroy(); } });
    }
    this.layers = [];
    const key = 'bg_grad_' + w;
    if (!this.textures.exists(key)) {
      bake(this, key, 4, 256, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        g.addColorStop(0, th.bgTop);
        g.addColorStop(1, th.bgBot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 4, 256);
      });
    }
    this.grad = this.add.image(0, 0, key).setOrigin(0).setDepth(0).setAlpha(0);
    this.tweens.add({ targets: this.grad, alpha: 1, duration: 600 });
    const W = this.scale.width, H = this.scale.height;
    this.grad.setDisplaySize(W, H);

    // Haze blobs
    const r = seeded(w * 97);
    for (let i = 0; i < 4; i++) {
      const img = this.add.image(0, 0, 'glow').setTint(hexNum(th.haze)).setBlendMode(ADD).setDepth(2).setAlpha(0);
      const layer = {
        obj: img, fx: r(), fy: r(), sp: 0.04 + r() * 0.06, ph: r() * 6, size: 0.5 + r() * 0.5,
        place: (W2, H2) => img.setScale((Math.max(W2, H2) / 128) * layer.size),
      };
      layer.place(W, H);
      this.tweens.add({ targets: img, alpha: 0.5, duration: 900 });
      this.layers.push(layer);
    }
    // Decor silhouettes
    const dkey = 'bg_decor_' + w;
    if (!this.textures.exists(dkey)) bake(this, dkey, 512, 512, (ctx) => drawDecor(ctx, th));
    for (let i = 0; i < 3; i++) {
      const img = this.add.image(0, 0, dkey).setDepth(3).setAlpha(0);
      const layer = {
        obj: img, fx: [0.12, 0.86, 0.55][i], fy: [0.3, 0.72, 0.1][i], sp: 0, ph: i * 2, size: [0.9, 1.3, 0.6][i],
        rot: (i % 2 ? -1 : 1) * (th.decor === 'gears' ? 0.12 : 0.03), depth: 0.3 + i * 0.25,
        place: (W2, H2) => img.setScale((Math.min(W2, H2) / 512) * layer.size),
      };
      layer.place(W, H);
      this.tweens.add({ targets: img, alpha: 0.45, duration: 900 });
      this.layers.push(layer);
    }
    // Drifting particles
    const zone = new Phaser.Geom.Rectangle(0, 0, W, H);
    const em = this.add.particles(0, 0, th.decor === 'stars' ? 'spark' : 'dot', {
      lifespan: { min: 5000, max: 9000 }, speedY: th.decor === 'leaves' ? { min: 4, max: 14 } : { min: -14, max: -4 },
      speedX: { min: -5, max: 5 }, scale: { start: 0.04, end: th.decor === 'stars' ? 0.18 : 0.3 },
      alpha: { start: 0, end: 0.6, ease: 'Sine.easeIn' }, blendMode: 'ADD', tint: hexNum(th.accent), frequency: 140,
      emitZone: { type: 'random', source: zone },
    }).setDepth(4);
    const pl = { obj: em, particles: true, place: (W2, H2) => { zone.width = W2; zone.height = H2; } };
    this.layers.push(pl);
    this.relayout();
  }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    const W = this.scale.width, H = this.scale.height;
    const ox = (this.px - 0.5), oy = (this.py - 0.5);
    for (const l of this.layers) {
      if (l.particles) continue;
      const img = l.obj;
      if (l.rot !== undefined) {
        img.setRotation(img.rotation + l.rot * dt);
        img.setPosition(l.fx * W - ox * 40 * l.depth, l.fy * H - oy * 30 * l.depth);
      } else {
        img.setPosition(
          (l.fx + Math.sin(this.t * l.sp + l.ph) * 0.12) * W - ox * 20,
          (l.fy + Math.cos(this.t * l.sp * 0.8 + l.ph) * 0.1) * H - oy * 15,
        );
      }
    }
  }
}

function drawDecor(ctx, th) {
  const c = (a) => rgba(th.accent, a);
  ctx.translate(256, 256);
  ctx.lineCap = 'round';
  switch (th.decor) {
    case 'rings':
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = c(0.1 - i * 0.012);
        ctx.lineWidth = 3;
        ctx.setLineDash(i % 2 ? [18, 14] : []);
        ctx.beginPath(); ctx.arc(0, 0, 70 + i * 34, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);
      break;
    case 'gears': {
      for (const [r, n, x, y] of [[170, 16, 0, 0], [80, 10, 180, 150]]) {
        ctx.strokeStyle = c(0.1);
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let t = 0; t < n * 2; t++) ctx.arc(x, y, t % 2 ? r * 0.84 : r, (t * Math.PI) / n, ((t + 1) * Math.PI) / n);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'clocks':
      ctx.strokeStyle = c(0.12);
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, l = i % 5 ? 10 : 26;
        ctx.lineWidth = i % 5 ? 2 : 5;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * (190 - l), Math.sin(a) * (190 - l)); ctx.lineTo(Math.cos(a) * 190, Math.sin(a) * 190); ctx.stroke();
      }
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -140); ctx.moveTo(0, 0); ctx.lineTo(90, 60); ctx.stroke();
      break;
    case 'leaves':
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.rotate((i / 7) * Math.PI * 2);
        ctx.fillStyle = c(0.08);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(80, -60, 220, 0); ctx.quadraticCurveTo(80, 60, 0, 0); ctx.fill();
        ctx.strokeStyle = c(0.12); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(210, 0); ctx.stroke();
        ctx.restore();
      }
      break;
    case 'shards': {
      const r = seeded(5);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = c(0.05 + r() * 0.05);
        ctx.strokeStyle = c(0.16);
        ctx.lineWidth = 2;
        const cx = (r() - 0.5) * 360, cy = (r() - 0.5) * 360, s = 40 + r() * 80;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const a = r() * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'stars':
    default: {
      const g = ctx.createRadialGradient(-40, -40, 10, 0, 0, 170);
      g.addColorStop(0, c(0.35));
      g.addColorStop(1, c(0.02));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(th.accent2, 0.25);
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, 0, 240, 60, -0.35, 0, Math.PI * 2); ctx.stroke();
    }
  }
}
