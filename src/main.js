// TRACEBOUND entry point.

import { App } from './app.js';
import { Progress } from './game/progress.js';
import { Input } from './platform/input.js';
import { AudioEngine } from './audio/audio.js';
import { TouchControls } from './ui/touch.js';
import { computeLayout, pickResolution } from './platform/layout.js';
import { Poki } from './platform/poki.js';
import { BootScene } from './scenes/BootScene.js';
import { BgScene } from './scenes/BgScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Safe-area insets in CSS px, resolved through the same custom properties
// that position #game and #touch in the stylesheet.
let insetProbe = null;
function safeInsets() {
  if (!insetProbe) {
    insetProbe = document.createElement('div');
    insetProbe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;'
      + 'padding:var(--safe-t,0px) var(--safe-r,0px) var(--safe-b,0px) var(--safe-l,0px)';
    document.body.appendChild(insetProbe);
  }
  const cs = getComputedStyle(insetProbe);
  const px = (v) => parseFloat(v) || 0;
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}

function viewport() {
  const vv = window.visualViewport;
  const s = safeInsets();
  const W = Math.max(1, Math.round((vv ? vv.width : window.innerWidth) - s.l - s.r));
  const H = Math.max(1, Math.round((vv ? vv.height : window.innerHeight) - s.t - s.b));
  return { W, H };
}

function applyLayout() {
  const { W, H } = viewport();
  const touch = App.input.mode === 'touch';
  const uiCss = Math.max(0.72, Math.min(1.35, Math.min(W / 820, H / 480)));
  App.layout = computeLayout(W, H, touch, uiCss);
  App.dpr = pickResolution(W, H, touch);
  App.ui = uiCss * App.dpr;
  App.touch.place(App.layout);
  return { W, H };
}

function onResize() {
  const { W, H } = applyLayout();
  const g = App.game;
  if (!g) return;
  g.scale.resize(Math.round(W * App.dpr), Math.round(H * App.dpr));
  g.scale.setZoom(1 / App.dpr);
  App.bus.emit('layout');
}

function loadFont() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('600 24px "Fredoka"').catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
}

async function boot() {
  App.bus = new Phaser.Events.EventEmitter();
  App.progress = new Progress();
  App.input = new Input();
  App.audio = new AudioEngine(App.progress.settings);
  App.touch = new TouchControls(App.input);
  await Promise.all([Poki.init(), loadFont()]);
  const { W, H } = applyLayout();
  App.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#04060c',
    width: Math.round(W * App.dpr),
    height: Math.round(H * App.dpr),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / App.dpr },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    audio: { noAudio: true },
    banner: false,
    // Real frame deltas: Phaser's smoothing caps delta during start-up and
    // while unfocused, which would run the simulation in slow motion.
    fps: { smoothStep: false },
    input: { activePointers: 4, keyboard: false },
    disableContextMenu: true,
    scene: [BootScene, BgScene, GameScene, UIScene],
  });
  let t = null;
  const schedule = () => { clearTimeout(t); t = setTimeout(onResize, 120); };
  window.addEventListener('resize', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  App.input.on((e) => { if (e.type === 'mode') onResize(); });
}

// Development-only inspection hook (removed from the release build)
const __DEV__ = typeof __TB_DEV__ === 'undefined' ? true : __TB_DEV__;
if (__DEV__ && location.search.includes('tbdebug')) window.TBX = App;

boot();
