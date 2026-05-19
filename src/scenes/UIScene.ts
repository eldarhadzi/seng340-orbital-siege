// src/scenes/UIScene.ts — Phase 6: Full HUD with minimap + damage numbers

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { hudData } from '@managers/HUDDataModel';
import { MiniMap } from '@ui/components/MiniMap';
import { DamageNumberSystem } from '@ui/components/DamageNumber';
import { entityManager } from '@managers/EntityManager';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export class UIScene extends Phaser.Scene {
  private gfx!:           Phaser.GameObjects.Graphics;
  private scoreText!:     Phaser.GameObjects.Text;
  private waveText!:      Phaser.GameObjects.Text;
  private healthLabel!:   Phaser.GameObjects.Text;
  private shieldLabel!:   Phaser.GameObjects.Text;
  private weaponLabel!:   Phaser.GameObjects.Text;
  private comboText!:     Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private debugText!:     Phaser.GameObjects.Text;
  private fpsText!:       Phaser.GameObjects.Text;
  private overheatText!:  Phaser.GameObjects.Text;
  private resourceText!:  Phaser.GameObjects.Text;

  private miniMap!:       MiniMap;
  private damageNumbers!: DamageNumberSystem;

  constructor() {
    super({ key: SceneKeys.UI });
  }

  create(): void {
    this.gfx          = this.add.graphics();
    this.miniMap      = new MiniMap(this);
    this.damageNumbers = new DamageNumberSystem(this);

    this.createHUDElements();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Show damage numbers on score change events
    eventBus.on(GameEvents.SCORE_CHANGED, (data: unknown) => {
      const d = data as { points: number; position: { x: number; y: number } };
      if (d.position && d.points > 0) {
        // Convert world position to screen position
        const screenX = d.position.x + RenderConfig.WIDTH  / 2;
        const screenY = d.position.y + RenderConfig.HEIGHT / 2;
        const isCrit  = d.points >= 150;
        this.damageNumbers.spawn(screenX, screenY, d.points, isCrit);
      }
    });
  }

  private createHUDElements(): void {
    const W = RenderConfig.WIDTH;
    const H = RenderConfig.HEIGHT;

    // ── Left panel: bars ──────────────────────────────────────────────────
    this.healthLabel = this.add.text(20, 20, 'HULL', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa',
    });
    this.shieldLabel = this.add.text(20, 56, 'SHIELD', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa',
    });
    this.weaponLabel = this.add.text(20, 92, 'WEAPON', {
      fontFamily: 'monospace', fontSize: '11px', color: '#6688aa',
    });
    this.overheatText = this.add.text(20, 122, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ff4400',
    });

    // Resources
    this.resourceText = this.add.text(20, 145, '◆ 0 RESOURCES', {
      fontFamily: 'monospace', fontSize: '12px', color: '#44ff88',
    });

    // ── Top center ─────────────────────────────────────────────────────────
    this.waveText = this.add.text(W / 2, 18, 'WAVE 1', {
      fontFamily: 'monospace', fontSize: '18px', color: '#4488ff',
    }).setOrigin(0.5, 0);

    this.countdownText = this.add.text(W / 2, H / 2 - 60, '', {
      fontFamily:      'monospace',
      fontSize:        '72px',
      color:           '#ffffff',
      stroke:          '#000033',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // ── Top right: score ───────────────────────────────────────────────────
    this.scoreText = this.add.text(W - 20, 20, '0', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffcc44',
    }).setOrigin(1, 0);

    this.add.text(W - 20, 50, 'SCORE', {
      fontFamily: 'monospace', fontSize: '10px', color: '#665522',
    }).setOrigin(1, 0);

    // ── Combo ──────────────────────────────────────────────────────────────
    this.comboText = this.add.text(W / 2, 50, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#ff8844',
    }).setOrigin(0.5, 0);

    // ── Debug ──────────────────────────────────────────────────────────────
    this.debugText = this.add.text(20, H - 46, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466',
    });
    this.fpsText = this.add.text(20, H - 24, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#334466',
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.gfx.clear();

    this.renderHealthBar();
    this.renderShieldBar();
    this.renderHeatBar();
    this.renderWaveInfo();
    this.renderScore();
    this.renderCombo();
    this.renderCountdown();
    this.renderResources();
    this.renderDebug();

    // Minimap
    this.miniMap.update(entityManager.getAll());

    // Damage numbers
    this.damageNumbers.update(delta);
  }

  // ─── Bar Renderer ─────────────────────────────────────────────────────────

  private renderBar(
    x: number, y: number, w: number, h: number,
    pct: number, fillColor: number,
    label: string, labelEl: Phaser.GameObjects.Text
  ): void {
    this.gfx.fillStyle(0x0a0f1a, 0.95);
    this.gfx.fillRect(x, y, w, h);
    this.gfx.fillStyle(fillColor, 1);
    this.gfx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
    this.gfx.lineStyle(1, 0x334466, 1);
    this.gfx.strokeRect(x, y, w, h);
    labelEl.setText(label);
  }

  private renderHealthBar(): void {
    const pct   = hudData.stationHealth / hudData.stationMaxHealth;
    const color = pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffaa00 : 0xff2200;
    this.renderBar(20, 32, 190, 13, pct, color,
      `HULL  ${hudData.stationHealth}/${hudData.stationMaxHealth}`,
      this.healthLabel
    );
  }

  private renderShieldBar(): void {
    const pct   = hudData.shieldEnergy / hudData.shieldMaxEnergy;
    const color = hudData.shieldBroken ? 0x333333 : 0x44aaff;
    this.renderBar(20, 68, 190, 13, pct, color,
      hudData.shieldBroken
        ? 'SHIELD  OFFLINE'
        : `SHIELD  ${Math.floor(hudData.shieldEnergy)}/${hudData.shieldMaxEnergy}`,
      this.shieldLabel
    );
  }

  private renderHeatBar(): void {
    const pct   = hudData.weaponHeat / 100;
    const color = pct > 0.8 ? 0xff2200 : pct > 0.5 ? 0xff8800 : 0x44ff88;
    this.renderBar(20, 104, 190, 13, pct, color,
      `${hudData.activeWeapon}  HEAT ${Math.floor(hudData.weaponHeat)}%`,
      this.weaponLabel
    );
    this.overheatText.setText(
      hudData.weaponOverheated ? '⚠  WEAPON OFFLINE' : ''
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
      this.comboText.setAlpha(0.8 + 0.2 * Math.sin(Date.now() / 140));
    } else {
      this.comboText.setText('');
    }
  }

  private renderCountdown(): void {
    const cd = hudData.waveCountdown ?? 0;
    if (cd > 0) {
      this.countdownText.setText(cd.toString());
      this.countdownText.setStyle({ fontSize: '72px', color: '#ffffff' });
      this.countdownText.setAlpha(0.9);
    } else if (hudData.waveComplete) {
      this.countdownText.setText('WAVE COMPLETE!');
      this.countdownText.setStyle({ fontSize: '36px', color: '#44ff88' });
      this.countdownText.setAlpha(0.9);
    } else {
      this.countdownText.setText('');
    }
  }

  private renderResources(): void {
    this.resourceText.setText(`◆  ${hudData.resourceCount} RESOURCES`);
  }

  private renderDebug(): void {
    this.debugText.setText(
      `Entities: ${hudData.activeEntities} | Physics: ${hudData.physicsStepMs.toFixed(2)}ms`
    );
    this.fpsText.setText(`FPS: ${Math.round(hudData.fps)}`);
  }

  shutdown(): void {
    this.miniMap.destroy();
    this.damageNumbers.destroy();
    eventBus.removeAllListeners(GameEvents.SCORE_CHANGED);
  }
}