// Small UI toolkit on top of Phaser: icon buttons with hover/press feel,
// keycaps, pills and panels. Everything is sized in UI units (App.ui).

import { App, FONT } from '../app.js';

export const UI_COL = {
  panel: 0x0c1020,
  panelLine: 0x2c3654,
  text: 0xeaf2ff,
  dim: 0x8390ad,
  good: 0x7dffb3,
  warn: 0xff5a74,
  ad: 0x8f7bff,
  gold: 0xffd66b,
};

export function txt(scene, x, y, str, size, color = '#eaf2ff', opts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: Math.round(size) + 'px',
    color,
    fontStyle: opts.bold === false ? '' : '600',
    align: opts.align || 'center',
    stroke: opts.stroke || undefined,
    strokeThickness: opts.strokeThickness || 0,
  });
  t.setOrigin(opts.ox ?? 0.5, opts.oy ?? 0.5);
  if (opts.resolution) t.setResolution(opts.resolution);
  return t;
}

export class Button extends Phaser.GameObjects.Container {
  /**
   * opts: { icon, size, w, h, fill, line, iconTint, iconScale, label, labelSize, onClick, round, key, disabled }
   */
  constructor(scene, x, y, opts) {
    super(scene, x, y);
    scene.add.existing(this);
    this.opts = opts;
    const u = App.ui;
    this.w = (opts.w || opts.size || 56) * u;
    this.h = (opts.h || opts.size || 56) * u;
    this.round = opts.round !== false && !opts.w;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    if (opts.icon) {
      this.icon = scene.add.image(opts.iconX ? opts.iconX * u : 0, 0, 'i_' + opts.icon).setTint(opts.iconTint ?? 0xffffff);
      const s = (opts.iconScale || 0.55) * Math.min(this.w, this.h) / 96;
      this.icon.setScale(s);
      this.add(this.icon);
    }
    if (opts.label !== undefined) {
      this.label = txt(scene, (opts.labelX || 0) * u, (opts.labelY || 0) * u, opts.label, (opts.labelSize || 20) * u, opts.labelColor || '#eaf2ff');
      this.add(this.label);
    }
    if (opts.key && App.input.mode === 'keyboard') this.addKeycap(opts.key);
    this.hover = false;
    this.pressed = false;
    this.focused = false;
    this.disabled = !!opts.disabled;
    this.highlight = false;
    this.redraw();
    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hover = true; this.redraw(); });
    this.on('pointerout', () => { this.hover = false; this.pressed = false; this.redraw(); });
    this.on('pointerdown', () => { if (this.disabled) return; this.pressed = true; this.redraw(); });
    this.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.redraw();
      this.click();
    });
  }

  addKeycap(k) {
    const u = App.ui;
    const cap = keycap(this.scene, 0, 0, k, 0.62);
    cap.setPosition(this.w / 2 - 4 * u, this.h / 2 - 4 * u);
    this.add(cap);
    this.keycap = cap;
  }

  click() {
    if (this.disabled) { App.audio.play('nothing'); this.shakeNo(); return; }
    App.audio.play('ui');
    this.scene.tweens.add({ targets: this, scale: 0.92, duration: 60, yoyo: true });
    if (this.opts.onClick) this.opts.onClick(this);
  }

  shakeNo() {
    const x = this.x;
    this.scene.tweens.add({ targets: this, x: x + 6 * App.ui, duration: 40, yoyo: true, repeat: 2, onComplete: () => { this.x = x; } });
  }

  setDisabled(d) { this.disabled = d; this.redraw(); return this; }

  setHighlight(h) { this.highlight = h; this.redraw(); return this; }

  setFocus(f) { this.focused = f; this.redraw(); return this; }

  setIcon(name) { if (this.icon) this.icon.setTexture('i_' + name); return this; }

  setFill(c) { this.opts.fill = c; this.redraw(); return this; }

  redraw() {
    const g = this.bg, u = App.ui, o = this.opts;
    const w = this.w, h = this.h;
    g.clear();
    const fill = o.fill ?? UI_COL.panel;
    const line = this.highlight ? UI_COL.gold : (o.line ?? UI_COL.panelLine);
    const lift = this.pressed ? 1 * u : 0;
    const r = this.round ? Math.min(w, h) / 2 : Math.min(16 * u, h / 2);
    // drop shadow
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2, -h / 2 + 3 * u, w, h, r);
    g.fillStyle(fill, this.disabled ? 0.55 : 0.95);
    g.fillRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    g.fillStyle(0xffffff, this.hover && !this.disabled ? 0.1 : 0.04);
    g.fillRoundedRect(-w / 2 + 2 * u, -h / 2 + lift + 2 * u, w - 4 * u, h * 0.45, Math.max(0, r - 2 * u));
    g.lineStyle((this.focused ? 3.5 : 2) * u, this.focused ? 0xffffff : line, this.disabled ? 0.5 : 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    if (this.icon) this.icon.setAlpha(this.disabled ? 0.4 : 1).setY(lift);
    if (this.label) this.label.setAlpha(this.disabled ? 0.5 : 1);
  }
}

/** Keycap prompt: rounded key with a letter or an icon. */
export function keycap(scene, x, y, key, scale = 1) {
  const u = App.ui * scale;
  const c = scene.add.container(x, y);
  const label = { left: '←', right: '→', up: '↑', space: 'SPACE' }[key] || key;
  const wide = label.length > 2;
  const w = (wide ? 64 : 30) * u, h = 30 * u;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-w / 2, -h / 2 + 3 * u, w, h, 7 * u);
  g.fillStyle(0xf2f5ff, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 7 * u);
  g.fillStyle(0xc6cde0, 1);
  g.fillRoundedRect(-w / 2, h / 2 - 5 * u, w, 5 * u, { tl: 0, tr: 0, bl: 7 * u, br: 7 * u });
  c.add(g);
  const t = txt(scene, 0, -1.5 * u, label, (wide ? 13 : 17) * u, '#1a2138');
  c.add(t);
  c.setSize(w, h);
  return c;
}

export function pill(g, x, y, w, h, fill, line, alpha = 0.72) {
  const u = App.ui;
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, h / 2);
  if (line !== undefined) {
    g.lineStyle(2 * u, line, 0.9);
    g.strokeRoundedRect(x, y, w, h, h / 2);
  }
}

export function panel(g, x, y, w, h, accent) {
  const u = App.ui;
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(x, y + 6 * u, w, h, 22 * u);
  g.fillStyle(UI_COL.panel, 0.96);
  g.fillRoundedRect(x, y, w, h, 22 * u);
  g.lineStyle(3 * u, accent, 0.9);
  g.strokeRoundedRect(x, y, w, h, 22 * u);
  g.fillStyle(0xffffff, 0.035);
  g.fillRoundedRect(x + 4 * u, y + 4 * u, w - 8 * u, h * 0.3, 18 * u);
}
