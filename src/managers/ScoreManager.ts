// src/managers/ScoreManager.ts
//
// Score tracking with combo multiplier system.
//
// COMBO SYSTEM:
// Each kill within COMBO_WINDOW_MS of the previous extends the combo.
// Missing the window resets multiplier to 1.0.
// Multiplier increases by COMBO_STEP per kill (max: COMBO_MAX_MULTIPLIER).
// Final score = base points × current multiplier.

import { BalanceConfig } from '@config/BalanceConfig';
import { hudData } from '@managers/HUDDataModel';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';
import { Vector2 } from '@utils/Vector2';
import { AsteroidSize } from '@typedefs/GameTypes';

export class ScoreManager {
  private score:         number = 0;
  private multiplier:    number = 1.0;
  private comboKills:    number = 0;
  private comboTimer:    number = 0;   // ms since last kill
  private highScore:     number = 0;

  constructor(highScore: number = 0) {
    this.highScore = highScore;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    if (this.multiplier > 1.0) {
      this.comboTimer += deltaMs;

      if (this.comboTimer >= BalanceConfig.COMBO_WINDOW_MS) {
        this.breakCombo();
      }
    }

    // Sync to HUD
    hudData.score           = this.score;
    hudData.comboMultiplier = this.multiplier;
    hudData.comboKills      = this.comboKills;
    hudData.comboTimeLeft   = Math.max(
      0,
      (BalanceConfig.COMBO_WINDOW_MS - this.comboTimer) / 1000
    );
  }

  // ─── Score Events ─────────────────────────────────────────────────────────

  onAsteroidDestroyed(size: AsteroidSize, position: Vector2): void {
    let basePoints: number;
    switch (size) {
      case AsteroidSize.LARGE:  basePoints = BalanceConfig.SCORE_ASTEROID_LARGE;  break;
      case AsteroidSize.MEDIUM: basePoints = BalanceConfig.SCORE_ASTEROID_MEDIUM; break;
      case AsteroidSize.SMALL:  basePoints = BalanceConfig.SCORE_ASTEROID_SMALL;  break;
    }
    this.addScore(basePoints, position, 'asteroid');
  }

  onEnemyDestroyed(points: number, position: Vector2): void {
    this.addScore(points, position, 'enemy');
  }

  onWaveComplete(waveNumber: number): void {
    const bonus = BalanceConfig.SCORE_WAVE_COMPLETION * waveNumber;
    this.addScore(bonus, new Vector2(0, 0), 'wave_complete');
    console.log(`[ScoreManager] Wave ${waveNumber} bonus: +${bonus}`);
  }

  // ─── Core Scoring ─────────────────────────────────────────────────────────

  private addScore(
    basePoints: number,
    position:   Vector2,
    source:     string
  ): void {
    const points = Math.round(basePoints * this.multiplier);
    this.score  += points;

    // Extend combo
    this.comboTimer = 0;
    this.comboKills++;
    this.multiplier = Math.min(
      BalanceConfig.COMBO_MAX_MULTIPLIER,
      1.0 + Math.floor(this.comboKills / 2) * BalanceConfig.COMBO_STEP
    );

    eventBus.emit(GameEvents.SCORE_CHANGED, {
      points,
      multiplier: this.multiplier,
      totalScore: this.score,
      source,
      position,
    });

    // Check high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      eventBus.emit(GameEvents.HIGH_SCORE_BEATEN, { score: this.score });
    }
  }

  private breakCombo(): void {
    if (this.multiplier <= 1.0) { return; }
    this.multiplier = 1.0;
    this.comboKills = 0;
    this.comboTimer = 0;
    eventBus.emit(GameEvents.COMBO_BROKEN, {});
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get currentScore():      number { return this.score; }
  get currentMultiplier(): number { return this.multiplier; }
  get currentHighScore():  number { return this.highScore; }

  reset(): void {
    this.score      = 0;
    this.multiplier = 1.0;
    this.comboKills = 0;
    this.comboTimer = 0;
  }
}