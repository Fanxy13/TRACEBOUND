// All sound is synthesised with the Web Audio API: no audio files to
// download, no external requests. SFX are tiny envelopes; the music is a
// generative loop per world (pad, bass, arpeggio, texture).

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor(settings) {
    this.ctx = null;
    this.sfxOn = settings.sfx;
    this.musicOn = settings.music;
    this.muted = new Set();
    this.music = new Music(this);
    this.lastPlay = new Map();
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => this.setMuted('hidden', document.hidden));
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted.size ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.55 : 0;
      this.musicBus.connect(this.master);
      // Shared echo/delay for musical sounds
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.36;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.32;
      const dl = ctx.createBiquadFilter();
      dl.type = 'lowpass';
      dl.frequency.value = 2400;
      this.delay.connect(dl).connect(this.delayFb).connect(this.delay);
      this.delayOut = ctx.createGain();
      this.delayOut.gain.value = 0.5;
      dl.connect(this.delayOut).connect(this.musicBus);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.music.onContext();
    }
    if (this.ctx.state === 'suspended' && !this.muted.size) this.ctx.resume().catch(() => {});
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  setMuted(reason, on) {
    if (on) this.muted.add(reason); else this.muted.delete(reason);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (this.muted.size) {
      g.linearRampToValueAtTime(0, t + 0.05);
      if (reason === 'hidden' || reason === 'ad') this.ctx.suspend().catch(() => {});
    } else {
      this.ctx.resume().catch(() => {});
      g.linearRampToValueAtTime(1, t + 0.25);
    }
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.1);
  }

  // ------------------------------------------------------------ primitives

  tone(o) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.glide || o.d));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.a || 0.005;
    const peak = o.g || 0.1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + o.d);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || this.sfxBus);
    if (o.send) g.connect(this.delay);
    osc.start(t0);
    osc.stop(t0 + a + o.d + 0.05);
  }

  noiseBurst(o) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.g || 0.1, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.a || 0.005) + o.d);
    src.connect(f).connect(g).connect(o.bus || this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + o.d + 0.1);
  }

  // ------------------------------------------------------------------ sfx

  play(name, p = {}) {
    if (!this.ctx || !this.sfxOn || this.muted.size || this.ctx.state !== 'running') return;
    // Rate-limit identical sounds
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) || 0;
    if (now - last < 0.035) return;
    this.lastPlay.set(name, now);
    const fn = SFX[name];
    if (fn) {
      try { fn(this, p); } catch (e) { /* never let audio break the game */ }
    }
  }
}

const SFX = {
  ui: (A) => { A.tone({ f: 880, f2: 660, d: 0.06, g: 0.08, type: 'triangle' }); },
  uiBack: (A) => { A.tone({ f: 520, f2: 380, d: 0.07, g: 0.07, type: 'triangle' }); },
  jump: (A, p) => { A.tone({ f: p.boost ? 330 : 280, f2: p.boost ? 820 : 560, d: 0.09, g: 0.05, type: 'sine' }); },
  land: (A, p) => {
    const v = Math.min(1, (p.v || 400) / 900);
    A.noiseBurst({ f: 260, f2: 120, d: 0.07, g: 0.05 + 0.08 * v, type: 'lowpass' });
  },
  lever: (A, p) => {
    A.noiseBurst({ f: 2400, d: 0.02, g: 0.08, q: 4 });
    A.tone({ f: p.on ? 180 : 150, f2: p.on ? 90 : 70, d: 0.09, g: 0.12 });
    A.tone({ f: p.on ? 1320 : 990, d: 0.12, g: 0.03, type: 'triangle', at: 0.03 });
  },
  plateOn: (A) => {
    A.tone({ f: 200, f2: 120, d: 0.08, g: 0.1 });
    A.tone({ f: 1046, d: 0.18, g: 0.03, type: 'triangle', at: 0.02 });
  },
  plateOff: (A) => { A.tone({ f: 140, f2: 210, d: 0.06, g: 0.05 }); },
  button: (A) => {
    A.tone({ f: 1400, d: 0.025, g: 0.05, type: 'square' });
    A.tone({ f: 660, f2: 990, d: 0.14, g: 0.06, type: 'triangle', at: 0.02 });
  },
  buttonOff: (A) => { A.tone({ f: 660, f2: 440, d: 0.1, g: 0.04, type: 'triangle' }); },
  doorOpen: (A) => {
    A.noiseBurst({ f: 300, f2: 1600, d: 0.22, g: 0.07, q: 2 });
    A.tone({ f: 110, f2: 220, d: 0.2, g: 0.07, type: 'triangle' });
  },
  doorClose: (A) => {
    A.noiseBurst({ f: 1400, f2: 250, d: 0.16, g: 0.06, q: 2 });
    A.tone({ f: 130, f2: 60, d: 0.12, g: 0.1 });
  },
  bridgeOn: (A) => {
    [1046, 1318, 1568].forEach((f, i) => A.tone({ f, d: 0.16, g: 0.035, type: 'triangle', at: i * 0.035 }));
    A.noiseBurst({ f: 5000, d: 0.2, g: 0.02, type: 'highpass' });
  },
  bridgeOff: (A) => { [1318, 988, 740].forEach((f, i) => A.tone({ f, d: 0.12, g: 0.03, type: 'triangle', at: i * 0.03 })); },
  lift: (A) => { A.tone({ f: 90, f2: 140, d: 0.18, g: 0.06, type: 'sawtooth', lp: 400 }); },
  pick: (A) => {
    A.tone({ f: 440, f2: 880, d: 0.12, g: 0.07, type: 'triangle' });
    A.tone({ f: 1760, d: 0.1, g: 0.02, at: 0.05 });
  },
  drop: (A) => { A.tone({ f: 660, f2: 330, d: 0.12, g: 0.06, type: 'triangle' }); },
  socket: (A) => {
    [330, 495, 660].forEach((f) => A.tone({ f, d: 0.35, g: 0.04, type: 'triangle' }));
    A.noiseBurst({ f: 3000, f2: 800, d: 0.15, g: 0.04 });
  },
  laserOn: (A) => { A.tone({ f: 90, f2: 180, d: 0.18, g: 0.05, type: 'sawtooth', lp: 1200 }); },
  laserOff: (A) => { A.tone({ f: 200, f2: 60, d: 0.2, g: 0.05, type: 'sawtooth', lp: 900 }); },
  shard: (A) => { [1318, 1661, 1976, 2637].forEach((f, i) => A.tone({ f, d: 0.2, g: 0.045, type: 'triangle', at: i * 0.05, send: true })); },
  echoSpawn: (A) => {
    [523, 784, 1046].forEach((f, i) => A.tone({ f, d: 0.7, g: 0.035, a: 0.04, type: 'sine', detune: i * 7, send: true }));
    A.noiseBurst({ f: 600, f2: 4000, d: 0.35, g: 0.03, type: 'bandpass', a: 0.25 });
  },
  rewind: (A) => {
    A.tone({ f: 900, f2: 140, d: 0.55, g: 0.05, type: 'sawtooth', lp: 1800, glide: 0.55 });
    A.noiseBurst({ f: 4000, f2: 400, d: 0.5, g: 0.05, q: 0.7 });
  },
  paradox: (A) => {
    for (let i = 0; i < 5; i++) A.tone({ f: 200 + Math.random() * 900, d: 0.03, g: 0.05, type: 'square', at: i * 0.03 });
    A.noiseBurst({ f: 1800, d: 0.18, g: 0.06, q: 0.5, at: 0.05 });
  },
  death: (A) => {
    A.tone({ f: 420, f2: 70, d: 0.28, g: 0.08, type: 'square', lp: 1600 });
    A.noiseBurst({ f: 900, f2: 200, d: 0.25, g: 0.08 });
  },
  success: (A) => {
    [523, 659, 784, 1046].forEach((f, i) => A.tone({ f, d: 0.4, g: 0.06, type: 'triangle', at: i * 0.07, send: true }));
    A.tone({ f: 1568, d: 1.1, g: 0.04, at: 0.3, send: true });
  },
  upgrade: (A) => {
    [392, 523, 659, 784, 1046].forEach((f, i) => A.tone({ f, d: 0.25, g: 0.05, type: 'triangle', at: i * 0.05, send: true }));
    A.tone({ f: 2093, d: 0.8, g: 0.03, at: 0.25, send: true });
  },
  unlock: (A) => {
    [659, 784, 988, 1318].forEach((f, i) => A.tone({ f, d: 0.35, g: 0.05, type: 'triangle', at: i * 0.09, send: true }));
  },
  nothing: (A) => { A.tone({ f: 220, f2: 180, d: 0.05, g: 0.03, type: 'triangle' }); },
  fail: (A) => { A.tone({ f: 500, f2: 250, d: 0.08, g: 0.03, type: 'square', lp: 1500 }); },
  tick: (A, p) => { A.noiseBurst({ f: p.hi ? 5200 : 3800, d: 0.025, g: 0.05, q: 6 }); },
  reset: (A) => { A.tone({ f: 300, f2: 900, d: 0.18, g: 0.04, type: 'triangle' }); },
  bonk: (A) => { A.tone({ f: 180, f2: 120, d: 0.05, g: 0.05 }); },
  start: (A) => { A.tone({ f: 660, d: 0.08, g: 0.04, type: 'triangle' }); A.tone({ f: 990, d: 0.12, g: 0.04, type: 'triangle', at: 0.06 }); },
};

// -------------------------------------------------------------------- music

const SONGS = [
  { bpm: 84, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 5, 3, 6], pad: 'triangle', lead: 'sine', perc: 'soft', cutoff: 1100 },
  { bpm: 96, root: 45, scale: [0, 3, 5, 7, 10, 12, 15], prog: [0, 3, 1, 4], pad: 'sawtooth', lead: 'triangle', perc: 'machine', cutoff: 800 },
  { bpm: 72, root: 52, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 5, 4], pad: 'triangle', lead: 'sine', perc: 'clock', cutoff: 1300 },
  { bpm: 88, root: 43, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3], pad: 'sine', lead: 'triangle', perc: 'shaker', cutoff: 1500 },
  { bpm: 100, root: 48, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 5, 6, 4], pad: 'sawtooth', lead: 'square', perc: 'glitch', cutoff: 900 },
  { bpm: 76, root: 41, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 2, 5, 3], pad: 'triangle', lead: 'sine', perc: 'sparkle', cutoff: 1700 },
];

class Music {
  constructor(engine) {
    this.A = engine;
    this.world = 1;
    this.state = 'menu';
    this.running = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.tension = false;
  }

  onContext() {
    if (this.running) this.startScheduler();
  }

  setWorld(w) { this.world = Math.max(1, Math.min(6, w)); }

  setState(s) { this.state = s; }

  setTension(on) { this.tension = on; }

  start() {
    this.running = true;
    if (this.A.ctx) this.startScheduler();
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  startScheduler() {
    if (this.timer) return;
    this.nextTime = this.A.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  schedule() {
    const A = this.A;
    if (!A.ctx || A.ctx.state !== 'running' || !A.musicOn) {
      if (A.ctx) this.nextTime = A.ctx.currentTime + 0.1;
      return;
    }
    const song = SONGS[this.world - 1];
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < A.ctx.currentTime + 0.25) {
      this.playStep(song, this.step, this.nextTime - A.ctx.currentTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 128;
    }
  }

  note(song, degree, octave) {
    const n = song.scale.length;
    const d = ((degree % n) + n) % n;
    const o = Math.floor(degree / n);
    return song.root + song.scale[d] + 12 * (octave + o);
  }

  playStep(song, step, at) {
    const A = this.A;
    const bus = A.musicBus;
    const bar = Math.floor(step / 16);
    const chord = song.prog[Math.floor(bar / 2) % song.prog.length];
    const beat = step % 16;
    const st = this.state;
    const active = st === 'play';
    const soft = st === 'menu' || st === 'ready';
    // Pad: on every chord change
    if (step % 32 === 0) {
      for (const deg of [0, 2, 4]) {
        const f = midi(this.note(song, chord + deg, 1));
        for (const det of [-6, 6]) {
          A.tone({ f, d: 3.6, a: 0.9, g: soft ? 0.016 : 0.022, type: song.pad, lp: song.cutoff, detune: det, bus, at });
        }
      }
    }
    // Bass
    if (!soft && (beat === 0 || beat === 8 || (song.perc === 'machine' && beat % 4 === 0))) {
      A.tone({ f: midi(this.note(song, chord, -1)), d: 0.45, g: 0.07, type: 'sine', bus, at });
    }
    // Arpeggio
    if (beat % 2 === 0 && (active || (soft && beat % 4 === 0))) {
      const pattern = [0, 2, 4, 7, 4, 2, 5, 4];
      const deg = chord + pattern[(step / 2) % pattern.length | 0];
      if (Math.random() > (active ? 0.25 : 0.5)) {
        A.tone({ f: midi(this.note(song, deg, 2)), d: 0.22, g: active ? 0.03 : 0.02, type: song.lead, bus, at, send: true });
      }
    }
    if (this.tension && active && beat % 2 === 1) {
      A.tone({ f: midi(this.note(song, chord + 4, 3)), d: 0.05, g: 0.012, type: 'square', bus, at, lp: 3000 });
    }
    // Texture per world
    if (!active) return;
    switch (song.perc) {
      case 'machine':
        if (beat % 4 === 2) A.noiseBurst({ f: 6000, d: 0.03, g: 0.02, q: 3, bus, at });
        if (beat === 12) A.noiseBurst({ f: 900, d: 0.06, g: 0.025, q: 2, bus, at });
        break;
      case 'clock':
        if (beat % 4 === 0) A.noiseBurst({ f: beat % 8 === 0 ? 4200 : 3200, d: 0.02, g: 0.025, q: 8, bus, at });
        break;
      case 'shaker':
        if (beat % 2 === 1) A.noiseBurst({ f: 7000, d: 0.04, g: 0.012, type: 'highpass', bus, at });
        break;
      case 'glitch':
        if (beat % 8 === 4 || (beat === 14 && Math.random() < 0.5)) A.noiseBurst({ f: 2400, d: 0.03, g: 0.02, q: 5, bus, at });
        break;
      case 'sparkle':
        if (Math.random() < 0.08) A.tone({ f: midi(this.note(song, chord + 7, 3)), d: 0.5, g: 0.012, bus, at, send: true });
        break;
      default:
        if (beat === 8 && Math.random() < 0.6) A.noiseBurst({ f: 5000, d: 0.05, g: 0.01, type: 'highpass', bus, at });
    }
  }

  stinger() {
    const A = this.A;
    if (!A.ctx || !A.musicOn || A.muted.size) return;
    const song = SONGS[this.world - 1];
    const bus = A.musicBus;
    [0, 2, 4, 7].forEach((deg, i) => {
      A.tone({ f: midi(this.note(song, deg, 2)), d: 0.9, g: 0.04, type: 'triangle', bus, at: i * 0.09, send: true });
    });
  }
}
