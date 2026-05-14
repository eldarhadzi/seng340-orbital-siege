// src/entities/BaseEntity.ts
//
// Abstract base class for every game object in Orbital Siege.
//
// ARCHITECTURE:
// All game entities (Station, Asteroid, Projectile, Enemy, Collectible)
// extend this class. It provides:
//   1. A unique ID for each entity
//   2. Transform component (position, rotation, scale)
//   3. Rigidbody component (physics data)
//   4. Collider component (collision shape)
//   5. Object pool interface (active flag + reset())
//   6. Tag system (for EntityManager queries)
//
// COMPONENT DESIGN:
// We don't use a pure ECS (which would be overkill for this project).
// Instead, the base class holds the core components as plain objects.
// Subclasses add game-specific data on top.
//
// PHYSICS RELEVANCE:
// The IRigidbody component stores ALL physics state:
//   - velocity: updated by PhysicsSystem every tick
//   - acceleration: set by GravitySystem, cleared after integration
//   - forces: accumulated by GravitySystem, summed into acceleration
//   - prevPosition: stored before integration for render interpolation

import { Vector2 } from '@utils/Vector2';
import { ITransform, IRigidbody, ICircleCollider } from '@typedefs/GameTypes';
import { Poolable } from '@utils/ObjectPool';
import { CollisionCategory } from '@utils/Constants';

let _entityIdCounter = 0;

/** Generate a unique entity ID */
function generateEntityId(): string {
  return `entity_${++_entityIdCounter}_${Date.now()}`;
}

export abstract class BaseEntity implements Poolable {
  // ─── Identity ─────────────────────────────────────────────────────────────
  readonly id: string;
  tag: string = 'entity';

  // ─── Pool Interface ────────────────────────────────────────────────────────
  active: boolean = false;

  // ─── Transform Component ──────────────────────────────────────────────────
  transform: ITransform = {
    position:     new Vector2(0, 0),
    prevPosition: new Vector2(0, 0),
    rotation:     0,
    prevRotation: 0,
    scale:        new Vector2(1, 1),
  };

  // ─── Rigidbody Component ──────────────────────────────────────────────────
  rigidbody: IRigidbody = {
    velocity:        new Vector2(0, 0),
    acceleration:    new Vector2(0, 0),
    mass:            1,
    inverseMass:     1,
    restitution:     0.5,
    drag:            0,
    angularVelocity: 0,
    isKinematic:     false,
    isStatic:        false,
    forces:          [],
  };

  // ─── Collider Component ───────────────────────────────────────────────────
  collider: ICircleCollider = {
    radius:            20,
    offset:            new Vector2(0, 0),
    collisionCategory: CollisionCategory.NONE,
    collisionMask:     CollisionCategory.NONE,
    isTrigger:         false,
  };

  // ─── State ────────────────────────────────────────────────────────────────
  health:    number = 100;
  maxHealth: number = 100;
  isDead:    boolean = false;

  constructor() {
    this.id = generateEntityId();
  }

  // ─── Pool Interface ────────────────────────────────────────────────────────

  /**
   * Called by ObjectPool when this entity is acquired.
   * Subclasses MUST call super.reset() then set their own defaults.
   *
   * This method resets ALL physics state so old data from a previous
   * life doesn't bleed into the new one.
   */
  reset(): void {
    // Transform
    this.transform.position.set(0, 0);
    this.transform.prevPosition.set(0, 0);
    this.transform.rotation     = 0;
    this.transform.prevRotation = 0;
    this.transform.scale.set(1, 1);

    // Rigidbody
    this.rigidbody.velocity.set(0, 0);
    this.rigidbody.acceleration.set(0, 0);
    this.rigidbody.angularVelocity = 0;
    this.rigidbody.forces          = [];
    this.rigidbody.isKinematic     = false;
    this.rigidbody.isStatic        = false;

    // State
    this.health  = this.maxHealth;
    this.isDead  = false;
    this.active  = true;
  }

  // ─── Physics Helpers ──────────────────────────────────────────────────────

  /** Add a force to this entity's accumulator (applied next physics tick) */
  addForce(force: Vector2): void {
    if (this.rigidbody.isStatic || this.rigidbody.isKinematic) { return; }
    this.rigidbody.forces.push(force.clone());
  }

  /** Apply an instantaneous impulse (changes velocity immediately) */
  applyImpulse(impulse: Vector2): void {
    if (this.rigidbody.isStatic) { return; }
    this.rigidbody.velocity.x += impulse.x * this.rigidbody.inverseMass;
    this.rigidbody.velocity.y += impulse.y * this.rigidbody.inverseMass;
  }

  /** Set mass and auto-update inverseMass */
  setMass(mass: number): void {
    this.rigidbody.mass = mass;
    this.rigidbody.inverseMass = mass > 0 ? 1 / mass : 0;
  }

  /** Get the world-space center of this entity's collider */
  getColliderCenter(): Vector2 {
    return new Vector2(
      this.transform.position.x + this.collider.offset.x,
      this.transform.position.y + this.collider.offset.y
    );
  }

  // ─── Health System ────────────────────────────────────────────────────────

  takeDamage(amount: number): boolean {
    if (this.isDead) { return false; }
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.isDead = true;
      return true; // Returns true if this damage was lethal
    }
    return false;
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  get healthPercent(): number {
    return this.maxHealth > 0 ? this.health / this.maxHealth : 0;
  }

  // ─── Abstract Interface ───────────────────────────────────────────────────

  /**
   * Called every game logic update tick.
   * Subclasses implement their specific behavior here.
   * @param deltaMs Delta time in milliseconds
   */
  abstract update(deltaMs: number): void;

  /**
   * Called when this entity is destroyed.
   * Subclasses handle death effects, drops, fragmentation, etc.
   */
  abstract onDestroy(): void;
}