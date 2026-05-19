// src/scenes/PauseScene.ts
//
// Pause menu — launched on top of GameScene.
// GameScene physics freezes because we pause its update loop.

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { saveManager } from '@managers/SaveManager';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKeys.PAUSE });
  }

  create(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    // Darken background
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000010, 0.75);
    overlay.fillRect(0, 0, RenderConfig.WIDTH, RenderConfig.HEIGHT);

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x0d1a2e, 0.98);
    panel.fillRoundedRect(cx - 200, cy - 200, 400, 400, 12);
    panel.lineStyle(2, 0x334466, 1);
    panel.strokeRoundedRect(cx - 200, cy - 200, 400, 400, 12);

    // Title
    this.add.text(cx, cy - 155, 'PAUSED', {
      fontFamily: 'monospace',
      fontSize:   '36px',
      color:      '#4a9eff',
    }).setOrigin(0.5);

    // Separator
    const sep = this.add.graphics();
    sep.lineStyle(1, 0x334466, 1);
    sep.beginPath();
    sep.moveTo(cx - 160, cy - 110);
    sep.lineTo(cx + 160, cy - 110);
    sep.strokePath();

    // Buttons
    const buttons = [
      { label: '▶  RESUME',      action: () => this.resume() },
      { label: '⚙  SETTINGS',    action: () => this.openSettings() },
      { label: '⌂  MAIN MENU',   action: () => this.goToMenu() },
    ];

    buttons.forEach((btn, i) => {
      const y   = cy - 60 + i * 70;
      const txt = this.add.text(cx, y, btn.label, {
        fontFamily:  'monospace',
        fontSize:    '22px',
        color:       '#aaccff',
        padding:     { x: 30, y: 12 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      txt.on('pointerover',  () => txt.setStyle({ color: '#ffffff' }));
      txt.on('pointerout',   () => txt.setStyle({ color: '#aaccff' }));
      txt.on('pointerdown',  btn.action);
    });

    // Controls hint
    this.add.text(cx, cy + 155, 'ESC to resume', {
      fontFamily: 'monospace',
      fontSize:   '12px',
      color:      '#334466',
    }).setOrigin(0.5);

    // ESC to resume
    this.input.keyboard!.once('keydown-ESC', () => { this.resume(); });
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(SceneKeys.GAME);
  }

  private openSettings(): void {
    this.showSettingsPanel();
  }

  private showSettingsPanel(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;

    // Simple volume controls
    const settings = saveManager.settings;

    const panel = this.add.graphics();
    panel.fillStyle(0x050d1a, 0.98);
    panel.fillRoundedRect(cx - 220, cy - 160, 440, 320, 10);
    panel.lineStyle(2, 0x4488bb, 1);
    panel.strokeRoundedRect(cx - 220, cy - 160, 440, 320, 10);

    this.add.text(cx, cy - 130, 'SETTINGS', {
      fontFamily: 'monospace', fontSize: '20px', color: '#4a9eff',
    }).setOrigin(0.5);

    // Volume sliders (simplified text-based controls)
    const sliderData = [
      { label: 'MASTER VOLUME', key: 'masterVolume' as const,  val: settings.masterVolume },
      { label: 'SFX VOLUME',    key: 'sfxVolume'    as const,  val: settings.sfxVolume },
      { label: 'MUSIC VOLUME',  key: 'musicVolume'  as const,  val: settings.musicVolume },
    ];

    sliderData.forEach((s, i) => {
      const y = cy - 70 + i * 60;
      this.add.text(cx - 170, y, s.label, {
        fontFamily: 'monospace', fontSize: '13px', color: '#6688aa',
      });

      // Simple +/- buttons
      const valText = this.add.text(cx + 80, y, `${Math.round(s.val * 100)}%`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#aaccff',
      }).setOrigin(0.5);

      const btnMinus = this.add.text(cx + 30, y, '–', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ff6644',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const btnPlus = this.add.text(cx + 130, y, '+', {
        fontFamily: 'monospace', fontSize: '18px', color: '#44ff88',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btnMinus.on('pointerdown', () => {
        const newVal = Math.max(0, settings[s.key] - 0.1);
        settings[s.key] = Math.round(newVal * 10) / 10;
        valText.setText(`${Math.round(settings[s.key] * 100)}%`);
        saveManager.updateSettings({ [s.key]: settings[s.key] });
      });

      btnPlus.on('pointerdown', () => {
        const newVal = Math.min(1, settings[s.key] + 0.1);
        settings[s.key] = Math.round(newVal * 10) / 10;
        valText.setText(`${Math.round(settings[s.key] * 100)}%`);
        saveManager.updateSettings({ [s.key]: settings[s.key] });
      });
    });

    // Close button
    const closeBtn = this.add.text(cx, cy + 110, '✓  SAVE & CLOSE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#44ff88',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      panel.destroy();
      closeBtn.destroy();
    });
  }

  private goToMenu(): void {
    this.scene.stop(SceneKeys.PAUSE);
    this.scene.stop(SceneKeys.GAME);
    this.scene.stop(SceneKeys.UI);
    this.scene.start(SceneKeys.MAIN_MENU);
  }
}