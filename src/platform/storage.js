// Defensive localStorage access. Private browsing, disabled storage or a full
// quota must never break the game: we silently fall back to memory.

const KEY = 'tracebound.save.v1';
let memory = null;
let available = null;

function probe() {
  if (available !== null) return available;
  try {
    const ls = window.localStorage;
    const k = '__tb_probe__';
    ls.setItem(k, '1');
    ls.removeItem(k);
    available = true;
  } catch (e) {
    available = false;
  }
  return available;
}

export function loadRaw() {
  if (probe()) {
    try {
      const txt = window.localStorage.getItem(KEY);
      if (txt) return JSON.parse(txt);
    } catch (e) {
      // corrupt or blocked: ignore
    }
  }
  return memory ? JSON.parse(memory) : null;
}

export function saveRaw(data) {
  let txt;
  try { txt = JSON.stringify(data); } catch (e) { return; }
  memory = txt;
  if (!probe()) return;
  try {
    window.localStorage.setItem(KEY, txt);
  } catch (e) {
    available = false;
  }
}

export function storageAvailable() { return probe(); }
