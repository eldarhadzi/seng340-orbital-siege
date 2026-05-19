// src/systems/RenderSystem.ts
//
// Central rendering coordinator for the GameScene.
//
// RENDERING PIPELINE ORDER (each frame):
//   1. Clear graphics layers
//   2. Render starfield (parallax background)
//   3. Render gravity well (central star)
//   4. Render orbital trails
//   5. Render trajectory preview arc
//   6. Render asteroids
//   7. Render enemies
//   8. Render projectiles
//   9. Render station + shield
//  10. Render particles (on top of everything)
//  11. Render debug overlay (if enabled)
//
// LAYER SEPARATION:
// We use two Graphics objects:
//   worldGfx  → everything in world space (affected by shake)
//   effectGfx → particles and trails (also world space but drawn last)
//
// RENDER INTERPOLATION:
// Every entity position is interpolated between prevPosition and
// current position using the alpha value from PhysicsSystem.
// This ensures smooth motion even when physics runs slower than render.

import Phaser from 'phaser';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { RenderConfig } from '@config/RenderConfig';
import { Depths } from '@utils/Constants';
import { CameraSystem } from '@systems/CameraSystem';
import { ParticleSystem } from '@systems/ParticleSystem';
import { BaseEntity } from '@entities/BaseEntity';
import { Asteroid } from '@entities/Asteroid';
import { Station } from '@entities/Station';
import { Projectile } from '@entities/Projectile';
import { AsteroidSize } from '@typedefs/GameTypes';
import { TrajectoryPoint } from '@typedefs/PhysicsTypes';
import { PhysicsConfig } from '@config/PhysicsConfig';

// ─── Star data (generated once, never changes) ─────────────────────────────

interface Star {
  x:      number;  // World X (pre-computed, never changes)
  y:      number;
  radius: number;
  alpha:  number;
  layer:  number;  // 0=far, 1=mid, 2=near
}

export class RenderSystem {
  private scene:          Phaser.Scene;
  private camera:         CameraSystem;
  private particles:      ParticleSystem;

  // Graphics layers (created in init())
  private bgGfx!:         Phaser.GameObjects.Graphics; // Background
  private worldGfx!:      Phaser.GameObjects.Graphics; // World entities
  private effectGfx!:     Phaser.GameObjects.Graphics; // Particles/trails
  private debugGfx!:      Phaser.GameObjects.Graphics; // Debug overlay

  // Starfield data
  private stars:          Star[] = [];

  // Debug toggle
  private debugEnabled:   boolean = false;

  // Trail history: entityId → last N positions (world space)
  private trailHistory:   Map<string, Vector2[]> = new Map();

  // Time accumulator for animations
  private time:           number = 0;

  constructor(scene: Phaser.Scene, camera: CameraSystem, particles: ParticleSystem) {
    this.scene     = scene;
    this.camera    = camera;
    this.particles = particles;
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  init(): void {
    // Create graphics layers at correct depths
    this.bgGfx     = this.scene.add.graphics().setDepth(Depths.BACKGROUND_FAR);
    this.worldGfx  = this.scene.add.graphics().setDepth(Depths.ASTEROIDS);
    this.effectGfx = this.scene.add.graphics().setDepth(Depths.PARTICLES);
    this.debugGfx  = this.scene.add.graphics().setDepth(Depths.DEBUG_OVERLAY);

    // Generate star field
    this.generateStarfield();
  }

  // ─── Starfield Generation ─────────────────────────────────────────────────

  private generateStarfield(): void {
    this.stars = [];

    // Layer 0: Far — many tiny stars
    for (let i = 0; i < 300; i++) {
      this.stars.push({
        x:      MathUtils.randomRange(-RenderConfig.WIDTH,  RenderConfig.WIDTH  * 2),
        y:      MathUtils.randomRange(-RenderConfig.HEIGHT, RenderConfig.HEIGHT * 2),
        radius: MathUtils.randomRange(0.3, 1.0),
        alpha:  MathUtils.randomRange(0.3, 0.7),
        layer:  0,
      });
    }

    // Layer 1: Mid — medium stars
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x:      MathUtils.randomRange(-RenderConfig.WIDTH,  RenderConfig.WIDTH  * 2),
        y:      MathUtils.randomRange(-RenderConfig.HEIGHT, RenderConfig.HEIGHT * 2),
        radius: MathUtils.randomRange(0.8, 1.5),
        alpha:  MathUtils.randomRange(0.5, 0.9),
        layer:  1,
      });
    }

    // Layer 2: Near — bright large stars (fewer)
    for (let i = 0; i < 30; i++) {
      this.stars.push({
        x:      MathUtils.randomRange(-RenderConfig.WIDTH,  RenderConfig.WIDTH  * 2),
        y:      MathUtils.randomRange(-RenderConfig.HEIGHT, RenderConfig.HEIGHT * 2),
        radius: MathUtils.randomRange(1.5, 2.5),
        alpha:  MathUtils.randomRange(0.7, 1.0),
        layer:  2,
      });
    }
  }

  // ─── Main Render Frame ────────────────────────────────────────────────────

  /**
   * Render everything for one frame.
   * @param alpha       Physics interpolation factor (0-1)
   * @param entities    All active entities
   * @param trajectory  Current trajectory preview points
   * @param deltaMs     Frame delta for animations
   */
  render(
    alpha:      number,
    entities:   BaseEntity[],
    trajectory: TrajectoryPoint[],
    deltaMs:    number
  ): void {
    this.time += deltaMs / 1000;

    // Clear all layers
    this.bgGfx.clear();
    this.worldGfx.clear();
    this.effectGfx.clear();
    this.debugGfx.clear();

    // ── Rendering pipeline ─────────────────────────────────────────────────
    this.renderBackground();
    this.renderStarfield();
    this.renderGravityWell();
    this.renderOrbitalTrails(entities, alpha);
    this.renderTrajectoryArc(trajectory);
    this.renderEntities(entities, alpha);
    this.renderParticles();

    if (this.debugEnabled) {
      this.renderDebugOverlay(entities);
    }

    // Update trail history for next frame
    this.updateTrailHistory(entities, alpha);
  }

  // ─── Background ───────────────────────────────────────────────────────────

  private renderBackground(): void {
    // Deep space gradient
    this.bgGfx.fillGradientStyle(
      0x000008, 0x000010,
      0x000015, 0x000008,
      1
    );
    this.bgGfx.fillRect(0, 0, RenderConfig.WIDTH, RenderConfig.HEIGHT);
  }

  // ─── Starfield (Parallax) ─────────────────────────────────────────────────

  /**
   * Render 3-layer parallax starfield.
   *
   * PARALLAX PRINCIPLE:
   * Stars in different layers scroll at different speeds relative to
   * any camera shake offset. Layers further away appear to move less
   * (they're "further" from the camera). This creates depth illusion.
   *
   * Layer speeds:
   *   Far:  shake * 0.05  ← barely moves
   *   Mid:  shake * 0.15
   *   Near: shake * 0.30  ← moves most
   */
  private renderStarfield(): void {
    const shakeX = this.camera.currentShakeX;
    const shakeY = this.camera.currentShakeY;

    const speeds = [
      RenderConfig.PARALLAX_SPEED_FAR,
      RenderConfig.PARALLAX_SPEED_MID,
      RenderConfig.PARALLAX_SPEED_NEAR,
    ];

    for (const star of this.stars) {
      const speed  = speeds[star.layer];
      const offsetX = shakeX * speed;
      const offsetY = shakeY * speed;

      // Wrap star position to always fill screen
      let sx = ((star.x + offsetX) % RenderConfig.WIDTH  + RenderConfig.WIDTH)  % RenderConfig.WIDTH;
      let sy = ((star.y + offsetY) % RenderConfig.HEIGHT + RenderConfig.HEIGHT) % RenderConfig.HEIGHT;

      // Subtle twinkle for near-layer stars
      let alpha = star.alpha;
      if (star.layer === 2) {
        alpha *= 0.7 + 0.3 * Math.sin(this.time * 2 + star.x);
      }

      this.bgGfx.fillStyle(0xffffff, alpha);
      this.bgGfx.fillCircle(sx, sy, star.radius);
    }
  }

  // ─── Gravity Well ─────────────────────────────────────────────────────────

  private renderGravityWell(): void {
    const sc = this.camera.worldToScreen(0, 0); // Gravity well at world origin

    // Outer glow pulse
    const pulse = 0.5 + 0.5 * Math.sin(this.time * RenderConfig.GRAVITY_WELL_PULSE_SPEED);
    const outerAlpha = MathUtils.lerp(
      RenderConfig.GRAVITY_WELL_MIN_ALPHA * 0.3,
      RenderConfig.GRAVITY_WELL_MAX_ALPHA * 0.3,
      pulse
    );

    // Layered glow (large to small)
    this.worldGfx.fillStyle(0xff6600, outerAlpha * 0.2);
    this.worldGfx.fillCircle(sc.x, sc.y, 90);

    this.worldGfx.fillStyle(0xff8800, outerAlpha * 0.35);
    this.worldGfx.fillCircle(sc.x, sc.y, 65);

    this.worldGfx.fillStyle(0xffaa44, outerAlpha * 0.5);
    this.worldGfx.fillCircle(sc.x, sc.y, 45);

    this.worldGfx.fillStyle(0xffcc66, 0.7 + pulse * 0.3);
    this.worldGfx.fillCircle(sc.x, sc.y, 28);

    this.worldGfx.fillStyle(0xffee99, 0.9);
    this.worldGfx.fillCircle(sc.x, sc.y, 16);

    this.worldGfx.fillStyle(0xffffff, 1.0);
    this.worldGfx.fillCircle(sc.x, sc.y, 8);

    // Corona rays
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const angle  = (i / rayCount) * Math.PI * 2 + this.time * 0.3;
      const length = 60 + 20 * Math.sin(this.time * 1.5 + i);
      this.worldGfx.lineStyle(1, 0xffaa44, outerAlpha * 0.4);
      this.worldGfx.beginPath();
      this.worldGfx.moveTo(sc.x + Math.cos(angle) * 20, sc.y + Math.sin(angle) * 20);
      this.worldGfx.lineTo(sc.x + Math.cos(angle) * length, sc.y + Math.sin(angle) * length);
      this.worldGfx.strokePath();
    }
  }

  // ─── Orbital Trails ───────────────────────────────────────────────────────

  private renderOrbitalTrails(entities: BaseEntity[], _alpha: number): void {
    for (const entity of entities) {
      const history = this.trailHistory.get(entity.id);
      if (!history || history.length < 2) { continue; }

      // Choose trail color by entity type
      let color = 0x4488ff;
      if (entity instanceof Asteroid) { color = 0x556677; }
      if (entity instanceof Projectile) { color = 0xffaa44; }

      // Draw fading trail segments
      for (let i = 1; i < history.length; i++) {
        const progress = i / history.length;
        const a = progress * 0.5; // Max 50% alpha

        const from = this.camera.worldToScreenVec(history[i - 1]);
        const to   = this.camera.worldToScreenVec(history[i]);

        this.worldGfx.lineStyle(RenderConfig.TRAIL_WIDTH * progress, color, a);
        this.worldGfx.beginPath();
        this.worldGfx.moveTo(from.x, from.y);
        this.worldGfx.lineTo(to.x,   to.y);
        this.worldGfx.strokePath();
      }
    }
  }

  private updateTrailHistory(entities: BaseEntity[], alpha: number): void {
    const maxHistory = RenderConfig.TRAIL_LENGTH;

    // Remove trails for entities that no longer exist
    const activeIds = new Set(entities.map(e => e.id));
    for (const id of this.trailHistory.keys()) {
      if (!activeIds.has(id)) { this.trailHistory.delete(id); }
    }

    // Add current interpolated position to each entity's trail
    for (const entity of entities) {
      // Store world-space interpolated position for trail rendering
      const worldPos = new Vector2(
        MathUtils.lerp(entity.transform.prevPosition.x, entity.transform.position.x, alpha),
        MathUtils.lerp(entity.transform.prevPosition.y, entity.transform.position.y, alpha)
      );

      if (!this.trailHistory.has(entity.id)) {
        this.trailHistory.set(entity.id, []);
      }

      const history = this.trailHistory.get(entity.id)!;
      history.push(worldPos);

      if (history.length > maxHistory) {
        history.shift();
      }
    }
  }

  // ─── Trajectory Arc ───────────────────────────────────────────────────────

  /**
   * Render the projectile trajectory prediction as a dotted arc.
   *
   * Visual encoding:
   *   - Dots fade from bright (near) to dim (far)
   *   - Dots shrink from large (near) to small (far)
   *   - Gap between dots increases with distance (shows speed variation)
   */
  renderTrajectoryArc(trajectory: TrajectoryPoint[]): void {
    if (trajectory.length < 2) { return; }

    const spacing = RenderConfig.TRAJECTORY_DOT_SPACING;

    for (let i = 0; i < trajectory.length; i += spacing) {
      const pt      = trajectory[i];
      const sc      = this.camera.worldToScreenVec(pt.position);
      const t       = i / trajectory.length;
      const alpha   = MathUtils.lerp(
        RenderConfig.TRAJECTORY_DOT_ALPHA_START,
        RenderConfig.TRAJECTORY_DOT_ALPHA_END,
        t
      );
      const radius  = MathUtils.lerp(
        RenderConfig.TRAJECTORY_DOT_RADIUS,
        RenderConfig.TRAJECTORY_DOT_RADIUS * 0.4,
        t
      );

      this.worldGfx.fillStyle(0x44aaff, alpha);
      this.worldGfx.fillCircle(sc.x, sc.y, radius);
    }
  }

  // ─── Entity Rendering ─────────────────────────────────────────────────────

  private renderEntities(entities: BaseEntity[], alpha: number): void {
    for (const entity of entities) {
      if (!entity.active) { continue; }

      const sc  = this.camera.getInterpolatedScreenPos(
        entity.transform.prevPosition,
        entity.transform.position,
        alpha
      );

      // Interpolate rotation
      const rot = MathUtils.angleLerp(
        entity.transform.prevRotation,
        entity.transform.rotation,
        alpha
      );

      if (entity instanceof Asteroid) {
        this.renderAsteroid(entity, sc, rot);
      } else if (entity instanceof Station) {
        this.renderStation(entity, sc, rot);
      } else if (entity instanceof Projectile) {
        this.renderProjectile(entity, sc, rot);
      }
    }
  }

  // ─── Asteroid ─────────────────────────────────────────────────────────────

  private renderAsteroid(
    asteroid: Asteroid,
    sc: { x: number; y: number },
    rotation: number
  ): void {
    const r = asteroid.collider.radius;

    // Damage flash — asteroids flash brighter when hit
    const healthRatio = asteroid.healthPercent;
    const baseColor   = 0x445566;

    // Draw rocky body using polygon approximation
    const sides = asteroid.size === AsteroidSize.LARGE ? 8 :
                  asteroid.size === AsteroidSize.MEDIUM ? 7 : 6;

    // Body fill
    this.worldGfx.fillStyle(baseColor, 0.9);
    this.worldGfx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle   = rotation + (i / sides) * Math.PI * 2;
      // Vary radius per vertex for rocky look (seeded by variant)
      const variance = 1.0 + 0.2 * Math.sin(i * 2.3 + asteroid.asteroidVariant * 1.7);
      const vr      = r * variance;
      const vx      = sc.x + Math.cos(angle) * vr;
      const vy      = sc.y + Math.sin(angle) * vr;
      if (i === 0) { this.worldGfx.moveTo(vx, vy); }
      else         { this.worldGfx.lineTo(vx, vy); }
    }
    this.worldGfx.closePath();
    this.worldGfx.fillPath();

    // Outline
    this.worldGfx.lineStyle(1.5, 0x8899aa, 0.8);
    this.worldGfx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle   = rotation + (i / sides) * Math.PI * 2;
      const variance = 1.0 + 0.2 * Math.sin(i * 2.3 + asteroid.asteroidVariant * 1.7);
      const vr      = r * variance;
      const vx      = sc.x + Math.cos(angle) * vr;
      const vy      = sc.y + Math.sin(angle) * vr;
      if (i === 0) { this.worldGfx.moveTo(vx, vy); }
      else         { this.worldGfx.lineTo(vx, vy); }
    }
    this.worldGfx.strokePath();

    // Health indicator: dim red tint when damaged
    if (healthRatio < 1.0) {
      this.worldGfx.fillStyle(0xff2200, (1 - healthRatio) * 0.4);
      this.worldGfx.fillCircle(sc.x, sc.y, r);
    }

    // Surface crater detail (large asteroids only)
    if (asteroid.size === AsteroidSize.LARGE) {
      const craterAngle = asteroid.asteroidVariant * 1.5;
      const cx = sc.x + Math.cos(craterAngle) * r * 0.4;
      const cy = sc.y + Math.sin(craterAngle) * r * 0.4;
      this.worldGfx.fillStyle(0x223344, 0.6);
      this.worldGfx.fillCircle(cx, cy, r * 0.25);
    }
  }

  // ─── Station ──────────────────────────────────────────────────────────────

  private renderStation(
    station: Station,
    sc: { x: number; y: number },
    _rotation: number
  ): void {
    const r = station.collider.radius;

    // Main body — hexagonal station
    const sides = 6;
    this.worldGfx.fillStyle(0x112244, 1);
    this.worldGfx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
      const vx    = sc.x + Math.cos(angle) * r;
      const vy    = sc.y + Math.sin(angle) * r;
      if (i === 0) { this.worldGfx.moveTo(vx, vy); }
      else         { this.worldGfx.lineTo(vx, vy); }
    }
    this.worldGfx.closePath();
    this.worldGfx.fillPath();

    // Outline
    this.worldGfx.lineStyle(2, 0x4488ff, 1);
    this.worldGfx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 6;
      const vx    = sc.x + Math.cos(angle) * r;
      const vy    = sc.y + Math.sin(angle) * r;
      if (i === 0) { this.worldGfx.moveTo(vx, vy); }
      else         { this.worldGfx.lineTo(vx, vy); }
    }
    this.worldGfx.strokePath();

    // Core reactor
    this.worldGfx.fillStyle(0x44aaff, 0.8);
    this.worldGfx.fillCircle(sc.x, sc.y, 10);
    this.worldGfx.fillStyle(0xaaddff, 1);
    this.worldGfx.fillCircle(sc.x, sc.y, 5);

    // Turret barrel
    const aimAngle = station.aimAngle;
    this.worldGfx.lineStyle(4, 0x88ccff, 1);
    this.worldGfx.beginPath();
    this.worldGfx.moveTo(sc.x, sc.y);
    this.worldGfx.lineTo(
      sc.x + Math.cos(aimAngle) * (r + 18),
      sc.y + Math.sin(aimAngle) * (r + 18)
    );
    this.worldGfx.strokePath();

    // Turret tip
    this.worldGfx.fillStyle(0x44aaff, 1);
    this.worldGfx.fillCircle(
      sc.x + Math.cos(aimAngle) * (r + 18),
      sc.y + Math.sin(aimAngle) * (r + 18),
      3
    );

    // Shield visualization
    if (station.shieldActive && !station.shieldBroken) {
      const shieldR    = PhysicsConfig.RADIUS_STATION_SHIELD;
      const shieldAlpha = 0.15 + 0.1 * Math.sin(this.time * 4);
      this.worldGfx.lineStyle(2, 0x44aaff, 0.6);
      this.worldGfx.strokeCircle(sc.x, sc.y, shieldR);
      this.worldGfx.fillStyle(0x2266aa, shieldAlpha);
      this.worldGfx.fillCircle(sc.x, sc.y, shieldR);
    }

    // Health bar above station
    this.renderHealthBar(sc, station.healthPercent, r);
  }

  private renderHealthBar(
    sc:          { x: number; y: number },
    healthPct:   number,
    entityRadius: number
  ): void {
    const barW  = entityRadius * 2;
    const barH  = 4;
    const barX  = sc.x - barW / 2;
    const barY  = sc.y - entityRadius - 12;

    // Background
    this.worldGfx.fillStyle(0x222222, 0.8);
    this.worldGfx.fillRect(barX, barY, barW, barH);

    // Fill (green → red based on health)
    const color = healthPct > 0.5 ? 0x44ff44 :
                  healthPct > 0.25 ? 0xffaa00 : 0xff2200;
    this.worldGfx.fillStyle(color, 1);
    this.worldGfx.fillRect(barX, barY, barW * healthPct, barH);
  }

  // ─── Projectile ───────────────────────────────────────────────────────────

  private renderProjectile(
    projectile: Projectile,
    sc: { x: number; y: number },
    _rotation: number
  ): void {
    // Glowing bullet
    this.worldGfx.fillStyle(0xffdd00, 0.3);
    this.worldGfx.fillCircle(sc.x, sc.y, 8);
    this.worldGfx.fillStyle(0xffee44, 0.7);
    this.worldGfx.fillCircle(sc.x, sc.y, 5);
    this.worldGfx.fillStyle(0xffffff, 1);
    this.worldGfx.fillCircle(sc.x, sc.y, 2.5);

    // Directional streak
    const vel    = projectile.rigidbody.velocity;
    const speed  = vel.magnitude();
    if (speed > 10) {
      const nx    = vel.x / speed;
      const ny    = vel.y / speed;
      const len   = Math.min(speed * 0.02, 20);
      this.worldGfx.lineStyle(2, 0xffee44, 0.6);
      this.worldGfx.beginPath();
      this.worldGfx.moveTo(sc.x, sc.y);
      this.worldGfx.lineTo(sc.x - nx * len, sc.y - ny * len);
      this.worldGfx.strokePath();
    }
  }

  // ─── Particles ────────────────────────────────────────────────────────────

  private renderParticles(): void {
    this.particles.render(this.effectGfx, (wx, wy) => {
      return this.camera.worldToScreen(wx, wy);
    });
  }

  // ─── Debug Overlay ────────────────────────────────────────────────────────

  private renderDebugOverlay(entities: BaseEntity[]): void {
    for (const entity of entities) {
      if (!entity.active) { continue; }

      const sc = this.camera.worldToScreenVec(entity.transform.position);

      // Collider circle
      this.debugGfx.lineStyle(1, 0x00ff00, 0.7);
      this.debugGfx.strokeCircle(sc.x, sc.y, entity.collider.radius);

      // Velocity vector
      const vel = entity.rigidbody.velocity;
      const velScale = 0.04;
      this.debugGfx.lineStyle(1, 0xff4444, 0.8);
      this.debugGfx.beginPath();
      this.debugGfx.moveTo(sc.x, sc.y);
      this.debugGfx.lineTo(
        sc.x + vel.x * velScale,
        sc.y + vel.y * velScale
      );
      this.debugGfx.strokePath();

      // Entity ID label
      this.debugGfx.fillStyle(0xffffff, 0.5);
    }

    // Draw world origin crosshair
    const origin = this.camera.worldToScreen(0, 0);
    this.debugGfx.lineStyle(1, 0xffff00, 0.5);
    this.debugGfx.beginPath();
    this.debugGfx.moveTo(origin.x - 20, origin.y);
    this.debugGfx.lineTo(origin.x + 20, origin.y);
    this.debugGfx.moveTo(origin.x, origin.y - 20);
    this.debugGfx.lineTo(origin.x, origin.y + 20);
    this.debugGfx.strokePath();
  }

  // ─── Controls ─────────────────────────────────────────────────────────────

  toggleDebug(): void {
    this.debugEnabled = !this.debugEnabled;
    console.log(`[RenderSystem] Debug overlay: ${this.debugEnabled ? 'ON' : 'OFF'}`);
  }

  get isDebugEnabled(): boolean { return this.debugEnabled; }

  clearTrails(): void { this.trailHistory.clear(); }

  destroy(): void {
    this.bgGfx.destroy();
    this.worldGfx.destroy();
    this.effectGfx.destroy();
    this.debugGfx.destroy();
  }
}