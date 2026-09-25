// Static game configuration: world themes, upgrades, skins, echo palette.

export const WORLD_THEMES = [
  {
    id: 1, glyph: 'w1',
    bgTop: '#0b1830', bgBot: '#050b17', haze: '#1b3a66',
    back: '#0e1a2f', tile: '#1a2a44', tileDark: '#101c30', tileTop: '#2e4a73',
    edge: '#6fe6ff', accent: '#5ce1ff', accent2: '#8aa8ff', decor: 'rings',
  },
  {
    id: 2, glyph: 'w2',
    bgTop: '#221309', bgBot: '#0e0805', haze: '#5a2e12',
    back: '#1d130d', tile: '#3b261a', tileDark: '#26170f', tileTop: '#6a4128',
    edge: '#ffb45c', accent: '#ff9d3f', accent2: '#ffd27a', decor: 'gears',
  },
  {
    id: 3, glyph: 'w3',
    bgTop: '#1a0f33', bgBot: '#0a0616', haze: '#3f2a78',
    back: '#161029', tile: '#2a1f4a', tileDark: '#1a1232', tileTop: '#473475',
    edge: '#c79bff', accent: '#b884ff', accent2: '#ff9be8', decor: 'clocks',
  },
  {
    id: 4, glyph: 'w4',
    bgTop: '#0b2219', bgBot: '#04100b', haze: '#1c5238',
    back: '#0c1c15', tile: '#1c3528', tileDark: '#10231a', tileTop: '#2f5a41',
    edge: '#8dffb9', accent: '#6dffa8', accent2: '#d4ff7a', decor: 'leaves',
  },
  {
    id: 5, glyph: 'w5',
    bgTop: '#2a0a14', bgBot: '#110409', haze: '#6a1a2c',
    back: '#1f0c12', tile: '#3d1822', tileDark: '#290f16', tileTop: '#6a2a3a',
    edge: '#ff7a8f', accent: '#ff5a74', accent2: '#ffb3a1', decor: 'shards',
  },
  {
    id: 6, glyph: 'w6',
    bgTop: '#0c0a26', bgBot: '#03020b', haze: '#2e2466',
    back: '#0d0b20', tile: '#1c1a38', tileDark: '#110f26', tileTop: '#34305e',
    edge: '#ffe391', accent: '#ffd66b', accent2: '#9ee7ff', decor: 'stars',
  },
];

export function theme(world) {
  return WORLD_THEMES[Math.max(0, Math.min(WORLD_THEMES.length - 1, world - 1))];
}

// Echo colours are fixed per recording so an echo keeps its identity.
export const ECHO_COLORS = [0x7fe8ff, 0xc9a4ff, 0xffc878, 0x8dffc2, 0xff9fcf, 0xfff38a];
export function echoColor(id) { return ECHO_COLORS[(id - 1) % ECHO_COLORS.length]; }

// Upgrades change how rooms can be solved, not raw power.
export const UPGRADES = [
  { id: 'memory', icon: 'hourglass', costs: [3, 6, 10], label: 'MEMORY' },
  { id: 'focus', icon: 'focus', costs: [3, 6, 10], label: 'FOCUS' },
  { id: 'speed', icon: 'speed', costs: [4, 7, 11], label: 'SPEED' },
  { id: 'stability', icon: 'echoplus', costs: [8, 14], label: 'ECHO+' },
  { id: 'sync', icon: 'sync', costs: [6, 12], label: 'SYNC' },
];

export const SKINS = [
  { id: 'tracer', world: 0 },
  { id: 'ghost', world: 1 },
  { id: 'robot', world: 2 },
  { id: 'shadow', world: 3 },
  { id: 'crystal', world: 4 },
  { id: 'energy', world: 5 },
  { id: 'cosmic', world: 6 },
];

export const REWARD_FIRST = 2;
export const REWARD_REPLAY = 1;
export const REWARD_WORLD = 3;
