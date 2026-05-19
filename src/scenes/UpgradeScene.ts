// src/scenes/UpgradeScene.ts
//
// Between-wave upgrade shop.
// Receives upgrade manager via scene data.
// Player picks one of 3 upgrade cards.

import Phaser from 'phaser';
import { SceneKeys } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { UpgradeManager } from '@managers/UpdateManager';
import { UpgradeCard } from '@ui/components/UpgradeCard';
import { UpgradeDefinition } from '@typedefs/GameTypes';

interface UpgradeSceneData {
  upgradeManager: UpgradeManager;
  waveNumber:     number;
  onComplete:     () => void;
}

export class UpgradeScene extends Phaser.Scene {
  private upgradeCards: UpgradeCard[] = [];
  private data!:        UpgradeSceneData;
  private selected:     boolean = false;

  constructor() {
    super({ key: SceneKeys.UPGRADE });
  }

  init(data: UpgradeSceneData): void {
    this.data     = data;
    this.selected = false;
  }

  create(): void {
    const cx = RenderConfig.WIDTH  / 2;
    const cy = RenderConfig.HEIGHT / 2;
    const W  = RenderConfig.WIDTH;

    // Semi-transparent overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000008, 0.88);
    overlay.fillRect(0, 0, W, RenderConfig.HEIGHT);

    // Header
    this.add.text(cx, 60, `WAVE ${this.data.waveNumber} COMPLETE`, {
      fontFamily: 'monospace',
      fontSize:   '32px',
      color:      '#44ff88',
      stroke:     '#001100',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(cx, 104, 'SELECT AN UPGRADE', {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      '#4488bb',
    }).setOrigin(0.5);

    // Resources display
    this.add.text(cx, 136, `◆  ${this.data.upgradeManager.currentResources} RESOURCES AVAILABLE`, {
      fontFamily: 'monospace',
      fontSize:   '14px',
      color:      '#44ff88',
    }).setOrigin(0.5);

    // Upgrade cards
    const options  = this.data.upgradeManager.getUpgradeOptions(3);
    const cardW    = 260;
    const cardH    = 230;
    const spacing  = 40;
    const totalW   = cardW * 3 + spacing * 2;
    const startX   = cx - totalW / 2 + cardW / 2;

    options.forEach((upgrade, i) => {
      const cardX = startX + i * (cardW + spacing);
      const card  = new UpgradeCard(this, {
        x:         cardX,
        y:         cy + 20,
        width:     cardW,
        height:    cardH,
        upgrade,
        canAfford: this.data.upgradeManager.canAfford(upgrade),
        onSelect:  (u) => { this.selectUpgrade(u); },
      });
      this.upgradeCards.push(card);
    });

    // Skip button
    const skipBtn = this.add.text(cx, cy + 185, 'SKIP  →', {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      '#446688',
      padding:    { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    skipBtn.on('pointerover',  () => skipBtn.setStyle({ color: '#6688aa' }));
    skipBtn.on('pointerout',   () => skipBtn.setStyle({ color: '#446688' }));
    skipBtn.on('pointerdown',  () => { this.complete(); });

    // Hint
    this.add.text(cx, RenderConfig.HEIGHT - 30, 'Next wave begins after selection', {
      fontFamily: 'monospace',
      fontSize:   '12px',
      color:      '#223344',
    }).setOrigin(0.5);
  }

  private selectUpgrade(upgrade: UpgradeDefinition): void {
    if (this.selected) { return; }
    this.selected = true;

    const purchased = this.data.upgradeManager.purchase(upgrade);
    if (purchased) {
      // Show confirmation
      const cx = RenderConfig.WIDTH / 2;
      this.add.text(cx, RenderConfig.HEIGHT / 2 + 195,
        `✓ ${upgrade.name} acquired!`, {
        fontFamily: 'monospace',
        fontSize:   '14px',
        color:      '#44ff88',
      }).setOrigin(0.5);
    }

    // Brief delay then continue
    this.time.delayedCall(800, () => { this.complete(); });
  }

  private complete(): void {
    this.upgradeCards.forEach(c => c.destroy());
    this.scene.stop();
    if (this.data.onComplete) { this.data.onComplete(); }
  }
}