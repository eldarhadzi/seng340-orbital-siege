// src/config/AudioConfig.ts
//
// Audio system configuration constants.

export const AudioConfig = {
  // ─── Default Volumes ─────────────────────────────────────────────────────
  DEFAULT_MASTER_VOLUME: 0.8,
  DEFAULT_SFX_VOLUME:    0.7,
  DEFAULT_MUSIC_VOLUME:  0.4,
  DEFAULT_AMBIENT_VOLUME: 0.3,

  // ─── Spatial Audio ────────────────────────────────────────────────────────
  // Maximum distance at which spatial audio is fully silent
  SPATIAL_MAX_DISTANCE:  900,   // pixels
  // Range over which panning is calculated
  SPATIAL_PAN_RANGE:     640,   // pixels from center

  // ─── Music ────────────────────────────────────────────────────────────────
  MUSIC_CROSSFADE_DURATION_MS: 2000,
  MUSIC_LOOP: true,

  // ─── SFX Pooling ─────────────────────────────────────────────────────────
  // Maximum simultaneous sound instances
  SFX_MAX_CHANNELS: 32,

  // ─── Pitch Variance ──────────────────────────────────────────────────────
  // Random pitch shift applied to SFX for variety (prevents repetition)
  PITCH_VARIANCE_CANNON:   0.08,  // ±8% pitch shift
  PITCH_VARIANCE_EXPLOSION: 0.15,
  PITCH_VARIANCE_HIT:       0.10,

  // ─── Rate Limiting ───────────────────────────────────────────────────────
  // Minimum ms between plays of the same SFX key (prevents audio spam)
  SFX_DEBOUNCE_MS: 50,

} as const;