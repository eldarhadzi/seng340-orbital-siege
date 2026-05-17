// src/systems/PhysicsSystem.ts
//
// Master physics coordinator — the simulation engine core.
//
// RESPONSIBILITIES:
//   1. Fixed timestep accumulator (decouples physics from render framerate)
//   2. Force accumulation (collects all forces per entity per tick)
//   3. Symplectic Euler integration (velocity → position update)
//   4. Velocity clamping (prevents tunneling at extreme speeds)
//   5. Drag application (linear damping)
//   6. Boundary enforcement (entity despawn outside world bounds)
//   7. Coordinate GravitySystem and CollisionSystem per tick
//
// FIXED TIMESTEP ACCUMULATOR:
//
//   accumulator += frameTime (variable, e.g. 16ms, 17ms, 14ms...)
//
//   while (accumulator >= FIXED_DT):
//     physics.step(FIXED_DT)     ← always exactly 16.667ms
//     accumulator -= FIXED_DT
//
//   alpha = accumulator / FIXED_DT  ← for render interpolation
//
// WHY THIS MATTERS:
// Without fixed timestep, an asteroid at 60fps travels 1px/frame.
// At 30fps it travels 2px/frame. The game plays differently on
// different machines. Fixed timestep guarantees identical simulation
// on all hardware.
//
// SYMPLECTIC EULER INTEGRATION:
//
//   Step 1: Sum all accumulated forces → net acceleration
//           a = (F₁ + F₂ + ... + Fₙ) / mass
//
//   Step 2: Update velocity FIRST (this is what makes it "symplectic")
//           v_new = v_old + a * dt
//
//   Step 3: Update position with NEW velocity
//           pos_new = pos_old + v_new * dt   ← not v_old!
//
//   Step 4: Apply drag
//           v = v * (1 - drag * dt)
//
//   Step 5: Clamp to max velocity
//           if |v| > maxV: v = normalize(v) * maxV
//
// ENERGY CONSERVATION NOTE:
// Standard Euler: pos += v_old * dt  → energy DRIFTS (orbits decay/expand)
// Symplectic Euler: pos += v_new * dt → energy CONSERVED (orbits stable)
// The difference is one line of code but critical for orbital simulation.

import { PhysicsConfig } from '@config/PhysicsConfig';
import { BaseEntity } from '@entities/BaseEntity';
import { GravitySystem } from '@systems/GravitySystem';
import { CollisionSystem } from '@systems/CollisionSystem';
import { PhysicsStepResult } from '@typedefs/PhysicsTypes';
import { Tags } from '@utils/Constants';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export class PhysicsSystem {
  private gravitySystem:    GravitySystem;
  private collisionSystem:  CollisionSystem;

  // Fixed timestep accumulator
  private accumulator: number = 0;

  // Current wave gravity multiplier (increases each wave)
  private gravityMultiplier: number = 1.0;

  // Max velocity lookup by entity tag
  private maxVelocities: Record<string, number> = {
    [Tags.ASTEROID]:   PhysicsConfig.MAX_VELOCITY_ASTEROID,
    [Tags.PROJECTILE]: PhysicsConfig.MAX_VELOCITY_PROJECTILE,
    [Tags.ENEMY]:      PhysicsConfig.MAX_VELOCITY_ENEMY,
    [Tags.COLLECTIBLE]:PhysicsConfig.MAX_VELOCITY_COLLECTIBLE,
    [Tags.STATION]:    0,  // Station doesn't move
  };

  // Statistics
  private _lastStepResult: PhysicsStepResult = {
    collisionsDetected:  0,
    collisionsResolved:  0,
    entitiesUpdated:     0,
    stepTimeMs:          0,
  };

  constructor(gravitySystem: GravitySystem, collisionSystem: CollisionSystem) {
    this.gravitySystem   = gravitySystem;
    this.collisionSystem = collisionSystem;
  }

  // ─── Main Update ──────────────────────────────────────────────────────────

  /**
   * Process physics for one render frame.
   * May execute 0, 1, or multiple fixed physics steps depending on
   * how much time has accumulated.
   *
   * @param frameDeltaMs  Real elapsed time since last render frame (ms)
   * @param entities      All active physics entities
   * @returns alpha       Interpolation factor for render smoothing (0-1)
   */
  update(frameDeltaMs: number, entities: BaseEntity[]): number {
    // Cap delta to prevent "spiral of death" on lag spikes
    const clampedDelta = Math.min(frameDeltaMs, PhysicsConfig.MAX_DELTA_MS);

    this.accumulator += clampedDelta;

    const dt = PhysicsConfig.FIXED_TIMESTEP_MS;

    // Run as many fixed steps as accumulated time allows
    while (this.accumulator >= dt) {
      this.step(dt / 1000, entities); // Convert ms → seconds for physics math
      this.accumulator -= dt;
    }

    // Alpha: fraction of a timestep remaining in the accumulator.
    // Used by the renderer to interpolate between prevPosition and position.
    // Produces smooth rendering even when physics runs at a different rate.
    const alpha = this.accumulator / dt;
    return alpha;
  }

  // ─── Fixed Physics Step ───────────────────────────────────────────────────

  /**
   * One complete physics simulation step at exactly FIXED_TIMESTEP.
   * @param dt Fixed timestep in SECONDS (not milliseconds)
   */
  private step(dt: number, entities: BaseEntity[]): void {
    const startTime = performance.now();

    // ── 1. Store Previous State (for render interpolation) ────────────────
    for (const entity of entities) {
      entity.transform.prevPosition.copyFrom(entity.transform.position);
      entity.transform.prevRotation = entity.transform.rotation;
    }

    // ── 2. Apply Gravity Forces ────────────────────────────────────────────
    // Gravity accumulates forces onto each entity's rigidbody.forces array.
    this.gravitySystem.update(entities, this.gravityMultiplier);

    // ── 3. Integrate (Symplectic Euler) ───────────────────────────────────
    for (const entity of entities) {
      this.integrateEntity(entity, dt);
    }

    // ── 4. Collision Detection + Resolution ───────────────────────────────
    this.collisionSystem.update(entities);

    // ── 5. Check Despawn Boundaries ───────────────────────────────────────
    this.checkBoundaries(entities);

    // ── Record Step Stats ─────────────────────────────────────────────────
    this._lastStepResult = {
      collisionsDetected:  this.collisionSystem.broadPhasePairs,
      collisionsResolved:  this.collisionSystem.resolvedThisTick,
      entitiesUpdated:     entities.length,
      stepTimeMs:          performance.now() - startTime,
    };
  }

  // ─── Symplectic Euler Integration ─────────────────────────────────────────

  /**
   * Integrate one entity's physics state by one timestep.
   *
   * SYMPLECTIC EULER ORDER (CRITICAL — do not reorder):
   *   1. Net force → acceleration   (F = ma → a = F/m)
   *   2. Velocity update            (v += a * dt)      ← FIRST
   *   3. Position update            (p += v * dt)      ← uses NEW v
   *   4. Angular velocity update
   *   5. Drag application
   *   6. Velocity clamping
   *   7. Clear force accumulator
   */
  private integrateEntity(entity: BaseEntity, dt: number): void {
    const rb = entity.rigidbody;
    const tf = entity.transform;

    if (rb.isStatic || rb.isKinematic) {
      rb.forces = [];
      return;
    }

    // ── Sum accumulated forces into net acceleration ──────────────────────
    let netForceX = 0;
    let netForceY = 0;

    for (const force of rb.forces) {
      netForceX += force.x;
      netForceY += force.y;
    }

    // a = F / m  (inverseMass = 1/m, precomputed to avoid division)
    const accX = netForceX * rb.inverseMass;
    const accY = netForceY * rb.inverseMass;

    // ── Step 2: Update velocity FIRST (Symplectic Euler) ─────────────────
    rb.velocity.x += accX * dt;
    rb.velocity.y += accY * dt;

    // ── Step 3: Update position with NEW velocity ─────────────────────────
    tf.position.x += rb.velocity.x * dt;
    tf.position.y += rb.velocity.y * dt;

    // ── Step 4: Angular integration ───────────────────────────────────────
    tf.rotation += rb.angularVelocity * dt;
    // Apply angular drag
    rb.angularVelocity *= (1 - PhysicsConfig.ANGULAR_DRAG);

    // ── Step 5: Linear drag ───────────────────────────────────────────────
    // v *= (1 - drag * dt)
    // Simulates very slight resistance — keeps simulation stable
    if (rb.drag > 0) {
      const dragFactor = 1 - rb.drag * dt;
      rb.velocity.x *= dragFactor;
      rb.velocity.y *= dragFactor;
    }

    // ── Step 6: Clamp to maximum velocity ────────────────────────────────
    const maxV = this.maxVelocities[entity.tag] ?? PhysicsConfig.MAX_VELOCITY_ASTEROID;
    if (maxV > 0) {
      const speedSq = rb.velocity.x * rb.velocity.x + rb.velocity.y * rb.velocity.y;
      if (speedSq > maxV * maxV) {
        const speed     = Math.sqrt(speedSq);
        rb.velocity.x   = (rb.velocity.x / speed) * maxV;
        rb.velocity.y   = (rb.velocity.y / speed) * maxV;
      }
    }

    // ── Step 7: Clear force accumulator ──────────────────────────────────
    // Forces are re-accumulated fresh each tick
    rb.forces = [];
  }

  // ─── Boundary Check ───────────────────────────────────────────────────────

  /**
   * Entities that drift beyond the despawn radius are returned to their pool.
   * The station at the center is exempt.
   */
  private checkBoundaries(entities: BaseEntity[]): void {
    const despawnSq = PhysicsConfig.DESPAWN_RADIUS * PhysicsConfig.DESPAWN_RADIUS;

    for (const entity of entities) {
      if (entity.tag === Tags.STATION) { continue; }

      const pos  = entity.transform.position;
      const distSq = pos.x * pos.x + pos.y * pos.y;

      if (distSq > despawnSq) {
        eventBus.emit(GameEvents.ENTITY_DESTROYED, {
          entityId:  entity.id,
          tag:       entity.tag,
          reason:    'out_of_bounds',
          position:  { x: pos.x, y: pos.y },
        });
      }
    }
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  setGravityMultiplier(multiplier: number): void {
    this.gravityMultiplier = multiplier;
  }

  resetAccumulator(): void {
    this.accumulator = 0;
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  get lastStepResult(): PhysicsStepResult {
    return this._lastStepResult;
  }

  get currentGravityMultiplier(): number {
    return this.gravityMultiplier;
  }

  getGravitySystem(): GravitySystem {
    return this.gravitySystem;
  }

  getCollisionSystem(): CollisionSystem {
    return this.collisionSystem;
  }
}