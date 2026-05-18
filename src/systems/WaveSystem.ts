// src/systems/WaveSystem.ts
//
// Wave state machine — drives the game's progression.
//
// STATES:
//   WAITING     → Pre-wave countdown (3 seconds)
//   SPAWNING    → SpawnSystem is releasing entities
//   ACTIVE      → All spawned, player fighting
//   COMPLETE    → All enemies dead, reward phase
//   FINISHED    → All waves done — victory
//
// WAVE COMPLETION DETECTION:
// A wave is complete when:
//   1. The spawn queue is empty (all entities released)
//   2. Zero asteroids and zero enemies remain active
// Both conditions must be true simultaneously.

import { WaveDefinition } from '@typedefs/GameTypes';
import { SpawnSystem } from '@systems/SpawnSystem';
import { entityManager } from '@managers/EntityManager';
import { eventBus } from '@managers/EventManager';
import { GameEvents, Tags } from '@utils/Constants';
import { hudData } from '@managers/HUDDataModel';

export enum WaveState {
  IDLE      = 'IDLE',
  WAITING   = 'WAITING',
  SPAWNING  = 'SPAWNING',
  ACTIVE    = 'ACTIVE',
  COMPLETE  = 'COMPLETE',
  FINISHED  = 'FINISHED',
}

export class WaveSystem {
  private spawnSystem:    SpawnSystem;
  private waveDefinitions: WaveDefinition[] = [];

  private currentWaveIndex: number    = 0;
  private state:             WaveState = WaveState.IDLE;
  private stateTimer:        number    = 0;

  // How long to wait before starting the next wave (ms)
  private readonly WAVE_START_DELAY_MS = 3000;
  // How long to show "WAVE COMPLETE" before next wave begins (ms)
  private readonly WAVE_COMPLETE_DELAY_MS = 4000;

  // Track total enemies for HUD
  private totalEnemiesThisWave: number = 0;

  constructor(spawnSystem: SpawnSystem) {
    this.spawnSystem = spawnSystem;
  }

  // ─── Load Wave Data ───────────────────────────────────────────────────────

  loadWaveDefinitions(definitions: WaveDefinition[]): void {
    this.waveDefinitions = definitions;
    console.log(`[WaveSystem] Loaded ${definitions.length} wave definitions.`);
  }

  // ─── Control ──────────────────────────────────────────────────────────────

  startWaves(): void {
    this.currentWaveIndex = 0;
    this.beginWaveCountdown();
  }

  private beginWaveCountdown(): void {
    this.state      = WaveState.WAITING;
    this.stateTimer = 0;

    const wave = this.currentWaveDef;
    if (!wave) { return; }

    hudData.waveNumber = wave.waveNumber;

    eventBus.emit(GameEvents.WAVE_STARTED, {
      waveNumber: wave.waveNumber,
      countdown:  this.WAVE_START_DELAY_MS / 1000,
    });

    console.log(`[WaveSystem] Wave ${wave.waveNumber} starting in ${this.WAVE_START_DELAY_MS / 1000}s`);
  }

  private launchWave(): void {
    const wave = this.currentWaveDef;
    if (!wave) { return; }

    this.state = WaveState.SPAWNING;
    this.spawnSystem.queueWave(wave);

    this.totalEnemiesThisWave =
      wave.asteroidCount + wave.enemyCount;
    hudData.enemiesTotal     = this.totalEnemiesThisWave;
    hudData.enemiesRemaining = this.totalEnemiesThisWave;

    console.log(`[WaveSystem] Wave ${wave.waveNumber} launched.`);
  }

  private completeWave(): void {
    this.state      = WaveState.COMPLETE;
    this.stateTimer = 0;

    const wave = this.currentWaveDef;
    eventBus.emit(GameEvents.WAVE_COMPLETED, {
      waveNumber: wave?.waveNumber ?? this.currentWaveIndex + 1,
      score:      hudData.score,
    });

    console.log(`[WaveSystem] Wave ${this.currentWaveIndex + 1} complete!`);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    this.stateTimer += deltaMs;

    switch (this.state) {
      case WaveState.WAITING:
        this.updateWaiting();
        break;

      case WaveState.SPAWNING:
        this.updateSpawning(deltaMs);
        break;

      case WaveState.ACTIVE:
        this.updateActive();
        break;

      case WaveState.COMPLETE:
        this.updateComplete();
        break;

      default:
        break;
    }

    // Update HUD enemies remaining
    const remaining =
      entityManager.countByTag(Tags.ASTEROID) +
      entityManager.countByTag(Tags.ENEMY);
    hudData.enemiesRemaining = remaining;
  }

  private updateWaiting(): void {
    if (this.stateTimer >= this.WAVE_START_DELAY_MS) {
      this.launchWave();
    }
  }

  private updateSpawning(deltaMs: number): void {
    this.spawnSystem.update(deltaMs);

    // Transition to ACTIVE once all entities are spawned
    if (this.spawnSystem.isQueueEmpty) {
      this.state = WaveState.ACTIVE;
    }
  }

  private updateActive(): void {
    const asteroidsLeft = entityManager.countByTag(Tags.ASTEROID);
    const enemiesLeft   = entityManager.countByTag(Tags.ENEMY);

    if (asteroidsLeft === 0 && enemiesLeft === 0) {
      this.completeWave();
    }
  }

  private updateComplete(): void {
    if (this.stateTimer >= this.WAVE_COMPLETE_DELAY_MS) {
      this.advanceWave();
    }
  }

  private advanceWave(): void {
    this.currentWaveIndex++;

    if (this.currentWaveIndex >= this.waveDefinitions.length) {
      this.state = WaveState.FINISHED;
      eventBus.emit(GameEvents.ALL_WAVES_COMPLETE, {});
      console.log('[WaveSystem] All waves complete — VICTORY!');
    } else {
      this.beginWaveCountdown();
    }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  get currentState():    WaveState      { return this.state; }
  get currentWaveNumber(): number       { return this.currentWaveIndex + 1; }
  get isActive():        boolean        { return this.state === WaveState.ACTIVE || this.state === WaveState.SPAWNING; }
  get isComplete():      boolean        { return this.state === WaveState.COMPLETE; }
  get isFinished():      boolean        { return this.state === WaveState.FINISHED; }
  get stateProgress():   number         {
    if (this.state === WaveState.WAITING) {
      return this.stateTimer / this.WAVE_START_DELAY_MS;
    }
    return 0;
  }

  get countdownSeconds(): number {
    if (this.state !== WaveState.WAITING) { return 0; }
    return Math.ceil(
      (this.WAVE_START_DELAY_MS - this.stateTimer) / 1000
    );
  }

  private get currentWaveDef(): WaveDefinition | null {
    return this.waveDefinitions[this.currentWaveIndex] ?? null;
  }

  reset(): void {
    this.currentWaveIndex = 0;
    this.state            = WaveState.IDLE;
    this.stateTimer       = 0;
    this.spawnSystem.clearQueue();
  }
}