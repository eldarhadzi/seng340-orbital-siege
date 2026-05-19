// src/ui/components/MiniMap.ts
//
// Radar minimap — shows entity positions scaled to a small display area.
//
// DESIGN:
// The minimap is a top-right HUD panel showing a bird's-eye view
// of the play area. Entity world positions are scaled by MINIMAP_WORLD_SCALE
// and drawn as colored dots relative to the minimap center.
//
// COLOR CODING:
//   White dot  = station (center)
//   Grey dots  = asteroids
//   Red dots   = enemies
//   Yellow dot = projectiles (brief flash)
//   Green dots = collectibles

import Phaser from 'phaser';
import { RenderConfig } from '@config/RenderConfig';
import { Tags } from '@utils/Constants';
import { BaseEntity } from '@entities/BaseEntity';

export class MiniMap {
  private scene:    Phaser.Scene;
  private gfx:      Phaser.GameObjects.Graphics;
  private border:   Phaser.GameObjects.Graphics;

  // Minimap panel position and size (screen space)
  private readonly SIZE   = RenderConfig.HUD_MINIMAP_SIZE;
  private readonly X: number;
  private readonly Y: number;
  private readonly SCALE  = RenderConfig.MINIMAP_WORLD_SCALE;
  private readonly RADIUS = RenderConfig.HUD_MINIMAP_SIZE / 2;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Top-right corner
    this.X = RenderConfig.WIDTH  - this.SIZE - 16;
    this.Y = RenderConfig.HEIGHT - this.SIZE - 16;

    // Static border — drawn once
    this.border = scene.add.graphics().setDepth(199);
    this.drawBorder();

    // Dynamic content — cleared and redrawn each frame
    this.gfx = scene.add.graphics().setDepth(200);
  }

  // ─── Static Border ────────────────────────────────────────────────────────

  private drawBorder(): void {
    const cx = this.X + this.RADIUS;
    const cy = this.Y + this.RADIUS;

    // Background circle
    this.border.fillStyle(0x050510, 0.85);
    this.border.fillCircle(cx, cy, this.RADIUS);

    // Orbit reference rings
    this.border.lineStyle(1, 0x112233, 0.6);
    this.border.strokeCircle(cx, cy, this.RADIUS * 0.4);
    this.border.strokeCircle(cx, cy, this.RADIUS * 0.7);

    // Border ring
    this.border.lineStyle(2, 0x334466, 1);
    this.border.strokeCircle(cx, cy, this.RADIUS);

    // Label
    this.scene.add.text(cx, this.Y - 14, 'RADAR', {
      fontFamily: 'monospace',
      fontSize:   '10px',
      color:      '#334466',
    }).setOrigin(0.5).setDepth(200);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Redraw minimap each frame with current entity positions.
   * @param entities All active entities in world space
   */
  update(entities: BaseEntity[]): void {
    this.gfx.clear();

    const cx = this.X + this.RADIUS;
    const cy = this.Y + this.RADIUS;

    // Clip to circle by only drawing entities within RADIUS
    for (const entity of entities) {
      if (!entity.active) { continue; }

      const wx = entity.transform.position.x * this.SCALE;
      const wy = entity.transform.position.y * this.SCALE;

      // Skip entities outside minimap boundary
      const distFromCenter = Math.sqrt(wx * wx + wy * wy);
      if (distFromCenter > this.RADIUS - 4) { continue; }

      const sx = cx + wx;
      const sy = cy + wy;

      // Color and size by entity type
      switch (entity.tag) {
        case Tags.STATION:
          this.gfx.fillStyle(0xffffff, 1);
          this.gfx.fillCircle(sx, sy, 3.5);
          // Station pulse ring
          this.gfx.lineStyle(1, 0x4488ff, 0.4);
          this.gfx.strokeCircle(sx, sy, 6);
          break;

        case Tags.ASTEROID:
          this.gfx.fillStyle(0x778899, 0.8);
          this.gfx.fillCircle(sx, sy, 2);
          break;

        case Tags.ENEMY:
          this.gfx.fillStyle(0xff3333, 1);
          this.gfx.fillCircle(sx, sy, 2.5);
          break;

        case Tags.PROJECTILE:
          this.gfx.fillStyle(0xffdd00, 0.9);
          this.gfx.fillCircle(sx, sy, 1.5);
          break;

        case Tags.COLLECTIBLE:
          this.gfx.fillStyle(0x44ff88, 0.9);
          this.gfx.fillCircle(sx, sy, 2);
          break;
      }
    }

    // Gravity well indicator at center
    this.gfx.fillStyle(0xff8800, 0.8);
    this.gfx.fillCircle(cx, cy, 4);
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillCircle(cx, cy, 2);
  }

  destroy(): void {
    this.gfx.destroy();
    this.border.destroy();
  }
}