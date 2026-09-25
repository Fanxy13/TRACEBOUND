// Screen-space UI: minimal HUD, contextual prompts, menus and milestone
// banners. Almost no text - icons, numbers and motion carry the meaning.

import { App, FONT } from '../app.js';
import { LEVELS, WORLDS } from '../levels/index.js';
import { TPS, TILE } from '../sim/constants.js';
import { theme, echoColor, UPGRADES, SKINS } from '../game/config.js';
import { hexNum } from '../render/canvas.js';
import { bakePortrait } from '../render/skins.js';
import { Button, keycap, txt, pill, panel, UI_COL } from '../ui/widgets.js';
import { Poki } from '../platform/poki.js';

const DPAD_HINT = { left: '.dpad', right: '.dpad', space: '.tjump', E: '.tuse', R: '.trewind' };

export class UIScene extends Phaser.Scene {
  constructor() { super('ui'); }

  create() {
    this.gs = this.scene.get('game');
    this.hud = null;
    this.menu = null;
    this.menuKind = null;
    this.focus = [];
    this.focusIdx = -1;
    this.promptObjs = [];
    this.def = null;
    this.accent = 0x5ce1ff;
    this.hintState = {};
    this.shardsShown = App.progress.data.shards;
    this.fxLayer = this.add.container(0, 0).setDepth(900);
    const B = App.bus;
    B.on('level', (def) => this.onLevel(def));
    B.on('loop', () => this.onLoop());
    B.on('run', () => this.onRun());
    B.on('paused', () => this.openPause());
    B.on('resumed', () => this.closeMenu());
    B.on('complete', (d) => this.openComplete(d));
    B.on('rewind', (d) => this.onRewind(d));
    B.on('echoSpawned', (d) => this.onEchoSpawned(d));
    B.on('banner', (b) => this.banner(b));
    B.on('shardFly', (p) => this.flyShard(p));
    B.on('timerTick', (s) => this.onTimerTick(s));
    B.on('death', () => this.flashScreen(0xff3355, 0.22));
    B.on('paradox', () => this.flashScreen(0xff5a74, 0.12));
    B.on('openMap', () => this.openMap());
    B.on('busy', (b) => this.setBusy(b));
    B.on('layout', () => this.relayout());
    App.input.on((e) => this.onInput(e));
    App.bus.emit('uiReady');
  }

  get u() { return App.ui; }

  // ------------------------------------------------------------- lifecycle

  onLevel(def) {
    this.def = def;
    this.accent = hexNum(theme(def.world).accent);
    this.hintState = { spawnX: null, moved: false, jumped: false, plated: false, plateTime: 0 };
    this.closeMenu(true);
    this.buildHud();
    this.levelIntro(def);
  }

  onLoop() {
    this.buildHudDynamic();
    if (App.touch) App.touch.setRewind(this.gs.session && this.gs.session.capacity > 0);
  }

  onRun() {}

  relayout() {
    if (this.def) this.buildHud();
    if (this.menuKind) {
      const kind = this.menuKind, arg = this.menuArg;
      this.closeMenu(true);
      this.openMenu(kind, arg);
    }
  }

  // ------------------------------------------------------------------- HUD

  buildHud() {
    if (this.hud) this.hud.destroy(true);
    const u = this.u;
    const W = this.scale.width;
    const hudH = App.layout.hudH * App.dpr;
    const cy = hudH / 2;
    const c = this.add.container(0, 0).setDepth(100);
    this.hud = c;
    const def = this.def;
    const th = theme(def.world);
    // Level chip (left)
    const g = this.add.graphics();
    c.add(g);
    const chipW = 96 * u, chipH = 34 * u;
    const x0 = 10 * u;
    pill(g, x0, cy - chipH / 2, chipW, chipH, 0x0a0e1a, hexNum(th.accent));
    c.add(this.add.image(x0 + 20 * u, cy, 'i_' + th.glyph).setScale(20 * u / 96).setTint(hexNum(th.accent)));
    c.add(txt(this, x0 + 58 * u, cy + 1 * u, def.id, 19 * u));
    // Shards + pause (right)
    const pauseSize = App.input.mode === 'touch' ? 46 : 38;
    this.pauseBtn = new Button(this, W - 10 * u - (pauseSize * u) / 2, cy, { icon: 'pause', size: pauseSize, iconScale: 0.45, onClick: () => App.bus.emit('cmd', 'pause') });
    c.add(this.pauseBtn);
    const sx = W - 20 * u - pauseSize * u - 88 * u;
    pill(g, sx, cy - chipH / 2, 84 * u, chipH, 0x0a0e1a, 0x6fd6ff);
    this.shardIcon = this.add.image(sx + 20 * u, cy, 'shardGem').setScale(22 * u / 48);
    this.shardText = txt(this, sx + 54 * u, cy + 1 * u, String(App.progress.data.shards), 19 * u);
    c.add([this.shardIcon, this.shardText]);
    this.shardPos = { x: sx + 20 * u, y: cy };
    this.centerLeft = x0 + chipW + 12 * u;
    this.centerRight = sx - 12 * u;
    this.buildHudDynamic();
  }

  buildHudDynamic() {
    if (!this.hud || !this.gs.session) return;
    if (this.dyn) this.dyn.destroy(true);
    const u = this.u;
    const s = this.gs.session;
    const hudH = App.layout.hudH * App.dpr;
    const cy = hudH / 2;
    const c = this.add.container(0, 0).setDepth(101);
    this.dyn = c;
    this.hud.add(c);
    if (s.capacity <= 0 || !s.def.time) { this.timeline = null; return; }
    const avail = this.centerRight - this.centerLeft;
    const slot = 26 * u;
    const nSlots = s.capacity;
    const touchUi = App.input.mode === 'touch';
    const btn = (touchUi ? 44 : 38) * u;
    const showUndo = s.echoes.length > 0;
    let barW = Math.min(260 * u, avail - nSlots * (slot + 4 * u) - btn * (showUndo ? 2.2 : 1.1) - 24 * u);
    barW = Math.max(60 * u, barW);
    const total = nSlots * (slot + 4 * u) + 10 * u + barW + 12 * u + btn + (showUndo ? btn * 0.9 + 8 * u : 0);
    let x = this.centerLeft + (avail - total) / 2;
    const g = this.add.graphics();
    c.add(g);
    this.slotIcons = [];
    const base = s.def.echoes;
    for (let i = 0; i < nSlots; i++) {
      const rec = s.echoes[i];
      const sx = x + slot / 2;
      g.fillStyle(0x0a0e1a, 0.75);
      g.fillCircle(sx, cy, slot / 2 + 2 * u);
      g.lineStyle(2 * u, i >= base ? UI_COL.gold : 0x2c3654, 1);
      g.strokeCircle(sx, cy, slot / 2 + 2 * u);
      const icon = this.add.image(sx, cy, 'i_ghost').setScale((slot * 0.78) / 96);
      icon.setTint(rec ? echoColor(rec.id) : 0x5b6680).setAlpha(rec ? 1 : 0.35);
      c.add(icon);
      this.slotIcons.push(icon);
      x += slot + 4 * u;
    }
    x += 6 * u;
    this.timeline = { x, y: cy, w: barW, h: 10 * u };
    this.tlGfx = this.add.graphics();
    c.add(this.tlGfx);
    x += barW + 12 * u;
    this.rewindBtn = new Button(this, x + btn / 2, cy, { icon: 'rewind', size: btn / u, iconScale: 0.52, onClick: () => App.bus.emit('cmd', 'rewind'), key: 'R', fill: 0x14203a, line: this.accent });
    c.add(this.rewindBtn);
    x += btn + 8 * u;
    if (showUndo) {
      this.undoBtn = new Button(this, x + btn * 0.45, cy, { icon: 'undo', size: (btn / u) * 0.9, iconScale: 0.48, onClick: () => App.bus.emit('cmd', 'undo'), key: 'Z' });
      c.add(this.undoBtn);
    } else this.undoBtn = null;
    this.buildRewardChip();
  }

  buildRewardChip() {
    if (this.rewardChip) { this.rewardChip.destroy(); this.rewardChip = null; }
    const s = this.gs.session;
    if (!Poki.available || !s || s.capacity <= 0 || s.bonusEchoes > 0 || !this.timeline) return;
    const u = this.u;
    const hudH = App.layout.hudH * App.dpr;
    const tl = this.timeline;
    this.rewardChip = new Button(this, tl.x + tl.w / 2, hudH + 26 * u, {
      w: 92, h: 38, icon: 'ad', iconScale: 0.5, iconX: -22, label: '+1', labelX: 22, labelSize: 18,
      fill: 0x241c4a, line: UI_COL.ad, onClick: () => this.askExtraEcho(),
    });
    const ghost = this.add.image(38 * u, 0, 'i_ghost').setScale(18 * u / 96).setTint(0xcfc4ff);
    this.rewardChip.add(ghost);
    this.rewardChip.label.setX(12 * u);
    this.rewardChip.setVisible(false).setDepth(102);
  }

  async askExtraEcho() {
    if (this.gs.state === 'run') App.bus.emit('cmd', 'pause');
    const ok = await Poki.rewardedBreak({
      pause: () => { App.audio.setMuted('ad', true); App.input.block(true); },
      resume: () => { App.audio.setMuted('ad', false); App.input.block(false); },
    });
    if (ok) {
      App.bus.emit('cmd', 'extraEcho');
      App.audio.play('unlock');
    } else if (this.rewardChip) this.rewardChip.shakeNo();
    if (this.rewardChip) { this.rewardChip.destroy(); this.rewardChip = null; }
    if (this.menuKind === 'pause') this.openMenu('pause');
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.drawTimeline();
    this.updatePrompts(dt);
    if (this.rewardChip && this.gs.session) {
      const need = Math.max(6, (this.def.sol.length - 1) * 2 + 3);
      const want = this.gs.stuck >= need && (this.gs.state === 'ready' || this.gs.state === 'run') && !this.menuKind;
      this.rewardChip.setVisible(want);
    }
    if (this.autoNext && this.menuKind === 'complete') {
      this.autoNext.t += dt;
      const k = Math.min(1, this.autoNext.t / this.autoNext.dur);
      const g = this.autoNext.g, b = this.autoNext.btn;
      g.clear();
      g.lineStyle(4 * this.u, 0xffffff, 0.9);
      g.beginPath();
      g.arc(b.x, b.y, b.w / 2 + 6 * this.u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false);
      g.strokePath();
      if (k >= 1) { this.autoNext = null; this.goNext(); }
    }
  }

  drawTimeline() {
    const tl = this.timeline;
    if (!tl || !this.tlGfx || !this.gs.world) return;
    const g = this.tlGfx, u = this.u;
    const s = this.gs.session, w = this.gs.world;
    const total = s.loopTicks;
    const k = Math.min(1, w.tick / total);
    const left = (total - w.tick) / TPS;
    g.clear();
    g.fillStyle(0x0a0e1a, 0.85);
    g.fillRoundedRect(tl.x - 3 * u, tl.y - tl.h / 2 - 3 * u, tl.w + 6 * u, tl.h + 6 * u, (tl.h + 6 * u) / 2);
    const danger = left <= 3 && this.gs.state === 'run';
    const col = danger ? (Math.floor(this.time.now / 150) % 2 ? 0xff5a74 : 0xffa0ae) : this.accent;
    g.fillStyle(0x1d2438, 1);
    g.fillRoundedRect(tl.x, tl.y - tl.h / 2, tl.w, tl.h, tl.h / 2);
    if (k > 0) {
      g.fillStyle(col, 1);
      g.fillRoundedRect(tl.x, tl.y - tl.h / 2, Math.max(tl.h, tl.w * k), tl.h, tl.h / 2);
    }
    // Echo actions and trace ends along the loop
    for (const e of w.echoes) {
      const c = echoColor(e.rec.id);
      for (const [tk] of e.rec.actions) {
        const x = tl.x + (tl.w * tk) / total;
        g.fillStyle(c, 1);
        g.fillTriangle(x - 4 * u, tl.y - tl.h / 2 - 6 * u, x + 4 * u, tl.y - tl.h / 2 - 6 * u, x, tl.y - tl.h / 2 - 1 * u);
      }
      const ex = tl.x + Math.min(tl.w, (tl.w * e.rec.len) / total);
      g.fillStyle(e.state === 'gone' ? 0xff5a74 : c, 1);
      g.fillCircle(ex, tl.y + tl.h / 2 + 4 * u, 2.5 * u);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(tl.x + tl.w * k, tl.y, tl.h * 0.75);
  }

  onTimerTick(sec) {
    if (!this.timeline) return;
    const tl = this.timeline;
    const t = txt(this, tl.x + tl.w + 2 * this.u, tl.y + 24 * this.u, String(Math.ceil(sec)), 22 * this.u, '#ff8a9b');
    t.setDepth(150);
    this.tweens.add({ targets: t, y: t.y + 10 * this.u, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  bumpShards() {
    const target = App.progress.data.shards;
    if (!this.shardText) return;
    this.shardText.setText(String(target));
    this.tweens.add({ targets: [this.shardText, this.shardIcon], scale: '*=1.25', duration: 110, yoyo: true });
  }

  flyShard(p) {
    if (!this.shardPos) return;
    const img = this.add.image(p.x, p.y, 'shardGem').setScale(0.9 * this.u).setDepth(950);
    this.tweens.add({
      targets: img, x: this.shardPos.x, y: this.shardPos.y, scale: 0.45 * this.u, duration: 650, ease: 'Cubic.easeIn',
      onComplete: () => {
        img.destroy();
        App.audio.play('pick');
        const t = txt(this, this.shardPos.x + 30 * this.u, this.shardPos.y + 26 * this.u, '+1', 18 * this.u, '#bff7ff').setDepth(950);
        this.tweens.add({ targets: t, y: t.y + 14 * this.u, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
      },
    });
  }

  flashScreen(color, alpha) {
    const r = this.add.rectangle(0, 0, this.scale.width, this.scale.height, color, alpha).setOrigin(0).setDepth(800);
    this.tweens.add({ targets: r, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  // --------------------------------------------------------------- prompts

  clearPrompts() {
    for (const o of this.promptObjs) o.destroy();
    this.promptObjs = [];
    if (App.touch) for (const el of document.querySelectorAll('#touch .hint')) el.classList.remove('hint');
  }

  prompt(x, y, key, opts = {}) {
    const touch = App.input.mode === 'touch';
    const u = this.u;
    let obj;
    if (touch) {
      if (DPAD_HINT[key]) { const el = document.querySelector('#touch ' + DPAD_HINT[key]); if (el) el.classList.add('hint'); }
      if (opts.noTap) return null;
      obj = this.add.image(x, y, 'i_tap').setScale(24 * u / 96).setTint(0xffffff);
    } else {
      obj = keycap(this, x, y, key, opts.scale || 0.85);
    }
    obj.setDepth(200);
    const bob = Math.sin(this.time.now / 180) * 3 * u;
    obj.y += bob;
    this.promptObjs.push(obj);
    return obj;
  }

  arrow(x, y, dir = 'down', color = 0xffffff) {
    const u = this.u;
    const bob = Math.sin(this.time.now / 160) * 5 * u;
    const img = this.add.image(x, y + (dir === 'down' ? bob : 0), 'i_' + (dir === 'down' ? 'down' : 'arrow')).setScale(26 * u / 96).setTint(color).setDepth(200);
    this.promptObjs.push(img);
  }

  updatePrompts(dt) {
    this.clearPrompts();
    const gs = this.gs;
    if (!gs.world || this.menuKind || !(gs.state === 'ready' || gs.state === 'run')) return;
    const w = gs.world, p = w.player, def = this.def, u = this.u;
    const hs = this.hintState;
    const toS = (x, y) => gs.worldToScreen(x, y);
    const pc = toS(p.x + p.w / 2, p.y);
    if (hs.spawnX === null) hs.spawnX = p.x;
    if (Math.abs(p.x - hs.spawnX) > 60) hs.moved = true;
    const hints = def.hints || [];
    const zoom = gs.cameras.main.zoom;
    // Movement keys at the very start of the game
    if (hints.includes('move') && !hs.moved) {
      if (App.input.mode === 'touch') {
        this.prompt(pc.x, pc.y - 40 * u, 'left', { noTap: true });
      } else {
        this.prompt(pc.x - 20 * u, pc.y - 40 * u, 'left');
        this.prompt(pc.x + 20 * u, pc.y - 40 * u, 'right');
      }
    }
    for (const h of hints) {
      if (h.startsWith('jump@') && !hs.jumped) {
        const at = parseFloat(h.slice(5));
        const cx = (p.x + p.w / 2) / TILE;
        if (!p.grounded) hs.jumped = hs.jumped || cx > at + 1;
        if (cx > at - 2.5 && cx < at + 0.8 && p.grounded) this.prompt(pc.x, pc.y - 40 * u, 'space', { noTap: true });
      }
      if (h.startsWith('plate:')) {
        const letter = h.slice(6);
        const pl = w.byLetter.get(letter)?.[0];
        if (pl && pl.powered) hs.plated = true;
        if (pl && !hs.plated) { const sp = toS(pl.ix, pl.y - 10); this.arrow(sp.x, sp.y - 20 * u, 'down', this.accent); }
        if (pl && pl.powered) hs.plateTime += dt; else hs.plateTime = Math.max(0, hs.plateTime - dt);
      }
      if (h === 'rewind' && !App.progress.flag('rewound') && hs.plateTime > 0.5 && gs.state === 'run') {
        this.prompt(pc.x, pc.y - 42 * u, 'R', { noTap: true });
        if (this.rewindBtn) this.rewindBtn.setHighlight(Math.floor(this.time.now / 250) % 2 === 0);
      }
      if (h === 'exit') {
        const door = [...w.receivers].find((r) => r.kind === 'door');
        if (door && door.open) { const ex = toS(w.exit.x + w.exit.w / 2, w.exit.y - 10); this.arrow(ex.x, ex.y - 16 * u, 'down', this.accent); }
      }
    }
    // Contextual interaction prompt
    const ft = w.focusTarget();
    if (ft && p.grounded !== undefined) {
      const o = ft.obj;
      let wx, wy;
      if (ft.kind === 'drop') { wx = p.x + p.w / 2; wy = p.y - 34; }
      else if (ft.kind === 'socket') { wx = o.ix; wy = o.y - 18; }
      else if (ft.kind === 'core') { wx = o.x + o.w / 2; wy = o.y - 16; }
      else { wx = o.ix; wy = o.y - 20; }
      const sp = toS(wx, wy);
      const firstTime = !App.progress.flag('used');
      if (ft.kind !== 'drop' || firstTime) this.prompt(sp.x, sp.y - 16 * u * Math.min(1.4, zoom / App.dpr), 'E', { scale: firstTime ? 0.95 : 0.7 });
      if (App.input.peek('use')) App.progress.setFlag('used');
    }
    if (this.rewindBtn && !(hints.includes('rewind') && hs.plateTime > 0.5 && !App.progress.flag('rewound'))) this.rewindBtn.setHighlight(false);
  }

  // ----------------------------------------------------------- level intro

  levelIntro(def) {
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const t = txt(this, W / 2, H * 0.22, def.id, 46 * u, '#ffffff', { stroke: '#000000', strokeThickness: 6 * u });
    t.setDepth(300).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 20 * u, delay: 1000, duration: 400, onComplete: () => t.destroy() });
  }

  onRewind(d) {
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const scan = this.add.tileSprite(0, 0, W, H, 'scan').setOrigin(0).setDepth(700).setAlpha(0).setTileScale(u * 1.5);
    const tint = this.add.rectangle(0, 0, W, H, 0x2a3a8a, 0.18).setOrigin(0).setDepth(699).setAlpha(0);
    const icon = this.add.image(W / 2, H / 2, 'i_rewind').setDepth(701).setScale(90 * u / 96).setAlpha(0).setTint(0xffffff);
    this.tweens.add({ targets: [scan, tint], alpha: 1, duration: 120 });
    this.tweens.add({ targets: icon, alpha: 0.85, duration: 120 });
    this.tweens.add({ targets: icon, angle: -360, duration: d.dur });
    this.tweens.add({ targets: scan, tilePositionY: -200, duration: d.dur });
    this.time.delayedCall(d.dur - 120, () => {
      this.tweens.add({ targets: [scan, tint, icon], alpha: 0, duration: 160, onComplete: () => { scan.destroy(); tint.destroy(); icon.destroy(); } });
    });
    if (this.rewindBtn) this.rewindBtn.setHighlight(false);
  }

  onEchoSpawned(d) {
    if (!d.first) return;
    // First echo ever: point at it
    this.time.delayedCall(250, () => {
      const gs = this.gs;
      const e = gs.world && gs.world.echoes[gs.world.echoes.length - 1];
      if (!e) return;
      const u = this.u;
      const sp = gs.worldToScreen(e.x + e.w / 2, e.y);
      const c = this.add.container(sp.x, sp.y - 50 * u).setDepth(300);
      const ghost = this.add.image(0, 0, 'i_ghost').setScale(40 * u / 96).setTint(echoColor(e.rec.id));
      const arr = this.add.image(0, 30 * u, 'i_down').setScale(22 * u / 96).setTint(echoColor(e.rec.id));
      c.add([ghost, arr]);
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, y: c.y - 8 * u, duration: 300, yoyo: false });
      this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 400, onComplete: () => c.destroy() });
    });
  }

  // ---------------------------------------------------------------- banners

  banner(b) {
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const c = this.add.container(W / 2, H * 0.4).setDepth(600);
    const g = this.add.graphics();
    const bw = Math.min(W * 0.9, 520 * u), bh = 92 * u;
    g.fillStyle(0x05070d, 0.85);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 20 * u);
    let col = this.accent, icon = 'star', label = 'NEW';
    if (b.kind === 'world') { const th = theme(b.world); col = hexNum(th.accent); icon = th.glyph; label = 'WORLD ' + b.world; }
    if (b.kind === 'echo') { icon = 'echoplus'; label = '+' + (b.bonus ? 1 : b.n) + ' ECHO'; col = 0xc9a4ff; }
    if (b.kind === 'skin') { icon = 'skin'; label = 'NEW SKIN'; col = UI_COL.gold; }
    if (b.kind === 'upgrade') { icon = b.icon; label = 'UPGRADE'; col = UI_COL.good; }
    if (b.kind === 'new') { icon = b.icon; label = 'NEW'; }
    if (b.kind === 'finale') { icon = 'star'; label = 'TRACEBOUND'; col = UI_COL.gold; }
    g.lineStyle(3 * u, col, 1);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 20 * u);
    c.add(g);
    const im = this.add.image(-bw / 2 + 52 * u, 0, 'i_' + icon).setScale(56 * u / 96).setTint(col);
    const t = txt(this, 24 * u, 2 * u, label, 34 * u, '#ffffff');
    c.add([im, t]);
    if (b.kind === 'skin' && b.skin) {
      const key = bakePortrait(this, b.skin, 128);
      c.add(this.add.image(bw / 2 - 52 * u, 0, key).setScale(84 * u / 128));
    }
    c.setScale(0.6).setAlpha(0);
    App.audio.play('unlock');
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: im, angle: 360, duration: 900, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, y: c.y - 30 * u, delay: 1700, duration: 350, onComplete: () => c.destroy() });
  }

  // ------------------------------------------------------------------ menus

  openMenu(kind, arg) {
    if (kind === 'pause') this.openPause();
    else if (kind === 'map') this.openMap(arg);
    else if (kind === 'lab') this.openLab(arg);
    else if (kind === 'complete') this.openComplete(arg, true);
  }

  closeMenu(silent) {
    if (this.menu) this.menu.destroy(true);
    this.menu = null;
    this.menuKind = null;
    this.menuArg = null;
    this.focus = [];
    this.focusIdx = -1;
    this.autoNext = null;
    if (App.touch) App.touch.setActive(true);
    void silent;
  }

  startMenu(kind, arg, dim = 0.62) {
    this.closeMenu(true);
    this.menuKind = kind;
    this.menuArg = arg;
    const c = this.add.container(0, 0).setDepth(500);
    const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x03050a, dim).setOrigin(0).setInteractive();
    c.add(bg);
    this.menu = c;
    if (App.touch) App.touch.setActive(false);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    return c;
  }

  addFocus(btn) { this.focus.push(btn); return btn; }

  setFocusIdx(i) {
    if (!this.focus.length) return;
    this.focusIdx = (i + this.focus.length) % this.focus.length;
    this.focus.forEach((b, k) => b.setFocus(k === this.focusIdx));
  }

  onInput(e) {
    if (e.type !== 'press' || !this.menuKind) return;
    const a = e.action;
    if (a === 'left' || a === 'up') { this.cancelAuto(); this.setFocusIdx(this.focusIdx < 0 ? 0 : this.focusIdx - 1); }
    else if (a === 'right' || a === 'down') { this.cancelAuto(); this.setFocusIdx(this.focusIdx < 0 ? 0 : this.focusIdx + 1); }
    else if (a === 'confirm' || a === 'jump' || a === 'use') {
      const b = this.focus[this.focusIdx >= 0 ? this.focusIdx : 0];
      if (b) b.click();
    } else if (a === 'pause') {
      if (this.menuKind === 'pause') App.bus.emit('cmd', 'resume');
      else if (this.menuKind === 'lab' || this.menuKind === 'map') this.backFromSub();
    }
  }

  cancelAuto() {
    if (this.autoNext) { this.autoNext.g.clear(); this.autoNext = null; }
  }

  backFromSub() {
    const from = this.subReturn || 'pause';
    this.subReturn = null;
    if (from === 'complete' && this.lastComplete) this.openComplete(this.lastComplete, true);
    else if (this.gs.state === 'paused') this.openPause();
    else this.closeMenu();
  }

  // Pause ------------------------------------------------------------------

  openPause() {
    const c = this.startMenu('pause');
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const cy = H * 0.46;
    const resume = this.addFocus(new Button(this, W / 2, cy - 64 * u, { icon: 'play', size: 96, iconScale: 0.5, fill: 0x14203a, line: this.accent, onClick: () => App.bus.emit('cmd', 'resume') }));
    c.add(resume);
    const P = App.progress;
    const items = [
      { icon: 'restart', fn: () => { this.closeMenu(); App.bus.emit('cmd', 'restart'); } },
      { icon: 'map', fn: () => { this.subReturn = 'pause'; this.openMap(); } },
      { icon: 'lab', fn: () => { this.subReturn = 'pause'; this.openLab(); }, hl: P.cheapestAffordable() },
      { icon: P.settings.sfx ? 'sound' : 'soundOff', fn: (b) => { const on = P.toggle('sfx'); App.audio.setSfx(on); b.setIcon(on ? 'sound' : 'soundOff'); } },
      { icon: P.settings.music ? 'music' : 'musicOff', fn: (b) => { const on = P.toggle('music'); App.audio.setMusic(on); b.setIcon(on ? 'music' : 'musicOff'); } },
    ];
    const s = this.gs.session;
    if (Poki.available && s && s.capacity > 0 && s.bonusEchoes === 0) {
      items.push({ icon: 'ad', fn: () => this.askExtraEcho(), fill: 0x241c4a, line: UI_COL.ad, extra: 'ghost' });
    }
    const size = 62, gap = 14;
    const rowW = items.length * size * u + (items.length - 1) * gap * u;
    items.forEach((it, i) => {
      const b = new Button(this, W / 2 - rowW / 2 + (size * u) / 2 + i * (size + gap) * u, cy + 58 * u, {
        icon: it.icon, size, iconScale: 0.5, onClick: it.fn, fill: it.fill, line: it.line,
      });
      if (it.hl) b.setHighlight(true);
      if (it.extra) {
        b.icon.setX(-9 * u).setScale(0.36 * size * u / 96);
        b.add(this.add.image(13 * u, 8 * u, 'i_' + it.extra).setScale(20 * u / 96).setTint(0xcfc4ff));
      }
      c.add(this.addFocus(b));
    });
    // Level context
    c.add(txt(this, W / 2, Math.max(App.layout.hudH * App.dpr + 24 * u, cy - 150 * u), this.def ? this.def.id : '', 26 * u, '#aab6d6'));
    this.setFocusIdx(0);
  }

  // Level complete --------------------------------------------------------

  openComplete(d, returning) {
    this.lastComplete = d;
    const c = this.startMenu('complete', d, 0.5);
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const pw = Math.min(W * 0.92, 440 * u), ph = 300 * u;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const g = this.add.graphics();
    panel(g, px, py, pw, ph, this.accent);
    c.add(g);
    const check = this.add.image(W / 2, py + 4 * u, 'i_check').setScale(0).setTint(0xffffff);
    const ring = this.add.graphics();
    ring.fillStyle(this.accent, 1);
    ring.fillCircle(W / 2, py + 4 * u, 38 * u);
    c.add([ring, check]);
    this.tweens.add({ targets: check, scale: 44 * u / 96, duration: 350, ease: 'Back.easeOut', delay: 80 });
    c.add(txt(this, W / 2, py + 64 * u, d.def.id, 28 * u, '#ffffff'));
    // Rewards
    const sm = d.summary;
    const gained = sm.gained;
    const rowY = py + 118 * u;
    const gem = this.add.image(W / 2 - 38 * u, rowY, 'shardGem').setScale(40 * u / 48);
    const num = txt(this, W / 2 + 22 * u, rowY + 2 * u, '+0', 36 * u, '#bff7ff');
    c.add([gem, num]);
    if (!returning) {
      const counter = { v: 0 };
      this.tweens.add({
        targets: counter, v: gained, duration: 500 + gained * 60, delay: 250,
        onUpdate: () => { if (num.scene) num.setText('+' + Math.round(counter.v)); },
        onComplete: () => { if (!num.scene) return; App.audio.play('shard'); this.bumpShards(); },
      });
    } else num.setText('+' + gained);
    // Details: loops used, bonus shard
    const info = [];
    info.push({ icon: 'rewind', text: '×' + Math.max(0, d.loops - 1) });
    if (sm.bonusGained) info.push({ icon: 'star', text: '+' + sm.bonusGained });
    const iw = 90 * u;
    info.forEach((it, i) => {
      const x = W / 2 - ((info.length - 1) * iw) / 2 + i * iw;
      c.add(this.add.image(x - 16 * u, rowY + 48 * u, 'i_' + it.icon).setScale(22 * u / 96).setTint(0xaab6d6));
      c.add(txt(this, x + 14 * u, rowY + 49 * u, it.text, 18 * u, '#aab6d6'));
    });
    // Buttons
    const by = py + ph - 52 * u;
    const next = new Button(this, W / 2, by, { icon: 'next', size: 76, iconScale: 0.5, fill: 0x14203a, line: this.accent, onClick: () => this.goNext() });
    const replay = new Button(this, W / 2 - 96 * u, by, { icon: 'restart', size: 54, iconScale: 0.5, onClick: () => { this.closeMenu(); App.bus.emit('cmd', 'restart'); } });
    const lab = new Button(this, W / 2 + 96 * u, by, { icon: 'lab', size: 54, iconScale: 0.5, onClick: () => { this.cancelAuto(); this.subReturn = 'complete'; this.openLab(); } });
    if (App.progress.cheapestAffordable()) {
      lab.setHighlight(true);
      this.tweens.add({ targets: lab, scale: 1.08, duration: 420, yoyo: true, repeat: -1 });
    }
    c.add([replay, next, lab]);
    this.addFocus(next); this.addFocus(replay); this.addFocus(lab);
    // Optional rewarded: double the shards (never required)
    if (Poki.available && gained > 0 && !d.doubled) {
      const ad = new Button(this, W / 2, py + ph + 36 * u, {
        w: 132, h: 44, icon: 'ad', iconX: -40, iconScale: 0.55, label: '×2', labelX: 6, labelSize: 22, fill: 0x241c4a, line: UI_COL.ad,
        onClick: async () => {
          this.cancelAuto();
          const ok = await Poki.rewardedBreak({
            pause: () => { App.audio.setMuted('ad', true); App.input.block(true); },
            resume: () => { App.audio.setMuted('ad', false); App.input.block(false); },
          });
          if (ok) {
            App.progress.data.shards += gained;
            App.progress.save();
            d.doubled = true;
            Poki.measure('booster', 'double-shards', 'complete');
            App.audio.play('upgrade');
            this.bumpShards();
            this.openComplete(Object.assign({}, d, { summary: Object.assign({}, sm, { gained: gained * 2 }) }), true);
          } else ad.shakeNo();
        },
      });
      ad.add(this.add.image(46 * u, 0, 'shardGem').setScale(20 * u / 48));
      c.add(ad);
      this.addFocus(ad);
    }
    this.setFocusIdx(0);
    if (!returning) {
      // New skin / world rewards
      if (sm.newSkin) this.time.delayedCall(700, () => this.banner({ kind: 'skin', skin: sm.newSkin }));
      if (d.def.id === LEVELS[LEVELS.length - 1].id && sm.first) this.time.delayedCall(2700, () => this.banner({ kind: 'finale' }));
      // Auto-continue unless the player interacts with the card
      const ag = this.add.graphics();
      c.add(ag);
      this.autoNext = { t: 0, dur: 5, g: ag, btn: next };
      bgCancel(c, () => this.cancelAuto());
    }
  }

  goNext() {
    this.closeMenu();
    App.bus.emit('cmd', 'next');
  }

  setBusy(on) {
    if (on) {
      if (this.busy) return;
      this.busy = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.001).setOrigin(0).setDepth(2000).setInteractive();
    } else if (this.busy) { this.busy.destroy(); this.busy = null; }
  }

  // Map -------------------------------------------------------------------

  openMap(world) {
    const P = App.progress;
    const cur = this.def ? this.def.world : 1;
    const w0 = world || cur;
    const c = this.startMenu('map', w0, 0.82);
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const back = new Button(this, 40 * u, 40 * u, { icon: 'back', size: 52, iconScale: 0.45, onClick: () => this.backFromSub() });
    c.add(back);
    // World tabs
    const tabs = WORLDS.length;
    const tw = 64 * u, gap = 12 * u;
    const rowW = tabs * tw + (tabs - 1) * gap;
    const ty = Math.max(96 * u, H * 0.2);
    WORLDS.forEach((wd, i) => {
      const th = theme(wd.id);
      const unlocked = P.worldUnlocked(wd.id);
      const b = new Button(this, W / 2 - rowW / 2 + tw / 2 + i * (tw + gap), ty, {
        icon: unlocked ? th.glyph : 'lock', size: 64, iconScale: 0.5, iconTint: unlocked ? hexNum(th.accent) : 0x5b6680,
        line: wd.id === w0 ? hexNum(th.accent) : undefined, disabled: !unlocked,
        onClick: () => { this.openMap(wd.id); },
      });
      if (P.worldDone(wd.id)) b.add(this.add.image(22 * u, -22 * u, 'i_check').setScale(18 * u / 96).setTint(UI_COL.good));
      if (wd.id === w0) b.setScale(1.1);
      c.add(b);
    });
    // Levels of the selected world
    const levels = WORLDS[w0 - 1].levels;
    const th = theme(w0);
    const ac = hexNum(th.accent);
    const n = levels.length;
    const cols = W / u < 560 ? 4 : 8;
    const rows = Math.ceil(n / cols);
    const ls = Math.min(72 * u, (W - 40 * u) / cols - 14 * u);
    const lgap = 14 * u;
    const gridW = cols * ls + (cols - 1) * lgap;
    const startY = ty + 110 * u;
    levels.forEach((l, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = W / 2 - gridW / 2 + ls / 2 + col * (ls + lgap);
      const y = startY + row * (ls + lgap + 18 * u) + (col % 2 ? 12 * u : 0);
      const unlocked = P.isUnlocked(l.id);
      const done = P.isDone(l.id);
      const b = new Button(this, x, y, {
        size: ls / u, label: unlocked ? String(i + 1) : undefined, labelSize: 26, icon: unlocked ? undefined : 'lock', iconScale: 0.45,
        fill: done ? 0x16233f : UI_COL.panel, line: done ? ac : undefined, disabled: !unlocked,
        onClick: () => { this.closeMenu(); App.bus.emit('cmd', 'load', l.id); },
      });
      if (done) b.add(this.add.image(ls * 0.32, -ls * 0.32, 'i_check').setScale(16 * u / 96).setTint(UI_COL.good));
      const bonusTotal = LEVELS.find((x2) => x2.id === l.id).map.join('').split('*').length - 1;
      if (bonusTotal) {
        const got = P.bonusTaken(l.id).size;
        b.add(this.add.image(0, ls * 0.62, 'shardGem').setScale(16 * u / 48).setAlpha(got ? 1 : 0.25));
      }
      if (this.def && l.id === this.def.id) b.setHighlight(true);
      c.add(b);
      if (unlocked) this.addFocus(b);
    });
    void rows;
    this.setFocusIdx(Math.max(0, this.focus.findIndex((b) => b.highlight)));
  }

  // Lab: upgrades + skins ---------------------------------------------------

  openLab(tab = 'up') {
    const P = App.progress;
    const c = this.startMenu('lab', tab, 0.84);
    const u = this.u, W = this.scale.width, H = this.scale.height;
    c.add(new Button(this, 40 * u, 40 * u, { icon: 'back', size: 52, iconScale: 0.45, onClick: () => this.backFromSub() }));
    // Tabs + balance
    const tUp = new Button(this, W / 2 - 40 * u, 40 * u, { icon: 'up', size: 56, iconScale: 0.45, line: tab === 'up' ? UI_COL.good : undefined, onClick: () => this.openLab('up') });
    const tSk = new Button(this, W / 2 + 40 * u, 40 * u, { icon: 'skin', size: 56, iconScale: 0.45, line: tab === 'skin' ? UI_COL.gold : undefined, onClick: () => this.openLab('skin') });
    c.add([tUp, tSk]);
    const g = this.add.graphics();
    pill(g, W - 130 * u, 22 * u, 110 * u, 36 * u, 0x0a0e1a, 0x6fd6ff);
    c.add(g);
    c.add(this.add.image(W - 108 * u, 40 * u, 'shardGem').setScale(22 * u / 48));
    const bal = txt(this, W - 62 * u, 41 * u, String(P.data.shards), 20 * u);
    c.add(bal);
    this.addFocus(tUp); this.addFocus(tSk);
    if (tab === 'up') this.buildUpgrades(c, bal);
    else this.buildSkins(c);
    this.setFocusIdx(2);
  }

  buildUpgrades(c, bal) {
    const P = App.progress;
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const n = UPGRADES.length;
    const narrow = W / u < 620;
    const cols = narrow ? 3 : 5;
    const cw = Math.min(150 * u, (W - 30 * u) / cols - 12 * u), ch = 190 * u;
    const gap = 12 * u;
    const top = 96 * u;
    UPGRADES.forEach((up, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * cw + (inRow - 1) * gap;
      const x = W / 2 - rowW / 2 + cw / 2 + col * (cw + gap);
      const y = top + ch / 2 + row * (ch + gap) + (narrow ? 0 : Math.max(0, (H - top - ch) / 2 - 60 * u));
      const lvl = P.upgradeLevel(up.id);
      const max = up.costs.length;
      const cost = P.upgradeCost(up.id);
      const card = this.add.graphics();
      card.fillStyle(UI_COL.panel, 0.96);
      card.fillRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 18 * u);
      card.lineStyle(2 * u, lvl >= max ? UI_COL.good : UI_COL.panelLine, 1);
      card.strokeRoundedRect(x - cw / 2, y - ch / 2, cw, ch, 18 * u);
      c.add(card);
      c.add(this.add.image(x, y - 50 * u, 'i_' + up.icon).setScale(58 * u / 96).setTint(UI_COL.good));
      c.add(txt(this, x, y - 8 * u, up.label, 15 * u, '#aab6d6'));
      const eff = { memory: '+3s', speed: '+7%', stability: '+1', focus: '+60%', sync: lvl === 0 ? '1' : '2' }[up.id];
      if (lvl < max && eff) c.add(txt(this, x + 34 * u, y - 60 * u, eff, 15 * u, '#7dffb3'));
      // tier pips
      for (let k = 0; k < max; k++) {
        const pg = this.add.graphics();
        const px = x + (k - (max - 1) / 2) * 18 * u;
        pg.fillStyle(k < lvl ? UI_COL.good : 0x2a3350, 1);
        pg.fillCircle(px, y + 18 * u, 6 * u);
        c.add(pg);
      }
      const b = new Button(this, x, y + 60 * u, {
        w: cw / u - 20, h: 44, label: lvl >= max ? 'MAX' : String(cost), labelSize: 20, labelX: lvl >= max ? 0 : 10,
        fill: lvl >= max ? 0x16233f : 0x173a2a, line: lvl >= max ? undefined : UI_COL.good,
        disabled: lvl >= max || !P.canBuy(up.id),
        onClick: () => {
          if (P.buy(up.id)) {
            App.audio.play('upgrade');
            Poki.measure('upgrade', up.id + '-' + P.upgradeLevel(up.id), 'complete');
            App.bus.emit('cmd', 'stats');
            this.banner({ kind: 'upgrade', icon: up.icon });
            this.bumpShards();
            this.openLab('up');
          }
        },
      });
      if (lvl < max) b.add(this.add.image(-(cw / 2) + 34 * u, 0, 'shardGem').setScale(18 * u / 48));
      c.add(b);
      this.addFocus(b);
    });
    void bal;
  }

  buildSkins(c) {
    const P = App.progress;
    const u = this.u, W = this.scale.width, H = this.scale.height;
    const n = SKINS.length;
    const cols = W / u < 620 ? 4 : 7;
    const size = Math.min(110 * u, (W - 30 * u) / cols - 12 * u);
    const gap = 12 * u;
    const top = 110 * u;
    SKINS.forEach((sk, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * size + (inRow - 1) * gap;
      const x = W / 2 - rowW / 2 + size / 2 + col * (size + gap);
      const y = top + size / 2 + row * (size + gap + 20 * u) + Math.max(0, (H - top) / 2 - size - 40 * u);
      const owned = P.hasSkin(sk.id);
      const sel = P.data.skin === sk.id;
      const b = new Button(this, x, y, {
        size: size / u, fill: sel ? 0x1a2a4a : UI_COL.panel, line: sel ? UI_COL.gold : undefined, round: false, w: size / u, h: size / u,
        onClick: () => {
          if (!owned) { App.audio.play('nothing'); b.shakeNo(); return; }
          P.setSkin(sk.id);
          Poki.measure('cosmetic', sk.id, 'interact');
          App.bus.emit('cmd', 'skin');
          this.openLab('skin');
        },
      });
      const key = bakePortrait(this, sk.id, 128);
      const img = this.add.image(0, 0, key).setScale((size * 0.9) / 128);
      if (!owned) img.setTintFill(0x1b2033);
      b.add(img);
      if (!owned) {
        const th = theme(sk.world);
        b.add(this.add.image(0, size * 0.02, 'i_lock').setScale(26 * u / 96).setTint(0x8390ad));
        b.add(this.add.image(size * 0.3, size * 0.32, 'i_' + th.glyph).setScale(22 * u / 96).setTint(hexNum(th.accent)));
      }
      if (sel) b.add(this.add.image(size * 0.34, -size * 0.34, 'i_check').setScale(18 * u / 96).setTint(UI_COL.gold));
      c.add(b);
      this.addFocus(b);
    });
  }
}

function bgCancel(container, fn) {
  const bg = container.list[0];
  if (bg && bg.on) bg.on('pointerdown', fn);
  for (const o of container.list) if (o instanceof Button) o.on('pointerover', fn);
}

export { FONT };
