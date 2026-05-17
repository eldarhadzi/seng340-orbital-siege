// src/scenes/PreloadScene.ts
//
// Asset loading scene with progress bar.
// ALL game assets are loaded here so subsequent scenes
// have instant access without any loading delay.
//
// For Phase 4, we load placeholder assets (colored rectangles).
// Real sprites are swapped in during Phase 8 (Polish).

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';

export class PreloadScene extends Phaser.Scene {
  private progressBar!:  Phaser.GameObjects.Graphics;
  private progressBox!:  Phaser.GameObjects.Graphics;
  private loadingText!:  Phaser.GameObjects.Text;
  private percentText!:  Phaser.GameObjects.Text;

  constructor() {
    super({ key: SceneKeys.PRELOAD });
  }

  init(): void {
    this.createLoadingUI();
    this.registerLoadEvents();
  }

  preload(): void {
    // ── Generate placeholder textures programmatically ─────────────────────
    // These colored rectangles serve as placeholders until real art is added.
    // They allow the full game to run without any external assets.
    this.generatePlaceholderTextures();

    // ── Load wave data ─────────────────────────────────────────────────────
    // Only load JSON here — it's small and needed at game start.
    // Audio and large sprites can be lazy-loaded in later phases.
  }

  create(): void {
    this.loadingText.setText('SYSTEMS ONLINE');

    this.time.delayedCall(500, () => {
      this.scene.start(SceneKeys.MAIN_MENU);
    });
  }

  // ─── Placeholder Texture Generation ──────────────────────────────────────

  private generatePlaceholderTextures(): void {
    // Generate all textures as colored rectangles.
    // These are drawn onto a temporary canvas and registered as Phaser textures.

    const makeRect = (key: string, w: number, h: number, color: number) => {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, w, h);
      gfx.generateTexture(key, w, h);
      gfx.destroy();
    };

    makeRect('station',        70,  70,  0x2244aa);
    makeRect('asteroid_large', 80,  80,  0x445566);
    makeRect('asteroid_med',   48,  48,  0x445566);
    makeRect('asteroid_small', 24,  24,  0x445566);
    makeRect('enemy_drone',    40,  40,  0xaa2222);
    makeRect('projectile',     8,   8,   0xffdd00);
    makeRect('collectible',    20,  20,  0x44ff88);
    makeRect('gravity_well',   160, 160, 0xff8800);
    makeRect('ui_panel',       200, 100, 0x112233);
    makeRect('btn_normal',     160, 44,  0x1a3a5c);
    makeRect('btn_hover',      160, 44,  0x2a5a8c);
  }

  // ─── Loading UI ──────────────────────────────────────────────────────────

  private createLoadingUI(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x000010, 1);
    bg.fillRect(0, 0, RenderConfig.WIDTH, RenderConfig.HEIGHT);

    // Title
    this.add.text(cx, cy - 80, 'ORBITAL SIEGE', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#4a9eff',
    }).setOrigin(0.5);

    // Progress box outline
    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(2, 0x334466, 1);
    this.progressBox.strokeRect(cx - 200, cy - 14, 400, 28);
    this.progressBox.fillStyle(0x111122, 1);
    this.progressBox.fillRect(cx - 200, cy - 14, 400, 28);

    // Progress bar (filled by event handler)
    this.progressBar = this.add.graphics();

    // Text labels
    this.loadingText = this.add.text(cx, cy - 36, 'LOADING...', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#8899cc',
    }).setOrigin(0.5);

    this.percentText = this.add.text(cx, cy + 28, '0%', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#4a9eff',
    }).setOrigin(0.5);
  }

  private registerLoadEvents(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x4a9eff, 1);
      this.progressBar.fillRect(cx - 198, cy - 12, 396 * value, 24);
      this.percentText.setText(`${Math.floor(value * 100)}%`);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      this.loadingText.setText(`Loading: ${file.key}`);
    });

    this.load.on('complete', () => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x44ff88, 1);
      this.progressBar.fillRect(cx - 198, cy - 12, 396, 24);
      this.percentText.setText('100%');
    });
  }
}