// src/main.ts — Phase 5
import Phaser from 'phaser';
import { GameConfig } from '@config/GameConfig';
import { BootScene }     from '@scenes/BootScene';
import { PreloadScene }  from '@scenes/PreloadScene';
import { MainMenuScene } from '@scenes/MainMenuScene';
import { GameScene }     from '@scenes/GameScene';
import { UIScene }       from '@scenes/UIScene';
import { GameOverScene } from '@scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  ...GameConfig,
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameScene,
    UIScene,
    GameOverScene,
  ],
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__GAME__ = game;
}

export { game };