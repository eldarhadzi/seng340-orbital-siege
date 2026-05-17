// src/entities/Projectile.ts
//
// Projectile entity — fired by the player station.
// Gravity-affected (missiles curve toward gravity well).
// Pooled: 100 instances pre-created, reused without GC.

import { BaseEntity } from '@entities/BaseEntity';
import { WeaponType } from '@typedefs/GameTypes';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { BalanceConfig } from '@config/BalanceConfig';
import { Tags, CollisionCategory } from '@utils/Constants';
import { Vector2 } from '@utils/Vector2';
import { CooldownTimer } from '@utils/Timer';

export class Projectile extends BaseEntity {
  weaponType:  WeaponType = WeaponType.CANNON;
  damage:      number     = 0;
  ownerId:     string     = '';

  // Lifetime timer — projectile expires if it doesn't hit anything
  private lifetimeTimer: CooldownTimer;
  hasExpired: boolean = false;

  constructor() {
    super();
    this.tag = Tags.PROJECTILE;
    this.lifetimeTimer = new CooldownTimer(BalanceConfig.CANNON_LIFETIME_MS);
  }

  init(
    position: Vector2,
    velocity: Vector2,
    weaponType: WeaponType,
    damage: number,
    ownerId: string
  ): void {
    this.weaponType  = weaponType;
    this.damage      = damage;
    this.ownerId     = ownerId;
    this.hasExpired  = false;

    this.transform.position.copyFrom(position);
    this.transform.prevPosition.copyFrom(position);

    this.rigidbody.velocity.copyFrom(velocity);
    this.rigidbody.restitution = PhysicsConfig.RESTITUTION_PROJECTILE;
    this.rigidbody.drag        = PhysicsConfig.DRAG_PROJECTILE;

    this.setMass(PhysicsConfig.MASS_PROJECTILE);
    this.collider.radius = PhysicsConfig.RADIUS_PROJECTILE;

    this.collider.collisionCategory = CollisionCategory.PROJECTILE;
    this.collider.collisionMask     = CollisionCategory.ASTEROID
                                    | CollisionCategory.ENEMY;

    // Set lifetime based on weapon type
    const lifetime = weaponType === WeaponType.MISSILE
      ? BalanceConfig.MISSILE_LIFETIME_MS
      : BalanceConfig.CANNON_LIFETIME_MS;

    this.lifetimeTimer = new CooldownTimer(lifetime);
    this.lifetimeTimer.trigger();
  }

  override reset(): void {
    super.reset();
    this.hasExpired = false;
    this.ownerId    = '';
    this.damage     = 0;
  }

  update(deltaMs: number): void {
    if (!this.active) { return; }
    this.lifetimeTimer.update(deltaMs);
    if (this.lifetimeTimer.isReady) {
      this.hasExpired = true;
    }
  }

  onDestroy(): void {}
}