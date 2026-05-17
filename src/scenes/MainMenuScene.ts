// src/scenes/MainMenuScene.ts
//
// Main menu with animated background and navigation.

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { MathUtils } from '@utils/MathUtils';
import { saveManager } from '@managers/SaveManager';

export class MainMenuScene extends Phaser.Scene {
  private bgGfx!:       Phaser.GameObjects.Graphics;
  private stars:        { x: number; y: number; r: number; a: number }[] = [];
  private _elapsed: number = 0;
  private menuItems:    Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: SceneKeys.MAIN_MENU });
  }

  create(): void {
    this.stars = [];

    // Generate background stars
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: MathUtils.randomRange(0, RenderConfig.WIDTH),
        y: MathUtils.randomRange(0, RenderConfig.HEIGHT),
        r: MathUtils.randomRange(0.5, 2),
        a: MathUtils.randomRange(0.3, 1.0),
      });
    }

    this.bgGfx = this.add.graphics();
    this.createUI();
  }

  private createUI(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    // ── Title ──────────────────────────────────────────────────────────────
    this.add.text(cx, cy - 160, 'ORBITAL SIEGE', {
      fontFamily: 'monospace',
      fontSize:   '52px',
      color:      '#4a9eff',
      stroke:     '#001133',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, cy - 108, 'SENG 340 — Computer Games & Simulation', {
      fontFamily: 'monospace',
      fontSize:   '14px',
      color:      '#4466aa',
    }).setOrigin(0.5);

    // High score
    const hs = saveManager.highScore;
    if (hs > 0) {
      this.add.text(cx, cy - 72, `HIGH SCORE: ${hs.toLocaleString()}`, {
        fontFamily: 'monospace',
        fontSize:   '16px',
        color:      '#ffcc44',
      }).setOrigin(0.5);
    }

    // ── Menu Buttons ────────────────────────────────────────────────────────
    const buttonData = [
      { label: '▶  PLAY',     action: () => this.startGame() },
      { label: '⚙  SETTINGS', action: () => this.openSettings() },
      { label: '?  HOW TO PLAY', action: () => this.showHelp() },
    ];

    buttonData.forEach((btn, i) => {
      const y   = cy + i * 60;
      const txt = this.add.text(cx, y, btn.label, {
        fontFamily:  'monospace',
        fontSize:    '22px',
        color:       '#aaccff',
        padding:     { x: 24, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      txt.on('pointerover',  () => txt.setStyle({ color: '#ffffff' }));
      txt.on('pointerout',   () => txt.setStyle({ color: '#aaccff' }));
      txt.on('pointerdown',  btn.action);

      this.menuItems.push(txt);
    });

    // ── Credits ──────────────────────────────────────────────────────────
    this.add.text(cx, RenderConfig.HEIGHT - 30,
      'Built with Phaser 3 + TypeScript | AI-Assisted Development', {
      fontFamily: 'monospace',
      fontSize:   '11px',
      color:      '#334466',
    }).setOrigin(0.5);
  }

  private startGame(): void {
    this.scene.start(SceneKeys.GAME);
    this.scene.launch(SceneKeys.UI);
  }

  private openSettings(): void {
    // Settings in a later phase — show placeholder
    console.log('[MainMenu] Settings — coming in Phase 6');
  }

  private showHelp(): void {
    console.log('[MainMenu] Help — coming in Phase 6');
  }

  update( delta: number): void {
    this._elapsed += delta / 1000;
    this.bgGfx.clear();

    // Animated background
    this.bgGfx.fillStyle(0x000010, 1);
    this.bgGfx.fillRect(0, 0, RenderConfig.WIDTH, RenderConfig.HEIGHT);

    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(this._elapsed * 1.5 + star.x * 0.01);
      this.bgGfx.fillStyle(0xffffff, star.a * twinkle);
      this.bgGfx.fillCircle(star.x, star.y, star.r);
    }

    // Orbiting demo asteroid
    const orbitR  = 120;
    const angle   = this._elapsed * 0.4;
    const cx      = RenderConfig.WIDTH  / 2;
    const cy      = RenderConfig.HEIGHT / 2 - 160;
    const ax      = cx + Math.cos(angle) * orbitR;
    const ay      = cy + Math.sin(angle) * orbitR;

    this.bgGfx.fillStyle(0x445566, 0.6);
    this.bgGfx.fillCircle(ax, ay, 12);
  }
}