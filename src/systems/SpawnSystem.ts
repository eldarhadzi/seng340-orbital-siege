// src/systems/SpawnSystem.ts
//
// Entity spawner — calculates spawn positions and orbital entry velocities.
//
// SPAWN PATTERNS:
//   RADIAL      → Evenly distributed around the 360° spawn ring
//   DIRECTIONAL → All from one 60° sector (focused attack)
//   CLUSTER     → 2-4 entities close together at random position
//
// ORBITAL ENTRY:
// Entities don't teleport in — they enter with velocities that
// bring them into the play area naturally under gravity influence.
// SpawnSystem uses GravitySystem.getCircularOrbitSpeed() to
// calculate a realistic initial velocity with a small inward component
// to ensure entities actually enter the arena.

import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { GravitySystem } from '@systems/GravitySystem';
import { ObjectPool } from '@utils/ObjectPool';
import { Asteroid } from '@entities/Asteroid';
import { DroneEnemy } from '@entities/enemies/DroneEnemy';
import { entityManager } from '@managers/EntityManager';
import { AsteroidSize, EnemyType, SpawnPattern, WaveDefinition } from '@typedefs/GameTypes';

export class SpawnSystem {
  private gravitySystem:  GravitySystem;
  private asteroidPool:   ObjectPool<Asteroid>;
  private dronePool:      ObjectPool<DroneEnemy>;

  // Spawn queue — entities are spawned gradually, not all at once
  private spawnQueue:     SpawnQueueEntry[] = [];
  private spawnTimer:     number = 0;
  private spawnIntervalMs: number = 800;
  private gravityMultiplier: number = 1.0;

  constructor(
    gravitySystem: GravitySystem,
    asteroidPool:  ObjectPool<Asteroid>,
    dronePool:     ObjectPool<DroneEnemy>
  ) {
    this.gravitySystem = gravitySystem;
    this.asteroidPool  = asteroidPool;
    this.dronePool     = dronePool;
  }

  // ─── Queue Wave ───────────────────────────────────────────────────────────

  /**
   * Queue all entities from a wave definition for gradual spawning.
   * Entities are spawned one-by-one at spawnIntervalMs intervals.
   */
  queueWave(wave: WaveDefinition): void {
    this.spawnQueue      = [];
    this.spawnTimer      = 0;
    this.spawnIntervalMs = wave.spawnIntervalMs;
    this.gravityMultiplier = wave.gravityMultiplier;

    const pattern = wave.spawnPattern;

    // Queue asteroids
    const sectorAngle = pattern === SpawnPattern.DIRECTIONAL
      ? MathUtils.randomRange(0, Math.PI * 2)
      : 0;

    for (let i = 0; i < wave.asteroidCount; i++) {
      const size = wave.asteroidSizes[i % wave.asteroidSizes.length] as AsteroidSize;
      const pos  = this.calculateSpawnPosition(pattern, i, wave.asteroidCount, sectorAngle);

      this.spawnQueue.push({ type: 'asteroid', size, position: pos });
    }

    // Queue enemies
    for (let i = 0; i < wave.enemyCount; i++) {
      const enemyType = wave.enemyTypes[i % wave.enemyTypes.length] as EnemyType;
      const pos = this.calculateSpawnPosition(
        SpawnPattern.RADIAL, i, wave.enemyCount, 0
      );
      this.spawnQueue.push({ type: 'enemy', enemyType, position: pos });
    }

    // Shuffle so asteroids and enemies interleave
    MathUtils.shuffle(this.spawnQueue);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Process spawn queue — spawn one entity per interval.
   * @returns Number of entities spawned this tick
   */
  update(deltaMs: number): number {
    if (this.spawnQueue.length === 0) { return 0; }

    this.spawnTimer += deltaMs;
    let spawned = 0;

    while (this.spawnTimer >= this.spawnIntervalMs && this.spawnQueue.length > 0) {
      const entry = this.spawnQueue.shift()!;
      this.spawnEntry(entry);
      this.spawnTimer -= this.spawnIntervalMs;
      spawned++;
    }

    return spawned;
  }

  get queueLength(): number { return this.spawnQueue.length; }
  get isQueueEmpty(): boolean { return this.spawnQueue.length === 0; }

  // ─── Spawn Logic ──────────────────────────────────────────────────────────

  private spawnEntry(entry: SpawnQueueEntry): void {
    if (entry.type === 'asteroid' && entry.size) {
      this.spawnAsteroid(entry.position, entry.size);
    } else if (entry.type === 'enemy' && entry.enemyType) {
      this.spawnEnemy(entry.position, entry.enemyType);
    }
  }

  private spawnAsteroid(position: Vector2, size: AsteroidSize): void {
    const asteroid = this.asteroidPool.acquire();
    if (!asteroid) { return; }

    const vel = this.calculateOrbitalEntryVelocity(position);
    asteroid.init(position, vel, size);
    entityManager.register(asteroid);
  }

  private spawnEnemy(position: Vector2, type: EnemyType): void {
    if (type === EnemyType.DRONE) {
      const drone = this.dronePool.acquire();
      if (!drone) { return; }

      const vel = this.calculateOrbitalEntryVelocity(position);
      drone.init(position, vel);
      entityManager.register(drone);
    }
  }

  // ─── Spawn Position Calculation ───────────────────────────────────────────

  private calculateSpawnPosition(
    pattern:     SpawnPattern,
    index:       number,
    total:       number,
    sectorAngle: number
  ): Vector2 {
    const r = PhysicsConfig.SPAWN_RADIUS;
    let angle: number;

    switch (pattern) {
      case SpawnPattern.RADIAL:
        // Evenly distributed around full circle with random jitter
        angle = (index / total) * Math.PI * 2
              + MathUtils.randomRange(-0.3, 0.3);
        break;

      case SpawnPattern.DIRECTIONAL:
        // All within a 60° sector
        angle = sectorAngle + MathUtils.randomRange(
          -Math.PI / 6, Math.PI / 6
        );
        break;

      case SpawnPattern.CLUSTER:
        // Small cluster around a random base angle
        const clusterBase = MathUtils.randomRange(0, Math.PI * 2);
        angle = clusterBase + MathUtils.randomRange(-0.4, 0.4);
        break;

      default:
        angle = MathUtils.randomRange(0, Math.PI * 2);
    }

    const spawnR = r + MathUtils.randomRange(-50, 50);
    return new Vector2(
      Math.cos(angle) * spawnR,
      Math.sin(angle) * spawnR
    );
  }

  /**
   * Calculate orbital entry velocity for an entity at the given position.
   *
   * Strategy:
   *   1. Get circular orbit speed at this radius
   *   2. Apply tangential component (orbit direction)
   *   3. Add small inward radial component to ensure entity drifts inward
   *   4. Add random perturbation for visual variety
   */
  private calculateOrbitalEntryVelocity(position: Vector2): Vector2 {
    const r         = position.magnitude();
    const orbitSpeed = this.gravitySystem.getCircularOrbitSpeed(
      r, 'central_star', this.gravityMultiplier
    );

    // Tangential component — orbit direction
    const clockwise = MathUtils.randomBool(0.5);
    const tangent   = this.gravitySystem.getOrbitalTangent(
      position, 'central_star', clockwise
    );

    // Speed: 70-90% of circular orbit speed (slightly sub-orbital → drifts inward)
    const speedFactor = MathUtils.randomRange(0.70, 0.90);
    const tangentVel  = tangent.scale(orbitSpeed * speedFactor);

    // Small inward radial component to guarantee arena entry
    const inward    = position.normalized().negated().scale(
      MathUtils.randomRange(20, 60)
    );

    return tangentVel.add(inward);
  }

  clearQueue(): void {
    this.spawnQueue = [];
    this.spawnTimer = 0;
  }
}

interface SpawnQueueEntry {
  type:       'asteroid' | 'enemy';
  size?:      AsteroidSize;
  enemyType?: EnemyType;
  position:   Vector2;
}