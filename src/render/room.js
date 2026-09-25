// Bakes a room into two textures: the interior backdrop (drawn behind wires
// and mechanisms) and the solid architecture on top.

import { TILE, T_SOLID, T_ONEWAY, T_SPIKE, T_SPIKE_DOWN, T_GLASS } from '../sim/constants.js';
import { bake, rgba, mix, seeded } from './canvas.js';

const T = TILE;

function solidAt(L, x, y) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
  const t = L.tiles[y * L.w + x];
  return t === T_SOLID;
}

function openAt(L, x, y) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
  const t = L.tiles[y * L.w + x];
  return t !== T_SOLID && t !== T_GLASS;
}

export function bakeRoom(scene, L, th, scale, keyBase) {
  const W = L.w * T, H = L.h * T;
  const seed = [...L.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 17);
  bake(scene, keyBase + '_back', W * scale, H * scale, (ctx) => {
    ctx.scale(scale, scale);
    drawBack(ctx, L, th, seed);
  });
  bake(scene, keyBase + '_tiles', W * scale, H * scale, (ctx) => {
    ctx.scale(scale, scale);
    drawTiles(ctx, L, th, seed);
  });
}

function drawBack(ctx, L, th, seed) {
  const W = L.w * T, H = L.h * T;
  // Interior panel: semi-transparent so the animated world shows through
  ctx.save();
  ctx.beginPath();
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (openAt(L, x, y) || L.tiles[y * L.w + x] === T_GLASS) ctx.rect(x * T, y * T, T, T);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(mix(th.back, '#000000', 0.15), 0.9));
  g.addColorStop(1, rgba(mix(th.back, '#000000', 0.45), 0.95));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Faint grid
  ctx.strokeStyle = rgba(th.edge, 0.035);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= L.w; x++) { ctx.moveTo(x * T + 0.5, 0); ctx.lineTo(x * T + 0.5, H); }
  for (let y = 0; y <= L.h; y++) { ctx.moveTo(0, y * T + 0.5); ctx.lineTo(W, y * T + 0.5); }
  ctx.stroke();
  drawDecor(ctx, L, th, seed);
  ctx.restore();

  // Ambient occlusion along walls
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      if (!openAt(L, x, y)) continue;
      const px = x * T, py = y * T;
      const shade = (x0, y0, x1, y1) => {
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, 'rgba(0,0,0,0.34)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(px, py, T, T);
      };
      if (solidAt(L, x, y - 1)) shade(px, py, px, py + 16);
      if (solidAt(L, x - 1, y)) shade(px, py, px + 12, py);
      if (solidAt(L, x + 1, y)) shade(px + T, py, px + T - 12, py);
      if (solidAt(L, x, y + 1)) {
        // rim light rising from floors
        const gr = ctx.createLinearGradient(px, py + T, px, py + T - 22);
        gr.addColorStop(0, rgba(th.accent, 0.16));
        gr.addColorStop(1, rgba(th.accent, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(px, py, T, T);
      }
    }
  }
}

function drawDecor(ctx, L, th, seed) {
  const W = L.w * T, H = L.h * T;
  const r = seeded(seed);
  ctx.save();
  ctx.lineCap = 'round';
  const col = (a) => rgba(th.accent, a);
  switch (th.decor) {
    case 'rings': {
      for (let i = 0; i < 3; i++) {
        const cx = r() * W, cy = r() * H * 0.7, rad = 120 + r() * 160;
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = col(0.05 - k * 0.008);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, rad + k * 34, 0, Math.PI * 2); ctx.stroke();
        }
      }
      break;
    }
    case 'gears': {
      for (let i = 0; i < 4; i++) {
        const cx = r() * W, cy = r() * H, rad = 60 + r() * 110, teeth = 10 + Math.floor(r() * 6);
        ctx.strokeStyle = col(0.06);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let t = 0; t < teeth * 2; t++) {
          const a0 = (t * Math.PI) / teeth, a1 = ((t + 1) * Math.PI) / teeth;
          ctx.arc(cx, cy, t % 2 ? rad * 0.86 : rad, a0, a1);
        }
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rad * 0.3, 0, Math.PI * 2); ctx.stroke();
      }
      // pipes
      ctx.strokeStyle = rgba(th.accent2, 0.05);
      ctx.lineWidth = 10;
      for (let i = 0; i < 3; i++) {
        const y = (0.2 + r() * 0.6) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * (0.3 + r() * 0.4), y); ctx.lineTo(W * (0.3 + r() * 0.4), y + 60 + r() * 80); ctx.stroke();
      }
      break;
    }
    case 'clocks': {
      for (let i = 0; i < 3; i++) {
        const cx = r() * W, cy = r() * H, rad = 80 + r() * 120;
        ctx.strokeStyle = col(0.07);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
        for (let t = 0; t < 12; t++) {
          const a = (t / 12) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rad * 0.86, cy + Math.sin(a) * rad * 0.86); ctx.lineTo(cx + Math.cos(a) * rad * 0.96, cy + Math.sin(a) * rad * 0.96); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(r() * 6) * rad * 0.6, cy + Math.sin(r() * 6) * rad * 0.6); ctx.stroke();
      }
      break;
    }
    case 'leaves': {
      for (let i = 0; i < 9; i++) {
        const x = r() * W, len = 80 + r() * 200;
        ctx.strokeStyle = col(0.07);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 30, len * 0.3, x - 30, len * 0.6, x + 10 * (r() - 0.5), len);
        ctx.stroke();
        for (let k = 0; k < 4; k++) {
          const ly = (k + 1) * len / 5, lx = x + Math.sin(k * 1.7) * 14;
          ctx.fillStyle = col(0.06);
          ctx.beginPath(); ctx.ellipse(lx + 9, ly, 10, 5, 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'shards': {
      for (let i = 0; i < 7; i++) {
        const cx = r() * W, cy = r() * H, s = 40 + r() * 90;
        ctx.strokeStyle = col(0.08);
        ctx.fillStyle = col(0.025);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const n = 3 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) { const a = r() * Math.PI * 2; ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      break;
    }
    case 'stars': {
      const pts = [];
      for (let i = 0; i < 70; i++) {
        const x = r() * W, y = r() * H, a = 0.1 + r() * 0.35;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, r() < 0.2 ? 2 : 1, r() < 0.2 ? 2 : 1);
        if (i < 8) pts.push([x, y]);
      }
      ctx.strokeStyle = col(0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      break;
    }
    default:
  }
  ctx.restore();
}

function drawTiles(ctx, L, th, seed) {
  const r = seeded(seed + 99);
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const t = L.tiles[y * L.w + x];
      const px = x * T, py = y * T;
      if (t === T_SOLID) drawSolid(ctx, L, th, x, y, px, py, r);
      else if (t === T_ONEWAY) drawOneWay(ctx, th, px, py);
      else if (t === T_GLASS) drawGlass(ctx, th, px, py);
      else if (t === T_SPIKE) drawSpikes(ctx, th, px, py, false);
      else if (t === T_SPIKE_DOWN) drawSpikes(ctx, th, px, py, true);
    }
  }
}

function drawSolid(ctx, L, th, x, y, px, py, r) {
  const up = !solidAt(L, x, y - 1) && openAt(L, x, y - 1);
  const dn = !solidAt(L, x, y + 1) && openAt(L, x, y + 1);
  const lf = !solidAt(L, x - 1, y) && openAt(L, x - 1, y);
  const rt = !solidAt(L, x + 1, y) && openAt(L, x + 1, y);
  const rad = 7;
  const radii = [up && lf ? rad : 0, up && rt ? rad : 0, dn && rt ? rad : 0, dn && lf ? rad : 0];
  const exposed = up || dn || lf || rt;
  const v = (r() - 0.5) * 0.06;
  const base = exposed ? mix(th.tile, th.tileTop, 0.25) : th.tileDark;
  ctx.fillStyle = v > 0 ? mix(base, '#ffffff', v) : mix(base, '#000000', -v);
  ctx.beginPath();
  ctx.roundRect(px, py, T, T, radii);
  ctx.fill();

  if (!exposed) {
    // Deep wall: faint circuitry
    if (r() < 0.22) {
      ctx.strokeStyle = rgba(th.accent, 0.13);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const hy = py + 10 + Math.floor(r() * 3) * 10;
      ctx.moveTo(px, hy); ctx.lineTo(px + 20, hy);
      if (r() < 0.5) ctx.lineTo(px + 20, hy + 10);
      ctx.stroke();
      ctx.fillStyle = rgba(th.accent, 0.2);
      ctx.beginPath(); ctx.arc(px + 20, hy, 2, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, T, T, radii);
  ctx.clip();
  // Surface texture per world
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  if (th.decor === 'gears') {
    ctx.fillRect(px, py + 20, T, 2);
    ctx.fillRect(px + (y % 2 ? 10 : 30), py, 2, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(px + 6, py + 30, 1.6, 0, Math.PI * 2); ctx.arc(px + 34, py + 30, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (th.decor === 'leaves' && up && r() < 0.6) {
    ctx.fillStyle = rgba(th.accent, 0.25);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(px + 6 + r() * 28, py + 9 + r() * 6, 5, 2.4, r() - 0.5, 0, Math.PI * 2); ctx.fill(); }
  } else if (r() < 0.35) {
    ctx.fillRect(px + 6 + r() * 20, py + 16 + r() * 16, 8 + r() * 10, 2);
  }
  if (dn) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px, py + T - 6, T, 6); ctx.fillStyle = rgba(th.edge, 0.25); ctx.fillRect(px, py + T - 2, T, 2); }
  if (lf) { ctx.fillStyle = rgba(th.edge, 0.3); ctx.fillRect(px, py, 2, T); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(px + 2, py, 4, T); }
  if (rt) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + T - 6, py, 6, T); ctx.fillStyle = rgba(th.edge, 0.3); ctx.fillRect(px + T - 2, py, 2, T); }
  if (up) {
    const g = ctx.createLinearGradient(0, py, 0, py + 14);
    g.addColorStop(0, mix(th.tileTop, '#ffffff', 0.12));
    g.addColorStop(1, th.tile);
    ctx.fillStyle = g;
    ctx.fillRect(px, py, T, 14);
    ctx.fillStyle = th.edge;
    ctx.fillRect(px, py, T, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px, py + 3, T, 1);
  }
  ctx.restore();
}

function drawOneWay(ctx, th, px, py) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(px + 2, py + 10, T - 4, 4);
  ctx.fillStyle = th.tileTop;
  ctx.beginPath(); ctx.roundRect(px, py, T, 10, 3); ctx.fill();
  ctx.fillStyle = rgba(th.edge, 0.9);
  ctx.fillRect(px, py, T, 2);
  ctx.fillStyle = th.tileDark;
  ctx.fillRect(px + 4, py + 10, 3, 8);
  ctx.fillRect(px + T - 7, py + 10, 3, 8);
}

function drawGlass(ctx, th, px, py) {
  ctx.fillStyle = rgba(th.edge, 0.1);
  ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
  ctx.strokeStyle = rgba(th.edge, 0.5);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(px + 8, py + 30); ctx.lineTo(px + 22, py + 8); ctx.moveTo(px + 16, py + 34); ctx.lineTo(px + 26, py + 18); ctx.stroke();
}

function drawSpikes(ctx, th, px, py, down) {
  ctx.save();
  if (down) { ctx.translate(px + T / 2, py + T / 2); ctx.scale(1, -1); ctx.translate(-px - T / 2, -py - T / 2); }
  const base = py + T;
  ctx.fillStyle = '#2a2f3d';
  ctx.fillRect(px, base - 4, T, 4);
  for (let i = 0; i < 3; i++) {
    const x0 = px + 2 + i * 12, x1 = x0 + 12, mx = (x0 + x1) / 2, top = base - 20;
    ctx.fillStyle = '#dfe6f3';
    ctx.beginPath(); ctx.moveTo(x0, base - 3); ctx.lineTo(mx, top); ctx.lineTo(mx, base - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8f9ab0';
    ctx.beginPath(); ctx.moveTo(mx, top); ctx.lineTo(x1, base - 3); ctx.lineTo(mx, base - 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d6a';
    ctx.beginPath(); ctx.moveTo(mx - 2.4, top + 5); ctx.lineTo(mx, top); ctx.lineTo(mx + 2.4, top + 5); ctx.closePath(); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, base - 26, 0, base);
  g.addColorStop(0, 'rgba(255,77,106,0)');
  g.addColorStop(1, 'rgba(255,77,106,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(px, base - 26, T, 26);
  ctx.restore();
  void th;
}
