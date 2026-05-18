// src/entities/enemies/DroneEnemy.ts
//
// Basic enemy — flies toward the station and rams it.
//
// AI BEHAVIOR:
//   Every update tick, apply a steering force toward the station (world origin).
//   The force is proportional to distance — closer = weaker correction.
//   This produces natural-looking curved approach paths under gravity.
//
// PHYSICS:
//   DroneEnemy is fully physics-simulated — gravity affects it.
//   The AI steering force works WITH gravity, not against it.
//   Result: drones spiral inward following curved paths, not straight lines.

import { EnemyBase } from '@entities/enemies/EnemyBase';
import { Vector2 } from '@utils/Vector2';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { MathUtils } from '@utils/MathUtils';

export class DroneEnemy extends EnemyBase {
  private steeringForce: number = 800; // Toward station per second

  constructor() {
    super();
    this.maxHealth  = 2;
    this.health     = 2;
    this.moveSpeed  = 200;
    this.scoreValue = 200;
    this.damage     = 30;
    this.collider.radius = PhysicsConfig.RADIUS_ENEMY_DRONE;
    this.setMass(PhysicsConfig.MASS_ENEMY_DRONE);
  }

  init(position: Vector2, velocity: Vector2): void {
    this.baseInit(position, velocity);
  }

  override reset(): void {
    super.reset();
    this.health = this.maxHealth;
  }

  // ─── AI Update ────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    if (!this.active || this.isDead) { return; }

    const dt = deltaMs / 1000;

    // Steer toward world origin (station position)
    const toStation = this.transform.position.negated().normalized();

    // Apply steering as a force — works alongside gravity
    const steer = toStation.scale(this.steeringForce * this.rigidbody.mass);
    this.addForce(steer);

    // Slight random jitter to prevent perfectly straight approaches
    const jitter = new Vector2(
      MathUtils.randomRange(-50, 50),
      MathUtils.randomRange(-50, 50)
    );
    this.addForce(jitter.scale(this.rigidbody.mass));
  }

  onDestroy(): void {}
}