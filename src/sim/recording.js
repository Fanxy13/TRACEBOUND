// A recording is one committed run: a per-tick timeline of the player's body
// (position, facing, grounded, carrying) plus the actions performed on
// specific ticks. Echoes are bound to this trace.

export const F_LEFT = 1;
export const F_GROUND = 2;
export const F_CARRY = 4;
export const F_RISE = 8;

export class RecordingBuilder {
  constructor(id) {
    this.id = id;
    this.xs = [];
    this.ys = [];
    this.fs = [];
    this.actions = new Map();
  }

  push(x, y, flags) {
    this.xs.push(x);
    this.ys.push(y);
    this.fs.push(flags);
  }

  action(tick, type) {
    this.actions.set(tick, type);
  }

  get length() { return this.xs.length; }

  finish() {
    return new Recording(this.id, this.xs, this.ys, this.fs, this.actions);
  }
}

export class Recording {
  constructor(id, xs, ys, fs, actions) {
    this.id = id;
    this.len = xs.length;
    this.x = Float64Array.from(xs);
    this.y = Float64Array.from(ys);
    this.f = Uint8Array.from(fs);
    this.actions = new Map(actions);
  }

  actionAt(tick) { return this.actions.get(tick); }
}
