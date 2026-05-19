// src/managers/HUDDataModel.ts
//
// The data contract between the game simulation and the HUD.
//
// ARCHITECTURE NOTE:
// The UIScene runs in parallel with GameScene. It cannot directly access
// GameScene's entities (different Phaser scene contexts).
// Instead, GameScene writes data into this shared model every frame,
// and UIScene reads from it every frame.
//
// This is the "Model" in a Model-View pattern:
//   GameScene (Controller) → HUDDataModel (Model) → UIScene (View)
//
// HUDDataModel is a plain data object — no logic, no methods.
// It is a singleton so both scenes can reference the same instance.

import { Vector2 } from '@utils/Vector2';
import { WeaponType } from '@typedefs/GameTypes';

export interface RadarEntity {
  position:    Vector2;
  entityType:  string;
  isHostile:   boolean;
}

export class HUDDataModel {
  private static _instance: HUDDataModel | null = null;

  // ─── Station State ───────────────────────────────────────────────────────
  stationHealth:    number = 100;
  stationMaxHealth: number = 100;
  shieldEnergy:     number = 100;
  shieldMaxEnergy:  number = 100;
  shieldActive:     boolean = false;
  shieldBroken:     boolean = false;

  // ─── Weapon State ────────────────────────────────────────────────────────
  activeWeapon:     WeaponType = WeaponType.CANNON;
  weaponHeat:       number = 0;        // 0-100
  weaponOverheated: boolean = false;
  weaponCooldownProgress: number = 1;  // 0 (on cooldown) to 1 (ready)

  // ─── Score & Combo ───────────────────────────────────────────────────────
  score:            number = 0;
  highScore:        number = 0;
  comboMultiplier:  number = 1;
  comboKills:       number = 0;
  comboTimeLeft:    number = 0; // Seconds until combo expires

  // ─── Wave Info ───────────────────────────────────────────────────────────
    waveNumber:         number = 1;
    totalWaves:         number = 10;
    enemiesRemaining:   number = 0;
    enemiesTotal:       number = 0;
    waveTimeElapsed:    number = 0;
    waveCountdown:      number = 0;   
    waveComplete:       boolean = false; 

  // ─── Resources ───────────────────────────────────────────────────────────
  resourceCount:    number = 0;

  // ─── Minimap ─────────────────────────────────────────────────────────────
  radarEntities:    RadarEntity[] = [];
  playerPosition:   Vector2 = new Vector2(0, 0);

  // ─── Performance (debug) ─────────────────────────────────────────────────
  fps:              number = 60;
  physicsStepMs:    number = 0;
  activeEntities:   number = 0;

  static getInstance(): HUDDataModel {
    if (!HUDDataModel._instance) {
      HUDDataModel._instance = new HUDDataModel();
    }
    return HUDDataModel._instance;
  }

  static resetInstance(): void {
    HUDDataModel._instance = null;
  }

  /** Reset all values to defaults (call on new game) */
  reset(): void {
    this.stationHealth    = 100;
    this.stationMaxHealth = 100;
    this.shieldEnergy     = 100;
    this.shieldMaxEnergy  = 100;
    this.shieldActive     = false;
    this.shieldBroken     = false;
    this.activeWeapon     = WeaponType.CANNON;
    this.weaponHeat       = 0;
    this.weaponOverheated = false;
    this.weaponCooldownProgress = 1;
    this.score            = 0;
    this.comboMultiplier  = 1;
    this.comboKills       = 0;
    this.comboTimeLeft    = 0;
    this.waveNumber       = 1;
    this.enemiesRemaining = 0;
    this.waveCountdown    = 0;
    this.waveComplete     = false;
    this.resourceCount    = 0;
    this.radarEntities    = [];
  }

  private constructor() {}
}

// Convenience export
export const hudData = HUDDataModel.getInstance();