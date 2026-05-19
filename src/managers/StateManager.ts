// src/managers/StateManager.ts
//
// Game-level state machine.
// Manages transitions between: PLAYING, PAUSED, GAME_OVER, VICTORY.

import { GameState } from '@typedefs/GameTypes';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export class StateManager {
  private state: GameState = GameState.WAVE_ACTIVE;

  // ─── Transitions ──────────────────────────────────────────────────────────

  pause(): void {
    if (this.state !== GameState.WAVE_ACTIVE) { return; }
    this.state = GameState.PAUSED;
    eventBus.emit(GameEvents.GAME_PAUSED, {});
  }

  resume(): void {
    if (this.state !== GameState.PAUSED) { return; }
    this.state = GameState.WAVE_ACTIVE;
    eventBus.emit(GameEvents.GAME_RESUMED, {});
  }

  triggerGameOver(): void {
    this.state = GameState.GAME_OVER;
    eventBus.emit(GameEvents.GAME_OVER, {});
  }

  triggerVictory(): void {
    this.state = GameState.VICTORY;
    eventBus.emit(GameEvents.GAME_VICTORY, {});
  }

  setWaveIntro(): void  { this.state = GameState.WAVE_INTRO; }
  setWaveActive(): void { this.state = GameState.WAVE_ACTIVE; }
  setWaveComplete(): void { this.state = GameState.WAVE_COMPLETE; }

  // ─── Queries ──────────────────────────────────────────────────────────────

  get currentState():  GameState { return this.state; }
  get isPlaying():     boolean   { return this.state === GameState.WAVE_ACTIVE; }
  get isPaused():      boolean   { return this.state === GameState.PAUSED; }
  get isGameOver():    boolean   { return this.state === GameState.GAME_OVER; }
  get isVictory():     boolean   { return this.state === GameState.VICTORY; }
}