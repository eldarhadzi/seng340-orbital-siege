// src/config/BalanceConfig.ts
//
// Game balance values — difficulty, scoring, progression.
// Modifying this file is how you tune gameplay difficulty.

export const BalanceConfig = {
  // ─── Station Stats ───────────────────────────────────────────────────────
  STATION_MAX_HEALTH:        100,
  STATION_SHIELD_CAPACITY:   100,
  STATION_SHIELD_REGEN_RATE: 8,    // Units/second
  STATION_SHIELD_REGEN_DELAY_MS: 3000, // Delay before regen starts after hit
  STATION_ROTATION_SPEED:    3.5,  // Radians/second

  // ─── Damage Values ───────────────────────────────────────────────────────
  DAMAGE_ASTEROID_LARGE:  25,
  DAMAGE_ASTEROID_MEDIUM: 15,
  DAMAGE_ASTEROID_SMALL:  8,
  DAMAGE_ENEMY_COLLISION: 30,
  DAMAGE_ENEMY_PROJECTILE: 12,

  // ─── Weapon Stats ────────────────────────────────────────────────────────
  CANNON_DAMAGE:         18,
  CANNON_COOLDOWN_MS:    250,    // 4 shots/second
  CANNON_SPEED:          900,    // px/s
  CANNON_LIFETIME_MS:    2500,   // Despawns after 2.5 seconds if no hit
  CANNON_HEAT_PER_SHOT:  10,     // Heat generated per shot (0-100 scale)

  MISSILE_DAMAGE:        65,
  MISSILE_COOLDOWN_MS:   1200,
  MISSILE_SPEED:         500,
  MISSILE_LIFETIME_MS:   5000,
  MISSILE_HEAT_PER_SHOT: 0,      // Missiles don't generate heat

  LASER_DAMAGE_PER_SEC:  80,     // Damage per second while held
  LASER_HEAT_PER_SEC:    35,     // Heat per second while active
  LASER_CHARGE_TIME_MS:  400,    // Must hold before damage begins

  WEAPON_MAX_HEAT:        100,
  WEAPON_OVERHEAT_COOLDOWN_MS: 3000, // Penalty when heat maxes out
  WEAPON_PASSIVE_COOL_RATE: 15,  // Heat lost per second when not firing

  // ─── Score System ────────────────────────────────────────────────────────
  SCORE_ASTEROID_LARGE:   150,
  SCORE_ASTEROID_MEDIUM:  75,
  SCORE_ASTEROID_SMALL:   30,
  SCORE_ENEMY_DRONE:      200,
  SCORE_ENEMY_ORBIT:      350,
  SCORE_WAVE_COMPLETION:  500,

  COMBO_WINDOW_MS:        3000,  // Time between kills to maintain combo
  COMBO_MAX_MULTIPLIER:   8,     // Maximum combo multiplier (x8)
  COMBO_STEP:             0.5,   // Multiplier increases by this per kill

  // ─── Resource Drops ──────────────────────────────────────────────────────
  RESOURCE_DROP_CHANCE_ASTEROID: 0.4,   // 40% chance on asteroid death
  RESOURCE_DROP_CHANCE_ENEMY:    0.7,   // 70% chance on enemy death
  RESOURCE_VALUE_MIN:            5,
  RESOURCE_VALUE_MAX:            25,
  RESOURCE_LIFETIME_MS:          15000, // Despawns after 15 seconds

  // ─── Wave Scaling ────────────────────────────────────────────────────────
  // These formulas determine wave difficulty.
  // Wave N produces: BASE + SCALE * N enemies/asteroids.
  WAVE_ASTEROID_BASE:     3,
  WAVE_ASTEROID_SCALE:    1.5,   // +1.5 per wave (floor)
  WAVE_ENEMY_START_WAVE:  3,     // Enemies start appearing in wave 3
  WAVE_ENEMY_BASE:        0,
  WAVE_ENEMY_SCALE:       0.5,

  WAVE_SPEED_MULTIPLIER:  0.08,  // Enemy/asteroid speed +8% per wave
  WAVE_GRAVITY_MULTIPLIER: 0.05, // Gravity +5% per wave

  // Time between spawns during a wave (decreases as waves progress)
  WAVE_SPAWN_INTERVAL_BASE_MS:  1200,
  WAVE_SPAWN_INTERVAL_MIN_MS:   300,
  WAVE_SPAWN_INTERVAL_SCALE:    50,  // Reduce by 50ms per wave

  TOTAL_WAVES:            10,   // Set to Infinity for endless mode
  BOSS_WAVE_INTERVAL:     5,    // Boss appears every 5th wave

  // ─── Upgrades ────────────────────────────────────────────────────────────
  UPGRADE_CARDS_PER_WAVE:   3,   // How many choices shown after each wave
  UPGRADE_REROLL_COST:      30,  // Cost to reroll upgrade options

} as const;