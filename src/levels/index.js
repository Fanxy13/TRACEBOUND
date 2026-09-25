import { WORLD1 } from './world1.js';
import { WORLD2 } from './world2.js';
import { WORLD3 } from './world3.js';
import { WORLD4 } from './world4.js';
import { WORLD5 } from './world5.js';
import { WORLD6 } from './world6.js';

export const WORLDS = [
  { id: 1, levels: WORLD1 },
  { id: 2, levels: WORLD2 },
  { id: 3, levels: WORLD3 },
  { id: 4, levels: WORLD4 },
  { id: 5, levels: WORLD5 },
  { id: 6, levels: WORLD6 },
];

export const LEVELS = WORLDS.flatMap((w) => w.levels.map((l) => Object.assign(l, { world: w.id })));

export function levelIndex(id) {
  return LEVELS.findIndex((l) => l.id === id);
}
