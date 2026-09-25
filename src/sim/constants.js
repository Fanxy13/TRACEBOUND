// Core simulation constants. The simulation runs on a fixed timestep so that
// recordings and replays are frame-rate independent and reproducible.

export const TILE = 40;
export const TPS = 60;
export const DT = 1 / TPS;

// Tile codes
export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_ONEWAY = 2;
export const T_SPIKE = 3;
export const T_SPIKE_DOWN = 4;
export const T_GLASS = 5;

export const BODY_W = 24;
export const BODY_H = 34;
export const CORE_SIZE = 20;

// Player physics. Tuned for snappy, readable movement: quick acceleration,
// a short coyote window, jump buffering and a slightly floaty apex.
export const PHYS = {
  speed: 250,
  accel: 3400,
  decel: 4200,
  airAccel: 2300,
  airDecel: 1500,
  turnBoost: 1.7,
  gravity: 2500,
  fallMax: 900,
  jumpV: 750,
  jumpCut: 0.45,
  apexBand: 110,
  apexGrav: 0.55,
  coyote: 6,
  buffer: 8,
  carrySpeed: 0.88,
  carryJump: 0.95,
  echoBoost: 1.28,
};

export const BASE_RANGE = 56;
export const MIN_ECHO_TICKS = 12;

// Ground reference ids recorded with each sample
export const G_AIR = 0;
export const G_STATIC = 1;
export const G_ECHO_BASE = 100000;
