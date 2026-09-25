// Particles and one-shot effects. Emitters are created once per scene and
// re-used (Phaser pools particles internally); ring/beam sprites are pooled.

const ADD = 'ADD';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    const P = (tex, cfg, depth = 60) => {
      const e = scene.add.particles(0, 0, tex, Object.assign({ emitting: false }, cfg));
      e.setDepth(depth);
      return e;
    };
    this.dust = P('dot', {
      lifespan: { min: 260, max: 520 }, speed: { min: 20, max: 90 }, angle: { min: 200, max: 340 },
      scale: { start: 0.55, end: 0 }, alpha: { start: 0.55, end: 0 }, gravityY: -40, tint: 0xcfd8ea,
    }, 49);
    this.sparks = P('spark', {
      lifespan: { min: 300, max: 650 }, speed: { min: 50, max: 220 }, angle: { min: 0, max: 360 },
      scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: ADD, gravityY: 120,
    });
    this.bits = P('dot', {
      lifespan: { min: 400, max: 900 }, speed: { min: 30, max: 160 }, angle: { min: 0, max: 360 },
      scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 }, blendMode: ADD, gravityY: -30,
    });
    this.shatter = P('tri', {
      lifespan: { min: 500, max: 900 }, speed: { min: 110, max: 320 }, angle: { min: 0, max: 360 },
      scale: { start: 0.75, end: 0.15 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 540 }, gravityY: 650,
    });
    this.trail = P('dot', {
      lifespan: { min: 250, max: 450 }, speed: { min: 0, max: 15 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0.5, end: 0 }, blendMode: ADD,
    }, 48);
    this.rings = [];
    this.floaters = [];
  }

  motes(rect, color) {
    if (this.moteEmitter) this.moteEmitter.destroy();
    this.moteEmitter = this.scene.add.particles(0, 0, 'dot', {
      x: { min: rect.x, max: rect.x + rect.w }, y: { min: rect.y, max: rect.y + rect.h },
      lifespan: { min: 4000, max: 8000 }, speedY: { min: -18, max: -6 }, speedX: { min: -6, max: 6 },
      scale: { start: 0.05, end: 0.28 }, alpha: { start: 0, end: 0.45, ease: 'Sine.easeIn' },
      blendMode: ADD, tint: color, frequency: 220, quantity: 1,
    }).setDepth(7);
    this.moteEmitter.alpha = 0.8;
  }

  puff(x, y, n = 5, tint = 0xcfd8ea) {
    this.dust.setParticleTint(tint);
    this.dust.explode(n, x, y);
  }

  burst(x, y, color, n = 14) {
    this.sparks.setParticleTint(color);
    this.sparks.explode(n, x, y);
  }

  glitter(x, y, color, n = 10) {
    this.bits.setParticleTint(color);
    this.bits.explode(n, x, y);
  }

  shards(x, y, color, n = 16) {
    this.shatter.setParticleTint(color);
    this.shatter.explode(n, x, y);
  }

  streak(x, y, color) {
    this.trail.setParticleTint(color);
    this.trail.emitParticleAt(x, y, 1);
  }

  ring(x, y, color, size = 1, dur = 450, depth = 61) {
    let r = this.rings.find((o) => !o.active);
    if (!r) {
      r = this.scene.add.image(0, 0, 'ring').setBlendMode(ADD);
      this.rings.push(r);
    }
    r.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth).setTint(color).setScale(0.05).setAlpha(1);
    this.scene.tweens.add({
      targets: r, scale: size, alpha: 0, duration: dur, ease: 'Cubic.easeOut',
      onComplete: () => r.setActive(false).setVisible(false),
    });
  }

  beam(x, y, color, h = 3) {
    const b = this.scene.add.image(x, y, 'glow').setBlendMode(ADD).setTint(color).setScale(0.35, h).setAlpha(0.9).setDepth(58);
    this.scene.tweens.add({ targets: b, scaleX: 0.02, alpha: 0, duration: 520, ease: 'Cubic.easeIn', onComplete: () => b.destroy() });
  }

  icon(x, y, key, color, scale = 0.28, rise = 40, dur = 1100) {
    const im = this.scene.add.image(x, y, key).setTint(color).setScale(scale * 0.4).setDepth(66);
    this.scene.tweens.add({ targets: im, scale, duration: 180, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: im, y: y - rise, alpha: 0, delay: dur * 0.45, duration: dur * 0.55, ease: 'Sine.easeIn', onComplete: () => im.destroy() });
  }

  flashAt(x, y, color, scale = 1.2) {
    const g = this.scene.add.image(x, y, 'glow').setBlendMode(ADD).setTint(color).setScale(scale).setAlpha(1).setDepth(62);
    this.scene.tweens.add({ targets: g, alpha: 0, scale: scale * 1.6, duration: 380, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  destroy() {
    for (const e of [this.dust, this.sparks, this.bits, this.shatter, this.trail, this.moteEmitter]) if (e) e.destroy();
    for (const r of this.rings) r.destroy();
  }
}
