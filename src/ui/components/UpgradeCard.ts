// src/ui/components/UpgradeCard.ts
//
// Single upgrade option card displayed in the upgrade shop.

import Phaser from 'phaser';
import { UpgradeDefinition } from '@typedefs/GameTypes';

export interface UpgradeCardConfig {
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  upgrade:    UpgradeDefinition;
  canAfford:  boolean;
  onSelect:   (upgrade: UpgradeDefinition) => void;
}

export class UpgradeCard {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg:        Phaser.GameObjects.Graphics;
  private selected:  boolean = false;
  private config:    UpgradeCardConfig;

  // Colors
  private readonly COLOR_NORMAL    = 0x0d1f33;
  private readonly COLOR_HOVER     = 0x1a3a5c;
  private readonly COLOR_SELECTED  = 0x1a4a6c;
  private readonly BORDER_NORMAL   = 0x334466;
  private readonly BORDER_HOVER    = 0x4488bb;
  private readonly BORDER_SELECTED = 0x44aaff;

  constructor(scene: Phaser.Scene, cfg: UpgradeCardConfig) {
    this.scene   = scene;
    this.config  = cfg;
    this.container = scene.add.container(cfg.x, cfg.y);
    this.bg = scene.add.graphics();
    this.build();
  }

  private build(): void {
    const { width: w, height: h, upgrade, canAfford } = this.config;
    const hw = w / 2;
    const hh = h / 2;

    // Background
    this.bg = this.scene.add.graphics();
    this.drawBg(this.COLOR_NORMAL, this.BORDER_NORMAL);

    // Category badge
    const badgeColor = this.getCategoryColor(upgrade.category);
    const badge = this.scene.add.graphics();
    badge.fillStyle(badgeColor, 0.3);
    badge.fillRoundedRect(-hw + 12, -hh + 12, 80, 22, 4);
    badge.lineStyle(1, badgeColor, 0.8);
    badge.strokeRoundedRect(-hw + 12, -hh + 12, 80, 22, 4);

    const badgeText = this.scene.add.text(-hw + 52, -hh + 23, upgrade.category, {
      fontFamily: 'monospace', fontSize: '10px',
      color: Phaser.Display.Color.IntegerToColor(badgeColor).rgba,
    }).setOrigin(0.5);

    // Name
    const nameText = this.scene.add.text(0, -hh + 50, upgrade.name, {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      canAfford ? '#aaccff' : '#445566',
      wordWrap:   { width: w - 24 },
    }).setOrigin(0.5);

    // Description
    const descText = this.scene.add.text(0, -hh + 85, upgrade.description, {
      fontFamily: 'monospace',
      fontSize:   '12px',
      color:      canAfford ? '#8899bb' : '#334455',
      wordWrap:   { width: w - 24 },
      align:      'center',
    }).setOrigin(0.5);

    // Cost
    const costColor = canAfford ? '#44ff88' : '#ff4444';
    const costText  = this.scene.add.text(0, hh - 28,
      canAfford ? `◆ ${upgrade.cost} RESOURCES` : `✗ INSUFFICIENT RESOURCES`, {
      fontFamily: 'monospace',
      fontSize:   '12px',
      color:      costColor,
    }).setOrigin(0.5);

    // Assemble container
    this.container.add([this.bg, badge, badgeText, nameText, descText, costText]);

    // Interactivity
    if (canAfford) {
      const hitArea = new Phaser.Geom.Rectangle(-hw, -hh, w, h);
      this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

      this.container.on('pointerover', () => {
        this.drawBg(this.COLOR_HOVER, this.BORDER_HOVER);
      });
      this.container.on('pointerout', () => {
        if (!this.selected) { this.drawBg(this.COLOR_NORMAL, this.BORDER_NORMAL); }
      });
      this.container.on('pointerdown', () => {
        this.selected = true;
        this.drawBg(this.COLOR_SELECTED, this.BORDER_SELECTED);
        this.config.onSelect(this.config.upgrade);
      });
    }
  }

  private drawBg(fillColor: number, borderColor: number): void {
    const w  = this.config.width;
    const h  = this.config.height;
    const hw = w / 2;
    const hh = h / 2;

    this.bg.clear();
    this.bg.fillStyle(fillColor, 0.95);
    this.bg.fillRoundedRect(-hw, -hh, w, h, 8);
    this.bg.lineStyle(2, borderColor, 1);
    this.bg.strokeRoundedRect(-hw, -hh, w, h, 8);
  }

  private getCategoryColor(category: string): number {
    switch (category) {
      case 'WEAPON':  return 0xff6633;
      case 'DEFENSE': return 0x4488ff;
      case 'UTILITY': return 0x44ff88;
      default:        return 0xaaaaaa;
    }
  }

  destroy(): void {
    this.container.destroy();
    this.bg.destroy();
  }
}