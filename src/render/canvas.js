// Canvas2D helpers used to bake crisp textures at start-up (no image files).

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Bake a texture into Phaser's texture manager (replacing an old one). */
export function bake(scene, key, w, h, draw) {
  const tm = scene.textures;
  if (tm.exists(key)) tm.remove(key);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  tm.addCanvas(key, c);
  return key;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Array.isArray(r) ? r : [r, r, r, r];
  const [tl, tr, br, bl] = rr.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function hexNum(hex) { return parseInt(hex.replace('#', ''), 16); }

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return '#' + c(a.r, b.r) + c(a.g, b.g) + c(a.b, b.b);
}

/** Small deterministic PRNG for decorative variation. */
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ctx.roundRect is missing on older Safari: polyfill with quadratic corners
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRectPolyfill(x, y, w, h, r) {
    const rad = typeof r === 'number' ? r : (Array.isArray(r) ? r[0] : 0);
    const k = Math.max(0, Math.min(rad, w / 2, h / 2));
    this.moveTo(x + k, y);
    this.lineTo(x + w - k, y);
    this.quadraticCurveTo(x + w, y, x + w, y + k);
    this.lineTo(x + w, y + h - k);
    this.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
    this.lineTo(x + k, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - k);
    this.lineTo(x, y + k);
    this.quadraticCurveTo(x, y, x + k, y);
    this.closePath();
    return this;
  };
}
