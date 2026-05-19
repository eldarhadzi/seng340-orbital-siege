// src/systems/CollisionSystem.ts
//
// Collision detection and response system.
//
// PIPELINE (runs each physics tick):
//
//   BROAD PHASE  → QuadTree spatial partitioning
//                  Input:  all active entities
//                  Output: candidate pairs (may be colliding)
//                  Cost:   O(n log n)
//
//   NARROW PHASE → Circle vs Circle precise test
//                  Input:  candidate pairs from broad phase
//                  Output: CollisionManifold (if actually colliding)
//                  Cost:   O(k) where k << n²
//
//   RESOLUTION   → Impulse-based velocity correction
//                  Input:  CollisionManifold
//                  Output: modified velocities + separated positions
//
// IMPULSE FORMULA (from Rigid Body Dynamics theory):
//
//   j = -(1 + e) * (vRel · n)
//       ─────────────────────────
//       (1/mA) + (1/mB)
//
//   velA += (j / mA) * n
//   velB -= (j / mB) * n
//
//   Where:
//     j    = impulse magnitude (scalar)
//     e    = restitution coefficient (elasticity)
//     vRel = velocity of A relative to B
//     n    = collision normal (unit vector from B toward A)
//     mA   = mass of entity A
//     mB   = mass of entity B
//
// POSITION CORRECTION:
// After impulse, objects may still overlap slightly.
// We apply a positional correction to prevent "sinking":
//   correction = max(penetration - slop, 0) / (1/mA + 1/mB) * percent * n
//   posA += (1/mA) * correction
//   posB -= (1/mB) * correction

import { Vector2 } from '@utils/Vector2';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { CollisionManifold } from '@typedefs/GameTypes';
import { BaseEntity } from '@entities/BaseEntity';
import { QuadTree, QuadTreeItem } from '@systems/QuadTree';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export class CollisionSystem {
  private quadTree: QuadTree;

  // Pre-allocated vectors for resolution (avoid GC in hot path)
  private _relVel:      Vector2 = new Vector2();
  private _correction:  Vector2 = new Vector2();

  // Statistics (for debug overlay)
  broadPhasePairs:    number = 0;
  narrowPhaseHits:    number = 0;
  resolvedThisTick:   number = 0;

  constructor() {
    // World bounds: centered at (0,0), 2400×2400 pixels
    // Larger than visible screen to accommodate off-screen entities
    this.quadTree = new QuadTree(
      { x: -1200, y: -1200, width: 2400, height: 2400 },
      PhysicsConfig.QUADTREE_CAPACITY,
      PhysicsConfig.QUADTREE_MAX_DEPTH
    );
  }

  // ─── Main Update ──────────────────────────────────────────────────────────

  /**
   * Run the full collision pipeline for one physics tick.
   * @param entities All active entities in the simulation
   */
  update(entities: BaseEntity[]): void {
    this.broadPhasePairs  = 0;
    this.narrowPhaseHits  = 0;
    this.resolvedThisTick = 0;

    if (entities.length < 2) { return; }

    // ── Broad Phase: Build QuadTree ─────────────────────────────────────────
    this.quadTree.clear();

    const qtItems: QuadTreeItem[] = entities.map(e => ({
      id:       e.id,
      position: e.transform.position,
      radius:   e.collider.radius,
    }));

    this.quadTree.insertAll(qtItems);

    // ── Get Candidate Pairs ─────────────────────────────────────────────────
    const pairs = this.quadTree.getCandidatePairs(qtItems);
    this.broadPhasePairs = pairs.length;

    // Build entity lookup map for O(1) access during resolution
    const entityMap = new Map<string, BaseEntity>();
    for (const e of entities) {
      entityMap.set(e.id, e);
    }

    // ── Narrow Phase + Resolution ───────────────────────────────────────────
    for (const [itemA, itemB] of pairs) {
      const entityA = entityMap.get(itemA.id);
      const entityB = entityMap.get(itemB.id);

      if (!entityA || !entityB) { continue; }
      if (!entityA.active || !entityB.active) { continue; }

      // Check collision mask compatibility:
      // Entity A must care about Entity B's category and vice versa
      const aCaresAboutB = (entityA.collider.collisionMask & entityB.collider.collisionCategory) !== 0;
      const bCaresAboutA = (entityB.collider.collisionMask & entityA.collider.collisionCategory) !== 0;

      if (!aCaresAboutB && !bCaresAboutA) { continue; }

      // ── Narrow Phase: Circle vs Circle ────────────────────────────────────
      const manifold = this.testCircleVsCircle(entityA, entityB);
      if (!manifold) { continue; }

      this.narrowPhaseHits++;

      // ── Emit Collision Event ──────────────────────────────────────────────
      // Other systems (ScoreManager, AudioSystem, ParticleSystem) listen
      // and respond independently via EventBus.
      eventBus.emit(GameEvents.COLLISION_OCCURRED, manifold);

      // ── Resolution ───────────────────────────────────────────────────────
      // Trigger-only colliders don't get physical response
      if (!entityA.collider.isTrigger && !entityB.collider.isTrigger) {
        this.resolveCollision(entityA, entityB, manifold);
        this.resolvedThisTick++;
      }
    }
  }

  // ─── Narrow Phase ─────────────────────────────────────────────────────────

  /**
   * Circle vs Circle collision test.
   * Two circles collide when: distance between centers < sum of radii
   *
   * @returns CollisionManifold if colliding, null otherwise
   */
  testCircleVsCircle(
    entityA: BaseEntity,
    entityB: BaseEntity
  ): CollisionManifold | null {
    const posA = entityA.transform.position;
    const posB = entityB.transform.position;
    const rA   = entityA.collider.radius;
    const rB   = entityB.collider.radius;

    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    const distSq       = dx * dx + dy * dy;
    const combinedRad  = rA + rB;
    const combinedSq   = combinedRad * combinedRad;

    // Fast rejection: squared distance check avoids sqrt
    if (distSq >= combinedSq) { return null; }

    const distance = Math.sqrt(distSq);

    // Collision normal: unit vector from B toward A
    let normalX: number;
    let normalY: number;

    if (distance < 0.0001) {
      // Entities are on top of each other — push in arbitrary direction
      normalX = 1;
      normalY = 0;
    } else {
      normalX = dx / distance;
      normalY = dy / distance;
    }

    return {
      entityAId:        entityA.id,
      entityBId:        entityB.id,
      normal:           new Vector2(normalX, normalY),
      penetrationDepth: combinedRad - distance,
      contactPoint:     new Vector2(
        posB.x + normalX * rB,
        posB.y + normalY * rB
      ),
    };
  }

  // ─── Collision Resolution ─────────────────────────────────────────────────

  /**
   * Impulse-based collision resolution.
   *
   * Computes and applies an impulse that:
   *   1. Separates entities (no overlap after resolution)
   *   2. Modifies velocities to reflect the collision
   *   3. Respects restitution (elasticity) of both materials
   *
   * DERIVATION:
   * From conservation of momentum and the restitution condition:
   *   j = -(1 + e) * (vRel · n) / (invMassA + invMassB)
   *
   * Where e = min(restitutionA, restitutionB) (we use the lower value)
   */
  private resolveCollision(
    entityA: BaseEntity,
    entityB: BaseEntity,
    manifold: CollisionManifold
  ): void {
    const rbA = entityA.rigidbody;
    const rbB = entityB.rigidbody;

    // Static entities have infinite mass (inverseMass = 0)
    // Kinematic entities are not moved by collisions but still affect others
    const invMassA = rbA.isStatic ? 0 : rbA.inverseMass;
    const invMassB = rbB.isStatic ? 0 : rbB.inverseMass;

    // If both have infinite mass (both static), nothing to resolve
    if (invMassA + invMassB === 0) { return; }

    const n = manifold.normal;

    // Relative velocity of A with respect to B
    this._relVel.set(
      rbA.velocity.x - rbB.velocity.x,
      rbA.velocity.y - rbB.velocity.y
    );

    // Relative velocity along collision normal
    const velAlongNormal = this._relVel.x * n.x + this._relVel.y * n.y;

    // If entities are already separating, don't apply impulse
    // (prevents double-resolution on the same frame)
    if (velAlongNormal > 0) { return; }

    // Restitution: use the minimum of both materials
    const e = Math.min(rbA.restitution, rbB.restitution);

    // Impulse scalar
    // j = -(1 + e) * velAlongNormal / (invMassA + invMassB)
    const j = -(1 + e) * velAlongNormal / (invMassA + invMassB);

    // Apply impulse to velocities
    if (!rbA.isStatic && !rbA.isKinematic) {
      rbA.velocity.x += invMassA * j * n.x;
      rbA.velocity.y += invMassA * j * n.y;
    }
    if (!rbB.isStatic && !rbB.isKinematic) {
      rbB.velocity.x -= invMassB * j * n.x;
      rbB.velocity.y -= invMassB * j * n.y;
    }

    // ── Positional Correction ─────────────────────────────────────────────
    // After velocity correction, entities may still visually overlap.
    // We nudge positions apart by the penetration depth (minus a small slop
    // to prevent jitter on resting contacts).
    const penetration = manifold.penetrationDepth;
    const slop   = PhysicsConfig.POSITION_CORRECTION_SLOP;
    const percent = PhysicsConfig.POSITION_CORRECTION_PERCENT;

    const correctionMag = Math.max(penetration - slop, 0)
                        / (invMassA + invMassB)
                        * percent;

    this._correction.set(
      correctionMag * n.x,
      correctionMag * n.y
    );

    if (!rbA.isStatic) {
      entityA.transform.position.x += invMassA * this._correction.x;
      entityA.transform.position.y += invMassA * this._correction.y;
    }
    if (!rbB.isStatic) {
      entityB.transform.position.x -= invMassB * this._correction.x;
      entityB.transform.position.y -= invMassB * this._correction.y;
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /** Check if two entities are colliding (without resolving) */
  areColliding(entityA: BaseEntity, entityB: BaseEntity): boolean {
    return this.testCircleVsCircle(entityA, entityB) !== null;
  }

  /** Get the QuadTree for debug rendering */
  getQuadTree(): QuadTree {
    return this.quadTree;
  }
}