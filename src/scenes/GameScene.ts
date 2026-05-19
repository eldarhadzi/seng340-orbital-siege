// src/scenes/GameScene.ts — Phase 5: Full gameplay implementation

import Phaser from 'phaser';
import { SceneKeys, Tags, GameEvents } from '@utils/Constants';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { GravitySystem } from '@systems/GravitySystem';
import { CollisionSystem } from '@systems/CollisionSystem';
import { PhysicsSystem } from '@systems/PhysicsSystem';
import { TrajectorySystem } from '@systems/TrajectorySystem';
import { CameraSystem } from '@systems/CameraSystem';
import { ParticleSystem } from '@systems/ParticleSystem';
import { RenderSystem } from '@systems/RenderSystem';
import { InputSystem } from '@systems/InputSystem';
import { WeaponSystem } from '@systems/WeaponSystem';
import { SpawnSystem } from '@systems/SpawnSystem';
import { WaveSystem } from '@systems/WaveSystem';
import { ScoreManager } from '@managers/ScoreManager';
import { StateManager } from '@managers/StateManager';
import { entityManager } from '@managers/EntityManager';
import { hudData } from '@managers/HUDDataModel';
import { saveManager } from '@managers/SaveManager';
import { eventBus } from '@managers/EventManager';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { ObjectPool } from '@utils/ObjectPool';
import { Asteroid } from '@entities/Asteroid';
import { Projectile } from '@entities/Projectile';
import { Station } from '@entities/Station';
import { DroneEnemy } from '@entities/enemies/DroneEnemy';
import { AsteroidSize, WeaponType, WaveDefinition } from '@typedefs/GameTypes';
import { TrajectoryPoint } from '@typedefs/PhysicsTypes';
import { UpgradeManager } from '@managers/UpdateManager';

export class GameScene extends Phaser.Scene {
  // ── Systems ──────────────────────────────────────────────────────────────
  private gravitySystem!:    GravitySystem;
  private collisionSystem!:  CollisionSystem;
  private physicsSystem!:    PhysicsSystem;
  private trajectorySystem!: TrajectorySystem;
  private cameraSystem!:     CameraSystem;
  private particleSystem!:   ParticleSystem;
  private renderSystem!:     RenderSystem;
  private inputSystem!:      InputSystem;
  private weaponSystem!:     WeaponSystem;
  private spawnSystem!:      SpawnSystem;
  private waveSystem!:       WaveSystem;
  private scoreManager!:     ScoreManager;
  private stateManager!:     StateManager;

  // ── Pools ─────────────────────────────────────────────────────────────────
  private asteroidPool!:  ObjectPool<Asteroid>;
  private projectilePool!: ObjectPool<Projectile>;
  private dronePool!:     ObjectPool<DroneEnemy>;

  // ── Core entities ─────────────────────────────────────────────────────────
  private station!: Station;

  // ── State ─────────────────────────────────────────────────────────────────
  private trajectory:   TrajectoryPoint[] = [];
  private renderAlpha:  number = 0;
  private gameOver:     boolean = false;

  private upgradeManager!: UpgradeManager;

  constructor() {
    super({ key: SceneKeys.GAME });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  preload(): void {
    this.load.json('waves', '/assets/data/waves.json');
  }

  create(): void {
    // Reset all singletons for new game
    entityManager.clear();
    hudData.reset();
    this.upgradeManager = new UpgradeManager();

    // ── Systems ────────────────────────────────────────────────────────────
    this.gravitySystem    = new GravitySystem();
    this.collisionSystem  = new CollisionSystem();
    this.physicsSystem    = new PhysicsSystem(this.gravitySystem, this.collisionSystem);
    this.trajectorySystem = new TrajectorySystem(this.gravitySystem);
    this.cameraSystem     = new CameraSystem(this);
    this.particleSystem   = new ParticleSystem();
    this.renderSystem     = new RenderSystem(this, this.cameraSystem, this.particleSystem);
    this.renderSystem.init();

    // ── Gravity well ───────────────────────────────────────────────────────
    this.gravitySystem.addSource({
      id:          'central_star',
      position:    new Vector2(0, 0),
      mass:        PhysicsConfig.GRAVITY_WELL_MASS,
      minDistance: PhysicsConfig.GRAVITY_MIN_DISTANCE,
      maxDistance: PhysicsConfig.GRAVITY_MAX_DISTANCE,
      active:      true,
    });

    // ── Pools ──────────────────────────────────────────────────────────────
    this.asteroidPool   = new ObjectPool(() => new Asteroid(),    20, 80,  'Asteroids');
    this.projectilePool = new ObjectPool(() => new Projectile(),  50, 100, 'Projectiles');
    this.dronePool      = new ObjectPool(() => new DroneEnemy(),  10, 20,  'Drones');

    // ── Station ────────────────────────────────────────────────────────────
    this.station = new Station();
    this.station.init(new Vector2(0, 0));
    entityManager.register(this.station);

    // ── Weapon system ──────────────────────────────────────────────────────
    this.weaponSystem = new WeaponSystem(this.projectilePool, this.station.id);

    // ── Spawn + Wave systems ───────────────────────────────────────────────
    this.spawnSystem = new SpawnSystem(
      this.gravitySystem,
      this.asteroidPool,
      this.dronePool
    );

    this.waveSystem = new WaveSystem(this.spawnSystem);

    // ── Score + State ──────────────────────────────────────────────────────
    this.scoreManager = new ScoreManager(saveManager.highScore);
    this.stateManager = new StateManager();

    // ── Input ──────────────────────────────────────────────────────────────
    this.inputSystem = new InputSystem(this, this.cameraSystem);

    // ── Event listeners ────────────────────────────────────────────────────
    this.setupEventListeners();

    // ── Debug toggle ───────────────────────────────────────────────────────
    this.input.keyboard!.on('keydown-D', () => {
      this.renderSystem.toggleDebug();
    });

    // ── Weapon switch (1/2 keys) ───────────────────────────────────────────
    this.input.keyboard!.on('keydown-ONE', () => {
      this.weaponSystem.switchWeapon(WeaponType.CANNON);
    });
    this.input.keyboard!.on('keydown-TWO', () => {
      this.weaponSystem.switchWeapon(WeaponType.MISSILE);
    });

    // ── Load wave data and start ───────────────────────────────────────────
    this.loadAndStartWaves();

    console.log('[GameScene] Phase 5 — Full gameplay active.');
    console.log('Controls: Mouse aim | Left click fire | 1=Cannon 2=Missile | D=Debug');
  }

  // ─── Wave Loading ─────────────────────────────────────────────────────────

  private loadAndStartWaves(): void {
    const waveData = this.cache.json.get('waves') as { waves: WaveDefinition[] } | null;

    if (waveData && waveData.waves) {
      this.waveSystem.loadWaveDefinitions(waveData.waves);
      this.waveSystem.startWaves();
    } else {
      console.warn('[GameScene] waves.json not found — using fallback waves.');
      this.waveSystem.loadWaveDefinitions(this.getFallbackWaves());
      this.waveSystem.startWaves();
    }
  }

  private getFallbackWaves(): WaveDefinition[] {
    return [
      {
        waveNumber: 1,
        asteroidCount: 4,
        asteroidSizes: [AsteroidSize.LARGE, AsteroidSize.LARGE, AsteroidSize.MEDIUM, AsteroidSize.MEDIUM],
        enemyCount: 0, enemyTypes: [],
        spawnPattern: 'RADIAL' as never,
        spawnIntervalMs: 1200,
        gravityMultiplier: 1.0,
        specialEvents: [],
      },
      {
        waveNumber: 2,
        asteroidCount: 5,
        asteroidSizes: [AsteroidSize.LARGE, AsteroidSize.LARGE, AsteroidSize.MEDIUM, AsteroidSize.MEDIUM, AsteroidSize.SMALL],
        enemyCount: 1, enemyTypes: ['DRONE' as never],
        spawnPattern: 'RADIAL' as never,
        spawnIntervalMs: 1000,
        gravityMultiplier: 1.05,
        specialEvents: [],
      },
    ];
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────

  private setupEventListeners(): void {
    eventBus.on(GameEvents.ENTITY_DESTROYED, (data: unknown) => {
      const d = data as { entityId: string; reason: string };
      if (d.reason === 'out_of_bounds') {
        const entity = entityManager.getById(d.entityId);
        if (entity) {
          entityManager.unregister(entity);
          entity.active = false;

          // Return to pool based on tag
          if (entity instanceof Asteroid) {
            this.asteroidPool.release(entity as Asteroid);
          } else if (entity instanceof Projectile) {
            this.projectilePool.release(entity as Projectile);
          } else if (entity instanceof DroneEnemy) {
            this.dronePool.release(entity as DroneEnemy);
          }
        }
      }
    });

    eventBus.on(GameEvents.WAVE_COMPLETED, (data: unknown) => {
      const d = data as { waveNumber: number };
      this.scoreManager.onWaveComplete(d.waveNumber);
      hudData.waveComplete = true;

      // Award resources for wave completion (10-30 per wave)
      const resourceReward = 10 + d.waveNumber * 4;
      this.upgradeManager.addResources(resourceReward);
      hudData.resourceCount = this.upgradeManager.currentResources;

      // Launch upgrade shop after short delay
      this.time.delayedCall(2000, () => {
        if (this.gameOver) { return; }
        this.scene.pause(SceneKeys.GAME);
        this.scene.launch(SceneKeys.UPGRADE, {
          upgradeManager: this.upgradeManager,
          waveNumber:     d.waveNumber,
          onComplete:     () => {
            hudData.waveComplete = false;
            hudData.resourceCount = this.upgradeManager.currentResources;
            this.scene.resume(SceneKeys.GAME);
          },
        });
      });
    });

    eventBus.on(GameEvents.WAVE_STARTED, (data: unknown) => {
      const d = data as { waveNumber: number };
      hudData.waveNumber   = d.waveNumber;
      hudData.waveComplete = false;
    });

    eventBus.on(GameEvents.ALL_WAVES_COMPLETE, () => {
      this.stateManager.triggerVictory();
      this.time.delayedCall(2000, () => {
        this.endGame(true);
      });
    });
  }

  // ─── Collision Handling ───────────────────────────────────────────────────

  private processHits(): void {
    const asteroids   = entityManager.getByTag(Tags.ASTEROID) as Asteroid[];
    const enemies     = entityManager.getByTag(Tags.ENEMY)    as DroneEnemy[];
    const projectiles = entityManager.getByTag(Tags.PROJECTILE) as Projectile[];

    // ── Projectile vs Asteroid ─────────────────────────────────────────────
    for (const proj of projectiles) {
      if (!proj.active) { continue; }

      // Expired projectile cleanup
      if (proj.hasExpired) {
        entityManager.unregister(proj);
        this.projectilePool.release(proj);
        continue;
      }

      // vs asteroids
      for (const asteroid of asteroids) {
        if (!asteroid.active) { continue; }
        if (this.collisionSystem.testCircleVsCircle(proj, asteroid)) {
          this.handleProjectileAsteroid(proj, asteroid);
          break;
        }
      }

      // vs enemies
      if (!proj.active) { continue; }
      for (const enemy of enemies) {
        if (!enemy.active) { continue; }
        if (this.collisionSystem.testCircleVsCircle(proj, enemy)) {
          this.handleProjectileEnemy(proj, enemy);
          break;
        }
      }
    }

    // ── Asteroid / Enemy vs Station ────────────────────────────────────────
    for (const asteroid of asteroids) {
      if (!asteroid.active) { continue; }
      if (this.collisionSystem.testCircleVsCircle(asteroid, this.station)) {
        this.handleAsteroidStation(asteroid);
      }
    }
    for (const enemy of enemies) {
      if (!enemy.active) { continue; }
      if (this.collisionSystem.testCircleVsCircle(enemy, this.station)) {
        this.handleEnemyStation(enemy);
      }
    }
  }

  // ─── Collision Responses ──────────────────────────────────────────────────

  private handleProjectileAsteroid(proj: Projectile, asteroid: Asteroid): void {
    const pos    = asteroid.transform.position.clone();
    const lethal = asteroid.takeDamage(proj.damage);

    // Explosion particles
    if (asteroid.size === AsteroidSize.LARGE)  { this.particleSystem.explodeLargeAsteroid(pos.x, pos.y); }
    else if (asteroid.size === AsteroidSize.MEDIUM) { this.particleSystem.explodeMediumAsteroid(pos.x, pos.y); }
    else { this.particleSystem.explodeSmallAsteroid(pos.x, pos.y); }

    this.cameraSystem.addTrauma(0.15);

    if (lethal) {
      this.scoreManager.onAsteroidDestroyed(asteroid.size, pos);
      this.spawnFragments(asteroid);
      entityManager.unregister(asteroid);
      this.asteroidPool.release(asteroid);
    }

    entityManager.unregister(proj);
    this.projectilePool.release(proj);
  }

  private handleProjectileEnemy(proj: Projectile, enemy: DroneEnemy): void {
    const pos    = enemy.transform.position.clone();
    const lethal = enemy.takeDamage(proj.damage);

    this.particleSystem.explodeEnemy(pos.x, pos.y);
    this.cameraSystem.addTrauma(0.2);

    if (lethal) {
      this.scoreManager.onEnemyDestroyed(enemy.scoreValue, pos);
      entityManager.unregister(enemy);
      this.dronePool.release(enemy);
    }

    entityManager.unregister(proj);
    this.projectilePool.release(proj);
  }

  private handleAsteroidStation(asteroid: Asteroid): void {
    const pos = asteroid.transform.position.clone();
    this.station.takeDamage(15);
    this.cameraSystem.addTrauma(0.5);
    this.cameraSystem.flash();
    this.particleSystem.explodeMediumAsteroid(pos.x, pos.y);

    entityManager.unregister(asteroid);
    this.asteroidPool.release(asteroid);

    if (this.station.isDead) { this.endGame(false); }
  }

  private handleEnemyStation(enemy: DroneEnemy): void {
    const pos = enemy.transform.position.clone();
    this.station.takeDamage(enemy.damage);
    this.cameraSystem.addTrauma(0.6);
    this.cameraSystem.flash();
    this.particleSystem.explodeEnemy(pos.x, pos.y);

    entityManager.unregister(enemy);
    this.dronePool.release(enemy);

    if (this.station.isDead) { this.endGame(false); }
  }

  // ─── Fragmentation ────────────────────────────────────────────────────────

  private spawnFragments(asteroid: Asteroid): void {
    const fragSize  = asteroid.fragmentSize;
    const fragCount = asteroid.fragmentCount;
    if (!fragSize || fragCount === 0) { return; }

    const pos = asteroid.transform.position;

    for (let i = 0; i < fragCount; i++) {
      const frag = this.asteroidPool.acquire();
      if (!frag) { continue; }

      const spread = MathUtils.randomRange(
        -PhysicsConfig.FRAGMENT_SPREAD_ANGLE / 2,
        PhysicsConfig.FRAGMENT_SPREAD_ANGLE / 2
      );
      const baseAngle = asteroid.rigidbody.velocity.angle() + spread;
      const speed     = asteroid.rigidbody.velocity.magnitude() * 0.5
                      + MathUtils.randomRange(50, 150);
      const fragVel   = Vector2.fromAngle(baseAngle).scale(speed);
      const fragPos   = pos.clone().add(
        Vector2.fromAngle(MathUtils.randomRange(0, Math.PI * 2)).scale(12)
      );

      frag.init(fragPos, fragVel, fragSize);
      entityManager.register(frag);
    }
  }

  // ─── Game End ─────────────────────────────────────────────────────────────

  private endGame(victory: boolean): void {
    if (this.gameOver) { return; }
    this.gameOver = true;

    if (victory) {
      this.stateManager.triggerVictory();
    } else {
      this.stateManager.triggerGameOver();
    }

    const score       = this.scoreManager.currentScore;
    const waveReached = this.waveSystem.currentWaveNumber;

    // Delay before showing game over screen
    this.time.delayedCall(1500, () => {
      this.scene.stop(SceneKeys.UI);
      this.scene.start(SceneKeys.GAME_OVER, {
        victory,
        score,
        waveReached,
      });
    });
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.gameOver) { return; }

    // ── Input ──────────────────────────────────────────────────────────────
    this.inputSystem.update();
    const input = this.inputSystem.state;

    // Pause
    if (input.justPaused && !this.gameOver) {
      this.scene.pause(SceneKeys.GAME);
      this.scene.launch(SceneKeys.PAUSE);
    }

    // Aim station
    this.station.aimAngle = input.aimAngle;

    // Fire
    if (input.isFiring) {
      const spawnR  = this.station.collider.radius + 14;
      const spawnPos = new Vector2(
        Math.cos(input.aimAngle) * spawnR,
        Math.sin(input.aimAngle) * spawnR
      );
      this.weaponSystem.tryFire(spawnPos, input.aimAngle);
    }

    // ── System updates ─────────────────────────────────────────────────────
    this.weaponSystem.update(delta);
    this.waveSystem.update(delta);
    this.scoreManager.update(delta);

    // ── Entity updates ─────────────────────────────────────────────────────
    this.station.update(delta);
    const entities = entityManager.getAll();
    for (const entity of entities) {
      entity.update(delta);
    }

    // ── Physics ────────────────────────────────────────────────────────────
    this.renderAlpha = this.physicsSystem.update(delta, entityManager.getAll());

    // ── Collision responses ────────────────────────────────────────────────
    this.processHits();

    // ── Particles + Camera ─────────────────────────────────────────────────
    this.particleSystem.update(delta);
    this.cameraSystem.update(delta);

    // ── Trajectory ────────────────────────────────────────────────────────
    const angle   = this.station.aimAngle;
    const spawnR  = this.station.collider.radius + 14;
    this.trajectory = this.trajectorySystem.predict(
      new Vector2(Math.cos(angle) * spawnR, Math.sin(angle) * spawnR),
      new Vector2(Math.cos(angle) * 900,    Math.sin(angle) * 900),
      this.physicsSystem.currentGravityMultiplier
    );

    // ── HUD sync ───────────────────────────────────────────────────────────
    const weaponState         = this.weaponSystem.getState();
    hudData.stationHealth     = this.station.health;
    hudData.stationMaxHealth  = this.station.maxHealth;
    hudData.shieldEnergy      = this.station.shieldEnergy;
    hudData.shieldMaxEnergy   = 100;
    hudData.shieldBroken      = this.station.shieldBroken;
    hudData.activeWeapon      = weaponState.type;
    hudData.weaponHeat        = weaponState.heat;
    hudData.weaponOverheated  = weaponState.overheated;
    hudData.activeEntities    = entities.length;
    hudData.physicsStepMs     = this.physicsSystem.lastStepResult.stepTimeMs;
    hudData.fps               = this.game.loop.actualFps;
    hudData.waveNumber        = this.waveSystem.currentWaveNumber;
    hudData.waveCountdown     = this.waveSystem.countdownSeconds;
    hudData.waveComplete      = this.waveSystem.isComplete;
    hudData.resourceCount     = this.upgradeManager.currentResources;

    // ── Render ─────────────────────────────────────────────────────────────
    this.renderSystem.render(
      this.renderAlpha,
      entityManager.getAll(),
      this.trajectory,
      delta
    );
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  shutdown(): void {
    eventBus.clearAll();
    entityManager.clear();
    this.renderSystem.destroy();
    this.cameraSystem.destroy();
    this.gameOver = false;
  }
}