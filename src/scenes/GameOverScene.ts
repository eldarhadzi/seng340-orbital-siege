// src/scenes/GameOverScene.ts
//
// Game over AND victory screen.

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { saveManager } from '@managers/SaveManager';

interface GameOverData {
  victory:     boolean;
  score:       number;
  waveReached: number;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.GAME_OVER });
  }

  init(data: GameOverData): void {
    const isNewRecord = saveManager.submitScore(data.score, data.waveReached);
    this.createUI(data, isNewRecord);
  }

  private createUI(data: GameOverData, isNewRecord: boolean): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000010, 1);
    bg.fillRect(0, 0, RenderConfig.WIDTH, RenderConfig.HEIGHT);

    // Title
    const titleText = data.victory ? 'VICTORY' : 'STATION DESTROYED';
    const titleColor = data.victory ? '#44ff88' : '#ff4444';

    this.add.text(cx, cy - 160, titleText, {
      fontFamily: 'monospace',
      fontSize:   '48px',
      color:      titleColor,
      stroke:     '#000022',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Stats
    const lines = [
      `SCORE:        ${data.score.toLocaleString()}`,
      `WAVE REACHED: ${data.waveReached}`,
      `HIGH SCORE:   ${saveManager.highScore.toLocaleString()}`,
      isNewRecord ? '★  NEW HIGH SCORE!' : '',
    ];

    lines.forEach((line, i) => {
      if (!line) { return; }
      const color = line.includes('★') ? '#ffcc44' : '#aaccff';
      this.add.text(cx, cy - 60 + i * 38, line, {
        fontFamily: 'monospace',
        fontSize:   '20px',
        color,
      }).setOrigin(0.5);
    });

    // Buttons
    const playAgain = this.add.text(cx, cy + 100, '▶  PLAY AGAIN', {
      fontFamily: 'monospace',
      fontSize:   '22px',
      color:      '#aaccff',
      padding:    { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playAgain.on('pointerover',  () => playAgain.setStyle({ color: '#ffffff' }));
    playAgain.on('pointerout',   () => playAgain.setStyle({ color: '#aaccff' }));
    playAgain.on('pointerdown',  () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.GAME);
      this.scene.launch(SceneKeys.UI);
    });

    const mainMenu = this.add.text(cx, cy + 155, '⌂  MAIN MENU', {
      fontFamily: 'monospace',
      fontSize:   '22px',
      color:      '#aaccff',
      padding:    { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    mainMenu.on('pointerover',  () => mainMenu.setStyle({ color: '#ffffff' }));
    mainMenu.on('pointerout',   () => mainMenu.setStyle({ color: '#aaccff' }));
    mainMenu.on('pointerdown',  () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.MAIN_MENU);
    });
  }

  create(): void {}
}