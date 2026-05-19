// src/scenes/BootScene.ts
//
// First scene executed on game startup.
// Responsibilities:
//   1. Set global game settings
//   2. Initialize singleton managers
//   3. Transition to PreloadScene

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { SaveManager } from '@managers/SaveManager';
import { HUDDataModel } from '@managers/HUDDataModel';
import { EntityManager } from '@managers/EntityManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.BOOT });
  }

  init(): void {
    console.log('[BootScene] Booting Orbital Siege...');
  }

  create(): void {
    // Initialize singletons on boot
    SaveManager.getInstance();
    HUDDataModel.getInstance();
    EntityManager.getInstance();

    // Apply saved settings
    const settings = SaveManager.getInstance().settings;
    this.sound.volume = settings.masterVolume;

    // Brief pause then transition
    this.time.delayedCall(100, () => {
      this.scene.start(SceneKeys.PRELOAD);
    });
  }
}