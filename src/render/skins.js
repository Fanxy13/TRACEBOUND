// The Tracer: an original character drawn in code. Every skin shares one
// silhouette language (rounded body, visor, light-thread antenna) so echoes
// read instantly, and each skin gets its own shape and palette.
//
// Parts are baked at 3x and composed per frame (squash, lean, stride).

import { bake, seeded } from './canvas.js';

export const PART_SCALE = 3;
const S = PART_SCALE;

export const SKIN_ART = {
  tracer: {
    shape: 'drop', top: '#3d5a94', bot: '#18203c', line: '#080d1c', band: '#7ff0ff',
    visor: 'eye', visorCol: '#9ff7ff', foot: '#0c1224', bead: '#7ff0ff', thread: '#7ff0ff', rim: '#8fb4ff',
    particle: 0x7ff0ff, anchor: 37,
  },
  ghost: {
    shape: 'sheet', top: '#f4f7ff', bot: '#c3cdeb', line: '#5c6892', band: null,
    visor: 'eyes', visorCol: '#1b2140', foot: '#aab4d4', bead: '#dccbff', thread: '#dccbff', rim: '#ffffff',
    particle: 0xdccbff,
  },
  robot: {
    shape: 'box', top: '#b3bdcc', bot: '#5d6878', line: '#1b2029', band: '#ffcf4a',
    visor: 'cyclops', visorCol: '#ff4f4f', foot: '#353c48', bead: '#ff4f4f', thread: '#707c8e', rim: '#e8eef8',
    particle: 0xff7a5a, rod: true,
  },
  shadow: {
    shape: 'taper', top: '#1d1830', bot: '#05040a', line: '#8d5cff', band: null,
    visor: 'slits', visorCol: '#caa0ff', foot: '#05040a', bead: '#b57cff', thread: '#8d5cff', rim: '#a57dff',
    particle: 0xb57cff,
  },
  crystal: {
    shape: 'facet', top: '#8ffbef', bot: '#1c7f86', line: '#0c4a50', band: null,
    visor: 'gem', visorCol: '#f0ffff', foot: '#11666c', bead: '#c8fff8', thread: '#8ffbef', rim: '#ffffff',
    particle: 0x9ffff0,
  },
  energy: {
    shape: 'flame', top: '#ffd05a', bot: '#e0661a', line: '#6e2a05', band: '#fff4b8',
    visor: 'eye', visorCol: '#fffbe8', foot: '#8a3a0a', bead: '#fff07a', thread: '#ffc24a', rim: '#fff4c2',
    particle: 0xffd45a, core: true, anchor: 38,
  },
  cosmic: {
    shape: 'orb', top: '#3a2a86', bot: '#0d0a2a', line: '#04020d', band: '#ff9ae0',
    visor: 'nebula', visorCol: '#ff8ad8', foot: '#0a0720', bead: '#ffffff', thread: '#a58cff', rim: '#9ee7ff',
    particle: 0xc9b8ff, stars: true, anchor: 33,
  },
};

function bodyPath(ctx, shape) {
  ctx.beginPath();
  switch (shape) {
    case 'sheet':
      ctx.moveTo(-13, -4);
      ctx.lineTo(-13, -21);
      ctx.bezierCurveTo(-13, -38, 13, -38, 13, -21);
      ctx.lineTo(13, -4);
      ctx.quadraticCurveTo(10.5, -8, 8.5, -3);
      ctx.quadraticCurveTo(6, -8, 3, -3.5);
      ctx.quadraticCurveTo(0, -8, -3, -3.5);
      ctx.quadraticCurveTo(-6, -8, -8.5, -3);
      ctx.quadraticCurveTo(-10.5, -8, -13, -4);
      break;
    case 'box':
      ctx.roundRect(-13, -33, 26, 29, 4.5);
      break;
    case 'taper':
      ctx.moveTo(-9, -4);
      ctx.lineTo(-13, -22);
      ctx.bezierCurveTo(-14, -37, 14, -37, 13, -22);
      ctx.lineTo(9, -4);
      ctx.quadraticCurveTo(0, -1, -9, -4);
      break;
    case 'drop':
      // Water-drop body: the tip becomes the light thread
      ctx.moveTo(0, -38);
      ctx.bezierCurveTo(5, -31, 14, -24, 14, -14);
      ctx.bezierCurveTo(14, -7, 9, -4, 0, -4);
      ctx.bezierCurveTo(-9, -4, -14, -7, -14, -14);
      ctx.bezierCurveTo(-14, -24, -5, -31, 0, -38);
      break;
    case 'flame':
      ctx.moveTo(0, -39);
      ctx.bezierCurveTo(3, -33, 8, -34, 7, -27);
      ctx.bezierCurveTo(12, -24, 14, -19, 14, -14);
      ctx.bezierCurveTo(14, -7, 9, -4, 0, -4);
      ctx.bezierCurveTo(-9, -4, -14, -7, -14, -14);
      ctx.bezierCurveTo(-14, -22, -9, -26, -6, -29);
      ctx.bezierCurveTo(-5, -34, -2, -34, 0, -39);
      break;
    case 'orb':
      ctx.arc(0, -19, 14.5, 0, Math.PI * 2);
      break;
    case 'facet':
      ctx.moveTo(-11, -4);
      ctx.lineTo(-13.5, -20);
      ctx.lineTo(-7, -34);
      ctx.lineTo(7, -34);
      ctx.lineTo(13.5, -20);
      ctx.lineTo(11, -4);
      ctx.closePath();
      break;
    default: // capsule
      ctx.moveTo(-13, -10);
      ctx.lineTo(-13, -22);
      ctx.bezierCurveTo(-13, -37, 13, -37, 13, -22);
      ctx.lineTo(13, -10);
      ctx.quadraticCurveTo(13, -4, 7, -4);
      ctx.lineTo(-7, -4);
      ctx.quadraticCurveTo(-13, -4, -13, -10);
  }
  ctx.closePath();
}

function drawBody(ctx, art, holo, id) {
  bodyPath(ctx, art.shape);
  if (holo) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let y = -36; y < 0; y += 3) ctx.fillRect(-16, y, 32, 1);
    const g = ctx.createLinearGradient(0, -36, 0, -4);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-16, -36, 32, 32);
    ctx.restore();
    bodyPath(ctx, art.shape);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return;
  }
  const g = ctx.createLinearGradient(0, -36, 0, -4);
  g.addColorStop(0, art.top);
  g.addColorStop(1, art.bot);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Rim light (upper left) and soft shade (right)
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = art.rim;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(-2, -22, 13, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(10, -16, 8, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (art.core) {
    const rg = ctx.createRadialGradient(0, -15, 1, 0, -15, 11);
    rg.addColorStop(0, 'rgba(255,250,210,0.95)');
    rg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(-14, -30, 28, 28);
  }
  if (art.stars) {
    const r = seeded(77);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      ctx.fillRect(-12 + r() * 24, -33 + r() * 28, r() < 0.3 ? 1.2 : 0.7, r() < 0.3 ? 1.2 : 0.7);
    }
    const ng = ctx.createRadialGradient(-5, -12, 1, -5, -12, 12);
    ng.addColorStop(0, 'rgba(255,120,220,0.35)');
    ng.addColorStop(1, 'rgba(255,120,220,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(-16, -30, 30, 28);
  }
  if (art.shape === 'facet') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7, -34); ctx.lineTo(-3, -18); ctx.lineTo(-11, -4);
    ctx.moveTo(7, -34); ctx.lineTo(3, -18); ctx.lineTo(11, -4);
    ctx.moveTo(-3, -18); ctx.lineTo(3, -18);
    ctx.moveTo(-13.5, -20); ctx.lineTo(-3, -18);
    ctx.moveTo(13.5, -20); ctx.lineTo(3, -18);
    ctx.stroke();
  }
  if (art.shape === 'box') {
    ctx.fillStyle = '#232a36';
    ctx.beginPath(); ctx.roundRect(-10, -29, 20, 13, 3); ctx.fill();
    ctx.fillStyle = '#39414f';
    for (const [x, y] of [[-10.5, -7.5], [10.5, -7.5]]) { ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill(); }
  }
  if (art.band) {
    ctx.fillStyle = art.band;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-15, -10, 30, 1.8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  bodyPath(ctx, art.shape);
  ctx.strokeStyle = art.line;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  if (art.shape === 'taper') {
    ctx.shadowColor = art.line;
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  void id;
}

function drawVisor(ctx, art, holo) {
  const col = holo ? '#ffffff' : art.visorCol;
  ctx.fillStyle = col;
  switch (art.visor) {
    case 'eyes':
      ctx.beginPath(); ctx.ellipse(-3.8, 0, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.ellipse(3.8, 0, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      if (!holo) { ctx.fillStyle = '#ffffff'; ctx.fillRect(-4.8, -2, 1, 1); ctx.fillRect(2.8, -2, 1, 1); }
      break;
    case 'cyclops':
      if (!holo) { ctx.fillStyle = '#10141c'; ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; }
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-1.2, -1.2, 1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'slits':
      ctx.beginPath(); ctx.moveTo(-7, -1.5); ctx.lineTo(-1.5, 0.5); ctx.lineTo(-7, 1.8); ctx.closePath();
      ctx.moveTo(7, -1.5); ctx.lineTo(1.5, 0.5); ctx.lineTo(7, 1.8); ctx.closePath(); ctx.fill();
      break;
    case 'nebula': {
      if (!holo) {
        const g = ctx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, 6.5);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ff8ad8'); g.addColorStop(1, '#7fe8ff');
        ctx.fillStyle = g;
      }
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      if (!holo) { ctx.fillStyle = '#1b0f3a'; ctx.beginPath(); ctx.arc(1.4, 0.4, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-2.6, -2.8, 1.5, 1.5);
      break;
    }
    case 'gem':
      ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.lineTo(5, 0); ctx.lineTo(0, 5.5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
      if (!holo) { ctx.fillStyle = '#0c4a50'; ctx.beginPath(); ctx.moveTo(1.2, -2); ctx.lineTo(3, 0.3); ctx.lineTo(1.2, 2.6); ctx.lineTo(-0.6, 0.3); ctx.closePath(); ctx.fill(); }
      break;
    default: // round lens eye
      if (!holo) { ctx.fillStyle = 'rgba(8,13,28,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 6.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = col; }
      ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, Math.PI * 2); ctx.fill();
      if (!holo) { ctx.fillStyle = '#0a1830'; ctx.beginPath(); ctx.arc(1.6, 0.4, 2.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.arc(-1.6, -1.9, 1.3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBead(ctx, art, holo) {
  const col = holo ? '#ffffff' : art.bead;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  g.addColorStop(0, col);
  g.addColorStop(0.45, col);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  if (art.shape === 'facet') {
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
  } else if (art.stars) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 1.3 : 3.8; const a = -Math.PI / 2 + i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-0.8, -0.8, 1, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFoot(ctx, art, holo) {
  ctx.fillStyle = holo ? 'rgba(255,255,255,0.8)' : art.foot;
  ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 2.9, 0, 0, Math.PI * 2); ctx.fill();
  if (!holo) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.ellipse(-1, -1, 2.6, 1.1, 0, 0, Math.PI * 2); ctx.fill();
  }
}

/** Bake all parts for one skin. Keys: c_<skin>_<part>[_h] */
export function bakeSkin(scene, id) {
  const art = SKIN_ART[id];
  for (const holo of [false, true]) {
    const suf = holo ? '_h' : '';
    // body: local box x[-16,16], y[-38,0]
    bake(scene, `c_${id}_body${suf}`, 32 * S, 38 * S, (ctx) => {
      ctx.scale(S, S); ctx.translate(16, 38); drawBody(ctx, art, holo, id);
    });
    bake(scene, `c_${id}_visor${suf}`, 18 * S, 16 * S, (ctx) => {
      ctx.scale(S, S); ctx.translate(9, 8);
      if (!holo) { ctx.shadowColor = art.visorCol; ctx.shadowBlur = 3; }
      drawVisor(ctx, art, holo);
    });
    bake(scene, `c_${id}_foot${suf}`, 10 * S, 7 * S, (ctx) => { ctx.scale(S, S); ctx.translate(5, 3.5); drawFoot(ctx, art, holo); });
    bake(scene, `c_${id}_bead${suf}`, 16 * S, 16 * S, (ctx) => { ctx.scale(S, S); ctx.translate(8, 8); drawBead(ctx, art, holo); });
  }
}

/** Big portrait used in the skin picker. */
export function bakePortrait(scene, id, size = 160) {
  const art = SKIN_ART[id];
  return bake(scene, `p_${id}`, size, size, (ctx) => {
    const k = size / 48;
    ctx.scale(k, k);
    ctx.translate(24, 44);
    ctx.save(); ctx.translate(-5.5, -2.5); drawFoot(ctx, art, false); ctx.restore();
    ctx.save(); ctx.translate(5.5, -2.5); drawFoot(ctx, art, false); ctx.restore();
    drawBody(ctx, art, false, id);
    ctx.save(); ctx.translate(2, -19); drawVisor(ctx, art, false); ctx.restore();
    const an = -(art.anchor || 34);
    ctx.strokeStyle = art.thread; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, an);
    if (art.rod) ctx.lineTo(-2, an - 7); else ctx.quadraticCurveTo(-2, an - 6, -7, an - 6);
    ctx.stroke();
    ctx.save(); ctx.translate(art.rod ? -2 : -7, an - 6); drawBead(ctx, art, false); ctx.restore();
  });
}
