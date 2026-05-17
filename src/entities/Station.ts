// src/entities/Station.ts
//
// Player's space station — the entity the player defends.
// Static position (center of world), rotates to aim turret.
// Has health and a rechargeable shield.

import { BaseEntity } from '@entities/BaseEntity';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { BalanceConfig } from '@config/BalanceConfig';
import { Tags, CollisionCategory } from '@utils/Constants';
import { Timer } from '@utils/Timer';
import { Vector2 } from '@utils/Vector2';

export class Station extends BaseEntity {
  // Turret aim angle (radians) — tracks mouse position
  aimAngle: number = 0;

  // Shield
  shieldEnergy:  number  = 100;
  shieldActive:  boolean = false;
  shieldBroken:  boolean = false;

  // Shield regen delay timer (starts after shield is hit)
  private shieldRegenDelayTimer: Timer;
  private regenActive: boolean = false;

  constructor() {
    super();
    this.tag = Tags.STATION;

    // Station never moves — physics still applies for collision response
    // but we'll override position each frame to keep it centered
    this.rigidbody.isKinematic = true;
    this.rigidbody.isStatic    = true;

    this.maxHealth     = BalanceConfig.STATION_MAX_HEALTH;
    this.health        = this.maxHealth;
    this.shieldEnergy  = BalanceConfig.STATION_SHIELD_CAPACITY;

    this.collider.radius            = PhysicsConfig.RADIUS_STATION;
    this.collider.collisionCategory = CollisionCategory.STATION;
    this.collider.collisionMask     = CollisionCategory.ASTEROID
                                    | CollisionCategory.ENEMY;

    this.shieldRegenDelayTimer = new Timer(
      BalanceConfig.STATION_SHIELD_REGEN_DELAY_MS
    );
  }

  init(position: Vector2): void {
    this.active        = true;  
    this.transform.position.copyFrom(position);
    this.transform.prevPosition.copyFrom(position);
    this.health        = this.maxHealth;
    this.shieldEnergy  = BalanceConfig.STATION_SHIELD_CAPACITY;
    this.shieldActive  = false;
    this.shieldBroken  = false;
    this.regenActive   = false;
    this.isDead        = false;
    this.aimAngle      = 0;
  }

  override reset(): void {
    super.reset();
    this.aimAngle     = 0;
    this.shieldEnergy = BalanceConfig.STATION_SHIELD_CAPACITY;
    this.shieldActive = false;
    this.shieldBroken = false;
  }

  update(deltaMs: number): void {
    this.updateShield(deltaMs);
  }

  private updateShield(deltaMs: number): void {
    if (this.shieldBroken) {
      this.shieldRegenDelayTimer.update(deltaMs);
      if (this.shieldRegenDelayTimer.isComplete) {
        this.shieldBroken = false;
        this.regenActive  = true;
      }
      return;
    }

    if (this.regenActive || (!this.shieldActive && this.shieldEnergy < BalanceConfig.STATION_SHIELD_CAPACITY)) {
      const regenAmount = BalanceConfig.STATION_SHIELD_REGEN_RATE * (deltaMs / 1000);
      this.shieldEnergy = Math.min(
        BalanceConfig.STATION_SHIELD_CAPACITY,
        this.shieldEnergy + regenAmount
      );
      if (this.shieldEnergy >= BalanceConfig.STATION_SHIELD_CAPACITY) {
        this.regenActive = false;
      }
    }
  }

  /** Called when shield absorbs a hit */
  hitShield(damage: number): boolean {
    if (this.shieldBroken || !this.shieldActive) { return false; }

    this.shieldEnergy -= damage;
    this.shieldRegenDelayTimer.start();

    if (this.shieldEnergy <= 0) {
      this.shieldEnergy = 0;
      this.shieldBroken = true;
      this.shieldActive = false;
      return true; // Shield broke
    }
    return false;
  }

  onDestroy(): void {}

  get shieldPercent(): number {
    return this.shieldEnergy / BalanceConfig.STATION_SHIELD_CAPACITY;
  }
}