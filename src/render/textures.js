// Shared generated textures: glows, particles, pickups.

import { bake } from './canvas.js';
import { bakeIcons } from './icons.js';
import { SKIN_ART, bakeSkin } from './skins.js';

export function bakeCommon(scene) {
  bake(scene, 'glow', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  bake(scene, 'soft', 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  bake(scene, 'dot', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
  bake(scene, 'spark', 24, 24, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.quadraticCurveTo(13, 11, 24, 12); ctx.quadraticCurveTo(13, 13, 12, 24);
    ctx.quadraticCurveTo(11, 13, 0, 12); ctx.quadraticCurveTo(11, 11, 12, 0);
    ctx.fill();
  });
  bake(scene, 'tri', 16, 16, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(15, 14); ctx.lineTo(1, 14); ctx.closePath(); ctx.fill();
  });
  bake(scene, 'sq', 8, 8, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 8); });
  bake(scene, 'ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.stroke();
  });
  bake(scene, 'ringSoft', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  bake(scene, 'shardGem', 48, 48, (ctx) => {
    ctx.translate(24, 24);
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 6;
    const g = ctx.createLinearGradient(-12, -18, 12, 18);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#bff7ff');
    g.addColorStop(1, '#6fd6ff');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(13, -5); ctx.lineTo(0, 19); ctx.lineTo(-13, -5); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(40,90,140,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-13, -5); ctx.lineTo(13, -5); ctx.moveTo(-5, -5); ctx.lineTo(0, 19); ctx.moveTo(5, -5); ctx.lineTo(0, 19); ctx.moveTo(0, -19); ctx.lineTo(-5, -5); ctx.moveTo(0, -19); ctx.lineTo(5, -5); ctx.stroke();
  });
  bake(scene, 'core', 48, 48, (ctx) => {
    ctx.translate(24, 24);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-24, -24, 48, 48);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.moveTo(-8.6, -5); ctx.lineTo(8.6, 5); ctx.moveTo(-8.6, 5); ctx.lineTo(8.6, -5); ctx.stroke();
  });
  bake(scene, 'swirl', 128, 128, (ctx) => {
    ctx.translate(64, 64);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      const g = ctx.createLinearGradient(-50, 0, 50, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 0.9); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0.5, Math.PI * 1.2); ctx.stroke();
    }
  });
  bake(scene, 'vignette', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  bake(scene, 'scan', 4, 4, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 4, 1);
  });
  bakeIcons(scene);
  for (const id of Object.keys(SKIN_ART)) bakeSkin(scene, id);
}
