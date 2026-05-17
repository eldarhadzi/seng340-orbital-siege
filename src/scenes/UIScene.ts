// src/scenes/UIScene.ts
//
// HUD overlay — runs in PARALLEL with GameScene.
// Reads from HUDDataModel (never touches physics entities directly).

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { hudData } from '@managers/HUDDataModel';
import { MathUtils } from '@utils/MathUtils';

export class UIScene extends Phaser.Scene {
  private gfx!:            Phaser.GameObjects.Graphics;
  private scoreText!:      Phaser.GameObjects.Text;
  private waveText!:       Phaser.GameObjects.Text;
  private healthLabel!:    Phaser.GameObjects.Text;
  private shieldLabel!:    Phaser.GameObjects.Text;
  private comboText!:      Phaser.GameObjects.Text;
  private debugText!:      Phaser.GameObjects.Text;
  private fpsText!:        Phaser.GameObjects.Text;

  constructor() {
    super({ key: SceneKeys.UI });
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.createHUDElements();
  }

  private createHUDElements(): void {
    const W = RenderConfig.WIDTH;

    // ── Left Panel: Health + Shield + Weapon ──────────────────────────────
    this.healthLabel = this.add.text(20, 20, 'HULL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa'
    });

    this.shieldLabel = this.add.text(20, 54, 'SHIELD', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa'
    });

    // ── Top Center: Wave info ─────────────────────────────────────────────
    this.waveText = this.add.text(W / 2, 18, 'WAVE 1', {
      fontFamily: 'monospace', fontSize: '18px', color: '#4488ff'
    }).setOrigin(0.5, 0);

    // ── Top Right: Score ──────────────────────────────────────────────────
    this.scoreText = this.add.text(W - 20, 20, '0', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffcc44'
    }).setOrigin(1, 0);

    // ── Combo ─────────────────────────────────────────────────────────────
    this.comboText = this.add.text(W / 2, 48, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff8844'
    }).setOrigin(0.5, 0);

    // ── Debug info (bottom left) ──────────────────────────────────────────
    this.debugText = this.add.text(20, RenderConfig.HEIGHT - 48, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466'
    });

    this.fpsText = this.add.text(20, RenderConfig.HEIGHT - 20, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466'
    });
  }

  update(): void {
    this.gfx.clear();

    this.renderHealthBar();
    this.renderShieldBar();
    this.renderWaveInfo();
    this.renderScore();
    this.renderCombo();
    this.renderDebug();
  }

  // ─── HUD Bars ─────────────────────────────────────────────────────────────

  private renderHealthBar(): void {
    const x = 20;
    const y = 32;
    const w = 180;
    const h = 12;

    const pct   = hudData.stationHealth / hudData.stationMaxHealth;
    const color = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;

    // Background
    this.gfx.fillStyle(0x111122, 0.9);
    this.gfx.fillRect(x, y, w, h);

    // Fill
    this.gfx.fillStyle(color, 1);
    this.gfx.fillRect(x, y, w * pct, h);

    // Border
    this.gfx.lineStyle(1, 0x334466, 1);
    this.gfx.strokeRect(x, y, w, h);

    // Label
    this.healthLabel.setText(`HULL  ${hudData.stationHealth}/${hudData.stationMaxHealth}`);
  }

  private renderShieldBar(): void {
    const x = 20;
    const y = 66;
    const w = 180;
    const h = 12;

    const pct   = hudData.shieldEnergy / hudData.shieldMaxEnergy;
    const color = hudData.shieldBroken ? 0x444444 : 0x44aaff;

    this.gfx.fillStyle(0x111122, 0.9);
    this.gfx.fillRect(x, y, w, h);

    this.gfx.fillStyle(color, pct);
    this.gfx.fillRect(x, y, w * pct, h);

    this.gfx.lineStyle(1, 0x334466, 1);
    this.gfx.strokeRect(x, y, w, h);

    this.shieldLabel.setText(
      hudData.shieldBroken
        ? 'SHIELD  OFFLINE'
        : `SHIELD  ${Math.floor(hudData.shieldEnergy)}/${hudData.shieldMaxEnergy}`
    );
  }

  private renderWaveInfo(): void {
    this.waveText.setText(
      `WAVE ${hudData.waveNumber}  |  ${hudData.enemiesRemaining} REMAINING`
    );
  }

  private renderScore(): void {
    this.scoreText.setText(hudData.score.toLocaleString());
  }

  private renderCombo(): void {
    if (hudData.comboMultiplier > 1) {
      this.comboText.setText(`×${hudData.comboMultiplier.toFixed(1)} COMBO`);
      const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 150);
      this.comboText.setAlpha(pulse);
    } else {
      this.comboText.setText('');
    }
  }

  private renderDebug(): void {
    this.debugText.setText(
      `Entities: ${hudData.activeEntities} | Physics: ${hudData.physicsStepMs.toFixed(2)}ms`
    );
    this.fpsText.setText(`FPS: ${Math.round(hudData.fps)}`);
  }
}