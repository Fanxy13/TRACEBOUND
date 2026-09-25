// Unified input: keyboard and on-screen touch controls feed the same logical
// actions. Held state is tracked per source so overlapping keys never stick.

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyE: 'use', KeyF: 'use',
  KeyR: 'rewind',
  KeyZ: 'undo', Backspace: 'undo',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm',
  ArrowDown: 'down', KeyS: 'down',
};

const GAMEPLAY = new Set(['left', 'right', 'jump', 'use', 'rewind', 'undo']);

export class Input {
  constructor() {
    this.sources = new Map();
    this.edges = new Set();
    this.listeners = new Set();
    this.mode = detectTouch() ? 'touch' : 'keyboard';
    this.blocked = false;

    window.addEventListener('keydown', (e) => this.onKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => this.onKey(e, false), { passive: false });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    window.addEventListener('touchstart', () => this.setMode('touch'), { passive: true });
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.setMode('touch'); }, { passive: true });
  }

  onKey(e, down) {
    const action = KEYMAP[e.code];
    if (!action) return;
    // Keep arrows / space from scrolling the host page
    e.preventDefault();
    if (down) {
      if (e.repeat) return;
      this.setMode('keyboard');
      this.press(action, 'k:' + e.code);
    } else {
      this.release(action, 'k:' + e.code);
    }
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const fn of this.listeners) fn({ type: 'mode', mode });
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  press(action, source) {
    if (this.blocked) return;
    let set = this.sources.get(action);
    if (!set) { set = new Set(); this.sources.set(action, set); }
    const was = set.size > 0;
    set.add(source);
    if (!was) {
      this.edges.add(action);
      for (const fn of this.listeners) fn({ type: 'press', action });
    }
  }

  release(action, source) {
    const set = this.sources.get(action);
    if (set) set.delete(source);
  }

  releaseAll() {
    this.sources.clear();
    this.edges.clear();
  }

  isDown(action) {
    const set = this.sources.get(action);
    return !!(set && set.size);
  }

  /** Edge-triggered press since the last consume. */
  consume(action) {
    if (this.edges.has(action)) { this.edges.delete(action); return true; }
    return false;
  }

  peek(action) { return this.edges.has(action); }

  clearEdges() { this.edges.clear(); }

  anyGameplay() {
    for (const a of GAMEPLAY) if (this.isDown(a) || this.edges.has(a)) return true;
    return false;
  }

  block(on) {
    this.blocked = on;
    if (on) this.releaseAll();
  }
}

function detectTouch() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch (e) { /* ignore */ }
  return (navigator.maxTouchPoints || 0) > 0 && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
}
