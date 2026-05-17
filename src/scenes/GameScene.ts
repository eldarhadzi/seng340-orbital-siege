// src/scenes/GameScene.ts
//
// PRIMARY SIMULATION SCENE — the game loop director.
// Owns and coordinates all systems. Renders the game world.

import Phaser from 'phaser';
import { SceneKeys, Tags, GameEvents } from '@utils/Constants';
import { RenderConfig } from '@config/RenderConfig';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { GravitySystem } from '@systems/GravitySystem';
import { CollisionSystem } from '@systems/CollisionSystem';
import { PhysicsSystem } from '@systems/PhysicsSystem';
import { TrajectorySystem } from '@systems/TrajectorySystem';
import { CameraSystem } from '@systems/CameraSystem';
import { ParticleSystem } from '@systems/ParticleSystem';
import { RenderSystem } from '@systems/RenderSystem';
import { entityManager } from '@managers/EntityManager';
import { hudData } from '@managers/HUDDataModel';
import { eventBus } from '@managers/EventManager';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { ObjectPool } from '@utils/ObjectPool';
import { Asteroid } from '@entities/Asteroid';
import { Projectile } from '@entities/Projectile';
import { Station } from '@entities/Station';
import { AsteroidSize, WeaponType } from '@typedefs/GameTypes';
import { TrajectoryPoint } from '@typedefs/PhysicsTypes';
import { CooldownTimer } from '@utils/Timer';

export class GameScene extends Phaser.Scene {
  // ── Systems ─────────────────────────────────────────────────────────────
  private gravitySystem!:    GravitySystem;
  private collisionSystem!:  CollisionSystem;
  private physicsSystem!:    PhysicsSystem;
  private trajectorySystem!: TrajectorySystem;
  private cameraSystem!:     CameraSystem;
  private particleSystem!:   ParticleSystem;
  private renderSystem!:     RenderSystem;

  // ── Entity Pools ─────────────────────────────────────────────────────────
  private asteroidPool!:    ObjectPool<Asteroid>;
  private projectilePool!:  ObjectPool<Projectile>;

  // ── Core Entities ────────────────────────────────────────────────────────
  private station!: Station;

  // ── State ────────────────────────────────────────────────────────────────
  private trajectory:       TrajectoryPoint[] = [];
  private renderAlpha:      number = 0;
  private fireTimer:        CooldownTimer = new CooldownTimer(250);
  private trailTimer:       CooldownTimer = new CooldownTimer(50);
  private spawnTimer:       CooldownTimer = new CooldownTimer(2000);
  private score:            number = 0;

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!:    Phaser.Types.Input.Keyboard.CursorKeys;
  private mouseWorld:  Vector2 = new Vector2();

  constructor() {
    super({ key: SceneKeys.GAME });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    entityManager.clear();

    // ── Initialize Systems ─────────────────────────────────────────────────
    this.gravitySystem    = new GravitySystem();
    this.collisionSystem  = new CollisionSystem();
    this.physicsSystem    = new PhysicsSystem(this.gravitySystem, this.collisionSystem);
    this.trajectorySystem = new TrajectorySystem(this.gravitySystem);
    this.cameraSystem     = new CameraSystem(this);
    this.particleSystem   = new ParticleSystem();
    this.renderSystem     = new RenderSystem(this, this.cameraSystem, this.particleSystem);
    this.renderSystem.init();

    // ── Gravity Well ───────────────────────────────────────────────────────
    this.gravitySystem.addSource({
      id:          'central_star',
      position:    new Vector2(0, 0),
      mass:        PhysicsConfig.GRAVITY_WELL_MASS,
      minDistance: PhysicsConfig.GRAVITY_MIN_DISTANCE,
      maxDistance: PhysicsConfig.GRAVITY_MAX_DISTANCE,
      active:      true,
    });

    // ── Object Pools ───────────────────────────────────────────────────────
    this.asteroidPool   = new ObjectPool(() => new Asteroid(),   20, 80, 'Asteroids');
    this.projectilePool = new ObjectPool(() => new Projectile(), 50, 100, 'Projectiles');

    // ── Station ────────────────────────────────────────────────────────────
    this.station = new Station();
    this.station.init(new Vector2(0, 0));
    entityManager.register(this.station);

    // ── Spawn Initial Asteroids ────────────────────────────────────────────
    this.spawnWaveAsteroids(5);

    // ── Input ──────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();

    // Debug toggle — D key
    this.input.keyboard!.on('keydown-D', () => {
      this.renderSystem.toggleDebug();
    });

    // ── Event Listeners ────────────────────────────────────────────────────
    this.setupEventListeners();

    // ── Initial trajectory preview ─────────────────────────────────────────
    this.updateTrajectory();

    console.log('[GameScene] Game world initialized. Press D for debug overlay.');
  }

  // ─── Event Wiring ─────────────────────────────────────────────────────────

  private setupEventListeners(): void {
    // Out-of-bounds entities
    eventBus.on(GameEvents.ENTITY_DESTROYED, (data: unknown) => {
      const d = data as { entityId: string; tag: string; reason: string };
      if (d.reason === 'out_of_bounds') {
        const entity = entityManager.getById(d.entityId);
        if (entity) {
          entityManager.unregister(entity);
          entity.active = false;
        }
      }
    });

    // Collisions → screen shake + particles
    eventBus.on(GameEvents.COLLISION_OCCURRED, (data: unknown) => {
      const manifold = data as { entityAId: string; entityBId: string; contactPoint: { x: number; y: number } };
      this.cameraSystem.addTrauma(0.15);
      this.particleSystem.spawnTrail(
        manifold.contactPoint.x,
        manifold.contactPoint.y,
        0xff8833
      );
    });
  }

  // ─── Spawning ─────────────────────────────────────────────────────────────

  private spawnWaveAsteroids(count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnAsteroid(
        i % 2 === 0 ? AsteroidSize.LARGE : AsteroidSize.MEDIUM
      );
    }
  }

  private spawnAsteroid(size: AsteroidSize): void {
    const asteroid = this.asteroidPool.acquire();
    if (!asteroid) { return; }

    // Spawn outside visible area
    const angle   = MathUtils.randomRange(0, Math.PI * 2);
    const spawnR  = PhysicsConfig.SPAWN_RADIUS * 0.6; // Closer for demo
    const pos     = new Vector2(
      Math.cos(angle) * spawnR,
      Math.sin(angle) * spawnR
    );

    // Circular orbit + perturbation
    const orbitSpeed = this.gravitySystem.getCircularOrbitSpeed(spawnR) * 0.85;
    const tangent    = this.gravitySystem.getOrbitalTangent(pos, 'central_star', true);
    const vel        = tangent.scale(orbitSpeed);

    asteroid.init(pos, vel, size);
    entityManager.register(asteroid);
  }

  private fireProjectile(): void {
    if (!this.fireTimer.isReady) { return; }

    const projectile = this.projectilePool.acquire();
    if (!projectile) { return; }

    const angle   = this.station.aimAngle;
    const spawnR  = this.station.collider.radius + 12;
    const pos     = new Vector2(
      Math.cos(angle) * spawnR,
      Math.sin(angle) * spawnR
    );
    const vel = new Vector2(
      Math.cos(angle) * 900,
      Math.sin(angle) * 900
    );

    projectile.init(pos, vel, WeaponType.CANNON, 18, this.station.id);
    entityManager.register(projectile);

    this.fireTimer.trigger();

    // Slight camera kick on fire
    this.cameraSystem.addTrauma(0.05);
  }

  // ─── Aim / Trajectory ─────────────────────────────────────────────────────

  private updateAim(): void {
    const pointer = this.input.activePointer;

    // Convert screen mouse to world coordinates
    this.mouseWorld = this.cameraSystem.screenToWorld(pointer.x, pointer.y);

    // Station aims at mouse (from world origin)
    this.station.aimAngle = Math.atan2(this.mouseWorld.y, this.mouseWorld.x);
  }

  private updateTrajectory(): void {
    const angle  = this.station.aimAngle;
    const spawnR = this.station.collider.radius + 12;
    const startPos = new Vector2(
      Math.cos(angle) * spawnR,
      Math.sin(angle) * spawnR
    );
    const startVel = new Vector2(
      Math.cos(angle) * 900,
      Math.sin(angle) * 900
    );

    this.trajectory = this.trajectorySystem.predict(startPos, startVel, 1.0);
  }

  // ─── Collision Response ───────────────────────────────────────────────────

  private processCollisionResults(): void {
    const asteroids   = entityManager.getByTag(Tags.ASTEROID) as Asteroid[];
    const projectiles = entityManager.getByTag(Tags.PROJECTILE) as Projectile[];

    // Check projectile hits
    for (const proj of projectiles) {
      if (!proj.active) { continue; }

      if (proj.hasExpired) {
        entityManager.unregister(proj);
        this.projectilePool.release(proj);
        continue;
      }

      for (const asteroid of asteroids) {
        if (!asteroid.active) { continue; }

        const manifold = this.collisionSystem.testCircleVsCircle(proj, asteroid);
        if (manifold) {
          this.handleProjectileHit(proj, asteroid);
          break;
        }
      }
    }

    // Check asteroid hits on station
    for (const asteroid of asteroids) {
      if (!asteroid.active) { continue; }
      const manifold = this.collisionSystem.testCircleVsCircle(asteroid, this.station);
      if (manifold) {
        const lethal = this.station.takeDamage(15);
        this.cameraSystem.addTrauma(0.4);
        this.cameraSystem.flash();
        this.particleSystem.explodeMediumAsteroid(
          asteroid.transform.position.x,
          asteroid.transform.position.y
        );
        entityManager.unregister(asteroid);
        this.asteroidPool.release(asteroid);

        if (lethal || this.station.isDead) {
          console.log('[GameScene] Station destroyed! Game Over.');
        }
      }
    }
  }

  private handleProjectileHit(
    projectile: Projectile,
    asteroid: Asteroid
  ): void {
    const pos = asteroid.transform.position;

    // Damage asteroid
    const lethal = asteroid.takeDamage(projectile.damage);

    // Spawn appropriate explosion
    if (asteroid.size === AsteroidSize.LARGE) {
      this.particleSystem.explodeLargeAsteroid(pos.x, pos.y);
    } else if (asteroid.size === AsteroidSize.MEDIUM) {
      this.particleSystem.explodeMediumAsteroid(pos.x, pos.y);
    } else {
      this.particleSystem.explodeSmallAsteroid(pos.x, pos.y);
    }

    this.cameraSystem.addTrauma(0.2);

    if (lethal) {
      // Spawn fragments
      const fragSize  = asteroid.fragmentSize;
      const fragCount = asteroid.fragmentCount;

      if (fragSize && fragCount > 0) {
        for (let i = 0; i < fragCount; i++) {
          const frag = this.asteroidPool.acquire();
          if (!frag) { continue; }

          const spreadAngle = MathUtils.randomRange(
            -PhysicsConfig.FRAGMENT_SPREAD_ANGLE / 2,
            PhysicsConfig.FRAGMENT_SPREAD_ANGLE / 2
          );
          const baseAngle = asteroid.rigidbody.velocity.angle() + spreadAngle;
          const speed     = asteroid.rigidbody.velocity.magnitude() * 0.6
                          + MathUtils.randomRange(40, 120);
          const fragVel   = Vector2.fromAngle(baseAngle).scale(speed);
          const fragPos   = pos.clone().add(
            Vector2.fromAngle(MathUtils.randomRange(0, Math.PI * 2)).scale(10)
          );

          frag.init(fragPos, fragVel, fragSize);
          entityManager.register(frag);
        }
      }

      // Update score
      this.score += asteroid.scoreValue;
      hudData.score = this.score;

      entityManager.unregister(asteroid);
      this.asteroidPool.release(asteroid);
    }

    // Remove projectile
    entityManager.unregister(projectile);
    this.projectilePool.release(projectile);
  }

  // ─── Main Game Loop ───────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    const entities = entityManager.getAll();

    // ── Input ──────────────────────────────────────────────────────────────
    this.updateAim();

    // Fire on left mouse held
    if (this.input.activePointer.isDown) {
      this.fireProjectile();
    }

    // ── Timers ─────────────────────────────────────────────────────────────
    this.fireTimer.update(delta);
    this.trailTimer.update(delta);
    this.spawnTimer.update(delta);

    // Auto-spawn asteroids for demo
    if (this.spawnTimer.isReady && entityManager.countByTag(Tags.ASTEROID) < 8) {
      this.spawnAsteroid(MathUtils.randomBool(0.3) ? AsteroidSize.LARGE : AsteroidSize.MEDIUM);
      this.spawnTimer.trigger();
    }

    // ── Entity updates ─────────────────────────────────────────────────────
    this.station.update(delta);
    for (const entity of entities) {
      entity.update(delta);
    }

    // ── Trail particles ────────────────────────────────────────────────────
    if (this.trailTimer.isReady) {
      for (const entity of entityManager.getByTag(Tags.PROJECTILE)) {
        const pos = entity.transform.position;
        this.particleSystem.spawnTrail(pos.x, pos.y, 0xffdd00);
      }
      this.trailTimer.trigger();
    }

    // ── Physics ────────────────────────────────────────────────────────────
    this.renderAlpha = this.physicsSystem.update(delta, entityManager.getAll());

    // ── Collision Response ─────────────────────────────────────────────────
    this.processCollisionResults();

    // ── Particle Update ────────────────────────────────────────────────────
    this.particleSystem.update(delta);

    // ── Camera ─────────────────────────────────────────────────────────────
    this.cameraSystem.update(delta);

    // ── Trajectory Update ──────────────────────────────────────────────────
    this.updateTrajectory();

    // ── HUD Data ───────────────────────────────────────────────────────────
    hudData.stationHealth    = this.station.health;
    hudData.stationMaxHealth = this.station.maxHealth;
    hudData.shieldEnergy     = this.station.shieldEnergy;
    hudData.shieldBroken     = this.station.shieldBroken;
    hudData.activeEntities   = entities.length;
    hudData.physicsStepMs    = this.physicsSystem.lastStepResult.stepTimeMs;
    hudData.fps              = this.game.loop.actualFps;
    hudData.enemiesRemaining = entityManager.countByTag(Tags.ASTEROID);

    // ── Render ─────────────────────────────────────────────────────────────
    this.renderSystem.render(
      this.renderAlpha,
      entityManager.getAll(),
      this.trajectory,
      delta
    );
  }

  shutdown(): void {
    eventBus.clearAll();
    entityManager.clear();
    this.renderSystem.destroy();
    this.cameraSystem.destroy();
  }
}