// src/entities/enemies/EnemyBase.ts
//
// Abstract base class for all enemy types.

import { BaseEntity } from '@entities/BaseEntity';
import { Tags, CollisionCategory } from '@utils/Constants';
import { Vector2 } from '@utils/Vector2';
import { PhysicsConfig } from '@config/PhysicsConfig';

export abstract class EnemyBase extends BaseEntity {
  moveSpeed:   number = 150;
  scoreValue:  number = 200;
  damage:      number = 30;

  constructor() {
    super();
    this.tag = Tags.ENEMY;
  }

  baseInit(position: Vector2, velocity: Vector2): void {
    this.active  = true;
    this.isDead  = false;
    this.health  = this.maxHealth;

    this.transform.position.copyFrom(position);
    this.transform.prevPosition.copyFrom(position);
    this.rigidbody.velocity.copyFrom(velocity);
    this.rigidbody.drag        = PhysicsConfig.DRAG_ENEMY;
    this.rigidbody.restitution = 0.3;

    this.collider.collisionCategory = CollisionCategory.ENEMY;
    this.collider.collisionMask     = CollisionCategory.STATION
                                    | CollisionCategory.PROJECTILE;
  }

  abstract init(position: Vector2, velocity: Vector2): void;
}