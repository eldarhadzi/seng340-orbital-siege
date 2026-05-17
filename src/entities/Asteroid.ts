// src/entities/Asteroid.ts
//
// Asteroid entity — the primary physics object in Orbital Siege.
//
// PHYSICS PROPERTIES:
//   - Affected by gravity (mass determines pull strength)
//   - Rotates with angular velocity (tumbling in space)
//   - Fragments on death (creates child entities)
//   - Elastic collision with other asteroids (e = 0.6)
//   - Inelastic collision with projectiles (absorbs impact)

import { BaseEntity } from '@entities/BaseEntity';
import { AsteroidSize } from '@typedefs/GameTypes';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { BalanceConfig } from '@config/BalanceConfig';
import { Tags, CollisionCategory } from '@utils/Constants';
import { MathUtils } from '@utils/MathUtils';
import { Vector2 } from '@utils/Vector2';

export class Asteroid extends BaseEntity {
  size:           AsteroidSize = AsteroidSize.LARGE;
  asteroidVariant: number = 0; // 0-2: visual variant

  constructor() {
    super();
    this.tag = Tags.ASTEROID;
  }

  /**
   * Initialize this asteroid with spawn data.
   * Called after acquiring from ObjectPool.
   */
  init(
    position: Vector2,
    velocity: Vector2,
    size: AsteroidSize,
    angularVelocity?: number,
    variant?: number
  ): void {
    this.size            = size;
    this.asteroidVariant = variant ?? MathUtils.randomInt(0, 2);

    // Position
    this.transform.position.copyFrom(position);
    this.transform.prevPosition.copyFrom(position);

    // Random rotation
    this.transform.rotation = MathUtils.randomRange(0, Math.PI * 2);

    // Configure physics based on size
    this.applyPhysicsForSize(size);

    // Velocity
    this.rigidbody.velocity.copyFrom(velocity);

    // Angular velocity: tumble naturally
    this.rigidbody.angularVelocity = angularVelocity
      ?? MathUtils.randomRange(
           PhysicsConfig.ANGULAR_VELOCITY_MIN,
           PhysicsConfig.ANGULAR_VELOCITY_MAX
         ) * MathUtils.randomSign();

    // Collision mask: asteroids collide with each other, station, projectiles
    this.collider.collisionCategory = CollisionCategory.ASTEROID;
    this.collider.collisionMask     = CollisionCategory.ASTEROID
                                    | CollisionCategory.STATION
                                    | CollisionCategory.PROJECTILE
                                    | CollisionCategory.SHIELD;
  }

  private applyPhysicsForSize(size: AsteroidSize): void {
    switch (size) {
      case AsteroidSize.LARGE:
        this.setMass(PhysicsConfig.MASS_ASTEROID_LARGE);
        this.collider.radius   = PhysicsConfig.RADIUS_ASTEROID_LARGE;
        this.maxHealth         = 3;
        this.health            = 3;
        this.rigidbody.restitution = PhysicsConfig.RESTITUTION_ASTEROID_ASTEROID;
        this.rigidbody.drag    = PhysicsConfig.DRAG_ASTEROID;
        break;

      case AsteroidSize.MEDIUM:
        this.setMass(PhysicsConfig.MASS_ASTEROID_MEDIUM);
        this.collider.radius   = PhysicsConfig.RADIUS_ASTEROID_MEDIUM;
        this.maxHealth         = 2;
        this.health            = 2;
        this.rigidbody.restitution = PhysicsConfig.RESTITUTION_ASTEROID_ASTEROID;
        this.rigidbody.drag    = PhysicsConfig.DRAG_ASTEROID;
        break;

      case AsteroidSize.SMALL:
        this.setMass(PhysicsConfig.MASS_ASTEROID_SMALL);
        this.collider.radius   = PhysicsConfig.RADIUS_ASTEROID_SMALL;
        this.maxHealth         = 1;
        this.health            = 1;
        this.rigidbody.restitution = PhysicsConfig.RESTITUTION_ASTEROID_ASTEROID;
        this.rigidbody.drag    = PhysicsConfig.DRAG_ASTEROID;
        break;
    }
  }

  override reset(): void {
    super.reset();
    this.size = AsteroidSize.LARGE;
    this.asteroidVariant = 0;
  }

  update(_deltaMs: number): void {
    // Asteroid behavior is handled entirely by PhysicsSystem.
    // No additional per-tick logic needed at this stage.
  }

  onDestroy(): void {
    // Fragmentation and event emission handled by GameScene
    // when it detects asteroid.isDead === true after physics step.
  }

  /** Score value for destroying this asteroid */
  get scoreValue(): number {
    switch (this.size) {
      case AsteroidSize.LARGE:  return BalanceConfig.SCORE_ASTEROID_LARGE;
      case AsteroidSize.MEDIUM: return BalanceConfig.SCORE_ASTEROID_MEDIUM;
      case AsteroidSize.SMALL:  return BalanceConfig.SCORE_ASTEROID_SMALL;
    }
  }

  /** What this asteroid fragments into on death */
  get fragmentSize(): AsteroidSize | null {
    switch (this.size) {
      case AsteroidSize.LARGE:  return AsteroidSize.MEDIUM;
      case AsteroidSize.MEDIUM: return AsteroidSize.SMALL;
      case AsteroidSize.SMALL:  return null; // No fragments
    }
  }

  get fragmentCount(): number {
    switch (this.size) {
      case AsteroidSize.LARGE:  return PhysicsConfig.FRAGMENT_COUNT_LARGE_TO_MEDIUM;
      case AsteroidSize.MEDIUM: return PhysicsConfig.FRAGMENT_COUNT_MEDIUM_TO_SMALL;
      case AsteroidSize.SMALL:  return 0;
    }
  }
}