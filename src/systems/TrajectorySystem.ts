// src/systems/TrajectorySystem.ts
//
// Shadow simulation for projectile trajectory prediction.
//
// PURPOSE:
// Before the player fires, we run a miniature physics simulation
// forward in time and collect the predicted positions. These are
// rendered as a dotted arc showing where the projectile will travel.
//
// WHY THIS IS ACADEMICALLY SIGNIFICANT:
// This demonstrates that our physics simulation is deterministic —
// given the same initial conditions, it produces the same result
// every time. The "shadow" simulation uses identical physics to
// the real simulation: same gravity law, same integration method.
//
// IMPLEMENTATION:
// We do NOT move any real entities. We maintain a local state
// (position + velocity) and integrate it N steps forward using
// the GravitySystem's acceleration query API.
//
// PERFORMANCE:
// Trajectory prediction runs every render frame (not physics tick).
// With TRAJECTORY_STEPS = 90 steps at dt = 1/60s,
// we predict 1.5 seconds of future travel.
// Each step is just: acc = gravity(pos), vel += acc*dt, pos += vel*dt
// ~90 iterations of simple math — negligible CPU cost.

import { Vector2 } from '@utils/Vector2';
import { RenderConfig } from '@config/RenderConfig';
import { GravitySystem } from '@systems/GravitySystem';
import { TrajectoryPoint } from '@typedefs/PhysicsTypes';

export class TrajectorySystem {
  private gravitySystem: GravitySystem;

  // Configuration
  private steps:   number;
  private stepDt:  number;

  // Cached result — updated each frame when player aims
  private _lastTrajectory: TrajectoryPoint[] = [];

  // Reusable state vectors (avoids allocation per frame)
  private _simPos: Vector2 = new Vector2();
  private _simVel: Vector2 = new Vector2();

  constructor(gravitySystem: GravitySystem) {
    this.gravitySystem = gravitySystem;
    this.steps  = RenderConfig.TRAJECTORY_STEPS;
    this.stepDt = RenderConfig.TRAJECTORY_STEP_DT;
  }

  // ─── Prediction ───────────────────────────────────────────────────────────

  /**
   * Predict the trajectory of a projectile from a given initial state.
   *
   * ALGORITHM (per step):
   *   1. Sample gravitational acceleration at current position
   *      acc = GravitySystem.getAccelerationAt(pos)
   *   2. Symplectic Euler: vel += acc * dt
   *   3. Symplectic Euler: pos += vel * dt
   *   4. Store position as a trajectory point
   *   5. Early exit if out of world bounds
   *
   * @param startPosition  World position where projectile spawns
   * @param startVelocity  Initial velocity of the projectile
   * @param gravMultiplier Current wave gravity multiplier
   * @returns Array of TrajectoryPoints (world-space positions)
   */
  predict(
    startPosition: Vector2,
    startVelocity: Vector2,
    gravMultiplier: number = 1.0
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];

    // Initialize shadow simulation state
    this._simPos.copyFrom(startPosition);
    this._simVel.copyFrom(startVelocity);

    const despawnSq = 1100 * 1100; // Matches PhysicsConfig.DESPAWN_RADIUS²

    for (let step = 0; step < this.steps; step++) {
      // Sample gravitational acceleration at current position
      const acc = this.gravitySystem.getAccelerationAt(
        this._simPos,
        gravMultiplier
      );

      // Symplectic Euler integration (same as real physics)
      this._simVel.x += acc.x * this.stepDt;
      this._simVel.y += acc.y * this.stepDt;
      this._simPos.x += this._simVel.x * this.stepDt;
      this._simPos.y += this._simVel.y * this.stepDt;

      // Store this point
      points.push({
        position:  new Vector2(this._simPos.x, this._simPos.y),
        velocity:  new Vector2(this._simVel.x, this._simVel.y),
        stepIndex: step,
      });

      // Early exit: out of world bounds
      const distSq = this._simPos.x * this._simPos.x
                   + this._simPos.y * this._simPos.y;
      if (distSq > despawnSq) { break; }
    }

    this._lastTrajectory = points;
    return points;
  }

  /**
   * Get the last computed trajectory (cached — no re-simulation).
   * Use when aim hasn't changed this frame.
   */
  getLastTrajectory(): TrajectoryPoint[] {
    return this._lastTrajectory;
  }

  /**
   * Clear the cached trajectory (e.g. when not aiming).
   */
  clearTrajectory(): void {
    this._lastTrajectory = [];
  }

  // ─── Configuration ────────────────────────────────────────────────────────

  setSteps(steps: number): void {
    this.steps = steps;
  }

  setStepDt(dt: number): void {
    this.stepDt = dt;
  }
}