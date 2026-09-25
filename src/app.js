// Shared services, set up once in main.js and used by all scenes.

export const App = {
  game: null,
  progress: null,
  audio: null,
  input: null,
  touch: null,
  layout: null,
  dpr: 1,
  bus: null,
  /** UI scale: physical pixels per UI unit (1 unit ~ 1 CSS px at a comfy size). */
  ui: 1,
};

export const FONT = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
