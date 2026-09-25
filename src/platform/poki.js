// Thin, defensive wrapper around the Poki HTML5 SDK.
//
// - Works when the SDK is missing (ad blocker, offline, local file): every
//   call becomes a no-op, ads resolve immediately, rewards are never granted.
// - Never sends duplicate gameplayStart/gameplayStop events.
// - Sends nothing while an ad is running; the game is paused and muted by the
//   caller through the hooks.

const sdk = () => (typeof window !== 'undefined' ? window.PokiSDK : undefined);

function call(name, ...args) {
  const s = sdk();
  if (!s || typeof s[name] !== 'function') return undefined;
  try { return s[name](...args); } catch (e) { return undefined; }
}

let ready = false;
let loadingDone = false;
let playing = false;
let adActive = false;
const measured = new Set();

export const Poki = {
  get available() { return !!sdk(); },
  get playing() { return playing; },
  get adActive() { return adActive; },

  async init() {
    const s = sdk();
    if (s && typeof s.init === 'function') {
      try {
        await Promise.race([
          Promise.resolve(s.init()),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (e) {
        // Initialised with an error (e.g. ad blocker): the game still loads.
      }
    }
    ready = true;
  },

  loadingFinished() {
    if (loadingDone) return;
    loadingDone = true;
    call('gameLoadingFinished');
  },

  gameplayStart() {
    if (playing || adActive || !loadingDone) return;
    playing = true;
    call('gameplayStart');
  },

  gameplayStop() {
    if (!playing || adActive) return;
    playing = false;
    call('gameplayStop');
  },

  /**
   * Natural break (between levels). Poki decides whether an ad is shown.
   * hooks: { pause(), resume() }
   */
  async commercialBreak(hooks = {}) {
    if (adActive) return;
    this.gameplayStop();
    const s = sdk();
    if (!s || typeof s.commercialBreak !== 'function') return;
    adActive = true;
    // Pause and mute up front: an ad may start at any moment of the promise.
    if (hooks.pause) hooks.pause();
    try {
      await s.commercialBreak(() => {});
    } catch (e) {
      // ignore
    } finally {
      adActive = false;
      if (hooks.resume) hooks.resume();
    }
  },

  /**
   * Opt-in rewarded video. Resolves true only if the reward should be granted.
   */
  async rewardedBreak(hooks = {}) {
    if (adActive) return false;
    this.gameplayStop();
    const s = sdk();
    if (!s || typeof s.rewardedBreak !== 'function') return false;
    adActive = true;
    if (hooks.pause) hooks.pause();
    let ok = false;
    try {
      ok = !!(await s.rewardedBreak({ size: 'small', onStart: () => {} }));
    } catch (e) {
      ok = false;
    } finally {
      adActive = false;
      if (hooks.resume) hooks.resume();
    }
    return ok;
  },

  /**
   * Analytics event. `once` suppresses repeats of the same event in a session.
   */
  measure(category, what, action, once = false) {
    const key = category + '|' + what + '|' + action;
    if (once && measured.has(key)) return;
    measured.add(key);
    call('measure', category, String(what), action);
  },
};
