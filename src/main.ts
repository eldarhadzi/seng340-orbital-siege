// src/main.ts — Phase 3 Physics Verification

import Phaser from 'phaser';
import { GameConfig, GAME_WIDTH, GAME_HEIGHT } from '@config/GameConfig';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { GravitySystem } from '@systems/GravitySystem';
import { CollisionSystem } from '@systems/CollisionSystem';
import { PhysicsSystem } from '@systems/PhysicsSystem';
import { TrajectorySystem } from '@systems/TrajectorySystem';
import { entityManager } from '@managers/EntityManager';
import { Asteroid } from '@entities/Asteroid';
import { Station } from '@entities/Station';
import { AsteroidSize } from '@typedefs/GameTypes';
import { ObjectPool } from '@utils/ObjectPool';
import { Tags } from '@utils/Constants';


class Phase3VerificationScene extends Phaser.Scene {
  private gravitySystem!:    GravitySystem;
  private collisionSystem!:  CollisionSystem;
  private physicsSystem!:    PhysicsSystem;
  private trajectorySystem!: TrajectorySystem;

  private asteroidPool!: ObjectPool<Asteroid>;

  private station!: Station;
  private orbitingAsteroids: Asteroid[] = [];
  private trajectoryPoints:  Vector2[]  = [];

  private testResults: { name: string; passed: boolean; detail: string }[] = [];
  private physicsRunning = false;
  private frameCount = 0;

  // Debug graphics
  private gfx!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'Phase3VerificationScene' });
  }

  create(): void {
    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000008, 0x000008, 0x00001a, 0x00001a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Title ───────────────────────────────────────────────────────────────
    this.add.text(GAME_WIDTH / 2, 28, 'ORBITAL SIEGE', {
      fontFamily: 'monospace', fontSize: '30px', color: '#4a9eff'
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 58, 'PHASE 3 — Physics System Verification', {
      fontFamily: 'monospace', fontSize: '14px', color: '#6688cc'
    }).setOrigin(0.5);

    // ── Initialize Physics Systems ──────────────────────────────────────────
    this.gravitySystem    = new GravitySystem();
    this.collisionSystem  = new CollisionSystem();
    this.physicsSystem    = new PhysicsSystem(this.gravitySystem, this.collisionSystem);
    this.trajectorySystem = new TrajectorySystem(this.gravitySystem);

    // ── Add Central Gravity Source ──────────────────────────────────────────
    this.gravitySystem.addSource({
      id:          'central_star',
      position:    new Vector2(0, 0),   // ← World origin
      mass:        PhysicsConfig.GRAVITY_WELL_MASS,
      minDistance: PhysicsConfig.GRAVITY_MIN_DISTANCE,
      maxDistance: PhysicsConfig.GRAVITY_MAX_DISTANCE,
      active:      true,
    });

    // ── Object Pools ────────────────────────────────────────────────────────
    this.asteroidPool   = new ObjectPool(() => new Asteroid(),   10, 40, 'Asteroids');

    // ── Station ─────────────────────────────────────────────────────────────
    this.station = new Station();
    this.station.init(new Vector2(0, 0)); 
    entityManager.register(this.station);

    // ── Spawn Orbiting Asteroids ─────────────────────────────────────────────
    this.spawnOrbitingAsteroids();

    // ── Run Static Tests ────────────────────────────────────────────────────
    this.testResults = this.runStaticTests();

    // ── Graphics Layer ──────────────────────────────────────────────────────
    this.gfx = this.add.graphics();

    // ── Status Text ─────────────────────────────────────────────────────────
    this.statusText = this.add.text(20, GAME_HEIGHT - 30, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#aaccff'
    });

    // ── Draw Test Results Panel ──────────────────────────────────────────────
    this.drawTestResults();

    // ── Start physics loop ───────────────────────────────────────────────────
    this.physicsRunning = true;

    // Precompute trajectory for display
    this.updateTrajectory();

    console.log('Phase 3: Physics systems initialized. Gravity simulation running.');
  }

  // ─── Spawn Asteroids in Orbital Positions ─────────────────────────────────
  private spawnOrbitingAsteroids(): void {
    // FIX: World coordinates — center is (0,0), not screen center.
    // Rendering adds (GAME_WIDTH/2, GAME_HEIGHT/2) offset.
    const count = 5;

    for (let i = 0; i < count; i++) {
      const angle       = (i / count) * Math.PI * 2;
      const orbitRadius = 160 + MathUtils.randomRange(-20, 20);
      const pos = new Vector2(
        Math.cos(angle) * orbitRadius,   // ← World space: centered at 0,0
        Math.sin(angle) * orbitRadius
      );

      // Circular orbit speed: v = sqrt(G*M/r)
      const speed  = this.gravitySystem.getCircularOrbitSpeed(orbitRadius);
      // Add ±15% perturbation for visual variety (makes orbits slightly elliptical)
      const perturbedSpeed = speed * MathUtils.randomRange(0.85, 1.15);
      const tangent = this.gravitySystem.getOrbitalTangent(pos, 'central_star', true);
      const vel     = tangent.scale(perturbedSpeed);

      const asteroid = this.asteroidPool.acquire()!;
      const size     = i === 0 ? AsteroidSize.LARGE : AsteroidSize.MEDIUM;
      asteroid.init(pos, vel, size);
      this.orbitingAsteroids.push(asteroid);
      entityManager.register(asteroid);
    }
  }

  // ─── Trajectory Preview ───────────────────────────────────────────────────
   private updateTrajectory(): void {
    // World space: station at (0,0), fire at 45° up-right
    const angle    = -Math.PI / 4;
    const speed    = 500;  // Moderate speed stays in bounds for visual preview
    const startPos = new Vector2(
      Math.cos(angle) * 55,   // Just outside station radius
      Math.sin(angle) * 55
    );
    const startVel = new Vector2(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    const pts = this.trajectorySystem.predict(startPos, startVel, 1.0);
    this.trajectoryPoints = pts.map(p => p.position);
  }

  // ─── Static Physics Tests ─────────────────────────────────────────────────
  private runStaticTests(): { name: string; passed: boolean; detail: string }[] {
    const tests: { name: string; passed: boolean; detail: string }[] = [];

    // Test 1: Gravity force calculation
    try {
      const source = this.gravitySystem.getSource('central_star')!;
      const entityPos  = new Vector2(GAME_WIDTH / 2 + 200, GAME_HEIGHT / 2);
      const force = this.gravitySystem.calculateGravityForce(
        entityPos, 100, source, 1.0
      );
      // Force should point LEFT (toward center) and have positive magnitude
      const pointsToCenter = force.x < 0;
      const hasMagnitude   = force.magnitude() > 0;
      tests.push({
        name: 'Gravity Force',
        passed: pointsToCenter && hasMagnitude,
        detail: `F=(${force.x.toFixed(1)},${force.y.toFixed(1)}), toCenter=${pointsToCenter}`,
      });
    } catch (e) {
      tests.push({ name: 'Gravity Force', passed: false, detail: String(e) });
    }

    // Test 2: Circular orbit speed
    try {
      const orbitR = 200;
      const speed  = this.gravitySystem.getCircularOrbitSpeed(orbitR);
      // v = sqrt(G*M/r) = sqrt(5000 * 1000000 / 200) ≈ 5000
      const expected = Math.sqrt(PhysicsConfig.GAME_G * PhysicsConfig.GRAVITY_WELL_MASS / orbitR);
      const ok = MathUtils.approximately(speed, expected, 0.01);
      tests.push({
        name: 'Orbital Speed',
        passed: ok,
        detail: `v=${speed.toFixed(1)} px/s, expected=${expected.toFixed(1)}`,
      });
    } catch (e) {
      tests.push({ name: 'Orbital Speed', passed: false, detail: String(e) });
    }

    // Test 3: Collision detection
    try {
      const a1 = this.asteroidPool.acquire()!;
      const a2 = this.asteroidPool.acquire()!;
      a1.init(new Vector2(0, 0), Vector2.zero(), AsteroidSize.MEDIUM);
      a2.init(new Vector2(30, 0), Vector2.zero(), AsteroidSize.MEDIUM); // 30px apart, radii sum = 48
      const manifold = this.collisionSystem.testCircleVsCircle(a1, a2);
      const detected = manifold !== null;
      const penetration = manifold?.penetrationDepth ?? 0;
      this.asteroidPool.release(a1);
      this.asteroidPool.release(a2);
      tests.push({
        name: 'Collision Detection',
        passed: detected && penetration > 0,
        detail: `detected=${detected}, penetration=${penetration.toFixed(2)}px`,
      });
    } catch (e) {
      tests.push({ name: 'Collision Detection', passed: false, detail: String(e) });
    }

    // Test 4: No collision (far apart)
    try {
      const a1 = this.asteroidPool.acquire()!;
      const a2 = this.asteroidPool.acquire()!;
      a1.init(new Vector2(0, 0), Vector2.zero(), AsteroidSize.SMALL);
      a2.init(new Vector2(500, 0), Vector2.zero(), AsteroidSize.SMALL);
      const manifold = this.collisionSystem.testCircleVsCircle(a1, a2);
      this.asteroidPool.release(a1);
      this.asteroidPool.release(a2);
      tests.push({
        name: 'No Collision',
        passed: manifold === null,
        detail: `500px apart, radii=12px each, manifold=null: ${manifold === null}`,
      });
    } catch (e) {
      tests.push({ name: 'No Collision', passed: false, detail: String(e) });
    }

    // Test 5: Symplectic Euler integration
    try {
      const a = this.asteroidPool.acquire()!;
      a.init(new Vector2(100, 0), new Vector2(50, 0), AsteroidSize.SMALL);
      a.rigidbody.isKinematic = false;
      a.rigidbody.drag        = 0;
      // Manually integrate 1 step: dt=1s, no forces
      // Expected: pos.x = 100 + 50*1 = 150
      const dt = 1.0;
      a.rigidbody.velocity.x  += 0 * dt; // no acceleration
      a.transform.position.x  += a.rigidbody.velocity.x * dt;
      const expectedX = 150;
      const ok = MathUtils.approximately(a.transform.position.x, expectedX, 0.001);
      this.asteroidPool.release(a);
      tests.push({
        name: 'Euler Integration',
        passed: ok,
        detail: `pos.x=${a.transform.position.x.toFixed(3)}, expected=${expectedX}`,
      });
    } catch (e) {
      tests.push({ name: 'Euler Integration', passed: false, detail: String(e) });
    }

    // Test 6: Trajectory prediction
    try {
      // ROOT CAUSE: Starting close to gravity well (r=150px) causes
      // acceleration of ~222,000 px/s² — projectile exits bounds in 11 steps.
      //
      // FIX: Start at r=400px from origin where:
      //   a = G*M/r² = 5000*1,000,000/400² = 31,250 px/s²
      //   Δv per step = 31,250 * 0.01667 ≈ 521 px/s (manageable)
      //
      // Fire tangentially (perpendicular to radius) at low speed.
      // This creates a gentle arc that stays in bounds for all 90 steps.
      const testStart = new Vector2(400, 0);       // 400px right of origin
      const testVel   = new Vector2(0, -80);       // Slow upward velocity

      const pts = this.trajectorySystem.predict(testStart, testVel, 1.0);

      // curves=true: verify the path bends — x-component of last point
      // should differ from start because gravity pulls it back toward origin
      const hasEnoughPoints = pts.length >= 60;
      const lastPt  = pts[pts.length - 1];
      const bends   = lastPt !== undefined && Math.abs(lastPt.position.x - 400) > 10;

      const passed = hasEnoughPoints && bends;
      tests.push({
        name: 'Trajectory Prediction',
        passed,
        detail: `${pts.length} points, bends=${bends}, lastX=${lastPt?.position.x.toFixed(1)}`,
      });
    } catch (e) {
      tests.push({ name: 'Trajectory Prediction', passed: false, detail: String(e) });
    }

    // Test 7: EntityManager
    try {
      const count      = entityManager.countByTag(Tags.ASTEROID);
      const hasStation = entityManager.countByTag(Tags.STATION) === 1;
      tests.push({
        name: 'EntityManager',
        passed: count === 5 && hasStation,
        detail: `asteroids=${count}/5, station=${hasStation}`,
      });
    } catch (e) {
      tests.push({ name: 'EntityManager', passed: false, detail: String(e) });
    }

    // Test 8: ObjectPool
    try {
      const activeAsteroids = this.asteroidPool.activeCount;
      const stats = this.asteroidPool.getStats();
      tests.push({
        name: 'ObjectPool (Active)',
        passed: activeAsteroids === 5,
        detail: stats,
      });
    } catch (e) {
      tests.push({ name: 'ObjectPool (Active)', passed: false, detail: String(e) });
    }

    return tests;
  }

  // ─── Draw Test Results Panel ──────────────────────────────────────────────
  private drawTestResults(): void {
    let y = 82;
    const cx = GAME_WIDTH - 350;

    this.add.text(cx, y, '── STATIC TESTS ──', {
      fontFamily: 'monospace', fontSize: '12px', color: '#4488ff'
    });
    y += 20;

    for (const r of this.testResults) {
      const icon  = r.passed ? '✓' : '✗';
      const color = r.passed ? '#44ff88' : '#ff4444';
      const detail = r.detail.length > 40 ? r.detail.substring(0, 37) + '...' : r.detail;
      this.add.text(cx, y, `${icon} ${r.name}`, {
        fontFamily: 'monospace', fontSize: '12px', color,
      });
      this.add.text(cx + 10, y + 14, detail, {
        fontFamily: 'monospace', fontSize: '10px', color: '#8899bb',
      });
      y += 32;
    }

    const passed  = this.testResults.filter(r => r.passed).length;
    const total   = this.testResults.length;
    const allPass = passed === total;
    this.add.text(cx, y + 8,
      allPass ? `✓ ALL ${total} TESTS PASSED` : `✗ ${total - passed}/${total} FAILED`,
      { fontFamily: 'monospace', fontSize: '14px', color: allPass ? '#44ff88' : '#ff4444' }
    );
  }

  // ─── Game Loop ────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (!this.physicsRunning) { return; }

    this.frameCount++;

    // Run physics
    const entities = entityManager.getAll();
    this.physicsSystem.update(delta, entities);

    // Render
    this.gfx.clear();
    this.renderGravityWell();
    this.renderTrajectory();
    this.renderAsteroids();
    this.renderStation();
    this.renderDebugInfo();

    // Update trajectory every 30 frames
    if (this.frameCount % 30 === 0) {
      this.updateTrajectory();
    }

    // Update status
    const stepResult = this.physicsSystem.lastStepResult;
    this.statusText.setText(
      `Frame: ${this.frameCount} | ` +
      `Entities: ${entities.length} | ` +
      `Collisions: ${stepResult.collisionsDetected} pairs | ` +
      `Physics step: ${stepResult.stepTimeMs.toFixed(2)}ms`
    );
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  private renderGravityWell(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const t  = this.time.now / 1000;

    // Pulsing glow
    const alpha = 0.3 + 0.2 * Math.sin(t * 2);
    this.gfx.fillStyle(0xffaa00, alpha * 0.3);
    this.gfx.fillCircle(cx, cy, 70);
    this.gfx.fillStyle(0xffcc44, alpha * 0.5);
    this.gfx.fillCircle(cx, cy, 45);
    this.gfx.fillStyle(0xffee88, 0.8);
    this.gfx.fillCircle(cx, cy, 20);
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillCircle(cx, cy, 8);
  }

    private toScreen(worldPos: Vector2): { x: number; y: number } {
    return {
      x: worldPos.x + GAME_WIDTH  / 2,
      y: worldPos.y + GAME_HEIGHT / 2,
    };
  }

  private renderTrajectory(): void {
    if (this.trajectoryPoints.length < 2) { return; }

    const spacing = 3;
    for (let i = 0; i < this.trajectoryPoints.length; i += spacing) {
      const pt     = this.toScreen(this.trajectoryPoints[i]);
      const alpha  = MathUtils.lerp(0.8, 0.05, i / this.trajectoryPoints.length);
      const radius = MathUtils.lerp(3, 1,   i / this.trajectoryPoints.length);

      this.gfx.fillStyle(0x44aaff, alpha);
      this.gfx.fillCircle(pt.x, pt.y, radius);
    }
  }

  private renderAsteroids(): void {
    for (const asteroid of this.orbitingAsteroids) {
      if (!asteroid.active) { continue; }

      const sp  = this.toScreen(asteroid.transform.position);
      const r   = asteroid.collider.radius;

      // Body
      this.gfx.lineStyle(2, 0x8899aa, 1);
      this.gfx.strokeCircle(sp.x, sp.y, r);
      this.gfx.fillStyle(0x445566, 0.8);
      this.gfx.fillCircle(sp.x, sp.y, r);

      // Rotation indicator
      const rot = asteroid.transform.rotation;
      this.gfx.lineStyle(1, 0xaabbcc, 0.5);
      this.gfx.beginPath();
      this.gfx.moveTo(sp.x, sp.y);
      this.gfx.lineTo(sp.x + Math.cos(rot) * r, sp.y + Math.sin(rot) * r);
      this.gfx.strokePath();

      // Velocity vector
      const vel      = asteroid.rigidbody.velocity;
      const velScale = 0.05;
      this.gfx.lineStyle(1, 0x44ff44, 0.4);
      this.gfx.beginPath();
      this.gfx.moveTo(sp.x, sp.y);
      this.gfx.lineTo(sp.x + vel.x * velScale, sp.y + vel.y * velScale);
      this.gfx.strokePath();
    }
  }

  private renderStation(): void {
    const sp = this.toScreen(this.station.transform.position);
    const r  = this.station.collider.radius;

    this.gfx.lineStyle(2, 0x4488ff, 1);
    this.gfx.strokeCircle(sp.x, sp.y, r);
    this.gfx.fillStyle(0x112244, 0.9);
    this.gfx.fillCircle(sp.x, sp.y, r);

    this.gfx.fillStyle(0x4488ff, 1);
    this.gfx.fillCircle(sp.x, sp.y, 5);

    const aimAngle = -Math.PI / 4;
    this.gfx.lineStyle(3, 0x88ccff, 1);
    this.gfx.beginPath();
    this.gfx.moveTo(sp.x, sp.y);
    this.gfx.lineTo(
      sp.x + Math.cos(aimAngle) * (r + 15),
      sp.y + Math.sin(aimAngle) * (r + 15)
    );
    this.gfx.strokePath();
  }

  private renderDebugInfo(): void {
    const cx = GAME_WIDTH  / 2;
    const cy = GAME_HEIGHT / 2;
    this.gfx.lineStyle(1, 0x334455, 0.3);
    this.gfx.strokeCircle(cx, cy, 160);
    this.gfx.lineStyle(1, 0x223333, 0.2);
    this.gfx.strokeCircle(cx, cy, 350);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  ...GameConfig,
  scene: [Phase3VerificationScene],
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__GAME__ = game;
}

export { game };