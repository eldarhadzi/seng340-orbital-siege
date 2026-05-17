// src/systems/GravitySystem.ts
//
// Gravitational simulation — the physics showpiece of Orbital Siege.
//
// PHYSICS MODEL: Newton's Law of Universal Gravitation
//
//   F = G * (m₁ * m₂) / r²
//
//   Where:
//     F  = gravitational force magnitude (Newtons, simulation units)
//     G  = gravitational constant (GAME_G = 5000, scaled for gameplay)
//     m₁ = mass of gravity source (e.g. the central star)
//     m₂ = mass of the attracted entity (asteroid, projectile, etc.)
//     r  = distance between centers (pixels)
//
//   Direction: always from entity toward the gravity source
//   forceVector = normalize(sourcePos - entityPos) * F
//
// WHY SYMPLECTIC EULER IN GRAVITYSYSTEM?
// GravitySystem only ACCUMULATES forces — it does NOT integrate.
// PhysicsSystem performs integration using Symplectic Euler:
//   1. velocity += (netForce / mass) * dt   ← update velocity first
//   2. position += velocity * dt            ← then position
// This ordering conserves energy, keeping orbits stable.
//
// MULTI-BODY SUPPORT:
// The GravityRegistry holds multiple GravitySources.
// In early waves: one central star.
// In later waves: secondary mini black holes can be added.
// Every entity feels the net force from ALL sources each tick.
//
// ACADEMIC NOTE:
// Real orbital mechanics uses the two-body problem solution.
// Our n-body simulation is numerically integrated — the same
// approach used by NASA's Horizons system for solar system modeling.

import { Vector2 } from '@utils/Vector2';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { GravitySource } from '@typedefs/PhysicsTypes';
import { BaseEntity } from '@entities/BaseEntity';

export class GravitySystem {
  // Registry of all active gravity sources in the simulation
  private sources: Map<string, GravitySource> = new Map();

  // Reusable vector to avoid allocation in the gravity loop
  private _direction: Vector2 = new Vector2();
  private _force: Vector2     = new Vector2();

  // ─── Gravity Source Registry ──────────────────────────────────────────────

  addSource(source: GravitySource): void {
    this.sources.set(source.id, source);
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  getSource(id: string): GravitySource | undefined {
    return this.sources.get(id);
  }

  updateSourcePosition(id: string, position: Vector2): void {
    const source = this.sources.get(id);
    if (source) {
      source.position.copyFrom(position);
    }
  }

  clearSources(): void {
    this.sources.clear();
  }

  // ─── Main Update ─────────────────────────────────────────────────────────

  /**
   * Apply gravitational forces to all provided entities.
   * Called once per fixed physics tick BEFORE integration.
   *
   * For each entity × each gravity source:
   *   1. Calculate distance vector
   *   2. Clamp distance to prevent singularity
   *   3. Calculate force magnitude using Newton's law
   *   4. Accumulate force vector onto entity's rigidbody
   *
   * @param entities All active physics entities
   * @param gravityMultiplier Wave-based gravity scaling (1.0 = normal)
   */
  update(entities: BaseEntity[], gravityMultiplier: number = 1.0): void {
    for (const entity of entities) {
      const rb = entity.rigidbody;

      // Skip static, kinematic, or massless entities
      if (rb.isStatic || rb.isKinematic || rb.mass <= 0) { continue; }

      // Apply force from each active gravity source
      for (const source of this.sources.values()) {
        if (!source.active) { continue; }

        const gravForce = this.calculateGravityForce(
          entity.transform.position,
          rb.mass,
          source,
          gravityMultiplier
        );

        entity.addForce(gravForce);
      }
    }
  }

  // ─── Force Calculation ────────────────────────────────────────────────────

  /**
   * Calculate the gravitational force vector acting on a point mass.
   *
   * Newton's Law:  F = G * M * m / r²
   * Direction:     normalize(sourcePos - entityPos)
   * Result:        direction * F_magnitude
   *
   * @param entityPos  World position of the attracted entity
   * @param entityMass Mass of the attracted entity (m₂)
   * @param source     The gravity source (provides G, M, position)
   * @param multiplier Optional scale factor for gameplay tuning
   * @returns Force vector (pixels * mass / second²)
   */
  calculateGravityForce(
    entityPos: Vector2,
    entityMass: number,
    source: GravitySource,
    multiplier: number = 1.0
  ): Vector2 {
    // Direction from entity toward source: source.pos - entity.pos
    this._direction.set(
      source.position.x - entityPos.x,
      source.position.y - entityPos.y
    );

    // Distance in pixels
    let distance = this._direction.magnitude();

    // Clamp to minimum distance — prevents singularity (division by ~0)
    // and stops entities being flung to infinity if they clip the center
    distance = Math.max(distance, source.minDistance);

    // Beyond maxDistance: no force (optimization — gravity falls off fast)
    if (distance > source.maxDistance) {
      return Vector2.zero();
    }

    // Newton's gravitational force magnitude:
    // F = G * m_source * m_entity / distance²
    const forceMagnitude =
      (PhysicsConfig.GAME_G * source.mass * entityMass * multiplier)
      / (distance * distance);

    // Normalize direction and scale by force magnitude
    this._force.set(
      (this._direction.x / distance) * forceMagnitude,
      (this._direction.y / distance) * forceMagnitude
    );

    // Return a new vector (forces array holds references — must not share)
    return new Vector2(this._force.x, this._force.y);
  }

  /**
   * Calculate gravitational ACCELERATION at a position (for trajectory prediction).
   * a = F/m = G * M_source / r²
   * Does not require entity mass — acceleration is mass-independent.
   *
   * @param position World position to sample
   * @param multiplier Wave gravity multiplier
   * @returns Acceleration vector (pixels/second²)
   */
  getAccelerationAt(position: Vector2, multiplier: number = 1.0): Vector2 {
    const netAcceleration = new Vector2(0, 0);

    for (const source of this.sources.values()) {
      if (!source.active) { continue; }

      const dx = source.position.x - position.x;
      const dy = source.position.y - position.y;

      let distance = Math.sqrt(dx * dx + dy * dy);
      distance = Math.max(distance, source.minDistance);

      if (distance > source.maxDistance) { continue; }

      // a = G * M / r² (mass-independent)
      const accelMagnitude =
        (PhysicsConfig.GAME_G * source.mass * multiplier)
        / (distance * distance);

      netAcceleration.x += (dx / distance) * accelMagnitude;
      netAcceleration.y += (dy / distance) * accelMagnitude;
    }

    return netAcceleration;
  }

  // ─── Orbital Mechanics Helpers ────────────────────────────────────────────

  /**
   * Calculate the velocity needed for a circular orbit at a given radius.
   *
   * Circular orbit condition: gravitational force = centripetal force
   *   G*M*m/r² = m*v²/r
   *   v = sqrt(G*M/r)
   *
   * USE: SpawnSystem uses this to give asteroids stable initial velocities,
   * creating natural-looking orbital motion.
   *
   * @param orbitRadius Distance from gravity source center (pixels)
   * @param sourceId    Which gravity source to orbit
   * @param multiplier  Wave gravity multiplier
   * @returns Circular orbit speed in pixels/second
   */
  getCircularOrbitSpeed(
    orbitRadius: number,
    sourceId: string = 'central_star',
    multiplier: number = 1.0
  ): number {
    const source = this.sources.get(sourceId);
    if (!source) { return 0; }

    const r = Math.max(orbitRadius, source.minDistance);
    return Math.sqrt(
      (PhysicsConfig.GAME_G * source.mass * multiplier) / r
    );
  }

  /**
   * Get the tangent direction for a circular orbit at a given position.
   * The tangent is perpendicular to the radial direction.
   *
   * USE: SpawnSystem uses this to construct orbital velocity vectors:
   *   velocity = tangentDirection * circularOrbitSpeed + perturbation
   *
   * @param position     World position of the entity
   * @param sourceId     Which source to orbit around
   * @param clockwise    Orbit direction (true = clockwise in screen space)
   * @returns Unit tangent vector
   */
  getOrbitalTangent(
    position: Vector2,
    sourceId: string = 'central_star',
    clockwise: boolean = true
  ): Vector2 {
    const source = this.sources.get(sourceId);
    if (!source) { return Vector2.right(); }

    const dx = position.x - source.position.x;
    const dy = position.y - source.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) { return Vector2.right(); }

    // Radial unit vector (entity → source)
    const rx = dx / dist;
    const ry = dy / dist;

    // Tangent is perpendicular to radial:
    // Clockwise: (ry, -rx)   Counter-clockwise: (-ry, rx)
    return clockwise
      ? new Vector2(ry, -rx)
      : new Vector2(-ry, rx);
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  getSources(): GravitySource[] {
    return Array.from(this.sources.values());
  }

  getSourceCount(): number {
    return this.sources.size;
  }
}