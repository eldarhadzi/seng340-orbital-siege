// src/systems/ParticleSystem.ts
//
// Pooled particle system for explosions, trails, and visual effects.
//
// DESIGN:
// All particles are managed by a single system using an ObjectPool.
// This prevents GC spikes from creating/destroying particle objects
// during explosions (which can spawn 60 particles at once).
//
// PARTICLE TYPES:
//   SPARK    → Small bright dot, high velocity, short life
//   DEBRIS   → Larger fragment, tumbles, medium life
//   SMOKE    → Large, slow, fading circle
//   TRAIL    → Small dot left behind moving entities
//   RING     → Expanding circle (shockwave)
//
// RENDERING:
// Particles are rendered each frame using Phaser.GameObjects.Graphics.
// Each particle is a colored circle scaled by its life progress.
// No sprites needed — pure geometry rendering.

import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { RenderConfig } from '@config/RenderConfig';
import { Poolable } from '@utils/ObjectPool';

// ─── Particle Types ────────────────────────────────────────────────────────

export enum ParticleType {
  SPARK   = 'SPARK',
  DEBRIS  = 'DEBRIS',
  SMOKE   = 'SMOKE',
  TRAIL   = 'TRAIL',
  RING    = 'RING',
}

// ─── Single Particle ──────────────────────────────────────────────────────

export class Particle implements Poolable {
  active:      boolean = false;

  // World-space position (rendered via CameraSystem.worldToScreen)
  x:           number = 0;
  y:           number = 0;

  // Velocity in pixels/second
  vx:          number = 0;
  vy:          number = 0;

  // Life: starts at maxLife, counts down to 0
  life:        number = 0;
  maxLife:     number = 0;

  // Visual
  type:        ParticleType = ParticleType.SPARK;
  color:       number = 0xffffff;
  radius:      number = 3;
  alpha:       number = 1;

  // Ring-specific
  ringRadius:       number = 0;
  ringExpansionRate: number = 0;

  // Gravity scale (some particles fall slightly)
  gravityScale:     number = 0;

  // Rotation (for debris)
  rotation:    number = 0;
  angularVel:  number = 0;

  reset(): void {
    this.x = this.y = 0;
    this.vx = this.vy = 0;
    this.life = this.maxLife = 0;
    this.type = ParticleType.SPARK;
    this.color = 0xffffff;
    this.radius = 3;
    this.alpha = 1;
    this.ringRadius = 0;
    this.ringExpansionRate = 0;
    this.gravityScale = 0;
    this.rotation = 0;
    this.angularVel = 0;
  }
}

// ─── Explosion Config ─────────────────────────────────────────────────────

export interface ExplosionConfig {
  x:            number;   // World X
  y:            number;   // World Y
  particleCount: number;
  minSpeed:     number;
  maxSpeed:     number;
  minLife:      number;   // ms
  maxLife:      number;   // ms
  colors:       number[]; // Array of hex colors
  minRadius:    number;
  maxRadius:    number;
  includeRing:  boolean;
  ringColor:    number;
}

// ─── Particle System ──────────────────────────────────────────────────────

export class ParticleSystem {
  private particles:   Particle[] = [];
  private maxParticles: number;
  private activeCount:  number = 0;

  constructor(maxParticles: number = RenderConfig.PARTICLE_BUDGET_MAX) {
    this.maxParticles = maxParticles;
    // Pre-allocate all particles
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push(new Particle());
    }
  }

  // ─── Acquire ─────────────────────────────────────────────────────────────

  private acquire(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.reset();
        this.activeCount++;
        return p;
      }
    }
    return null; // Budget exhausted
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  /**
   * Update all active particles.
   * @param deltaMs Frame delta in milliseconds
   */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (const p of this.particles) {
      if (!p.active) { continue; }

      // Countdown life
      p.life -= deltaMs;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }

      // Move
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;

      // Gravity effect (mild downward drift)
      p.vy += RenderConfig.PARTICLE_GRAVITY * p.gravityScale * dt;

      // Drag (slows particles over time)
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Rotation
      p.rotation += p.angularVel * dt;

      // Ring expansion
      if (p.type === ParticleType.RING) {
        p.ringRadius += p.ringExpansionRate * dt;
      }

      // Fade alpha based on remaining life
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio;
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  /**
   * Render all active particles.
   * @param gfx    Phaser Graphics object to draw into
   * @param toScreen  Function converting world pos to screen pos
   */
  render(
    gfx: Phaser.GameObjects.Graphics,
    toScreen: (wx: number, wy: number) => { x: number; y: number }
  ): void {
    for (const p of this.particles) {
      if (!p.active || p.alpha <= 0.01) { continue; }

      const sc = toScreen(p.x, p.y);

      switch (p.type) {
        case ParticleType.SPARK:
        case ParticleType.TRAIL:
        case ParticleType.DEBRIS: {
          gfx.fillStyle(p.color, p.alpha);
          gfx.fillCircle(sc.x, sc.y, p.radius * p.alpha + 0.5);
          break;
        }

        case ParticleType.SMOKE: {
          // Smoke expands as it fades
          const smokeR = p.radius * (2 - p.alpha);
          gfx.fillStyle(p.color, p.alpha * 0.4);
          gfx.fillCircle(sc.x, sc.y, smokeR);
          break;
        }

        case ParticleType.RING: {
          // Expanding ring shockwave
          gfx.lineStyle(2 * p.alpha, p.color, p.alpha);
          gfx.strokeCircle(sc.x, sc.y, p.ringRadius);
          break;
        }
      }
    }
  }

  // ─── Explosion Emitter ────────────────────────────────────────────────────

  /**
   * Spawn a burst of particles at a world position.
   * Used for asteroid/enemy destruction.
   */
  explode(config: ExplosionConfig): void {
    // Spark particles — main burst
    for (let i = 0; i < config.particleCount; i++) {
      const p = this.acquire();
      if (!p) { break; }

      const angle  = MathUtils.randomRange(0, Math.PI * 2);
      const speed  = MathUtils.randomRange(config.minSpeed, config.maxSpeed);

      p.type         = i < config.particleCount * 0.6 ? ParticleType.SPARK : ParticleType.DEBRIS;
      p.x            = config.x + MathUtils.randomRange(-5, 5);
      p.y            = config.y + MathUtils.randomRange(-5, 5);
      p.vx           = Math.cos(angle) * speed;
      p.vy           = Math.sin(angle) * speed;
      p.life         = MathUtils.randomRange(config.minLife, config.maxLife);
      p.maxLife      = p.life;
      p.color        = MathUtils.randomElement(config.colors);
      p.radius       = MathUtils.randomRange(config.minRadius, config.maxRadius);
      p.gravityScale = MathUtils.randomRange(0.1, 0.4);
      p.angularVel   = MathUtils.randomRange(-3, 3);
    }

    // Smoke particles — linger after sparks fade
    const smokeCount = Math.floor(config.particleCount * 0.3);
    for (let i = 0; i < smokeCount; i++) {
      const p = this.acquire();
      if (!p) { break; }

      const angle = MathUtils.randomRange(0, Math.PI * 2);
      const speed = MathUtils.randomRange(config.minSpeed * 0.2, config.maxSpeed * 0.3);

      p.type    = ParticleType.SMOKE;
      p.x       = config.x;
      p.y       = config.y;
      p.vx      = Math.cos(angle) * speed;
      p.vy      = Math.sin(angle) * speed - 20; // Drift upward
      p.life    = MathUtils.randomRange(config.maxLife, config.maxLife * 1.5);
      p.maxLife = p.life;
      p.color   = 0x445566;
      p.radius  = MathUtils.randomRange(config.maxRadius, config.maxRadius * 2);
      p.gravityScale = 0;
    }

    // Shockwave ring
    if (config.includeRing) {
      const ring = this.acquire();
      if (ring) {
        ring.type              = ParticleType.RING;
        ring.x                 = config.x;
        ring.y                 = config.y;
        ring.ringRadius        = 5;
        ring.ringExpansionRate = config.maxSpeed * 1.5;
        ring.life              = config.minLife * 0.5;
        ring.maxLife           = ring.life;
        ring.color             = config.ringColor;
      }
    }
  }

  // ─── Preset Explosions ────────────────────────────────────────────────────

  explodeLargeAsteroid(wx: number, wy: number): void {
    this.explode({
      x: wx, y: wy,
      particleCount: RenderConfig.EXPLOSION_PARTICLES_LG,
      minSpeed:  80,  maxSpeed:  350,
      minLife:   400, maxLife:   1000,
      colors:    [0xff6622, 0xff9944, 0xffcc44, 0xffffff, 0x888899],
      minRadius: 2,   maxRadius: 6,
      includeRing: true,
      ringColor: 0xff8833,
    });
  }

  explodeMediumAsteroid(wx: number, wy: number): void {
    this.explode({
      x: wx, y: wy,
      particleCount: RenderConfig.EXPLOSION_PARTICLES_MD,
      minSpeed:  60,  maxSpeed:  250,
      minLife:   300, maxLife:   700,
      colors:    [0xff6622, 0xff9944, 0xffcc44, 0x888899],
      minRadius: 1.5, maxRadius: 4,
      includeRing: true,
      ringColor: 0xff6622,
    });
  }

  explodeSmallAsteroid(wx: number, wy: number): void {
    this.explode({
      x: wx, y: wy,
      particleCount: RenderConfig.EXPLOSION_PARTICLES_SM,
      minSpeed:  40,  maxSpeed:  180,
      minLife:   200, maxLife:   500,
      colors:    [0xff8844, 0xffaa66, 0x888899],
      minRadius: 1,   maxRadius: 3,
      includeRing: false,
      ringColor: 0xff6622,
    });
  }

  explodeEnemy(wx: number, wy: number): void {
    this.explode({
      x: wx, y: wy,
      particleCount: 50,
      minSpeed:  100, maxSpeed:  400,
      minLife:   500, maxLife:   1200,
      colors:    [0xff2200, 0xff6600, 0xffaa00, 0x44aaff, 0xffffff],
      minRadius: 2,   maxRadius: 7,
      includeRing: true,
      ringColor: 0xff4400,
    });
  }

  /** Spawn a single trail particle behind a moving entity */
  spawnTrail(wx: number, wy: number, color: number = 0x4488ff): void {
    const p = this.acquire();
    if (!p) { return; }

    p.type    = ParticleType.TRAIL;
    p.x       = wx + MathUtils.randomRange(-2, 2);
    p.y       = wy + MathUtils.randomRange(-2, 2);
    p.vx      = MathUtils.randomRange(-10, 10);
    p.vy      = MathUtils.randomRange(-10, 10);
    p.life    = MathUtils.randomRange(100, RenderConfig.TRAIL_FADE_TIME_MS);
    p.maxLife = p.life;
    p.color   = color;
    p.radius  = MathUtils.randomRange(1, 3);
    p.gravityScale = 0;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  get totalActive():   number { return this.activeCount; }
  get totalCapacity(): number { return this.maxParticles; }

  clearAll(): void {
    for (const p of this.particles) {
      p.active = false;
    }
    this.activeCount = 0;
  }
}