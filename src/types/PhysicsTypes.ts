// src/types/PhysicsTypes.ts
//
// Physics-domain type definitions.
// Separated from GameTypes to keep physics concepts clearly distinct
// from game-domain concepts.

import { Vector2 } from '@utils/Vector2';

// ─── Integration Methods ──────────────────────────────────────────────────────

/** Which numerical integration method to use for velocity/position update.
 *
 *  SYMPLECTIC_EULER (selected):
 *    velocity += acceleration * dt   (update velocity first)
 *    position += velocity * dt       (then position with NEW velocity)
 *    → Conserves energy. Orbits remain stable. Industry standard for games.
 *
 *  STANDARD_EULER (rejected):
 *    position += velocity * dt       (old velocity — energy drift)
 *    velocity += acceleration * dt
 *    → Orbits slowly spiral in/out. Unacceptable for orbital simulation.
 *
 *  RUNGE_KUTTA_4 (overkill for our scope):
 *    Four-stage predictor. Maximum accuracy. Used in real orbital software.
 *    Too expensive for a real-time game.
 */
export enum IntegrationMethod {
  SYMPLECTIC_EULER = 'SYMPLECTIC_EULER',
  STANDARD_EULER   = 'STANDARD_EULER',
  RUNGE_KUTTA_4    = 'RUNGE_KUTTA_4',
}

// ─── Force Types ─────────────────────────────────────────────────────────────

/** Categories of forces that can act on entities */
export enum ForceType {
  GRAVITY   = 'GRAVITY',   // F = G*m1*m2/r²
  THRUST    = 'THRUST',    // Player/enemy engine force
  DRAG      = 'DRAG',      // Linear velocity damping
  IMPULSE   = 'IMPULSE',   // Instantaneous force (collision response)
  EXPLOSION = 'EXPLOSION', // Radial force from explosion origin
}

/** A force with metadata for debugging */
export interface Force {
  vector:    Vector2;
  type:      ForceType;
  sourceId?: string; // Entity ID of the force origin
}

// ─── Gravity Source ───────────────────────────────────────────────────────────

/** A point in space that exerts gravitational attraction.
 *
 *  Newton's Law of Universal Gravitation (applied per tick):
 *    F = G * (m_source * m_entity) / distance²
 *    direction = normalize(sourcePos - entityPos)
 *    forceVector = direction * F
 *
 *  In our simulation:
 *    G     = PhysicsConfig.GAME_G      (scaled for gameplay visibility)
 *    mass  = this.mass                 (large value for strong attraction)
 */
export interface GravitySource {
  id:          string;
  position:    Vector2;
  mass:        number;      // Gravitational mass (determines pull strength)
  minDistance: number;      // Prevents singularity at r → 0
  maxDistance: number;      // Beyond this distance, no force applied (optimization)
  active:      boolean;
}

// ─── Physics Body Data ────────────────────────────────────────────────────────

/** Snapshot of a physics body's state at one point in time.
 *  Used for trajectory prediction (shadow simulation).
 */
export interface PhysicsSnapshot {
  position:        Vector2;
  velocity:        Vector2;
  acceleration:    Vector2;
  rotation:        number;
  angularVelocity: number;
}

// ─── Collision System ─────────────────────────────────────────────────────────

/** Types of collision geometry we support */
export enum ColliderShape {
  CIRCLE    = 'CIRCLE',
  RECTANGLE = 'RECTANGLE',  // Used for station shield
}

/** Broad-phase result: pair of entity IDs that MAY be colliding */
export interface BroadPhasePair {
  entityAId: string;
  entityBId: string;
}

/** Contact data for resolving a detected collision */
export interface ContactData {
  normal:           Vector2;  // Collision normal (points from B to A)
  penetrationDepth: number;   // How far objects overlap (pixels)
  contactPoint:     Vector2;  // World-space point of contact
  relativeVelocity: Vector2;  // Velocity of A relative to B at contact
  separatingSpeed:  number;   // Dot of relativeVelocity and normal
}

// ─── Physics Step Result ──────────────────────────────────────────────────────

/** Returned by PhysicsSystem.update() each fixed timestep */
export interface PhysicsStepResult {
  collisionsDetected:  number;
  collisionsResolved:  number;
  entitiesUpdated:     number;
  stepTimeMs:          number; // How long the physics step took (profiling)
}

// ─── Trajectory Prediction ────────────────────────────────────────────────────

/** Configuration for trajectory prediction simulation */
export interface TrajectoryConfig {
  steps:    number;   // Number of simulation steps to predict ahead
  stepDt:   number;   // Time per prediction step (seconds)
  maxAge:   number;   // Discard prediction points older than this (ms)
}

/** One point along a predicted trajectory */
export interface TrajectoryPoint {
  position: Vector2;
  velocity: Vector2;
  stepIndex: number;
}