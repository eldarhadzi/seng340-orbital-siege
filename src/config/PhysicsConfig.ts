// src/config/PhysicsConfig.ts
//
// All physics simulation constants for Orbital Siege.
//
// CRITICAL RULE: No physics value is hardcoded anywhere else in the codebase.
// Every tunable physics constant lives here. This makes balancing and
// academic documentation straightforward.
//
// PHYSICS NOTES:
// Real-world constants are scaled for gameplay visibility:
//   Real G     = 6.674×10⁻¹¹ N⋅m²/kg²
//   Our GAME_G = 5000           (scaled to produce visible orbital curves)
//
// This is standard practice in game physics simulation. The proportional
// relationships (larger mass → stronger pull) remain physically correct.

import { IntegrationMethod } from '@typedefs/PhysicsTypes';

export const PhysicsConfig = {
  // ─── Time Step ──────────────────────────────────────────────────────────
  // Fixed timestep in milliseconds (1000 / 60 ≈ 16.667ms = 60 physics ticks/sec)
  // Physics always runs at exactly this rate, independent of render framerate.
  FIXED_TIMESTEP_MS: 1000 / 60,      // 16.667 ms
  FIXED_TIMESTEP_S:  1 / 60,         // 0.01667 seconds (used in integration)

  // Maximum physics catch-up per frame (prevents spiral of death on lag spikes)
  // If deltaTime > this, we cap it. This means physics slows down on lag
  // rather than trying to catch up and making it worse.
  MAX_DELTA_MS: 100,   // Never simulate more than 100ms of lag at once

  // ─── Integration ────────────────────────────────────────────────────────
  INTEGRATION_METHOD: IntegrationMethod.SYMPLECTIC_EULER,

  // ─── Gravity ────────────────────────────────────────────────────────────
  // Gravitational constant (scaled for gameplay — see header note)
  GAME_G: 5000,

  // Mass of the central gravity well (the star)
  GRAVITY_WELL_MASS: 1_000_000,

  // Mass of a secondary gravity well (mini black hole — later waves)
  SECONDARY_WELL_MASS: 400_000,

  // Minimum distance in pixels before gravity force is capped.
  // Prevents division-by-zero singularity and stops entities from being
  // flung off-screen when they get too close to the well.
  GRAVITY_MIN_DISTANCE: 60,

  // Beyond this radius, gravity is not calculated (optimization).
  // Entities outside this range feel no gravitational pull.
  GRAVITY_MAX_DISTANCE: 1200,

  // ─── Entity Masses ───────────────────────────────────────────────────────
  // In kg (simulation units — not real kg)
  MASS_STATION:          800,
  MASS_ASTEROID_LARGE:   500,
  MASS_ASTEROID_MEDIUM:  200,
  MASS_ASTEROID_SMALL:   80,
  MASS_PROJECTILE:       5,
  MASS_ENEMY_DRONE:      150,
  MASS_ENEMY_ORBIT:      200,
  MASS_COLLECTIBLE:      10,

  // ─── Restitution Coefficients ────────────────────────────────────────────
  // e = 0: perfectly inelastic (stick together)
  // e = 1: perfectly elastic (no energy loss)
  // Real collisions are between 0 and 1.
  RESTITUTION_ASTEROID_ASTEROID: 0.6,  // Rocky, partly elastic
  RESTITUTION_ASTEROID_STATION:  0.3,  // Station absorbs impact
  RESTITUTION_ASTEROID_SHIELD:   0.8,  // Shield bounces well
  RESTITUTION_PROJECTILE:        0.0,  // Projectile stops on hit

  // ─── Velocity Limits ─────────────────────────────────────────────────────
  // Maximum speed in pixels/second. Without this, gravity slingshot can
  // accelerate entities to absurd speeds and cause tunneling (passing through
  // objects because they move more than one collision-check's width per frame).
  MAX_VELOCITY_ASTEROID:    600,
  MAX_VELOCITY_PROJECTILE:  1200,
  MAX_VELOCITY_ENEMY:       500,
  MAX_VELOCITY_COLLECTIBLE: 300,

  // ─── Drag Coefficients ────────────────────────────────────────────────────
  // Applied each physics tick: velocity *= (1 - drag * dt)
  // 0 = no drag (pure space)
  // Space has near-zero drag. We add tiny drag to prevent
  // infinite acceleration edge cases and for gameplay feel.
  DRAG_ASTEROID:    0.002,
  DRAG_ENEMY:       0.01,
  DRAG_PROJECTILE:  0.0,    // Projectiles have zero drag (they're moving fast)
  DRAG_COLLECTIBLE: 0.05,   // Collectibles slow down to be catchable

  // ─── Angular Velocity ────────────────────────────────────────────────────
  // Asteroids tumble as they travel. These are starting rotation speeds (rad/s).
  ANGULAR_VELOCITY_MIN: 0.3,   // rad/s
  ANGULAR_VELOCITY_MAX: 2.5,   // rad/s
  ANGULAR_DRAG:         0.001, // Tiny rotational drag

  // ─── Collision System ────────────────────────────────────────────────────
  // QuadTree configuration
  QUADTREE_CAPACITY:  4,  // Objects per node before splitting
  QUADTREE_MAX_DEPTH: 6,  // Maximum subdivision levels

  // Positional correction after collision (prevents sinking/jittering)
  POSITION_CORRECTION_PERCENT: 0.8,   // Correct 80% of penetration per step
  POSITION_CORRECTION_SLOP:    0.5,   // Ignore penetrations smaller than 0.5px

  // ─── Collider Radii ──────────────────────────────────────────────────────
  RADIUS_ASTEROID_LARGE:  40,
  RADIUS_ASTEROID_MEDIUM: 24,
  RADIUS_ASTEROID_SMALL:  12,
  RADIUS_STATION:         35,
  RADIUS_STATION_SHIELD:  65,
  RADIUS_PROJECTILE:       4,
  RADIUS_ENEMY_DRONE:     20,
  RADIUS_COLLECTIBLE:     10,

  // ─── Spawn System ────────────────────────────────────────────────────────
  // Entities spawn on a circle outside the visible screen
  SPAWN_RADIUS: 950,  // Pixels from world center

  // How far outside spawn radius the "despawn" boundary is
  // Entities beyond this are recycled back to their pool
  DESPAWN_RADIUS: 1100,

  // ─── Fragmentation ───────────────────────────────────────────────────────
  // When a LARGE asteroid dies, how many MEDIUM fragments spawn?
  FRAGMENT_COUNT_LARGE_TO_MEDIUM: 2,
  // When a MEDIUM asteroid dies, how many SMALL fragments spawn?
  FRAGMENT_COUNT_MEDIUM_TO_SMALL: 2,

  // Angular spread of fragments (radians — how wide the cone of fragments is)
  FRAGMENT_SPREAD_ANGLE: Math.PI / 3,  // 60 degree spread

  // Fragments receive parent velocity + this factor * projectile velocity
  FRAGMENT_IMPULSE_FACTOR: 0.4,

} as const;