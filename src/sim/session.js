// A level attempt: owns the committed echoes (oldest first) and spins up a
// fresh World for every loop.

import { parseLevel } from './level.js';
import { World } from './world.js';
import { TPS, MIN_ECHO_TICKS } from './constants.js';

export class Session {
  /**
   * @param def level definition
   * @param stats { speedMul, range, sync, memory, extraEchoes }
   * @param shardsTaken Set of bonus shard indices already collected
   */
  constructor(def, stats, shardsTaken) {
    this.def = def;
    this.level = parseLevel(def);
    this.stats = stats;
    this.bonusEchoes = 0;
    this.echoes = [];
    this.nextId = 1;
    this.loops = 0;
    this.deaths = 0;
    this.paradoxes = 0;
    this.shardsTaken = new Set(shardsTaken || []);
    this.newShards = new Set();
    this.world = null;
  }

  get capacity() {
    const base = this.def.echoes || 0;
    if (base <= 0) return 0;
    return base + (this.stats.extraEchoes || 0) + this.bonusEchoes;
  }

  get loopSeconds() {
    return this.def.time ? this.def.time + (this.stats.memory || 0) : 0;
  }

  get loopTicks() {
    return this.def.time ? Math.round(this.loopSeconds * TPS) : Infinity;
  }

  startLoop() {
    this.world = new World(this.level, {
      stats: this.stats,
      echoes: this.echoes,
      recId: this.nextId,
      mirror: this.def.mirror || 0,
      shardsTaken: this.shardsTaken,
    });
    return this.world;
  }

  /** Remember shards the player touched in this loop. */
  harvestShards() {
    if (!this.world) return;
    for (const s of this.world.shards) {
      if (s.taken && !this.shardsTaken.has(s.id)) {
        this.shardsTaken.add(s.id);
        this.newShards.add(s.id);
      }
    }
  }

  /**
   * End the current loop and turn it into an echo.
   * Returns { rec, dropped } (rec is null if the run was too short or the level has no echoes).
   */
  commit() {
    this.harvestShards();
    this.loops++;
    const rec = this.world.rec.finish();
    if (this.capacity <= 0 || rec.len < MIN_ECHO_TICKS) return { rec: null, dropped: null };
    this.echoes.push(rec);
    this.nextId++;
    let dropped = null;
    while (this.echoes.length > this.capacity) dropped = this.echoes.shift();
    return { rec, dropped };
  }

  /** The current run failed (death): throw it away. */
  discard() {
    this.harvestShards();
    this.deaths++;
  }

  undo() {
    return this.echoes.pop() || null;
  }

  clear() {
    this.echoes = [];
  }
}
