// On-screen touch controls (DOM). They live in their own panels next to or
// below the room, never on top of gameplay, and are sized for thumbs.

const SVG = {
  left: '<svg viewBox="0 0 48 48"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 48 48"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  jump: '<svg viewBox="0 0 48 48"><path d="M12 28 L24 14 L36 28" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 36 L32 36" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
  use: '<svg viewBox="0 0 48 48"><path d="M17 26V12a3 3 0 0 1 6 0v11V9a3 3 0 0 1 6 0v14V11a3 3 0 0 1 6 0v14v-8a3 3 0 0 1 6 0v12c0 8-5 13-12 13h-2c-5 0-8-2-11-6l-6-8a3 3 0 0 1 5-4z" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  rotate: '<svg viewBox="0 0 64 64"><rect x="22" y="8" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 50a22 22 0 0 0 30 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M40 50l3 6-7 1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rewind: '<svg viewBox="0 0 48 48"><path d="M14 16 A14 14 0 1 1 11 29" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M7 9 L14 17 L22 12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.root = document.createElement('div');
    this.root.id = 'touch';
    this.root.innerHTML = `
      <div class="tpanel tleft">
        <div class="dpad"><div class="dhalf dl">${SVG.left}</div><div class="dhalf dr">${SVG.right}</div></div>
      </div>
      <div class="rotate-hint">${SVG.rotate}</div>
      <div class="tpanel tright">
        <div class="tbtn trewind" data-act="rewind">${SVG.rewind}</div>
        <div class="tbtn tuse" data-act="use">${SVG.use}</div>
        <div class="tbtn tjump" data-act="jump">${SVG.jump}</div>
      </div>`;
    document.body.appendChild(this.root);
    this.left = this.root.querySelector('.tleft');
    this.right = this.root.querySelector('.tright');
    this.dpad = this.root.querySelector('.dpad');
    this.visible = false;
    this.bindDpad();
    for (const el of this.root.querySelectorAll('.tbtn')) this.bindButton(el);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindButton(el) {
    const act = el.dataset.act;
    const pointers = new Set();
    const down = (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointers.add(e.pointerId);
      el.classList.add('on');
      this.input.press(act, 't:' + act + ':' + e.pointerId);
    };
    const up = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      this.input.release(act, 't:' + act + ':' + e.pointerId);
      if (!pointers.size) el.classList.remove('on');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  bindDpad() {
    const el = this.dpad;
    const active = new Map();
    const dl = el.querySelector('.dl');
    const dr = el.querySelector('.dr');
    const refresh = () => {
      let l = false, r = false;
      for (const dir of active.values()) { if (dir < 0) l = true; if (dir > 0) r = true; }
      dl.classList.toggle('on', l);
      dr.classList.toggle('on', r);
    };
    const update = (e) => {
      const rect = el.getBoundingClientRect();
      const dir = e.clientX < rect.left + rect.width / 2 ? -1 : 1;
      const prev = active.get(e.pointerId);
      if (prev === dir) return;
      if (prev) this.input.release(prev < 0 ? 'left' : 'right', 't:d:' + e.pointerId);
      active.set(e.pointerId, dir);
      this.input.press(dir < 0 ? 'left' : 'right', 't:d:' + e.pointerId);
      refresh();
    };
    const end = (e) => {
      const prev = active.get(e.pointerId);
      if (!prev) return;
      this.input.release(prev < 0 ? 'left' : 'right', 't:d:' + e.pointerId);
      active.delete(e.pointerId);
      refresh();
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      update(e);
    });
    el.addEventListener('pointermove', (e) => { if (active.has(e.pointerId)) update(e); });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  show(on) {
    this.visible = on;
    this.root.style.display = on ? 'block' : 'none';
  }

  /** Dim while menus are open so it is clear they do nothing. */
  setActive(on) {
    this.root.classList.toggle('inactive', !on);
  }

  setRewind(on) {
    this.root.querySelector('.trewind').style.visibility = on ? 'visible' : 'hidden';
  }

  place(layout) {
    const p = layout.panels;
    if (!p) { this.show(false); return; }
    this.show(true);
    const set = (el, r) => {
      el.style.left = r.x + 'px';
      el.style.top = r.y + 'px';
      el.style.width = r.w + 'px';
      el.style.height = r.h + 'px';
    };
    set(this.left, p.left);
    set(this.right, p.right);
    this.root.dataset.mode = p.mode;
    const rot = this.root.querySelector('.rotate-hint');
    if (p.mode === 'portrait') {
      const gapTop = layout.play.y + layout.play.h, gapBot = p.left.y + p.left.h * 0.35;
      rot.style.display = gapBot - gapTop > 90 ? 'block' : 'none';
      rot.style.top = ((gapTop + gapBot) / 2 - 32) + 'px';
    } else rot.style.display = 'none';
    // Size controls relative to the panel
    const unit = p.mode === 'side'
      ? Math.min(p.left.w * 0.44, p.left.h * 0.2, 84)
      : Math.min(p.left.h * 0.46, p.left.w * 0.24, 92);
    this.root.style.setProperty('--u', Math.max(44, unit) + 'px');
  }
}
