// src/main.ts
//
// APPLICATION ENTRY POINT — Orbital Siege
// SENG 340 — Computer Games & Simulation
//
// This file has ONE responsibility: create the Phaser.Game instance.
// No game logic, no entity code, no system code belongs here.
//
// BOOT SEQUENCE:
//   1. Browser loads public/index.html
//   2. Vite serves src/main.ts as a module
//   3. Phaser.Game is constructed with GameConfig
//   4. Phaser initializes WebGL renderer
//   5. Phaser boots the first registered scene
//
// PHASE 1 NOTE:
//   We boot with an inline placeholder scene that draws a
//   confirmation message to the canvas. This verifies the entire
//   pipeline (Vite → TypeScript → Phaser → WebGL) is working.
//   The placeholder scene is replaced in Phase 2 with BootScene.

import Phaser from 'phaser';
import { GameConfig, GAME_WIDTH, GAME_HEIGHT } from '@config/GameConfig';

// ─── Phase 1 Placeholder Scene ──────────────────────────────────────────────
// This scene exists ONLY in Phase 1 to verify the pipeline works.
// It will be deleted and replaced with proper scene imports in Phase 2.
//
// It demonstrates:
//   - Phaser is initialized correctly
//   - WebGL renderer is active
//   - TypeScript compilation succeeded
//   - Vite path aliases resolve correctly (@config/GameConfig works)
//   - Canvas displays at correct dimensions

class Phase1VerificationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Phase1VerificationScene' });
  }

  create(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // ── Background gradient simulation ──────────────────────────────────────
    // Draw a simple space-like background using Phaser Graphics.
    // This confirms WebGL rendering is working.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x000010, 0x000010, 0x000028, 0x000028, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ── Decorative star field ────────────────────────────────────────────────
    // Scatter 200 random white dots to simulate stars.
    // Verifies that the Graphics API is functional.
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(0, GAME_HEIGHT);
      const size = Phaser.Math.FloatBetween(0.5, 2.0);
      stars.fillCircle(x, y, size);
    }

    // ── Gravity well simulation ──────────────────────────────────────────────
    // Draw a glowing circle at center to represent the gravity well.
    const wellGlow = this.add.graphics();
    wellGlow.fillStyle(0xffaa00, 0.15);
    wellGlow.fillCircle(centerX, centerY, 80);
    wellGlow.fillStyle(0xffcc44, 0.3);
    wellGlow.fillCircle(centerX, centerY, 50);
    wellGlow.fillStyle(0xffee88, 0.6);
    wellGlow.fillCircle(centerX, centerY, 25);
    wellGlow.fillStyle(0xffffff, 1.0);
    wellGlow.fillCircle(centerX, centerY, 10);

    // ── Orbiting asteroid demo ────────────────────────────────────────────────
    // Draw a small circle that orbits the gravity well.
    // Verifies that Phaser tweens and scene updates work.
    const orbitContainer = this.add.container(centerX, centerY);
    const asteroid = this.add.graphics();
    asteroid.fillStyle(0x8899aa, 1);
    asteroid.fillCircle(120, 0, 10);
    orbitContainer.add(asteroid);

    // Tween: rotate the container to create orbital motion
    this.tweens.add({
      targets: orbitContainer,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
    });

    // ── Status text ──────────────────────────────────────────────────────────
    // Confirm renderer type and resolution.
    const rendererType = this.game.renderer.type === Phaser.WEBGL
      ? 'WebGL (Hardware Accelerated)'
      : 'Canvas (Software)';

    // Title
    this.add.text(centerX, 80, 'ORBITAL SIEGE', {
      fontFamily: 'monospace',
      fontSize: '42px',
      color: '#4a9eff',
      stroke: '#000033',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(centerX, 130, 'SENG 340 — Computer Games & Simulation', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#8899cc',
    }).setOrigin(0.5);

    // Phase status
    this.add.text(centerX, centerY + 100, '✓ PHASE 1 COMPLETE', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#44ff88',
    }).setOrigin(0.5);

    // Pipeline verification
    const checks = [
      `✓ Renderer:     ${rendererType}`,
      `✓ Resolution:   ${GAME_WIDTH} × ${GAME_HEIGHT}`,
      `✓ TypeScript:   Compiled Successfully`,
      `✓ Phaser:       v${Phaser.VERSION}`,
      `✓ Vite Aliases: @config resolved`,
      `✓ Physics:      Arcade (gravity = 0,0)`,
    ];

    checks.forEach((line, index) => {
      this.add.text(centerX, centerY + 150 + (index * 26), line, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#aaccff',
      }).setOrigin(0.5);
    });

    // ── Renderer type warning ────────────────────────────────────────────────
    if (this.game.renderer.type !== Phaser.WEBGL) {
      this.add.text(centerX, GAME_HEIGHT - 40,
        '⚠ WARNING: WebGL not available. Check browser GPU settings.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ff4444',
      }).setOrigin(0.5);
    }

    // ── Console confirmation ─────────────────────────────────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ORBITAL SIEGE — Phase 1 Verification   ');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Phaser Version:   ${Phaser.VERSION}`);
    console.log(`  Renderer:         ${rendererType}`);
    console.log(`  Resolution:       ${GAME_WIDTH}×${GAME_HEIGHT}`);
    console.log(`  TypeScript:       OK`);
    console.log(`  Vite Aliases:     OK`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
}

// ─── Assemble Final Config ───────────────────────────────────────────────────
// We spread the base GameConfig and inject our Phase 1 scene.
// In Phase 2 this entire block is replaced with proper scene imports.
const config: Phaser.Types.Core.GameConfig = {
  ...GameConfig,
  scene: [Phase1VerificationScene],
};

// ─── Launch Game ─────────────────────────────────────────────────────────────
// new Phaser.Game(config) triggers the entire Phaser boot sequence:
//   1. Creates WebGL/Canvas renderer
//   2. Initializes all Phaser managers (input, audio, physics, scale, etc.)
//   3. Starts the first scene in the scene array
//
// We store the reference so it's accessible from browser console for debugging:
//   window.__GAME__.scene.scenes  ← all active scenes
//   window.__GAME__.renderer      ← renderer info
const game = new Phaser.Game(config);

// Attach to window for debugging access during development.
// This is removed in production builds via tree-shaking.
if (import.meta.env.DEV) {
  (window as Window & { __GAME__: Phaser.Game }).__GAME__ = game;
}

// Export for potential test access
export { game };