// Scripted input used by the level verification tests.
//
// Tokens (separated by spaces), positions in tiles (player centre):
//   >x  hold right until x      <x  hold left until x      s  release
//   j   full jump               h   short hop              e  interact
//   wN  wait N seconds          tN  wait until loop time N
//   g   wait until grounded     yN  wait until y <= N      YN wait until y >= N
//   xN  wait until x >= N       zN  wait until x <= N   (without moving)
//   oA  wait until A powered    cA  wait until A unpowered
//   r   rewind (commit loop)    .   idle until the loop ends

import { TILE, TPS } from './constants.js';

export class Bot {
  constructor(script) {
    this.tokens = script.trim().split(/\s+/).filter(Boolean);
    this.i = 0;
    this.hold = 0;
    this.jumpTicks = 0;
    this.jumpMode = null;
    this.waitStart = -1;
  }

  next(world) {
    const p = world.player;
    const input = { left: false, right: false, jump: false, jumpPressed: false, interact: false, rewind: false };
    const cx = (p.x + p.w / 2) / TILE;
    const cy = (p.y + p.h / 2) / TILE;
    const t = world.tick;

    let guard = 0;
    while (this.i < this.tokens.length && guard++ < 50) {
      const tok = this.tokens[this.i];
      const op = tok[0];
      const arg = tok.slice(1);
      const num = parseFloat(arg);
      let done = true;
      switch (op) {
        case '>': this.hold = 1; done = cx >= num; break;
        case '<': this.hold = -1; done = cx <= num; break;
        case 's': this.hold = 0; break;
        case 'j': input.jumpPressed = true; this.jumpMode = 'full'; this.jumpTicks = 0; break;
        case 'h': input.jumpPressed = true; this.jumpMode = 'hop'; this.jumpTicks = 0; break;
        case 'e': input.interact = true; break;
        case 'r': input.rewind = true; break;
        case 'w':
          if (this.waitStart < 0) this.waitStart = t;
          done = t - this.waitStart >= Math.round(num * TPS);
          if (done) this.waitStart = -1;
          break;
        case 't': done = t >= Math.round(num * TPS); break;
        case 'g': done = p.grounded; break;
        case 'y': done = cy <= num; break;
        case 'Y': done = cy >= num; break;
        case 'x': done = cx >= num; break;
        case 'z': done = cx <= num; break;
        case 'o': done = !!world.byLetter.get(arg)?.[0]?.powered; break;
        case 'c': done = !world.byLetter.get(arg)?.[0]?.powered; break;
        case '.': done = false; break;
        default: throw new Error('bad bot token ' + tok);
      }
      if (!done) break;
      this.i++;
      if (op === 'e' || op === 'r' || op === 'j' || op === 'h') break;
    }

    if (this.hold > 0) input.right = true;
    if (this.hold < 0) input.left = true;
    if (this.jumpMode) {
      this.jumpTicks++;
      const keep = this.jumpMode === 'full' ? (this.jumpTicks < 40 && (this.jumpTicks < 3 || p.vy < 0)) : this.jumpTicks < 5;
      if (keep) input.jump = true; else this.jumpMode = null;
    }
    return input;
  }
}
