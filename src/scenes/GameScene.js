// The playable room. Runs the fixed-step simulation, renders it with
// interpolation, and drives the loop flow: ready -> run -> rewind / fail /
// complete. Also owns all in-world feedback (sound, particles, camera).

import { App } from '../app.js';
import { LEVELS } from '../levels/index.js';
import { Session } from '../sim/session.js';
import { TILE, TPS, DT, MIN_ECHO_TICKS, BODY_W } from '../sim/constants.js';
import { F_GROUND, F_LEFT } from '../sim/recording.js';
import { theme, echoColor } from '../game/config.js';
import { hexNum } from '../render/canvas.js';
import { bakeRoom } from '../render/room.js';
import { MechLayer } from '../render/mechs.js';
import { CharacterView } from '../render/character.js';
import { Fx } from '../render/fx.js';
import { Poki } from '../platform/poki.js';

const T = TILE;
const DT_MS = 1000 / TPS;
// Replaced at build time; true when running from source
const __DEV__ = typeof __TB_DEV__ === 'undefined' ? true : __TB_DEV__;
const RED = 0xff5a74;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.state = 'idle';
    this.acc = 0;
    this.zoomBase = 1;
    this.punch = 0;
    this.echoViews = [];
    this.traces = [];
    this.fx = new Fx(this);
    this.cameras.main.setRoundPixels(false);
    App.bus.on('layout', () => this.fitCamera(true));
    App.bus.on('cmd', (cmd, arg) => this.command(cmd, arg));
    App.input.on((e) => {
      if (e.type === 'press' && e.action === 'pause' && (this.state === 'run' || this.state === 'ready')) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'run' || this.state === 'ready')) this.pause();
    });
  }

  // ------------------------------------------------------------- commands

  command(cmd, arg) {
    switch (cmd) {
      case 'load': this.loadLevel(arg); break;
      case 'pause': this.pause(); break;
      case 'resume': this.resume(); break;
      case 'restart': this.restartLevel(); break;
      case 'next': this.nextLevel(); break;
      case 'rewind': if (this.state === 'run') this.rewind('manual'); break;
      case 'undo': this.undo(); break;
      case 'extraEcho': this.grantExtraEcho(); break;
      case 'skin': if (this.player) this.player.setSkin(App.progress.data.skin); break;
      case 'stats': if (this.session) this.session.stats = App.progress.stats(); break;
      default:
    }
  }

  // ---------------------------------------------------------------- level

  loadLevel(id) {
    const def = LEVELS.find((l) => l.id === id) || LEVELS[0];
    this.clearLevel();
    this.def = def;
    this.th = theme(def.world);
    this.accent = hexNum(this.th.accent);
    const P = App.progress;
    P.setLast(def.id);
    this.session = new Session(def, P.stats(), P.bonusTaken(def.id));
    this.levelStarted = false;
    this.failMeasured = false;
    this.stuck = 0;
    this.firstRewindDone = P.flag('rewound');
    const L = this.session.level;
    this.roomW = L.w * T;
    this.roomH = L.h * T;
    this.fitCamera(false);
    this.bakeScale = this.pickBakeScale();
    this.roomKey = 'room_' + def.id;
    bakeRoom(this, L, this.th, this.bakeScale, this.roomKey);
    this.back = this.add.image(0, 0, this.roomKey + '_back').setOrigin(0).setScale(1 / this.bakeScale).setDepth(0);
    this.tiles = this.add.image(0, 0, this.roomKey + '_tiles').setOrigin(0).setScale(1 / this.bakeScale).setDepth(25);
    const world = this.session.startLoop();
    this.world = world;
    this.mech = new MechLayer(this, world, this.th);
    this.player = new CharacterView(this, { skin: P.data.skin, depth: 50 });
    this.fx.motes({ x: T, y: T, w: this.roomW - 2 * T, h: this.roomH - 2 * T }, this.accent);
    if (def.mirror) this.buildMirror(def.mirror * T);
    App.bus.emit('world', def.world);
    App.audio.music.setWorld(def.world);
    App.audio.music.setState('ready');
    App.bus.emit('level', def);
    this.introAnim();
    this.startLoop({ intro: true });
    if (def.world > 1 && P.setFlag('world' + def.world)) {
      App.bus.emit('banner', { kind: 'world', world: def.world });
      Poki.measure('world', def.world, 'start', true);
    } else if (def.echoes >= 2 && P.setFlag('echoes' + def.echoes)) {
      App.bus.emit('banner', { kind: 'echo', n: def.echoes });
    } else {
      const fresh = this.newMechanic(def, world);
      if (fresh) this.time.delayedCall(350, () => App.bus.emit('banner', { kind: 'new', icon: fresh }));
    }
  }

  /** First time a mechanic shows up: announce it with its icon. */
  newMechanic(def, world) {
    const P = App.progress;
    const kinds = [];
    if (world.bridges.length) kinds.push(['bridge', 'bridge']);
    if (world.lifts.length) kinds.push(['lift', 'lift']);
    if (world.cores.length) kinds.push(['core', 'core']);
    if (world.triggers.some((t) => t.kind === 'button')) kinds.push(['button', 'clock']);
    if (world.receivers.some((r) => r.cycle)) kinds.push(['cycle', 'w3']);
    if (world.lasers.length) kinds.push(['laser', 'laser']);
    if (world.receivers.some((r) => r.hist)) kinds.push(['delay', 'hourglass']);
    if (def.mirror) kinds.push(['mirror', 'w5']);
    let icon = null;
    for (const [k, ic] of kinds) if (P.setFlag('seen_' + k) && !icon) icon = ic;
    return icon;
  }

  clearLevel() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.mech) this.mech.destroy();
    this.mech = null;
    for (const o of [this.back, this.tiles, this.mirrorLine, this.mirrorGlow]) if (o) o.destroy();
    this.back = this.tiles = this.mirrorLine = this.mirrorGlow = null;
    if (this.player) this.player.destroy();
    if (this.reflection) this.reflection.destroy();
    this.player = this.reflection = null;
    for (const v of this.echoViews) v.view.destroy();
    this.echoViews = [];
    for (const g of this.traces) g.destroy();
    this.traces = [];
    if (this.roomKey) {
      for (const suf of ['_back', '_tiles']) if (this.textures.exists(this.roomKey + suf)) this.textures.remove(this.roomKey + suf);
    }
    this.state = 'idle';
  }

  buildMirror(ax) {
    const g = this.add.graphics().setDepth(9);
    this.mirrorLine = g;
    this.mirrorX = ax;
    this.mirrorGlow = this.add.image(ax, this.roomH / 2, 'glow').setBlendMode(1).setTint(RED).setScale(0.35, this.roomH / 55).setAlpha(0.35).setDepth(8);
    this.reflection = new CharacterView(this, { skin: App.progress.data.skin, holo: true, tint: 0xff8fa3, depth: 44 });
    this.reflection.setAlpha(0.35);
  }

  introAnim() {
    const cam = this.cameras.main;
    this.punch = -0.06;
    cam.fadeIn(350, 0, 0, 0);
    this.back.setAlpha(0);
    this.tweens.add({ targets: this.back, alpha: 1, duration: 400 });
  }

  // ----------------------------------------------------------------- loop

  startLoop(opts = {}) {
    const s = this.session;
    const world = opts.intro ? this.world : s.startLoop();
    this.world = world;
    this.mech.bind(world);
    this.acc = 0;
    this.tension = false;
    App.audio.music.setTension(false);
    // Echo views
    const n = world.echoes.length;
    while (this.echoViews.length > n) this.echoViews.pop().view.destroy();
    world.echoes.forEach((e, i) => {
      let ev = this.echoViews[i];
      if (!ev) {
        ev = { view: new CharacterView(this, { skin: App.progress.data.skin, holo: true, depth: 45 + i * 0.01 }), id: -1 };
        this.echoViews[i] = ev;
      }
      ev.echo = e;
      if (ev.id !== e.rec.id) {
        ev.id = e.rec.id;
        ev.view.setSkin(App.progress.data.skin);
        ev.view.setTint(echoColor(e.rec.id));
      }
      ev.view.setVisible(true);
      const age = n - 1 - i;
      ev.view.setAlpha(Math.max(0.38, 0.85 - age * 0.16));
      ev.view.resetMotion(e.x + e.w / 2, e.y + e.h);
      ev.gone = false;
    });
    this.drawTraces();
    const p = world.player;
    this.player.setVisible(true);
    this.player.root.setScale(this.player.baseScale).setRotation(0).setAlpha(1);
    this.player.resetMotion(p.x + p.w / 2, p.y + p.h);
    this.state = 'ready';
    App.input.clearEdges();
    App.audio.music.setState('ready');
    App.bus.emit('loop', { world, session: s });
  }

  drawTraces() {
    for (const g of this.traces) g.destroy();
    this.traces = [];
    const w = this.world;
    w.echoes.forEach((e) => {
      const g = this.add.graphics().setDepth(15);
      const col = echoColor(e.rec.id);
      const rec = e.rec;
      const mx = (x) => (e.mirror ? w.mirrorX(x) : x) + BODY_W / 2;
      let last = null;
      for (let k = 0; k < rec.len; k += 3) {
        const x = mx(rec.x[k]), y = rec.y[k] + 30;
        if (last && Math.hypot(x - last[0], y - last[1]) < 7) continue;
        g.fillStyle(col, 0.5);
        g.fillCircle(x, y, 1.8);
        last = [x, y];
      }
      for (const [k] of rec.actions) {
        if (k >= rec.len) continue;
        const x = mx(rec.x[k]), y = rec.y[k] + 14;
        g.lineStyle(2, col, 0.8);
        g.strokeCircle(x, y, 6);
        g.fillStyle(col, 0.8);
        g.fillCircle(x, y, 2);
      }
      if (rec.len) {
        const k = rec.len - 1;
        const x = mx(rec.x[k]), y = rec.y[k] + 34;
        g.lineStyle(2, col, 0.7);
        g.strokeEllipse(x, y, 22, 7);
      }
      g.setAlpha(0.9);
      this.traces.push(g);
    });
  }

  // ---------------------------------------------------------------- update

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    const I = App.input;
    if (this.state === 'ready') {
      if (I.consume('undo')) this.undo();
      I.consume('rewind');
      if (this.state === 'ready' && (I.isDown('left') || I.isDown('right') || I.isDown('jump') || I.peek('jump') || I.peek('use'))) {
        this.beginRun();
      }
    }
    if (this.state === 'run') {
      if (I.consume('rewind')) { this.rewind('manual'); }
      else if (I.consume('undo')) { this.undo(); }
      else {
        this.acc += Math.min(delta, 100);
        let steps = 0;
        const maxSteps = __DEV__ && this.bot ? 40 : 6;
        if (__DEV__ && this.bot) this.acc += DT_MS * 30;
        while (this.acc >= DT_MS && this.state === 'run' && steps < maxSteps) {
          this.tick();
          this.acc -= DT_MS;
          steps++;
        }
        if (steps >= maxSteps) this.acc = 0;
      }
    }
    this.render(dt);
  }

  beginRun() {
    this.state = 'run';
    this.acc = DT_MS;
    Poki.gameplayStart();
    if (!this.levelStarted) {
      this.levelStarted = true;
      Poki.measure('level', this.def.id, 'start');
    }
    App.audio.music.setState('play');
    App.bus.emit('run');
  }

  tick() {
    const I = App.input;
    const w = this.world;
    let input = {
      left: I.isDown('left'),
      right: I.isDown('right'),
      jump: I.isDown('jump'),
      jumpPressed: I.consume('jump'),
      interact: I.consume('use'),
    };
    if (__DEV__ && this.bot) {
      input = this.bot.next(w);
      if (input.rewind) return this.rewind('manual');
    }
    w.step(input);
    for (const ev of w.events) this.onEvent(ev);
    w.events.length = 0;
    if (w.status === 'dead') return this.onDeath();
    if (w.status === 'complete') return this.onComplete();
    const s = this.session;
    if (s.loopTicks !== Infinity) {
      const left = s.loopTicks - w.tick;
      if (left <= 0) return this.rewind('timer');
      if (left <= 3 * TPS && left % TPS === 0) {
        App.audio.play('tick', { hi: left <= TPS });
        App.bus.emit('timerTick', left / TPS);
      }
      const tense = left <= 3 * TPS;
      if (tense !== this.tension) { this.tension = tense; App.audio.music.setTension(tense); }
    }
  }

  // --------------------------------------------------------------- events

  viewFor(who) {
    if (!who || who === 'player' || who.kind === 'player') return this.player;
    const ev = this.echoViews.find((v) => v.echo === who);
    return ev ? ev.view : null;
  }

  onEvent(ev) {
    const A = App.audio, fx = this.fx, acc = this.accent;
    switch (ev.type) {
      case 'jump': A.play('jump', ev); this.player.jump(ev.boost); fx.puff(ev.x, ev.y, 4); if (ev.boost) fx.ring(ev.x, ev.y, acc, 0.5, 300); break;
      case 'land':
        if (ev.who === 'player') { A.play('land', ev); this.player.land(ev.v); if (ev.v > 350) fx.puff(ev.x, ev.y, 3 + Math.round(ev.v / 250)); }
        else fx.puff(ev.x, ev.y, 2);
        break;
      case 'bonk': A.play('bonk'); break;
      case 'lever': {
        A.play('lever', ev); fx.burst(ev.x, ev.y - 20, acc, 10); fx.ring(ev.x, ev.y - 20, acc, 0.45, 300);
        const v = this.viewFor(ev.who === 'player' ? 'player' : null); if (v && ev.who === 'player') v.poke();
        this.shake(80, 0.0015);
        break;
      }
      case 'button': A.play('button'); fx.burst(ev.x, ev.y - 10, acc, 10); fx.ring(ev.x, ev.y - 10, acc, 0.5, 350); if (ev.who === 'player') this.player.poke(); break;
      case 'buttonOff': A.play('buttonOff'); break;
      case 'plateOn': A.play('plateOn'); fx.ring(ev.x, ev.y + 12, acc, 0.5, 300); fx.glitter(ev.x, ev.y + 14, acc, 6); break;
      case 'plateOff': A.play('plateOff'); break;
      case 'doorOpen': A.play('doorOpen'); fx.puff(ev.x, ev.obj.y + ev.obj.h, 5); break;
      case 'doorClose': A.play('doorClose'); fx.puff(ev.x, ev.obj.y + ev.obj.h, 4); this.shake(70, 0.0012); break;
      case 'bridgeOn': A.play('bridgeOn'); fx.glitter(ev.x, ev.y, acc, 14); break;
      case 'bridgeOff': A.play('bridgeOff'); break;
      case 'laserOn': A.play('laserOn'); break;
      case 'laserOff': A.play('laserOff'); break;
      case 'socketOn': A.play('socket'); fx.burst(ev.x, ev.y, 0xffe07a, 18); fx.ring(ev.x, ev.y, 0xffe07a, 0.7, 420); this.shake(90, 0.0018); break;
      case 'socketOff': A.play('drop'); break;
      case 'pick': A.play('pick'); fx.glitter(ev.x, ev.y, 0xffe07a, 10); if (ev.who === 'player') this.player.poke(); break;
      case 'drop': A.play('drop'); break;
      case 'shard':
        A.play('shard'); fx.burst(ev.x, ev.y, 0x9fe8ff, 22); fx.ring(ev.x, ev.y, 0x9fe8ff, 0.8, 500); this.punchZoom(0.02);
        App.bus.emit('shardFly', this.worldToScreen(ev.x, ev.y));
        break;
      case 'paradox': this.onParadox(ev); break;
      case 'echoEnd': {
        const v = this.viewFor(ev.echo);
        if (v) fx.ring(ev.x, ev.y + 16, echoColor(ev.echo.rec.id), 0.3, 300);
        break;
      }
      case 'nothing': A.play('nothing'); fx.ring(ev.x, ev.y + 10, 0x9aa6c2, 0.25, 200); break;
      case 'fail': A.play('fail'); fx.ring(ev.x, ev.y + 10, RED, 0.3, 300); break;
      case 'shove': fx.puff(ev.x, ev.y, 5); break;
      case 'coreLand': fx.puff(ev.x, ev.y, 3, 0xffe07a); break;
      case 'death': break;
      default:
    }
  }

  onParadox(ev) {
    const e = ev.echo;
    const ec = this.echoViews.find((v) => v.echo === e);
    const col = echoColor(e.rec.id);
    App.audio.play('paradox');
    this.fx.shards(ev.x, ev.y, col, 14);
    this.fx.icon(ev.x, ev.y - 30, 'i_broken', RED, 0.3, 30, 1400);
    this.fx.ring(ev.x, ev.y, RED, 0.6, 400);
    this.shake(120, 0.002);
    this.session.paradoxes++;
    if (ec) {
      ec.gone = true;
      const v = ec.view;
      this.tweens.add({ targets: v.root, alpha: 0, duration: 250, onComplete: () => v.setVisible(false) });
    }
    App.bus.emit('paradox', ev);
  }

  // ---------------------------------------------------------- transitions

  onDeath() {
    this.state = 'dead';
    const p = this.world.player;
    const x = p.x + p.w / 2, y = p.y + p.h / 2;
    this.session.discard();
    this.stuck++;
    App.audio.play('death');
    this.fx.shards(x, y, 0xffffff, 18);
    this.fx.shards(x, y, this.accent, 10);
    this.fx.flashAt(x, y, 0xffffff, 1.4);
    this.shake(200, 0.005);
    this.player.setVisible(false);
    if (!this.failMeasured) { this.failMeasured = true; Poki.measure('level', this.def.id, 'fail'); }
    App.bus.emit('death');
    this.time.delayedCall(520, () => {
      if (this.state !== 'dead') return;
      this.startLoop();
      App.audio.play('start');
      this.fx.ring(this.world.player.x + BODY_W / 2, this.world.player.y + 17, 0xffffff, 0.6, 350);
    });
  }

  quickRestart() {
    this.session.discard();
    App.audio.play('reset');
    this.startLoop();
  }

  rewind(reason) {
    if (this.state !== 'run') return;
    const s = this.session;
    if (s.capacity <= 0 || this.world.rec.length < MIN_ECHO_TICKS) {
      if (reason === 'timer' || s.capacity <= 0) { this.quickRestart(); }
      return;
    }
    this.state = 'rewind';
    this.stuck++;
    const world = this.world;
    const endTick = world.tick;
    const { rec, dropped } = s.commit();
    if (!App.progress.flag('rewound')) App.progress.setFlag('rewound');
    const first = !this.firstRewindDone;
    this.firstRewindDone = true;
    const dur = first ? 1500 : 850;
    App.audio.play('rewind');
    App.bus.emit('rewind', { dur, first, reason });
    // Old echoes and the fresh recording all play back in reverse
    const tracks = [];
    for (const ev of this.echoViews) {
      if (!ev.echo) continue;
      if (dropped && ev.echo.rec === dropped) {
        this.fx.glitter(ev.echo.x + BODY_W / 2, ev.echo.y + 17, echoColor(dropped.id), 12);
        this.tweens.add({ targets: ev.view.root, alpha: 0, duration: 300 });
        continue;
      }
      if (!ev.gone) tracks.push({ view: ev.view, rec: ev.echo.rec, mirror: ev.echo.mirror, col: echoColor(ev.echo.rec.id) });
    }
    if (rec) tracks.push({ view: this.player, rec, mirror: false, col: echoColor(rec.id), self: true });
    for (const tr of tracks) tr.view.setVisible(true);
    const proxy = { t: 1 };
    this.tweens.add({
      targets: proxy, t: 0, duration: dur, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const k = Math.floor(proxy.t * endTick);
        for (const tr of tracks) {
          const rk = Math.min(tr.rec.len - 1, k);
          if (rk < 0) continue;
          let x = tr.rec.x[rk];
          if (tr.mirror) x = world.mirrorX(x);
          const fx = x + BODY_W / 2, fy = tr.rec.y[rk] + 34;
          const f = tr.rec.f[rk];
          tr.view.update(0.016, { x: fx, y: fy, vx: 0, vy: 0, grounded: !!(f & F_GROUND), facing: (f & F_LEFT) ? (tr.mirror ? 1 : -1) : (tr.mirror ? -1 : 1) });
          if (Math.random() < 0.6) this.fx.streak(fx, fy - 17, tr.col);
        }
      },
      onComplete: () => {
        if (this.state !== 'rewind') return;
        this.startLoop();
        const sp = this.session.level.spawn;
        this.fx.beam(sp.x, sp.y - 30, rec ? echoColor(rec.id) : 0xffffff, 3.2);
        this.fx.ring(sp.x, sp.y - 17, rec ? echoColor(rec.id) : 0xffffff, 1.1, 600);
        this.fx.glitter(sp.x, sp.y - 17, rec ? echoColor(rec.id) : 0xffffff, 18);
        App.audio.play('echoSpawn');
        this.punchZoom(0.025);
        if (rec) App.bus.emit('echoSpawned', { id: rec.id, first });
      },
    });
  }

  undo() {
    if (!(this.state === 'run' || this.state === 'ready')) return;
    const rec = this.session.undo();
    if (!rec) return;
    const ev = this.echoViews.find((v) => v.echo && v.echo.rec === rec);
    if (ev) this.fx.shards(ev.echo.x + BODY_W / 2, ev.echo.y + 17, echoColor(rec.id), 12);
    App.audio.play('reset');
    this.startLoop();
    App.bus.emit('undo');
  }

  grantExtraEcho() {
    if (!this.session) return;
    this.session.bonusEchoes += 1;
    Poki.measure('booster', 'extra-echo', 'complete');
    App.bus.emit('banner', { kind: 'echo', n: 1, bonus: true });
    App.bus.emit('loop', { world: this.world, session: this.session });
  }

  onComplete() {
    this.state = 'complete';
    const def = this.def;
    const s = this.session;
    s.harvestShards();
    const loops = s.loops + 1;
    const summary = App.progress.complete(def, loops, s.newShards);
    Poki.gameplayStop();
    Poki.measure('level', def.id, 'complete');
    if (def.id === '1-1') Poki.measure('tutorial', 'basics', 'complete', true);
    if (def.id === '1-2') Poki.measure('tutorial', 'echo', 'complete', true);
    if (summary.worldBonus) Poki.measure('world', def.world, 'complete', true);
    if (summary.newSkin) Poki.measure('cosmetic', summary.newSkin, 'complete', true);
    App.audio.play('success');
    App.audio.music.stinger();
    App.audio.music.setState('menu');
    const ex = this.world.exit;
    const cx = ex.x + ex.w / 2, cy = ex.y + ex.h / 2;
    const v = this.player;
    this.punchZoom(0.05);
    this.tweens.add({
      targets: v.root, x: cx, y: cy + 16, scale: 0.1, angle: 540, duration: 520, ease: 'Back.easeIn',
      onComplete: () => {
        v.setVisible(false);
        this.fx.flashAt(cx, cy, 0xffffff, 2);
        this.fx.burst(cx, cy, this.accent, 34);
        this.fx.burst(cx, cy, 0xffffff, 16);
        this.fx.ring(cx, cy, this.accent, 2.2, 700);
        this.fx.ring(cx, cy, 0xffffff, 1.4, 500);
        this.shake(160, 0.003);
      },
    });
    this.time.delayedCall(950, () => App.bus.emit('complete', { def, summary, loops, echoes: s.capacity }));
  }

  // ------------------------------------------------------- pause & flow

  pause() {
    if (!(this.state === 'run' || this.state === 'ready')) return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    Poki.gameplayStop();
    App.input.releaseAll();
    App.audio.music.setState('menu');
    App.bus.emit('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'ready';
    this.acc = 0;
    App.input.releaseAll();
    if (this.state === 'run') {
      Poki.gameplayStart();
      App.audio.music.setState('play');
    } else App.audio.music.setState('ready');
    if (this.session) this.session.stats = App.progress.stats();
    App.bus.emit('resumed');
  }

  restartLevel() {
    if (!this.def) return;
    const id = this.def.id;
    this.state = 'idle';
    Poki.gameplayStop();
    this.breakThen(() => this.loadLevel(id));
  }

  nextLevel() {
    const next = App.progress.nextAfter(this.def.id);
    const id = next || this.def.id;
    this.state = 'idle';
    this.breakThen(() => {
      this.loadLevel(id);
      // Everything cleared: open the map as a sub-menu of pause, so backing
      // out of it always lands on a playable level.
      if (!next) { this.pause(); App.bus.emit('openMap'); }
    });
  }

  /** Natural break point: let Poki decide on an ad, then continue. */
  breakThen(fn) {
    App.bus.emit('busy', true);
    Poki.commercialBreak({
      pause: () => { App.audio.setMuted('ad', true); App.input.block(true); },
      resume: () => { App.audio.setMuted('ad', false); App.input.block(false); },
    }).then(() => {
      App.bus.emit('busy', false);
      fn();
    });
  }

  // ---------------------------------------------------------------- render

  render(dt) {
    if (!this.world) return;
    const w = this.world;
    const alpha = this.state === 'run' ? Math.min(1, this.acc / DT_MS) : 1;
    const lerp = (a, b) => a + (b - a) * alpha;
    const p = w.player;
    if (this.state === 'run' || this.state === 'ready' || this.state === 'paused' || this.state === 'dead') {
      if (p.alive && this.player.root.visible) {
        const fx = lerp(p.px, p.x) + p.w / 2, fy = lerp(p.py, p.y) + p.h;
        this.player.update(dt, { x: fx, y: fy, vx: this.state === 'run' ? p.vx : 0, vy: this.state === 'run' ? p.vy : 0, grounded: p.grounded, facing: p.facing, carrying: !!p.carry });
        if (this.state === 'run' && Math.abs(p.vx) > 200 && p.grounded && Math.random() < 0.25) this.fx.puff(fx - p.facing * 8, fy, 1);
      }
      for (const ev of this.echoViews) {
        const e = ev.echo;
        if (!e || ev.gone) continue;
        ev.view.update(dt, { x: lerp(e.px, e.x) + e.w / 2, y: lerp(e.py, e.y) + e.h, grounded: e.grounded, facing: e.facing, inert: e.state === 'inert' });
      }
      if (this.reflection) this.updateReflection(dt, lerp);
    }
    if (this.mech) this.mech.update(dt, w, alpha);
    for (const g of this.traces) g.setAlpha(this.state === 'ready' ? 0.95 : 0.45);
    if (this.mirrorLine) this.drawMirror();
    // Camera feel
    this.punch *= Math.pow(0.02, dt);
    const cam = this.cameras.main;
    cam.setZoom(this.zoomBase * (1 + this.punch));
    const nx = (p.x + p.w / 2) / this.roomW, ny = (p.y + p.h / 2) / this.roomH;
    if (this.camCenter) {
      const tx = this.camCenter.x + (nx - 0.5) * 18, ty = this.camCenter.y + (ny - 0.5) * 10;
      this.camX = this.camX === undefined ? tx : this.camX + (tx - this.camX) * Math.min(1, dt * 3);
      this.camY = this.camY === undefined ? ty : this.camY + (ty - this.camY) * Math.min(1, dt * 3);
      cam.centerOn(this.camX, this.camY);
    }
    App.bus.emit('focus', nx, ny);
  }

  updateReflection(dt, lerp) {
    const w = this.world, p = w.player;
    const v = this.reflection;
    const vis = p.alive && (this.state === 'run' || this.state === 'ready');
    v.setVisible(vis);
    if (!vis) return;
    const x = w.mirrorX(lerp(p.px, p.x));
    const y = lerp(p.py, p.y);
    const box = { x, y, w: p.w, h: p.h };
    const danger = w.hazardAt({ x: x + 3, y: y + 3, w: p.w - 6, h: p.h - 3 }) || w.blocked(box, null, 1.5) || (p.grounded && !w.hasSupport(box));
    v.setTint(danger ? RED : echoColor(this.session.nextId));
    v.setAlpha(danger ? 0.55 + Math.sin(this.time.now / 60) * 0.2 : 0.35);
    v.update(dt, { x: x + p.w / 2 + (danger ? (Math.random() - 0.5) * 3 : 0), y: y + p.h, vx: -p.vx, vy: p.vy, grounded: p.grounded, facing: -p.facing, carrying: false });
  }

  drawMirror() {
    const g = this.mirrorLine;
    const x = this.mirrorX;
    g.clear();
    const t = this.time.now / 1000;
    g.lineStyle(2, RED, 0.55);
    for (let y = T; y < this.roomH - T; y += 16) {
      const o = Math.sin(t * 3 + y * 0.05) * 1.5;
      g.lineBetween(x + o, y, x + o, y + 9);
    }
    g.fillStyle(0xffffff, 0.7);
    for (let y = T + ((t * 40) % 80); y < this.roomH - T; y += 80) g.fillTriangle(x - 4, y, x + 4, y, x, y + 7);
    this.mirrorGlow.setAlpha(0.28 + Math.sin(t * 2) * 0.06);
  }

  // ---------------------------------------------------------------- camera

  fitCamera(rebake) {
    if (!this.roomW) return;
    const L = App.layout;
    const d = App.dpr;
    const W = this.scale.width, H = this.scale.height;
    const play = { x: L.play.x * d, y: L.play.y * d, w: L.play.w * d, h: L.play.h * d };
    const z = Math.min(play.w / this.roomW, play.h / this.roomH);
    this.zoomBase = z;
    const cam = this.cameras.main;
    cam.setSize(W, H);
    cam.setZoom(z);
    const cx = this.roomW / 2 + (W / 2 - (play.x + play.w / 2)) / z;
    const cy = this.roomH / 2 + (H / 2 - (play.y + play.h / 2)) / z;
    cam.centerOn(cx, cy);
    this.camCenter = { x: cx, y: cy };
    this.camX = this.camY = undefined;
    if (rebake && this.def && this.back) {
      const s = this.pickBakeScale();
      if (Math.abs(s - this.bakeScale) >= 0.25) {
        this.bakeScale = s;
        bakeRoom(this, this.session.level, this.th, s, this.roomKey);
        this.back.setTexture(this.roomKey + '_back').setScale(1 / s);
        this.tiles.setTexture(this.roomKey + '_tiles').setScale(1 / s);
      }
    }
  }

  pickBakeScale() {
    const z = this.zoomBase || 1;
    return Math.max(0.75, Math.min(2, Math.ceil(z * 4) / 4));
  }

  worldToScreen(x, y) {
    const cam = this.cameras.main;
    return { x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom };
  }

  shake(ms, intensity) { this.cameras.main.shake(ms, intensity); }

  punchZoom(v) { this.punch = Math.max(this.punch, v); }
}
