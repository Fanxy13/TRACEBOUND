// Vector icons drawn in code (white on transparent, tinted at runtime).
// Everything is authored in a 100x100 box.

import { bake } from './canvas.js';

const W = 'rgba(255,255,255,1)';

function stroke(ctx, w = 9) {
  ctx.strokeStyle = W;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function fill(ctx) { ctx.fillStyle = W; ctx.fill(); }

function arcArrow(ctx, cx, cy, r, a0, a1, ccw) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1, ccw);
  stroke(ctx, 9);
  const ex = cx + Math.cos(a1) * r;
  const ey = cy + Math.sin(a1) * r;
  const dir = a1 + (ccw ? -Math.PI / 2 : Math.PI / 2);
  const s = 15;
  ctx.beginPath();
  ctx.moveTo(ex + Math.cos(dir + 2.4) * s, ey + Math.sin(dir + 2.4) * s);
  ctx.lineTo(ex + Math.cos(dir) * 4, ey + Math.sin(dir) * 4);
  ctx.lineTo(ex + Math.cos(dir - 2.4) * s, ey + Math.sin(dir - 2.4) * s);
  stroke(ctx, 9);
}

function silhouette(ctx, x, y, s, holo) {
  // Tracer silhouette: capsule body + visor slot
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Water-drop body whose tip turns into the light thread
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.bezierCurveTo(6, -17, 17, -10, 17, 3);
  ctx.bezierCurveTo(17, 13, 10, 18, 0, 18);
  ctx.bezierCurveTo(-10, 18, -17, 13, -17, 3);
  ctx.bezierCurveTo(-17, -10, -6, -17, 0, -26);
  ctx.closePath();
  if (holo) { stroke(ctx, 5); } else fill(ctx);
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.quadraticCurveTo(-2, -34, -10, -34);
  ctx.strokeStyle = W;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-11, -34, 5, 0, Math.PI * 2);
  ctx.fillStyle = W;
  ctx.fill();
  ctx.globalCompositeOperation = holo ? 'source-over' : 'destination-out';
  ctx.beginPath();
  ctx.arc(3, 1, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = W;
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

function star(ctx, cx, cy, r1, r2, n) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function gear(ctx, cx, cy, r, teeth) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth;
    const a1 = ((i + 1) * Math.PI) / teeth;
    const rr = i % 2 ? r * 0.78 : r;
    ctx.arc(cx, cy, rr, a0, a1);
  }
  ctx.closePath();
}

export const ICONS = {
  pause(ctx) { ctx.fillStyle = W; ctx.beginPath(); ctx.roundRect(26, 20, 16, 60, 6); ctx.roundRect(58, 20, 16, 60, 6); ctx.fill(); },
  play(ctx) {
    ctx.beginPath(); ctx.moveTo(32, 18); ctx.lineTo(80, 50); ctx.lineTo(32, 82); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = W; ctx.stroke(); fill(ctx);
  },
  next(ctx) {
    ctx.beginPath(); ctx.moveTo(22, 22); ctx.lineTo(56, 50); ctx.lineTo(22, 78); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = W; ctx.stroke(); fill(ctx);
    ctx.beginPath(); ctx.roundRect(64, 22, 13, 56, 5); fill(ctx);
  },
  restart(ctx) { arcArrow(ctx, 50, 52, 27, Math.PI * 0.75, Math.PI * 2.35, false); },
  rewind(ctx) { arcArrow(ctx, 50, 52, 27, Math.PI * 0.25, -Math.PI * 1.35, true); ctx.beginPath(); ctx.arc(50, 52, 6, 0, Math.PI * 2); fill(ctx); },
  undo(ctx) {
    ctx.beginPath(); ctx.moveTo(30, 40); ctx.lineTo(62, 40); ctx.quadraticCurveTo(82, 40, 82, 60); ctx.quadraticCurveTo(82, 78, 62, 78); ctx.lineTo(44, 78); stroke(ctx, 9);
    ctx.beginPath(); ctx.moveTo(42, 24); ctx.lineTo(26, 40); ctx.lineTo(42, 56); stroke(ctx, 9);
  },
  map(ctx) {
    ctx.fillStyle = W;
    for (const [x, y] of [[20, 20], [56, 20], [20, 56], [56, 56]]) { ctx.beginPath(); ctx.roundRect(x, y, 24, 24, 6); ctx.fill(); }
  },
  lab(ctx) {
    ctx.beginPath(); ctx.moveTo(40, 14); ctx.lineTo(40, 40); ctx.lineTo(20, 76); ctx.quadraticCurveTo(16, 86, 28, 86); ctx.lineTo(72, 86); ctx.quadraticCurveTo(84, 86, 80, 76); ctx.lineTo(60, 40); ctx.lineTo(60, 14); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(34, 14); ctx.lineTo(66, 14); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(29, 66); ctx.lineTo(71, 66); ctx.lineTo(77, 78); ctx.lineTo(23, 78); ctx.closePath(); fill(ctx);
  },
  sound(ctx) {
    ctx.beginPath(); ctx.moveTo(16, 40); ctx.lineTo(32, 40); ctx.lineTo(50, 22); ctx.lineTo(50, 78); ctx.lineTo(32, 60); ctx.lineTo(16, 60); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = W; ctx.stroke(); fill(ctx);
    ctx.beginPath(); ctx.arc(52, 50, 16, -0.9, 0.9); stroke(ctx, 7);
    ctx.beginPath(); ctx.arc(52, 50, 30, -0.9, 0.9); stroke(ctx, 7);
  },
  soundOff(ctx) {
    ICONS.sound(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(12, 88); ctx.lineTo(88, 12); stroke(ctx, 18);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(14, 86); ctx.lineTo(86, 14); stroke(ctx, 8);
  },
  music(ctx) {
    ctx.beginPath(); ctx.moveTo(40, 72); ctx.lineTo(40, 22); ctx.lineTo(76, 14); ctx.lineTo(76, 64); stroke(ctx, 8);
    ctx.beginPath(); ctx.ellipse(31, 74, 12, 9, -0.3, 0, Math.PI * 2); fill(ctx);
    ctx.beginPath(); ctx.ellipse(67, 66, 12, 9, -0.3, 0, Math.PI * 2); fill(ctx);
  },
  musicOff(ctx) {
    ICONS.music(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(12, 88); ctx.lineTo(88, 12); stroke(ctx, 18);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(14, 86); ctx.lineTo(86, 14); stroke(ctx, 8);
  },
  ad(ctx) {
    ctx.beginPath(); ctx.roundRect(12, 22, 76, 56, 12); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(42, 37); ctx.lineTo(64, 50); ctx.lineTo(42, 63); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = W; ctx.stroke(); fill(ctx);
  },
  ghost(ctx) { silhouette(ctx, 50, 54, 1.45, false); },
  ghostHollow(ctx) { silhouette(ctx, 50, 54, 1.45, true); },
  shard(ctx) {
    ctx.beginPath(); ctx.moveTo(50, 8); ctx.lineTo(82, 42); ctx.lineTo(50, 92); ctx.lineTo(18, 42); ctx.closePath(); fill(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(18, 42); ctx.lineTo(82, 42); ctx.lineWidth = 5; ctx.strokeStyle = W; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, 42); ctx.lineTo(50, 92); ctx.lineWidth = 4; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  },
  lock(ctx) {
    ctx.beginPath(); ctx.arc(50, 42, 16, Math.PI, 0); ctx.lineTo(66, 48); ctx.moveTo(34, 48); ctx.lineTo(34, 42); stroke(ctx, 9);
    ctx.beginPath(); ctx.roundRect(24, 46, 52, 40, 9); fill(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(50, 63, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(47, 63, 6, 12);
    ctx.globalCompositeOperation = 'source-over';
  },
  check(ctx) { ctx.beginPath(); ctx.moveTo(22, 52); ctx.lineTo(42, 72); ctx.lineTo(80, 30); stroke(ctx, 12); },
  close(ctx) { ctx.beginPath(); ctx.moveTo(26, 26); ctx.lineTo(74, 74); ctx.moveTo(74, 26); ctx.lineTo(26, 74); stroke(ctx, 11); },
  back(ctx) { ctx.beginPath(); ctx.moveTo(60, 20); ctx.lineTo(30, 50); ctx.lineTo(60, 80); stroke(ctx, 11); },
  hourglass(ctx) {
    ctx.beginPath(); ctx.moveTo(26, 12); ctx.lineTo(74, 12); ctx.moveTo(26, 88); ctx.lineTo(74, 88); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(30, 14); ctx.quadraticCurveTo(30, 40, 50, 50); ctx.quadraticCurveTo(70, 60, 70, 86); ctx.moveTo(70, 14); ctx.quadraticCurveTo(70, 40, 50, 50); ctx.quadraticCurveTo(30, 60, 30, 86); stroke(ctx, 7);
    ctx.beginPath(); ctx.moveTo(38, 84); ctx.quadraticCurveTo(50, 64, 62, 84); ctx.closePath(); fill(ctx);
    ctx.beginPath(); ctx.moveTo(40, 30); ctx.lineTo(60, 30); ctx.lineTo(50, 42); ctx.closePath(); fill(ctx);
  },
  focus(ctx) {
    ctx.beginPath(); ctx.arc(50, 50, 34, 0, Math.PI * 2); stroke(ctx, 7);
    ctx.beginPath(); ctx.arc(50, 50, 19, 0, Math.PI * 2); stroke(ctx, 7);
    ctx.beginPath(); ctx.arc(50, 50, 7, 0, Math.PI * 2); fill(ctx);
  },
  speed(ctx) {
    ctx.beginPath(); ctx.moveTo(18, 24); ctx.lineTo(44, 50); ctx.lineTo(18, 76); stroke(ctx, 11);
    ctx.beginPath(); ctx.moveTo(48, 24); ctx.lineTo(74, 50); ctx.lineTo(48, 76); stroke(ctx, 11);
  },
  echoplus(ctx) {
    silhouette(ctx, 40, 58, 1.2, false);
    ctx.beginPath(); ctx.moveTo(78, 12); ctx.lineTo(78, 40); ctx.moveTo(64, 26); ctx.lineTo(92, 26); stroke(ctx, 8);
  },
  sync(ctx) {
    silhouette(ctx, 50, 76, 0.85, true);
    silhouette(ctx, 50, 32, 0.85, false);
  },
  skin(ctx) {
    ctx.beginPath(); ctx.arc(50, 50, 36, 0, Math.PI * 2); stroke(ctx, 7);
    ctx.fillStyle = W;
    for (const [x, y] of [[36, 36], [60, 32], [68, 54], [40, 62]]) { ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); }
  },
  up(ctx) { ctx.beginPath(); ctx.moveTo(50, 84); ctx.lineTo(50, 20); ctx.moveTo(24, 44); ctx.lineTo(50, 18); ctx.lineTo(76, 44); stroke(ctx, 11); },
  down(ctx) { ctx.beginPath(); ctx.moveTo(50, 16); ctx.lineTo(50, 80); ctx.moveTo(24, 56); ctx.lineTo(50, 82); ctx.lineTo(76, 56); stroke(ctx, 11); },
  arrow(ctx) { ctx.beginPath(); ctx.moveTo(16, 50); ctx.lineTo(80, 50); ctx.moveTo(56, 26); ctx.lineTo(82, 50); ctx.lineTo(56, 74); stroke(ctx, 11); },
  tap(ctx) {
    ctx.beginPath(); ctx.arc(50, 50, 14, 0, Math.PI * 2); fill(ctx);
    ctx.beginPath(); ctx.arc(50, 50, 28, 0, Math.PI * 2); stroke(ctx, 5);
    ctx.beginPath(); ctx.arc(50, 50, 41, 0, Math.PI * 2); ctx.globalAlpha = 0.5; stroke(ctx, 4); ctx.globalAlpha = 1;
  },
  star(ctx) { star(ctx, 50, 52, 42, 18, 5); fill(ctx); },
  clock(ctx) {
    ctx.beginPath(); ctx.arc(50, 50, 36, 0, Math.PI * 2); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(50, 50); ctx.lineTo(50, 26); ctx.moveTo(50, 50); ctx.lineTo(66, 58); stroke(ctx, 8);
  },
  bolt(ctx) { ctx.beginPath(); ctx.moveTo(58, 8); ctx.lineTo(24, 56); ctx.lineTo(48, 56); ctx.lineTo(40, 92); ctx.lineTo(76, 42); ctx.lineTo(52, 42); ctx.closePath(); fill(ctx); },
  broken(ctx) {
    ctx.beginPath(); ctx.arc(34, 50, 16, Math.PI * 0.35, Math.PI * 1.65); stroke(ctx, 8);
    ctx.beginPath(); ctx.arc(66, 50, 16, -Math.PI * 0.65, Math.PI * 0.65); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(46, 22); ctx.lineTo(52, 36); ctx.moveTo(54, 78); ctx.lineTo(48, 64); stroke(ctx, 6);
  },
  bridge(ctx) {
    ctx.fillStyle = W;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.roundRect(10 + i * 28, 44, 24, 24, 4); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(10, 34); ctx.lineTo(90, 34); stroke(ctx, 5);
    ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(20, 80); ctx.lineTo(80, 80); stroke(ctx, 5); ctx.globalAlpha = 1;
  },
  lift(ctx) {
    ctx.beginPath(); ctx.roundRect(18, 58, 64, 14, 5); fill(ctx);
    ctx.beginPath(); ctx.moveTo(50, 48); ctx.lineTo(50, 12); ctx.moveTo(36, 26); ctx.lineTo(50, 12); ctx.lineTo(64, 26); stroke(ctx, 8);
    ctx.beginPath(); ctx.moveTo(50, 80); ctx.lineTo(50, 92); stroke(ctx, 8);
  },
  core(ctx) {
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ctx.lineTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); } ctx.closePath(); fill(ctx);
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(50, 50, 12, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  },
  laser(ctx) {
    ctx.beginPath(); ctx.moveTo(50, 8); ctx.lineTo(38, 30); ctx.lineTo(60, 44); ctx.lineTo(40, 60); ctx.lineTo(60, 74); ctx.lineTo(50, 92); stroke(ctx, 8);
    ctx.fillStyle = W; ctx.fillRect(30, 4, 40, 8); ctx.fillRect(30, 88, 40, 8);
  },
  // World glyphs
  w1(ctx) {
    ctx.beginPath(); ctx.arc(50, 50, 8, 0, Math.PI * 2); fill(ctx);
    for (const r of [22, 36]) { ctx.beginPath(); ctx.arc(50, 50, r, -0.8, 0.8); stroke(ctx, 7); ctx.beginPath(); ctx.arc(50, 50, r, Math.PI - 0.8, Math.PI + 0.8); stroke(ctx, 7); }
  },
  w2(ctx) {
    gear(ctx, 50, 50, 40, 8); fill(ctx);
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(50, 50, 13, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  },
  w3(ctx) { ICONS.clock(ctx); ctx.beginPath(); ctx.arc(50, 50, 5, 0, Math.PI * 2); fill(ctx); },
  w4(ctx) {
    ctx.beginPath(); ctx.moveTo(22, 80); ctx.quadraticCurveTo(18, 22, 80, 18); ctx.quadraticCurveTo(84, 78, 22, 80); fill(ctx);
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.moveTo(26, 76); ctx.quadraticCurveTo(50, 50, 72, 26); ctx.lineWidth = 5; ctx.strokeStyle = W; ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
  },
  w5(ctx) {
    ctx.beginPath(); ctx.moveTo(46, 10); ctx.lineTo(14, 50); ctx.lineTo(46, 90); ctx.closePath(); fill(ctx);
    ctx.beginPath(); ctx.moveTo(54, 10); ctx.lineTo(86, 50); ctx.lineTo(54, 90); ctx.closePath(); ctx.lineWidth = 6; ctx.strokeStyle = W; ctx.lineJoin = 'round'; ctx.stroke();
  },
  w6(ctx) {
    star(ctx, 50, 50, 22, 9, 4); fill(ctx);
    ctx.beginPath(); ctx.ellipse(50, 50, 42, 16, -0.4, 0, Math.PI * 2); stroke(ctx, 5);
  },
};

// Link glyphs: pair a trigger with the receivers it powers (shape, not colour)
export const GLYPHS = [
  (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 30, 0, Math.PI * 2); fill(ctx); },
  (ctx) => { ctx.beginPath(); ctx.moveTo(50, 16); ctx.lineTo(84, 78); ctx.lineTo(16, 78); ctx.closePath(); fill(ctx); },
  (ctx) => { ctx.beginPath(); ctx.roundRect(22, 22, 56, 56, 6); fill(ctx); },
  (ctx) => { ctx.beginPath(); ctx.moveTo(50, 12); ctx.lineTo(86, 50); ctx.lineTo(50, 88); ctx.lineTo(14, 50); ctx.closePath(); fill(ctx); },
  (ctx) => { ctx.beginPath(); ctx.moveTo(50, 16); ctx.lineTo(50, 84); ctx.moveTo(16, 50); ctx.lineTo(84, 50); stroke(ctx, 18); },
  (ctx) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ctx.lineTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); } ctx.closePath(); fill(ctx); },
  (ctx) => { star(ctx, 50, 52, 38, 16, 5); fill(ctx); },
  (ctx) => { ctx.beginPath(); ctx.arc(50, 50, 32, 0, Math.PI * 2); stroke(ctx, 12); ctx.beginPath(); ctx.arc(50, 50, 10, 0, Math.PI * 2); fill(ctx); },
];

export function bakeIcons(scene, size = 96) {
  for (const [name, fn] of Object.entries(ICONS)) {
    bake(scene, 'i_' + name, size, size, (ctx) => {
      ctx.scale(size / 100, size / 100);
      fn(ctx);
    });
  }
  GLYPHS.forEach((fn, i) => {
    bake(scene, 'g_' + i, 64, 64, (ctx) => { ctx.scale(0.64, 0.64); fn(ctx); });
  });
}
