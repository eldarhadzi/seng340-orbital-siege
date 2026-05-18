// src/scenes/UIScene.ts — Phase 5 Update
// Full HUD with wave countdown, heat bar, weapon indicator, combo.

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { hudData } from '@managers/HUDDataModel';

export class UIScene extends Phaser.Scene {
  private gfx!:          Phaser.GameObjects.Graphics;
  private scoreText!:    Phaser.GameObjects.Text;
  private waveText!:     Phaser.GameObjects.Text;
  private healthLabel!:  Phaser.GameObjects.Text;
  private shieldLabel!:  Phaser.GameObjects.Text;
  private weaponLabel!:  Phaser.GameObjects.Text;
  private comboText!:    Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private debugText!:    Phaser.GameObjects.Text;
  private fpsText!:      Phaser.GameObjects.Text;
  private overheatText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SceneKeys.UI });
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.createHUDElements();
  }

  private createHUDElements(): void {
    const W = RenderConfig.WIDTH;
    const H = RenderConfig.HEIGHT;

    // ── Left panel ─────────────────────────────────────────────────────────
    this.healthLabel = this.add.text(20, 20, 'HULL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa'
    });

    this.shieldLabel = this.add.text(20, 56, 'SHIELD', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa'
    });

    this.weaponLabel = this.add.text(20, 92, 'WEAPON', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa'
    });

    this.overheatText = this.add.text(20, 122, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff4400'
    });

    // ── Top center ─────────────────────────────────────────────────────────
    this.waveText = this.add.text(W / 2, 18, 'WAVE 1', {
      fontFamily: 'monospace', fontSize: '18px', color: '#4488ff'
    }).setOrigin(0.5, 0);

    this.countdownText = this.add.text(W / 2, H / 2 - 60, '', {
      fontFamily: 'monospace', fontSize: '64px', color: '#ffffff',
      stroke: '#000033', strokeThickness: 6,
    }).setOrigin(0.5);

    // ── Top right ──────────────────────────────────────────────────────────
    this.scoreText = this.add.text(W - 20, 20, '0', {
      fontFamily: 'monospace', fontSize: '24px', color: '#ffcc44'
    }).setOrigin(1, 0);

    // ── Combo ──────────────────────────────────────────────────────────────
    this.comboText = this.add.text(W / 2, 48, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ff8844'
    }).setOrigin(0.5, 0);

    // ── Debug ──────────────────────────────────────────────────────────────
    this.debugText = this.add.text(20, H - 46, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466'
    });
    this.fpsText = this.add.text(20, H - 20, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466'
    });
  }

  update(): void {
    this.gfx.clear();

    this.renderHealthBar();
    this.renderShieldBar();
    this.renderHeatBar();
    this.renderWaveInfo();
    this.renderScore();
    this.renderCombo();
    this.renderCountdown();
    this.renderDebug();
  }

  // ─── Bars ─────────────────────────────────────────────────────────────────

  private renderBar(
    x: number, y: number, w: number, h: number,
    pct: number, fillColor: number, label: string,
    labelText: Phaser.GameObjects.Text
  ): void {
    this.gfx.fillStyle(0x111122, 0.9);
    this.gfx.fillRect(x, y, w, h);
    this.gfx.fillStyle(fillColor, 1);
    this.gfx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
    this.gfx.lineStyle(1, 0x334466, 1);
    this.gfx.strokeRect(x, y, w, h);
    labelText.setText(label);
  }

  private renderHealthBar(): void {
    const pct   = hudData.stationHealth / hudData.stationMaxHealth;
    const color = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
    this.renderBar(20, 32, 180, 12, pct, color,
      `HULL  ${hudData.stationHealth}/${hudData.stationMaxHealth}`,
      this.healthLabel
    );
  }

  private renderShieldBar(): void {
    const pct   = hudData.shieldEnergy / hudData.shieldMaxEnergy;
    const color = hudData.shieldBroken ? 0x444444 : 0x44aaff;
    this.renderBar(20, 68, 180, 12, pct, color,
      hudData.shieldBroken
        ? 'SHIELD  OFFLINE'
        : `SHIELD  ${Math.floor(hudData.shieldEnergy)}/${hudData.shieldMaxEnergy}`,
      this.shieldLabel
    );
  }

  private renderHeatBar(): void {
    const pct   = hudData.weaponHeat / 100;
    const color = pct > 0.8 ? 0xff2200 : pct > 0.5 ? 0xff8800 : 0x44ff88;
    this.renderBar(20, 104, 180, 12, pct, color,
      `${hudData.activeWeapon}  ${hudData.weaponOverheated ? '🔥 OVERHEAT' : `HEAT ${Math.floor(hudData.weaponHeat)}%`}`,
      this.weaponLabel
    );
    this.overheatText.setText(
      hudData.weaponOverheated ? '⚠ WEAPON OFFLINE' : ''
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
      this.comboText.setAlpha(0.8 + 0.2 * Math.sin(Date.now() / 150));
    } else {
      this.comboText.setText('');
    }
  }

  private renderCountdown(): void {
    const cd = hudData.waveCountdown ?? 0;
    if (cd > 0) {
      this.countdownText.setText(cd.toString());
      this.countdownText.setAlpha(0.9);
    } else if (hudData.waveComplete) {
      this.countdownText.setText('WAVE COMPLETE!');
      this.countdownText.setStyle({ fontSize: '36px', color: '#44ff88' });
      this.countdownText.setAlpha(0.9);
    } else {
      this.countdownText.setText('');
    }
  }

  private renderDebug(): void {
    this.debugText.setText(
      `Entities: ${hudData.activeEntities} | Physics: ${hudData.physicsStepMs.toFixed(2)}ms`
    );
    this.fpsText.setText(`FPS: ${Math.round(hudData.fps)}`);
  }
}