// src/ui/components/DamageNumber.ts
//
// Floating damage numbers — popup text showing damage dealt.
// Pooled to avoid GC during rapid combat.
//
// BEHAVIOR:
//   - Spawns at impact world position (converted to screen)
//   - Floats upward at RISE_SPEED px/s
//   - Fades out after FADE_DELAY ms
//   - Destroyed after LIFETIME_MS ms

import Phaser from 'phaser';
import { RenderConfig } from '@config/RenderConfig';
import { MathUtils } from '@utils/MathUtils';
import { Depths } from '@utils/Constants';

interface DamageNumberEntry {
  text:    Phaser.GameObjects.Text;
  screenX: number;
  screenY: number;
  life:    number;     // ms remaining
  maxLife: number;
  active:  boolean;
}

export class DamageNumberSystem {
  private scene:   Phaser.Scene;
  private pool:    DamageNumberEntry[] = [];
  private readonly POOL_SIZE = 30;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.prewarm();
  }

  private prewarm(): void {
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const txt = this.scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize:   '16px',
        color:      '#ffffff',
        stroke:     '#000000',
        strokeThickness: 3,
      }).setDepth(Depths.WORLD_UI).setVisible(false).setOrigin(0.5);

      this.pool.push({
        text:    txt,
        screenX: 0,
        screenY: 0,
        life:    0,
        maxLife: 0,
        active:  false,
      });
    }
  }

  // ─── Spawn ────────────────────────────────────────────────────────────────

  /**
   * Show a floating damage number at a world position.
   * @param screenX   Screen X (already converted from world)
   * @param screenY   Screen Y
   * @param damage    Number to display
   * @param isCritical Show larger yellow text for big hits
   */
  spawn(
    screenX:    number,
    screenY:    number,
    damage:     number,
    isCritical: boolean = false
  ): void {
    const entry = this.pool.find(e => !e.active);
    if (!entry) { return; }

    entry.screenX   = screenX + MathUtils.randomRange(-15, 15);
    entry.screenY   = screenY;
    entry.life      = RenderConfig.DAMAGE_NUMBER_LIFETIME_MS;
    entry.maxLife   = RenderConfig.DAMAGE_NUMBER_LIFETIME_MS;
    entry.active    = true;

    const color   = isCritical ? '#ffcc00' : '#ffffff';
    const size    = isCritical ? '20px' : '15px';
    const label   = isCritical ? `${damage}!` : `${damage}`;

    entry.text.setText(label);
    entry.text.setStyle({ color, fontSize: size });
    entry.text.setPosition(entry.screenX, entry.screenY);
    entry.text.setAlpha(1);
    entry.text.setVisible(true);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const entry of this.pool) {
      if (!entry.active) { continue; }

      entry.life -= deltaMs;

      if (entry.life <= 0) {
        entry.active = false;
        entry.text.setVisible(false);
        continue;
      }

      // Rise upward
      entry.screenY -= RenderConfig.DAMAGE_NUMBER_RISE_SPEED * dt;
      entry.text.setY(entry.screenY);

      // Fade out after delay
      const lifeRatio = entry.life / entry.maxLife;
      const fadeStart = RenderConfig.DAMAGE_NUMBER_FADE_DELAY / entry.maxLife;
      if (lifeRatio < fadeStart) {
        const alpha = lifeRatio / fadeStart;
        entry.text.setAlpha(alpha);
      }
    }
  }

  destroy(): void {
    for (const entry of this.pool) {
      entry.text.destroy();
    }
    this.pool = [];
  }
}