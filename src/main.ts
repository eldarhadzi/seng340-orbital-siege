// src/main.ts — Phase 2 Verification (Fixed)
// Fixes:
//   1. Removed unused named imports (EventManager, SaveManager classes)
//   2. Fixed import.meta.env via tsconfig "types": ["vite/client"]
//   3. Fixed Window cast using double assertion (unknown first)
//   4. Fixed wrapAngle test: Math.PI*3 wraps to -Math.PI (boundary case)

import Phaser from 'phaser';
import { GameConfig, GAME_WIDTH, GAME_HEIGHT } from '@config/GameConfig';
import { Vector2 } from '@utils/Vector2';
import { MathUtils } from '@utils/MathUtils';
import { GameEvents } from '@utils/Constants';
import { ObjectPool, Poolable } from '@utils/ObjectPool';
import { Timer, CooldownTimer } from '@utils/Timer';
import { eventBus } from '@managers/EventManager';
import { HUDDataModel, hudData } from '@managers/HUDDataModel';
import { saveManager } from '@managers/SaveManager';
import { PhysicsConfig } from '@config/PhysicsConfig';
import { BalanceConfig } from '@config/BalanceConfig';
import { WeaponType } from '@typedefs/GameTypes';

// ─── Phase 2 Verification Scene ───────────────────────────────────────────────
class Phase2VerificationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Phase2VerificationScene' });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const results = this.runTests();

    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000010, 0x000010, 0x000030, 0x000030, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Title ───────────────────────────────────────────────────────────────
    this.add.text(cx, 35, 'ORBITAL SIEGE', {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: '#4a9eff',
    }).setOrigin(0.5);

    this.add.text(cx, 72, 'PHASE 2 — Core Engine Verification', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#8899cc',
    }).setOrigin(0.5);

    // ── Test Results ────────────────────────────────────────────────────────
    let y = 112;
    for (const result of results) {
      const icon  = result.passed ? '✓' : '✗';
      const color = result.passed ? '#44ff88' : '#ff4444';

      // Truncate detail text so it fits within canvas width
      const detail  = result.detail.length > 55
        ? result.detail.substring(0, 52) + '...'
        : result.detail;

      this.add.text(cx, y, `${icon}  ${result.name}: ${detail}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color,
      }).setOrigin(0.5);

      y += 24;
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    const passed  = results.filter(r => r.passed).length;
    const total   = results.length;
    const allPass = passed === total;

    this.add.text(cx, y + 16,
      allPass
        ? `✓  ALL ${total} TESTS PASSED — PHASE 2 COMPLETE`
        : `✗  ${total - passed}/${total} TESTS FAILED`,
      {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: allPass ? '#44ff88' : '#ff4444',
      }
    ).setOrigin(0.5);

    // ── Console Report ───────────────────────────────────────────────────────
    console.log('─────────────────────────────────────────');
    console.log('   PHASE 2 — Core Engine Test Report     ');
    console.log('─────────────────────────────────────────');
    results.forEach(r => {
      console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}: ${r.detail}`);
    });
    console.log(`  Result: ${passed}/${total} passed`);
    console.log('─────────────────────────────────────────');
  }

  // ─── Test Suite ────────────────────────────────────────────────────────────
  private runTests(): { name: string; passed: boolean; detail: string }[] {
    const tests: { name: string; passed: boolean; detail: string }[] = [];

    // ── Test 1: Vector2 ──────────────────────────────────────────────────────
    try {
      const a   = new Vector2(3, 4);
      const mag = a.magnitude();          // Expected: 5
      const b   = new Vector2(1, 0);
      const c   = a.add(b);               // Expected: (4, 4)
      const dot = a.dot(new Vector2(1, 0)); // Expected: 3
      const passed = MathUtils.approximately(mag, 5)
                  && c.x === 4 && c.y === 4
                  && dot === 3;
      tests.push({
        name: 'Vector2',
        passed,
        detail: `mag(3,4)=${mag.toFixed(2)}, add=(${c.x},${c.y}), dot=${dot}`,
      });
    } catch (e) {
      tests.push({ name: 'Vector2', passed: false, detail: String(e) });
    }

    // ── Test 2: MathUtils ────────────────────────────────────────────────────
    // FIX: Math.PI * 3 wraps to exactly -Math.PI (boundary case).
    // We test a non-boundary case (2.5π) which wraps to 0.5π unambiguously.
    try {
      const clamped  = MathUtils.clamp(150, 0, 100);        // Expected: 100
      const lerped   = MathUtils.lerp(0, 100, 0.5);         // Expected: 50
      // 2.5π radians → wraps to 0.5π (≈1.5708) — clear non-boundary test
      const wrapped  = MathUtils.wrapAngle(Math.PI * 2.5);
      const wrapOk   = MathUtils.approximately(wrapped, Math.PI * 0.5, 0.001);
      const mapVal   = MathUtils.mapRange(0.5, 0, 1, 0, 200); // Expected: 100
      const passed   = clamped === 100 && lerped === 50 && wrapOk && mapVal === 100;
      tests.push({
        name: 'MathUtils',
        passed,
        detail: `clamp=${clamped}, lerp=${lerped}, wrap2.5π≈${wrapped.toFixed(3)}, map=${mapVal}`,
      });
    } catch (e) {
      tests.push({ name: 'MathUtils', passed: false, detail: String(e) });
    }

    // ── Test 3: EventBus ─────────────────────────────────────────────────────
    try {
      let callCount = 0;
      const unsub = eventBus.on(GameEvents.ASTEROID_DESTROYED, () => {
        callCount++;
      });
      eventBus.emit(GameEvents.ASTEROID_DESTROYED, {});
      eventBus.emit(GameEvents.ASTEROID_DESTROYED, {});
      unsub(); // Unsubscribe
      eventBus.emit(GameEvents.ASTEROID_DESTROYED, {}); // Should NOT increment

      // Test 'once'
      let onceFired = 0;
      eventBus.once(GameEvents.SCORE_CHANGED, () => { onceFired++; });
      eventBus.emit(GameEvents.SCORE_CHANGED, {});
      eventBus.emit(GameEvents.SCORE_CHANGED, {}); // Should not fire again

      const passed = callCount === 2 && onceFired === 1;
      tests.push({
        name: 'EventBus',
        passed,
        detail: `on fired=${callCount}/2, once fired=${onceFired}/1, unsub OK`,
      });
    } catch (e) {
      tests.push({ name: 'EventBus', passed: false, detail: String(e) });
    }

    // ── Test 4: ObjectPool ───────────────────────────────────────────────────
    try {
      class PoolTestObj implements Poolable {
        active = false;
        value  = 42;
        reset(): void { this.value = 0; }
      }

      const pool = new ObjectPool(
        () => new PoolTestObj(), 5, 10, 'TestPool'
      );

      const obj1 = pool.acquire()!;
      const obj2 = pool.acquire()!;
      const obj3 = pool.acquire()!;

      // obj1.value should be reset to 0 by acquire
      const resetOk = obj1.value === 0;

      pool.release(obj2);
      const afterRelease = pool.activeCount; // Should be 2

      pool.releaseAll();
      const afterAll = pool.activeCount; // Should be 0

      const passed = obj1 !== null
                  && obj2 !== null
                  && obj3 !== null
                  && resetOk
                  && afterRelease === 2
                  && afterAll === 0;

      tests.push({
        name: 'ObjectPool',
        passed,
        detail: `reset=${resetOk}, active=${afterRelease}/2, releaseAll=${afterAll}`,
      });
    } catch (e) {
      tests.push({ name: 'ObjectPool', passed: false, detail: String(e) });
    }

    // ── Test 5: Timer ────────────────────────────────────────────────────────
    try {
      let fired = false;
      const t = new Timer(100, () => { fired = true; }, true);

      t.update(50);
      const notYet   = !fired;       // Should not have fired at 50ms
      const progress = t.progress;  // Should be ~0.5

      t.update(60);                  // Total 110ms > 100ms → fires
      const firedOk  = fired && t.isComplete;

      // Test restart
      t.restart();
      const restartOk = !t.isComplete && t.isRunning;

      const passed = notYet && firedOk && restartOk
                  && MathUtils.approximately(progress, 0.5, 0.05);
      tests.push({
        name: 'Timer',
        passed,
        detail: `notFiredAt50ms=${notYet}, progress≈${progress.toFixed(2)}, fired=${fired}, restart=${restartOk}`,
      });
    } catch (e) {
      tests.push({ name: 'Timer', passed: false, detail: String(e) });
    }

    // ── Test 6: CooldownTimer ────────────────────────────────────────────────
    try {
      const cd = new CooldownTimer(500);

      const readyInitial = cd.isReady;   // Should be true (starts ready)
      cd.trigger();
      const readyAfterTrigger = cd.isReady; // Should be false (on cooldown)

      cd.update(300);
      const progressMid = cd.progress;   // Should be ~0.6

      cd.update(300);                    // Total 600ms > 500ms → ready
      const readyAfterExpiry = cd.isReady; // Should be true

      // Test forceReady
      cd.trigger();
      cd.forceReady();
      const forcedReady = cd.isReady;

      const passed = readyInitial
                  && !readyAfterTrigger
                  && readyAfterExpiry
                  && forcedReady
                  && MathUtils.approximately(progressMid, 0.6, 0.05);

      tests.push({
        name: 'CooldownTimer',
        passed,
        detail: `ready=${readyInitial}, cooldown=${!readyAfterTrigger}, recovered=${readyAfterExpiry}, force=${forcedReady}`,
      });
    } catch (e) {
      tests.push({ name: 'CooldownTimer', passed: false, detail: String(e) });
    }

    // ── Test 7: HUDDataModel ─────────────────────────────────────────────────
    try {
      hudData.score        = 1500;
      hudData.waveNumber   = 4;
      hudData.activeWeapon = WeaponType.MISSILE;

      const singleton = HUDDataModel.getInstance() === hudData;

      hudData.reset();

      const weaponAfterReset = hudData.activeWeapon as string;
      const resetOk = hudData.score === 0
                   && hudData.waveNumber === 1
                   && weaponAfterReset === WeaponType.CANNON;

      const passed = singleton && resetOk;
      tests.push({
        name: 'HUDDataModel',
        passed,
        detail: `singleton=${singleton}, reset score=${hudData.score}, weapon=${hudData.activeWeapon}`,
      });
    } catch (e) {
      tests.push({ name: 'HUDDataModel', passed: false, detail: String(e) });
    }

    // ── Test 8: SaveManager ──────────────────────────────────────────────────
    try {
      // Clean slate
      saveManager.deleteSave();

      const isNewRecord = saveManager.submitScore(5000, 3);
      const hs          = saveManager.highScore;
      const hw          = saveManager.highestWave;

      // Submitting a lower score should NOT replace high score
      saveManager.submitScore(1000, 1);
      const stillSame = saveManager.highScore === 5000;

      // Settings update
      saveManager.updateSettings({ musicVolume: 0.2 });
      const settingsOk = saveManager.settings.musicVolume === 0.2;

      // Clean up test data
      saveManager.deleteSave();

      const passed = isNewRecord && hs === 5000 && hw === 3 && stillSame && settingsOk;
      tests.push({
        name: 'SaveManager',
        passed,
        detail: `highScore=${hs}, wave=${hw}, newRecord=${isNewRecord}, settings=${settingsOk}`,
      });
    } catch (e) {
      tests.push({ name: 'SaveManager', passed: false, detail: String(e) });
    }

    // ── Test 9: PhysicsConfig ────────────────────────────────────────────────
    try {
      const gOk        = PhysicsConfig.GAME_G === 5000;
      const dtOk       = MathUtils.approximately(PhysicsConfig.FIXED_TIMESTEP_S, 1/60, 0.0001);
      const radiiOk    = PhysicsConfig.RADIUS_ASTEROID_LARGE === 40;
      const massOk     = PhysicsConfig.MASS_ASTEROID_LARGE === 500;
      const spawnOk    = PhysicsConfig.SPAWN_RADIUS === 950;
      const passed     = gOk && dtOk && radiiOk && massOk && spawnOk;
      tests.push({
        name: 'PhysicsConfig',
        passed,
        detail: `G=${PhysicsConfig.GAME_G}, dt=${PhysicsConfig.FIXED_TIMESTEP_S.toFixed(5)}, spawnR=${PhysicsConfig.SPAWN_RADIUS}`,
      });
    } catch (e) {
      tests.push({ name: 'PhysicsConfig', passed: false, detail: String(e) });
    }

    // ── Test 10: BalanceConfig ────────────────────────────────────────────────
    try {
      const dmgOk    = BalanceConfig.DAMAGE_ASTEROID_LARGE === 25;
      const waveOk   = BalanceConfig.TOTAL_WAVES === 10;
      const scoreOk  = BalanceConfig.SCORE_ASTEROID_LARGE === 150;
      const comboOk  = BalanceConfig.COMBO_MAX_MULTIPLIER === 8;
      const passed   = dmgOk && waveOk && scoreOk && comboOk;
      tests.push({
        name: 'BalanceConfig',
        passed,
        detail: `dmg=${BalanceConfig.DAMAGE_ASTEROID_LARGE}, waves=${BalanceConfig.TOTAL_WAVES}, score=${BalanceConfig.SCORE_ASTEROID_LARGE}`,
      });
    } catch (e) {
      tests.push({ name: 'BalanceConfig', passed: false, detail: String(e) });
    }

    return tests;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const config: Phaser.Types.Core.GameConfig = {
  ...GameConfig,
  scene: [Phase2VerificationScene],
};

const game = new Phaser.Game(config);

// ── Dev-only debug helpers ────────────────────────────────────────────────────
// Double assertion (unknown first) satisfies strict TypeScript
// while still allowing window property assignment.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__GAME__  = game;
  w.__V2__    = Vector2;
  w.__MATH__  = MathUtils;
  w.__BUS__   = eventBus;
  w.__HUD__   = hudData;
  w.__SAVE__  = saveManager;
}

export { game };