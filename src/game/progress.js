// Persistent progression: one currency (shards), upgrades, skins, unlocks.

import { loadRaw, saveRaw } from '../platform/storage.js';
import { LEVELS, WORLDS } from '../levels/index.js';
import { UPGRADES, SKINS, REWARD_FIRST, REWARD_REPLAY, REWARD_WORLD } from './config.js';
import { BASE_RANGE } from '../sim/constants.js';

function defaults() {
  return {
    v: 1,
    shards: 0,
    done: {},
    bonus: {},
    up: { memory: 0, focus: 0, speed: 0, stability: 0, sync: 0 },
    skins: ['tracer'],
    skin: 'tracer',
    last: LEVELS[0].id,
    set: { sfx: true, music: true },
    flags: {},
  };
}

function sanitize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== 'object') return d;
  const num = (v, min, max) => (Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min);
  d.shards = num(raw.shards, 0, 99999);
  if (raw.done && typeof raw.done === 'object') {
    for (const l of LEVELS) if (raw.done[l.id]) d.done[l.id] = { loops: num(raw.done[l.id].loops, 1, 999) };
  }
  if (raw.bonus && typeof raw.bonus === 'object') {
    for (const l of LEVELS) if (Array.isArray(raw.bonus[l.id])) d.bonus[l.id] = raw.bonus[l.id].filter((i) => Number.isInteger(i) && i >= 0 && i < 8);
  }
  if (raw.up && typeof raw.up === 'object') {
    for (const u of UPGRADES) d.up[u.id] = num(raw.up[u.id], 0, u.costs.length);
  }
  if (Array.isArray(raw.skins)) d.skins = SKINS.map((s) => s.id).filter((id) => id === 'tracer' || raw.skins.includes(id));
  if (d.skins.includes(raw.skin)) d.skin = raw.skin;
  if (LEVELS.some((l) => l.id === raw.last)) d.last = raw.last;
  if (raw.set && typeof raw.set === 'object') {
    d.set.sfx = raw.set.sfx !== false;
    d.set.music = raw.set.music !== false;
  }
  if (raw.flags && typeof raw.flags === 'object') {
    for (const k of Object.keys(raw.flags)) if (typeof raw.flags[k] === 'boolean') d.flags[k] = raw.flags[k];
  }
  return d;
}

export class Progress {
  constructor() {
    this.data = sanitize(loadRaw());
  }

  save() { saveRaw(this.data); }

  // --------------------------------------------------------------- levels

  isDone(id) { return !!this.data.done[id]; }

  isUnlocked(id) {
    const i = LEVELS.findIndex((l) => l.id === id);
    if (i <= 0) return true;
    if (this.isDone(LEVELS[i - 1].id)) return true;
    // Past the tutorial one level may be skipped
    if (i >= 3 && this.isDone(LEVELS[i - 2].id)) return true;
    return this.isDone(id);
  }

  worldUnlocked(w) {
    const first = WORLDS[w - 1].levels[0].id;
    return this.isUnlocked(first);
  }

  worldDone(w) { return WORLDS[w - 1].levels.every((l) => this.isDone(l.id)); }

  completedCount() { return Object.keys(this.data.done).length; }

  /** Level to resume on a new visit. */
  resumeLevel() {
    const last = this.data.last;
    if (!this.isDone(last) && this.isUnlocked(last)) return last;
    return this.nextAfter(last) || last;
  }

  /** Next level to play after finishing `id`: first unfinished unlocked level after it. */
  nextAfter(id) {
    const i = LEVELS.findIndex((l) => l.id === id);
    for (let j = i + 1; j < LEVELS.length; j++) {
      if (!this.isDone(LEVELS[j].id) && this.isUnlocked(LEVELS[j].id)) return LEVELS[j].id;
    }
    for (let j = 0; j < LEVELS.length; j++) {
      if (!this.isDone(LEVELS[j].id) && this.isUnlocked(LEVELS[j].id)) return LEVELS[j].id;
    }
    return i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
  }

  bonusTaken(id) { return new Set(this.data.bonus[id] || []); }

  /**
   * Record a finished level. Returns a summary of what was earned.
   */
  complete(def, loops, newShards) {
    const id = def.id;
    const first = !this.isDone(id);
    const worldWasDone = this.worldDone(def.world);
    let gained = first ? REWARD_FIRST : REWARD_REPLAY;
    const bonusGained = newShards ? newShards.size : 0;
    gained += bonusGained;
    if (bonusGained) {
      const set = this.bonusTaken(id);
      for (const s of newShards) set.add(s);
      this.data.bonus[id] = [...set];
    }
    const prev = this.data.done[id];
    this.data.done[id] = { loops: prev ? Math.min(prev.loops, loops) : loops };
    let worldBonus = 0;
    let newSkin = null;
    if (!worldWasDone && this.worldDone(def.world)) {
      worldBonus = REWARD_WORLD;
      gained += worldBonus;
      const skin = SKINS.find((s) => s.world === def.world);
      if (skin && !this.data.skins.includes(skin.id)) {
        this.data.skins.push(skin.id);
        newSkin = skin.id;
      }
    }
    this.data.shards += gained;
    this.save();
    return { first, gained, bonusGained, worldBonus, newSkin };
  }

  setLast(id) {
    this.data.last = id;
    this.save();
  }

  // ------------------------------------------------------------ upgrades

  upgradeLevel(id) { return this.data.up[id] || 0; }

  upgradeCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const lvl = this.upgradeLevel(id);
    return lvl < u.costs.length ? u.costs[lvl] : null;
  }

  canBuy(id) {
    const c = this.upgradeCost(id);
    return c !== null && this.data.shards >= c;
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.data.shards -= this.upgradeCost(id);
    this.data.up[id] = this.upgradeLevel(id) + 1;
    this.save();
    return true;
  }

  cheapestAffordable() {
    return UPGRADES.some((u) => this.canBuy(u.id));
  }

  /** Simulation stats derived from upgrades. */
  stats() {
    const up = this.data.up;
    return {
      speedMul: 1 + 0.07 * up.speed,
      range: BASE_RANGE + 24 * up.focus,
      memory: 3 * up.memory,
      extraEchoes: up.stability,
      sync: up.sync,
    };
  }

  // --------------------------------------------------------------- skins

  hasSkin(id) { return this.data.skins.includes(id); }

  setSkin(id) {
    if (!this.hasSkin(id)) return false;
    this.data.skin = id;
    this.save();
    return true;
  }

  // ------------------------------------------------------------ settings

  get settings() { return this.data.set; }

  toggle(key) {
    this.data.set[key] = !this.data.set[key];
    this.save();
    return this.data.set[key];
  }

  flag(name) { return !!this.data.flags[name]; }

  setFlag(name) {
    if (this.data.flags[name]) return false;
    this.data.flags[name] = true;
    this.save();
    return true;
  }
}
