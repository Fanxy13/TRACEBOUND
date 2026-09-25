// Generates every texture in code, then hands over to the game.

import { App } from '../app.js';
import { bakeCommon } from '../render/textures.js';
import { Poki } from '../platform/poki.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  create() {
    bakeCommon(this);
    App.bus.once('uiReady', () => {
      Poki.loadingFinished();
      const loader = document.getElementById('loader');
      if (loader) {
        loader.classList.add('done');
        setTimeout(() => loader.remove(), 600);
      }
      App.audio.music.start();
      App.bus.emit('cmd', 'load', App.progress.resumeLevel());
    });
    this.scene.launch('bg');
    this.scene.launch('game');
    this.scene.launch('ui');
  }
}
