// src/types/GameTypes.ts
//
// Game-domain TypeScript type definitions.
//
// ARCHITECTURE NOTE:
// Types defined here are the "vocabulary" of the game.
// Every system speaks in these types — they are the contracts
// that allow systems to communicate without knowing each other's internals.
//
// RULE: No logic here. Types and interfaces ONLY.
// If you find yourself writing a function here, it belongs elsewhere.

import { Vector2 } from '@utils/Vector2';

// ─── Enums ────────────────────────────────────────────────────────────────────

/** Game-wide state machine states */
export enum GameState {
  BOOTING       = 'BOOTING',
  MAIN_MENU     = 'MAIN_MENU',
  WAVE_INTRO    = 'WAVE_INTRO',
  WAVE_ACTIVE   = 'WAVE_ACTIVE',
  WAVE_COMPLETE = 'WAVE_COMPLETE',
  PAUSED        = 'PAUSED',
  GAME_OVER     = 'GAME_OVER',
  VICTORY       = 'VICTORY',
}

/** Asteroid size classification */
export enum AsteroidSize {
  LARGE  = 'LARGE',   // Splits into 2-3 medium on death
  MEDIUM = 'MEDIUM',  // Splits into 2 small on death
  SMALL  = 'SMALL',   // Destroyed completely on death
}

/** Enemy ship type */
export enum EnemyType {
  DRONE  = 'DRONE',   // Basic straight-line attacker
  ORBIT  = 'ORBIT',   // Enters orbit and fires
  BOSS   = 'BOSS',    // Multi-phase boss
}

/** Weapon type */
export enum WeaponType {
  CANNON  = 'CANNON',   // Fast, low damage, hitscan
  MISSILE = 'MISSILE',  // Slow, high damage, gravity-affected
  LASER   = 'LASER',    // Continuous beam, requires charge
}

/** Upgrade category */
export enum UpgradeCategory {
  WEAPON   = 'WEAPON',
  DEFENSE  = 'DEFENSE',
  UTILITY  = 'UTILITY',
}

/** Spawn pattern for wave enemies */
export enum SpawnPattern {
  RADIAL      = 'RADIAL',      // All directions equally
  DIRECTIONAL = 'DIRECTIONAL', // One focused direction
  CLUSTER     = 'CLUSTER',     // Groups close together
}

// ─── Component Interfaces ─────────────────────────────────────────────────────

/** Transform component: position and rotation */
export interface ITransform {
  position:     Vector2;
  prevPosition: Vector2;  // Previous frame — used for render interpolation
  rotation:     number;   // Radians
  prevRotation: number;
  scale:        Vector2;
}

/** Rigidbody component: all physics data for one entity */
export interface IRigidbody {
  velocity:        Vector2;
  acceleration:    Vector2;
  mass:            number;
  inverseMass:     number;   // 1/mass — precomputed, avoids division in loop
  restitution:     number;   // Elasticity: 0 = inelastic, 1 = perfectly elastic
  drag:            number;   // Linear drag coefficient (0 = no drag)
  angularVelocity: number;   // Rotation speed in radians/second
  isKinematic:     boolean;  // If true, physics doesn't move this entity
  isStatic:        boolean;  // If true, entity never moves (infinite mass)
  forces:          Vector2[]; // Accumulated forces this tick
}

/** Circular collider */
export interface ICircleCollider {
  radius:            number;
  offset:            Vector2;  // Relative to entity position
  collisionCategory: number;   // Bitmask: what category is THIS entity
  collisionMask:     number;   // Bitmask: what categories does THIS collide WITH
  isTrigger:         boolean;  // If true: detects overlap but no physics response
}

// ─── Game Object Interfaces ───────────────────────────────────────────────────

/** Data needed to spawn a new asteroid */
export interface AsteroidSpawnData {
  position:        Vector2;
  velocity:        Vector2;
  size:            AsteroidSize;
  angularVelocity: number;
  asteroidVariant: number; // 0-2: visual variant (rock type)
}

/** Data needed to spawn a projectile */
export interface ProjectileSpawnData {
  position:   Vector2;
  velocity:   Vector2;
  damage:     number;
  weaponType: WeaponType;
  ownerId:    string;  // Entity ID of the shooter (prevents self-collision)
}

/** Data needed to spawn an enemy */
export interface EnemySpawnData {
  position:  Vector2;
  velocity:  Vector2;
  enemyType: EnemyType;
}

// ─── Wave System ──────────────────────────────────────────────────────────────

/** Complete definition of one wave (loaded from waves.json) */
export interface WaveDefinition {
  waveNumber:        number;
  asteroidCount:     number;
  asteroidSizes:     AsteroidSize[];
  enemyCount:        number;
  enemyTypes:        EnemyType[];
  spawnPattern:      SpawnPattern;
  spawnIntervalMs:   number;
  gravityMultiplier: number;
  specialEvents:     SpecialEvent[];
}

/** Special events that can occur during a wave */
export interface SpecialEvent {
  type:    'METEOR_SHOWER' | 'GRAVITY_SURGE' | 'ENEMY_REINFORCEMENT';
  delayMs: number;  // Seconds into the wave when this triggers
  data:    Record<string, unknown>;
}

// ─── Upgrade System ───────────────────────────────────────────────────────────

/** Definition of one purchasable upgrade */
export interface UpgradeDefinition {
  id:           string;
  name:         string;
  description:  string;
  category:     UpgradeCategory;
  cost:         number;   // Resource cost
  maxLevel:     number;
  effect:       UpgradeEffect;
}

/** The stat modification an upgrade applies */
export interface UpgradeEffect {
  statKey:      string;   // e.g. 'station.maxHealth', 'weapon.damage'
  addValue:     number;   // Flat addition per level
  multiplyValue: number;  // Multiplier per level (1.0 = no change)
}

// ─── Score System ────────────────────────────────────────────────────────────

/** Data for a score change event */
export interface ScoreEventData {
  points:       number;
  multiplier:   number;
  totalScore:   number;
  source:       string;  // 'asteroid_large', 'enemy_drone', etc.
  position:     Vector2; // World position for floating damage number
}

// ─── Input System ─────────────────────────────────────────────────────────────

/** Snapshot of all player input intent for one frame */
export interface InputState {
  aimAngle:       number;   // Radians — direction from station to mouse
  aimPosition:    Vector2;  // World-space mouse position
  isFiring:       boolean;  // Left mouse held
  isAlternate:    boolean;  // Right mouse held
  isShielding:    boolean;  // Space bar held
  rotationInput:  number;   // -1 (left), 0, +1 (right) — A/D keys
  justPaused:     boolean;  // Escape pressed THIS frame only
  justFiredOnce:  boolean;  // Mouse clicked THIS frame (not held)
}

// ─── Radar / Minimap ──────────────────────────────────────────────────────────

/** Simplified entity data for minimap rendering */
export interface RadarEntity {
  position:   Vector2;
  entityType: string;  // Tags.ASTEROID, Tags.ENEMY, etc.
  isHostile:  boolean;
}

// ─── Collision ────────────────────────────────────────────────────────────────

/** Result of a narrow-phase collision test */
export interface CollisionManifold {
  entityAId:        string;
  entityBId:        string;
  normal:           Vector2; // Points from B toward A
  penetrationDepth: number;  // Overlap distance in pixels
  contactPoint:     Vector2; // World-space point of contact
}

// ─── Save Data ────────────────────────────────────────────────────────────────

/** Structure of the persisted save file */
export interface SaveData {
  version:          string;
  timestamp:        number;
  highScore:        number;
  highestWave:      number;
  totalGamesPlayed: number;
  settings:         GameSettings;
}

/** Player-configurable settings */
export interface GameSettings {
  masterVolume:     number;  // 0-1
  sfxVolume:        number;  // 0-1
  musicVolume:      number;  // 0-1
  showTrajectory:   boolean;
  showDebugOverlay: boolean;
}