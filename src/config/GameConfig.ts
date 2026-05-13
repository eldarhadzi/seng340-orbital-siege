// src/config/GameConfig.ts
//
// Central Phaser game configuration.
// This file defines the Phaser.Game instance parameters:
// renderer type, canvas dimensions, physics engine, and scene list.
//
// ARCHITECTURE NOTE:
// All scenes are registered here. Phaser boots them in the order listed
// in the 'scene' array. Only BootScene starts automatically — all others
// are launched programmatically by the scenes themselves.
//
// This file will grow as we add scenes in later phases.
// For now it bootstraps with a single placeholder scene.

import Phaser from 'phaser';

// ─── Canvas Dimensions ──────────────────────────────────────────────────────
// We target 1280×720 (720p) as the base resolution.
// This gives a 16:9 aspect ratio that works on all modern monitors
// and scales cleanly on both laptop and presentation screens.
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// ─── Game Configuration Object ──────────────────────────────────────────────
export const GameConfig: Phaser.Types.Core.GameConfig = {
  // ── Renderer ──────────────────────────────────────────────────────────────
  // AUTO: Phaser selects WebGL if available, falls back to Canvas.
  // WebGL is required for particle effects, camera effects, and
  // the visual quality expected in this project.
  type: Phaser.AUTO,

  // ── Canvas Size ───────────────────────────────────────────────────────────
  width: GAME_WIDTH,
  height: GAME_HEIGHT,

  // ── Background Color ──────────────────────────────────────────────────────
  // Deep space black. The starfield system will paint over this.
  backgroundColor: '#000000',

  // ── Parent Element ────────────────────────────────────────────────────────
  // Phaser injects the canvas into <body> by default.
  // We leave parent undefined to use default body injection.
  parent: undefined,

  // ── Scale Manager ─────────────────────────────────────────────────────────
  // FIT: Scales the game to fit the browser window while maintaining
  // the 16:9 aspect ratio. Adds letterbox bars if needed.
  // This ensures the game looks identical on all screen sizes.
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    min: {
      width: 640,
      height: 360,
    },
    max: {
      width: 1920,
      height: 1080,
    },
  },

  // ── Physics Engine ────────────────────────────────────────────────────────
  // We use Arcade Physics as Phaser's built-in layer, but we build
  // our own physics simulation ON TOP of it.
  // Arcade gives us: sprite body management, basic overlap detection.
  // Our custom PhysicsSystem gives us: gravity, symplectic euler,
  // impulse resolution — the simulation layer required by SENG 340.
  //
  // gravity is set to { x: 0, y: 0 } because our GravitySystem
  // handles gravity manually — we do NOT want Phaser pulling everything down.
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false, // Set to true during Phase 3 to visualize Arcade bodies
    },
  },

  // ── Render Settings ───────────────────────────────────────────────────────
  render: {
    // Disable anti-aliasing for pixel-art sprites.
    // For high-res sprites, set this to true.
    antialias: true,
    // Round pixel positions to prevent sub-pixel blurring on sprites.
    // Important for sharp rendering at 60fps.
    roundPixels: false,
    // Transparent background (we use backgroundColor instead).
    transparent: false,
    // Power preference hint to GPU: 'high-performance' requests the
    // discrete GPU on multi-GPU systems (laptops).
    powerPreference: 'high-performance',
  },

  // ── Audio ─────────────────────────────────────────────────────────────────
  audio: {
    // Disable audio until Phase 7 to avoid browser autoplay warnings
    // during early development. Set to false in Phase 7.
    noAudio: false,
    disableWebAudio: false,
  },

  // ── Input ─────────────────────────────────────────────────────────────────
  input: {
    keyboard: true,
    mouse: true,
    touch: true,
    gamepad: false, // Enable in a future enhancement if desired
  },

  // ── Scenes ────────────────────────────────────────────────────────────────
  // Registered here. Active scenes are managed programmatically.
  // Phase 1: Only BootScene registered. More added each phase.
  scene: [
    // BootScene imported and registered in Phase 2.
    // For Phase 1 we use an inline placeholder scene.
  ],

  // ── Performance ───────────────────────────────────────────────────────────
  // fps target — Phaser will try to maintain this frame rate.
  // Our fixed-timestep physics runs independently of this.
  fps: {
    target: 60,
    forceSetTimeOut: false, // Use requestAnimationFrame (correct for games)
    smoothStep: true,       // Smooth delta time variance
  },

  // ── Banner ────────────────────────────────────────────────────────────────
  // Show Phaser branding in console. Useful to confirm version during dev.
  banner: {
    hidePhaser: false,
    text: '#ffffff',
    background: ['#000000'],
  },
};