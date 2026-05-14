// src/config/RenderConfig.ts
//
// All rendering constants — depths, parallax speeds, visual parameters.

export const RenderConfig = {
  // ─── Virtual Resolution ──────────────────────────────────────────────────
  WIDTH:  1280,
  HEIGHT: 720,

  // ─── Camera ──────────────────────────────────────────────────────────────
  // Trauma system: trauma is added on impacts, decays over time.
  // Screen offset = sin(time * SHAKE_FREQUENCY) * MAX_SHAKE * trauma²
  CAMERA_SHAKE_MAX_OFFSET:  20,   // Maximum pixel offset during shake
  CAMERA_SHAKE_MAX_ROTATION: 0.05, // Maximum rotation during shake (radians)
  CAMERA_SHAKE_FREQUENCY:   25,   // Oscillations per second
  CAMERA_TRAUMA_DECAY:      1.5,  // Trauma units lost per second
  CAMERA_TRAUMA_ON_HIT:     0.4,  // Trauma added when station is hit
  CAMERA_TRAUMA_ON_DEATH:   1.0,  // Max trauma on station destruction
  CAMERA_LERP_SPEED:        5.0,  // Camera follow smoothing speed

  // ─── Parallax Starfield ──────────────────────────────────────────────────
  // Scroll speed multipliers relative to world movement
  PARALLAX_SPEED_FAR:    0.05,
  PARALLAX_SPEED_MID:    0.15,
  PARALLAX_SPEED_NEAR:   0.30,

  // ─── Particles ───────────────────────────────────────────────────────────
  PARTICLE_BUDGET_MAX:   400,  // Maximum simultaneous particles
  EXPLOSION_PARTICLES_LG: 60,
  EXPLOSION_PARTICLES_MD: 35,
  EXPLOSION_PARTICLES_SM: 15,
  PARTICLE_LIFETIME_MS:   800,
  PARTICLE_GRAVITY:       50,  // Slight downward drift on particles

  // ─── Orbital Trail ───────────────────────────────────────────────────────
  TRAIL_LENGTH:       20,     // Number of trail points
  TRAIL_FADE_TIME_MS: 300,    // How fast trail fades out
  TRAIL_WIDTH:        2,      // Trail line width (pixels)

  // ─── Trajectory Preview ──────────────────────────────────────────────────
  TRAJECTORY_STEPS:   90,       // Number of dots in the preview arc
  TRAJECTORY_STEP_DT: 1 / 60,   // Time per prediction step (seconds)
  TRAJECTORY_DOT_RADIUS: 2,
  TRAJECTORY_DOT_ALPHA_START: 0.8,
  TRAJECTORY_DOT_ALPHA_END:   0.1,
  TRAJECTORY_DOT_SPACING:     3,  // Show every Nth trajectory point

  // ─── UI Positions (normalized 0-1, multiply by screen size) ─────────────
  HUD_HEALTH_X:    0.03,
  HUD_HEALTH_Y:    0.05,
  HUD_SHIELD_X:    0.03,
  HUD_SHIELD_Y:    0.12,
  HUD_WEAPON_X:    0.03,
  HUD_WEAPON_Y:    0.20,
  HUD_SCORE_X:     0.97,
  HUD_SCORE_Y:     0.05,
  HUD_WAVE_X:      0.50,
  HUD_WAVE_Y:      0.04,
  HUD_MINIMAP_X:   0.97,
  HUD_MINIMAP_Y:   0.85,
  HUD_MINIMAP_SIZE: 150, // Minimap width/height in pixels

  // ─── Minimap ─────────────────────────────────────────────────────────────
  MINIMAP_WORLD_SCALE: 0.10,  // World units → minimap pixels scale factor

  // ─── Damage Numbers ──────────────────────────────────────────────────────
  DAMAGE_NUMBER_RISE_SPEED:  60,   // px/s upward drift
  DAMAGE_NUMBER_LIFETIME_MS: 1200,
  DAMAGE_NUMBER_FADE_DELAY:  600,  // Start fading after this many ms

  // ─── Gravity Well Visual ─────────────────────────────────────────────────
  GRAVITY_WELL_PULSE_SPEED: 1.5,   // Glow pulse frequency (cycles/sec)
  GRAVITY_WELL_MIN_ALPHA:   0.5,
  GRAVITY_WELL_MAX_ALPHA:   1.0,

  // ─── Screen Flash ────────────────────────────────────────────────────────
  FLASH_DAMAGE_COLOR:  0xff2200,
  FLASH_DAMAGE_ALPHA:  0.3,
  FLASH_DAMAGE_DURATION_MS: 200,

} as const;