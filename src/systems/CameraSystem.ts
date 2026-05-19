// src/systems/CameraSystem.ts
//
// Camera controller with trauma-based screen shake system.
//
// TRAUMA SYSTEM:
// Professional game feel technique from Squirrel Eiserloh (GDC 2015).
// Instead of directly setting shake offset, we maintain a "trauma" value
// (0-1). Shake offset = sin(time * frequency) * maxOffset * trauma².
//
// Using trauma² (not trauma) means:
//   - At trauma=1.0: full shake (1.0² = 1.0)
//   - At trauma=0.5: quarter shake (0.5² = 0.25) — feels more natural
//   - At trauma=0.1: 1% shake — almost imperceptible, not jarring
//
// WORLD-TO-SCREEN CONVERSION:
// All physics runs in world space centered at (0,0).
// The camera converts world coordinates to screen coordinates.
// Screen center = world (0,0) + camera offset + shake offset.
//
// RENDER INTERPOLATION:
// The camera receives the alpha value from PhysicsSystem and uses it
// to interpolate entity positions between physics frames:
//   renderPos = lerp(entity.prevPosition, entity.position, alpha)
// This produces smooth 60fps rendering even though physics runs at
// a fixed rate that may not align with render frames.

import Phaser from 'phaser';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { RenderConfig } from '@config/RenderConfig';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export interface CameraShakeEvent {
  trauma:   number;   // 0-1, how intense the shake is
  duration: number;   // ms, ignored (trauma decays naturally)
}

export interface CameraFlashEvent {
  color:    number;   // Hex color e.g. 0xff0000
  alpha:    number;   // 0-1
  duration: number;   // ms
}

export class CameraSystem {
  private scene: Phaser.Scene;

  // Trauma: 0 = no shake, 1 = maximum shake
  // Decays over time. New shakes ADD to current trauma (capped at 1).
  private trauma:    number = 0;

  // Current shake offsets (recalculated each frame from trauma)
  private shakeOffsetX:  number = 0;
  private shakeOffsetY:  number = 0;
  private shakeRotation: number = 0;

  // Camera target zoom (lerped toward over time)
  private targetZoom:  number = 1.0;
  private currentZoom: number = 1.0;

  // World offset — the base world-to-screen translation
  // For Orbital Siege, world (0,0) maps to screen center always.
  private worldOffsetX: number;
  private worldOffsetY: number;

  // Shake seed for pseudo-random noise (varies per axis)
  private shakeTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene        = scene;
    this.worldOffsetX = RenderConfig.WIDTH  / 2;
    this.worldOffsetY = RenderConfig.HEIGHT / 2;

    // Listen for shake/flash events from other systems
    eventBus.on<CameraShakeEvent>(GameEvents.CAMERA_SHAKE, (data) => {
      this.addTrauma(data.trauma);
    });

    eventBus.on<CameraFlashEvent>(GameEvents.CAMERA_FLASH, (data) => {
      this.flash(data.color, data.alpha, data.duration);
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Update camera state each render frame.
   * @param deltaMs  Frame delta time in milliseconds
   */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Decay trauma over time
    this.trauma = Math.max(
      0,
      this.trauma - RenderConfig.CAMERA_TRAUMA_DECAY * dt
    );

    // Calculate shake offsets using trauma²
    const traumaSq = this.trauma * this.trauma;

    if (traumaSq > 0.0001) {
      this.shakeTime += dt;

      // Use multiple frequencies for more organic shake feel
      this.shakeOffsetX = traumaSq * RenderConfig.CAMERA_SHAKE_MAX_OFFSET
        * Math.sin(this.shakeTime * RenderConfig.CAMERA_SHAKE_FREQUENCY * 1.0);

      this.shakeOffsetY = traumaSq * RenderConfig.CAMERA_SHAKE_MAX_OFFSET
        * Math.sin(this.shakeTime * RenderConfig.CAMERA_SHAKE_FREQUENCY * 1.3);

      this.shakeRotation = traumaSq * RenderConfig.CAMERA_SHAKE_MAX_ROTATION
        * Math.sin(this.shakeTime * RenderConfig.CAMERA_SHAKE_FREQUENCY * 0.8);
    } else {
      this.shakeOffsetX  = 0;
      this.shakeOffsetY  = 0;
      this.shakeRotation = 0;
    }

    // Smooth zoom toward target
    this.currentZoom = MathUtils.lerp(
      this.currentZoom,
      this.targetZoom,
      RenderConfig.CAMERA_LERP_SPEED * dt
    );

    // Apply to Phaser camera
    const cam = this.scene.cameras.main;
    cam.setRotation(this.shakeRotation);
  }

  // ─── Coordinate Conversion ────────────────────────────────────────────────

  /**
   * Convert world-space position to screen-space position.
   * Applies camera shake offset.
   *
   * @param worldX  World X (0 = center of play area)
   * @param worldY  World Y (0 = center of play area)
   * @returns Screen pixel coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX + this.worldOffsetX + this.shakeOffsetX,
      y: worldY + this.worldOffsetY + this.shakeOffsetY,
    };
  }

  worldToScreenVec(worldPos: Vector2): { x: number; y: number } {
    return this.worldToScreen(worldPos.x, worldPos.y);
  }

  /**
   * Convert screen-space position to world-space.
   * Used for mouse input conversion.
   */
  screenToWorld(screenX: number, screenY: number): Vector2 {
    return new Vector2(
      screenX - this.worldOffsetX - this.shakeOffsetX,
      screenY - this.worldOffsetY - this.shakeOffsetY
    );
  }

  /**
   * Get interpolated world-to-screen position for an entity.
   * Uses prevPosition + alpha to smooth rendering between physics ticks.
   *
   * @param prevPos  Entity position from previous physics tick
   * @param currPos  Entity position from current physics tick
   * @param alpha    Interpolation factor (0-1) from PhysicsSystem
   */
  getInterpolatedScreenPos(
    prevPos: Vector2,
    currPos: Vector2,
    alpha: number
  ): { x: number; y: number } {
    const interpX = MathUtils.lerp(prevPos.x, currPos.x, alpha);
    const interpY = MathUtils.lerp(prevPos.y, currPos.y, alpha);
    return this.worldToScreen(interpX, interpY);
  }

  // ─── Trauma / Shake ───────────────────────────────────────────────────────

  /**
   * Add trauma from an event (collision, explosion, etc.)
   * Trauma is clamped to [0, 1] — cannot exceed maximum shake.
   */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Instantly set trauma to a specific value */
  setTrauma(amount: number): void {
    this.trauma = MathUtils.clamp01(amount);
  }

  // ─── Flash ────────────────────────────────────────────────────────────────

  /** Screen flash effect — used for damage, explosions, etc. */
  flash(
    color: number    = RenderConfig.FLASH_DAMAGE_COLOR,
    _alpha: number   = RenderConfig.FLASH_DAMAGE_ALPHA,
    duration: number = RenderConfig.FLASH_DAMAGE_DURATION_MS
  ): void {
    this.scene.cameras.main.flash(
      duration,
      (color >> 16) & 0xff,
      (color >> 8)  & 0xff,
       color        & 0xff,
      false,
      (_cam: Phaser.Cameras.Scene2D.Camera, _progress: number) => {
        // Flash progress callback
      }
    );
  }

  // ─── Zoom ─────────────────────────────────────────────────────────────────

  setTargetZoom(zoom: number): void {
    this.targetZoom = MathUtils.clamp(zoom, 0.5, 2.0);
  }

  resetZoom(): void {
    this.targetZoom = 1.0;
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get currentTrauma():    number { return this.trauma; }
  get currentShakeX():    number { return this.shakeOffsetX; }
  get currentShakeY():    number { return this.shakeOffsetY; }
  get zoom():             number { return this.currentZoom; }

  destroy(): void {
    eventBus.removeAllListeners(GameEvents.CAMERA_SHAKE);
    eventBus.removeAllListeners(GameEvents.CAMERA_FLASH);
  }
}