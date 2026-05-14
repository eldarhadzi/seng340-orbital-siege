// src/utils/Constants.ts
//
// Global constants registry for Orbital Siege.
//
// ARCHITECTURE NOTE:
// This file has a critical purpose: eliminating "magic strings" and
// "magic numbers" from the codebase.
//
// BAD (magic string):  eventBus.emit('asteroid_destroyed', data)
// GOOD (constant):     eventBus.emit(GameEvents.ASTEROID_DESTROYED, data)
//
// Why it matters:
//   - Typos in magic strings cause silent runtime bugs (no TypeScript error)
//   - Constants are autocompleted by VS Code (no typos possible)
//   - Renaming an event means changing ONE line here, not searching everywhere
//
// ORGANIZATION:
//   GameEvents    → EventBus event name strings
//   SceneKeys     → Phaser scene key strings
//   Tags          → Entity tag strings for EntityManager queries
//   Depths        → Render depth (z-index) values
//   CollisionCats → Collision category bitmasks

// ─── Event Names ─────────────────────────────────────────────────────────────
// All strings published on the EventBus.
// Consumers import this and use: EventManager.emit(GameEvents.FOO, data)

export const GameEvents = {
  // Physics events
  COLLISION_OCCURRED:       'collision:occurred',
  ASTEROID_FRAGMENTED:      'asteroid:fragmented',

  // Entity lifecycle
  ENTITY_SPAWNED:           'entity:spawned',
  ENTITY_DESTROYED:         'entity:destroyed',

  // Combat events
  ASTEROID_DESTROYED:       'asteroid:destroyed',
  ENEMY_DESTROYED:          'enemy:destroyed',
  PROJECTILE_HIT:           'projectile:hit',
  PROJECTILE_EXPIRED:       'projectile:expired',

  // Station events
  STATION_DAMAGED:          'station:damaged',
  STATION_DESTROYED:        'station:destroyed',
  SHIELD_ACTIVATED:         'shield:activated',
  SHIELD_DEACTIVATED:       'shield:deactivated',
  SHIELD_HIT:               'shield:hit',
  SHIELD_BROKEN:            'shield:broken',
  SHIELD_RECHARGED:         'shield:recharged',

  // Weapon events
  WEAPON_FIRED:             'weapon:fired',
  WEAPON_SWITCHED:          'weapon:switched',
  WEAPON_OVERHEATED:        'weapon:overheated',
  WEAPON_COOLED:            'weapon:cooled',

  // Wave events
  WAVE_STARTED:             'wave:started',
  WAVE_COMPLETED:           'wave:completed',
  WAVE_ENEMY_SPAWNED:       'wave:enemySpawned',
  ALL_WAVES_COMPLETE:       'wave:allComplete',

  // Score events
  SCORE_CHANGED:            'score:changed',
  COMBO_CHANGED:            'combo:changed',
  COMBO_BROKEN:             'combo:broken',
  HIGH_SCORE_BEATEN:        'score:highScoreBeaten',

  // Resource events
  RESOURCE_SPAWNED:         'resource:spawned',
  RESOURCE_COLLECTED:       'resource:collected',

  // Upgrade events
  UPGRADE_PURCHASED:        'upgrade:purchased',
  UPGRADE_APPLIED:          'upgrade:applied',

  // Game state events
  GAME_STARTED:             'game:started',
  GAME_PAUSED:              'game:paused',
  GAME_RESUMED:             'game:resumed',
  GAME_OVER:                'game:over',
  GAME_VICTORY:             'game:victory',

  // UI events
  HUD_UPDATE_REQUESTED:     'hud:updateRequested',

  // Audio events
  PLAY_SFX:                 'audio:playSfx',
  PLAY_MUSIC:               'audio:playMusic',
  STOP_MUSIC:               'audio:stopMusic',

  // Camera events
  CAMERA_SHAKE:             'camera:shake',
  CAMERA_FLASH:             'camera:flash',
} as const;

// Type for event names (enables type-safe event listeners)
export type GameEvent = typeof GameEvents[keyof typeof GameEvents];

// ─── Scene Keys ───────────────────────────────────────────────────────────────
// Phaser requires string keys to identify scenes.
// Never type these strings directly — always use SceneKeys.FOO.

export const SceneKeys = {
  BOOT:       'BootScene',
  PRELOAD:    'PreloadScene',
  MAIN_MENU:  'MainMenuScene',
  GAME:       'GameScene',
  UI:         'UIScene',
  PAUSE:      'PauseScene',
  UPGRADE:    'UpgradeScene',
  GAME_OVER:  'GameOverScene',
} as const;

// ─── Entity Tags ─────────────────────────────────────────────────────────────
// Used by EntityManager to filter entities by type.
// Example: entityManager.getByTag(Tags.ASTEROID)

export const Tags = {
  STATION:      'station',
  ASTEROID:     'asteroid',
  PROJECTILE:   'projectile',
  ENEMY:        'enemy',
  COLLECTIBLE:  'collectible',
  GRAVITY_WELL: 'gravityWell',
} as const;

// ─── Render Depths (Z-Index) ──────────────────────────────────────────────────
// Higher number = rendered on top.
// NEVER use raw numbers for setDepth() calls — always use Depths.FOO.

export const Depths = {
  BACKGROUND_FAR:    0,
  BACKGROUND_NEAR:   10,
  GRAVITY_FIELD:     20,
  ORBITAL_TRAILS:    30,
  COLLECTIBLES:      35,
  ASTEROIDS:         40,
  ENEMIES:           50,
  PROJECTILES:       60,
  STATION:           70,
  SHIELD:            75,
  PARTICLES:         80,
  SHOCKWAVE:         85,
  WORLD_UI:          100,  // floating damage numbers
  SCREEN_UI:         200,  // HUD (handled by UIScene)
  DEBUG_OVERLAY:     999,
} as const;

// ─── Asset Keys ───────────────────────────────────────────────────────────────
// All Phaser asset keys in one place.
// These must match the keys used in PreloadScene.

export const AssetKeys = {
  // Sprites
  STATION:          'station',
  STATION_SHIELD:   'station_shield',
  ASTEROIDS:        'asteroids',
  ENEMIES:          'enemies',
  PROJECTILES:      'projectiles',
  PARTICLES:        'particles',
  UI_ATLAS:         'ui_atlas',
  GRAVITY_WELL:     'gravity_well',

  // Backgrounds
  STARFIELD_FAR:    'starfield_far',
  STARFIELD_MID:    'starfield_mid',
  STARFIELD_NEAR:   'starfield_near',
  NEBULA_BG:        'nebula_bg',

  // Audio
  MUSIC_MENU:       'music_menu',
  MUSIC_GAMEPLAY:   'music_gameplay',
  MUSIC_BOSS:       'music_boss',
  MUSIC_VICTORY:    'music_victory',

  SFX_FIRE_CANNON:          'sfx_fire_cannon',
  SFX_FIRE_MISSILE:         'sfx_fire_missile',
  SFX_SHIELD_ACTIVATE:      'sfx_shield_activate',
  SFX_SHIELD_IMPACT:        'sfx_shield_impact',
  SFX_SHIELD_BREAK:         'sfx_shield_break',
  SFX_ASTEROID_EXPLODE_LG:  'sfx_asteroid_explode_large',
  SFX_ASTEROID_EXPLODE_SM:  'sfx_asteroid_explode_small',
  SFX_ASTEROID_HIT:         'sfx_asteroid_hit',
  SFX_ENEMY_EXPLODE:        'sfx_enemy_explode',
  SFX_STATION_DAMAGE:       'sfx_station_damage',
  SFX_RESOURCE_COLLECT:     'sfx_resource_collect',
  SFX_UPGRADE_SELECT:       'sfx_upgrade_select',
  SFX_WAVE_START:           'sfx_wave_start',
  SFX_WAVE_COMPLETE:        'sfx_wave_complete',
  SFX_AMBIENT:              'sfx_ambient_space',
} as const;

// ─── Collision Categories (bitmasks) ─────────────────────────────────────────
// Used by CollisionSystem to determine which entities check against each other.
// Bitmasks allow efficient bitwise AND checks:
//   entityA.collisionMask & entityB.collisionCategory → nonzero = check collision

export const CollisionCategory = {
  NONE:        0b00000000,
  STATION:     0b00000001,
  ASTEROID:    0b00000010,
  PROJECTILE:  0b00000100,
  ENEMY:       0b00001000,
  COLLECTIBLE: 0b00010000,
  SHIELD:      0b00100000,
} as const;

// ─── Weapon Types ─────────────────────────────────────────────────────────────
export const WeaponTypeKeys = {
  CANNON:   'cannon',
  MISSILE:  'missile',
  LASER:    'laser',
} as const;