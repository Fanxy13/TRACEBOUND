// Responsive layout. The canvas always fills the viewport at device
// resolution; the room is fitted into a "play rect" that never sits under the
// HUD band or the touch controls.

export const ROOM_REF_W = 1280;
export const ROOM_REF_H = 720;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function computeLayout(W, H, touch, uiCss = 1) {
  const hudH = Math.round(46 * uiCss);
  const gap = 6;
  let play;
  let panels = null;

  const zoomFor = (r) => Math.min(r.w / ROOM_REF_W, r.h / ROOM_REF_H);

  if (!touch) {
    play = { x: gap, y: hudH, w: W - gap * 2, h: H - hudH - gap };
  } else if (W >= H) {
    const sideW = Math.round(clamp(W * 0.145, 104, 190));
    const side = { x: sideW, y: hudH, w: W - sideW * 2, h: H - hudH - gap };
    const bandH = Math.round(clamp(H * 0.27, 118, 200));
    const bottom = { x: gap, y: hudH, w: W - gap * 2, h: H - hudH - bandH };
    if (zoomFor(side) >= zoomFor(bottom)) {
      play = side;
      panels = {
        mode: 'side',
        left: { x: 0, y: hudH, w: sideW, h: H - hudH },
        right: { x: W - sideW, y: hudH, w: sideW, h: H - hudH },
      };
    } else {
      play = bottom;
      panels = {
        mode: 'bottom',
        left: { x: 0, y: H - bandH, w: W / 2, h: bandH },
        right: { x: W / 2, y: H - bandH, w: W / 2, h: bandH },
      };
    }
  } else {
    // Portrait: room on top, generous thumb area below
    const roomH = Math.min(W * (ROOM_REF_H / ROOM_REF_W) + 12, H * 0.55);
    const bandTop = hudH + roomH;
    play = { x: gap, y: hudH, w: W - gap * 2, h: roomH };
    const bandH = H - bandTop;
    panels = {
      mode: 'portrait',
      left: { x: 0, y: bandTop, w: W / 2, h: bandH },
      right: { x: W / 2, y: bandTop, w: W / 2, h: bandH },
    };
  }
  return { W, H, hudH, play, panels, touch };
}

export function pickResolution(W, H) {
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Cap the backing store so large desktop screens stay fast
  const maxPixels = 3.6e6;
  if (W * H * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (W * H));
  return Math.max(0.75, dpr);
}
