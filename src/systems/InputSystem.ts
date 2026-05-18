// src/systems/InputSystem.ts
//
// Unified input handler — converts raw hardware events into Intent actions.
//
// ARCHITECTURE:
// Game logic never reads raw key codes or mouse buttons directly.
// Instead it reads an InputState snapshot produced by this system.
// This means: adding gamepad support = change InputSystem only.
// Zero changes to game logic code.
//
// EDGE DETECTION:
// justFired / justPaused are true for exactly ONE frame.
// They are reset at the start of each update() call.
// This prevents "held key = spam action" bugs.

import Phaser from 'phaser';
import { InputState } from '@typedefs/GameTypes';
import { Vector2 } from '@utils/Vector2';
import { CameraSystem } from '@systems/CameraSystem';

export class InputSystem {
  private scene:        Phaser.Scene;
  private camera:       CameraSystem;
  private keys!:        Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!:        Phaser.Input.Keyboard.Key;
  private keyD!:        Phaser.Input.Keyboard.Key;
  private keySpace!:    Phaser.Input.Keyboard.Key;
  private keyEsc!:      Phaser.Input.Keyboard.Key;
  private key1!:        Phaser.Input.Keyboard.Key;
  private key2!:        Phaser.Input.Keyboard.Key;
  private key3!:        Phaser.Input.Keyboard.Key;

  // Track previous frame state for edge detection
  private prevEscDown:   boolean = false;

  // Current input state snapshot
  private _state: InputState = {
    aimAngle:      0,
    aimPosition:   new Vector2(0, 0),
    isFiring:      false,
    isAlternate:   false,
    isShielding:   false,
    rotationInput: 0,
    justPaused:    false,
    justFiredOnce: false,
  };

  constructor(scene: Phaser.Scene, camera: CameraSystem) {
    this.scene  = scene;
    this.camera = camera;
    this.setupKeys();
  }

  private setupKeys(): void {
    const kb = this.scene.input.keyboard!;
    this.keys     = kb.createCursorKeys();
    this.keyA     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyEsc   = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.key1     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this.key2     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
    this.key3     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Sample all input devices and produce InputState snapshot.
   * Call once per frame before any game logic reads input.
   */
  update(): void {
    const pointer  = this.scene.input.activePointer;
    const escDown  = this.keyEsc.isDown;
    const spaceDown = this.keySpace.isDown;

    // ── Mouse aim ──────────────────────────────────────────────────────────
    const worldPos = this.camera.screenToWorld(pointer.x, pointer.y);
    this._state.aimPosition.copyFrom(worldPos);
    this._state.aimAngle = Math.atan2(worldPos.y, worldPos.x);

    // ── Firing ─────────────────────────────────────────────────────────────
    this._state.isFiring      = pointer.leftButtonDown();
    this._state.isAlternate   = pointer.rightButtonDown();
    this._state.justFiredOnce = pointer.leftButtonDown() && !pointer.leftButtonReleased();

    // ── Shield ─────────────────────────────────────────────────────────────
    this._state.isShielding = spaceDown;

    // ── Rotation ───────────────────────────────────────────────────────────
    const rotLeft  = this.keyA.isDown || this.keys.left?.isDown;
    const rotRight = this.keyD.isDown || this.keys.right?.isDown;
    this._state.rotationInput = rotLeft ? -1 : rotRight ? 1 : 0;

    // ── Edge detection: justPaused ─────────────────────────────────────────
    // True only on the frame Escape is FIRST pressed (not held)
    this._state.justPaused = escDown && !this.prevEscDown;

    // Store for next frame
    this.prevEscDown   = escDown;
  }

  get state(): InputState { return this._state; }

  /** Check if weapon switch key was pressed */
  getWeaponSwitch(): number | null {
    if (Phaser.Input.Keyboard.JustDown(this.key1)) { return 0; }
    if (Phaser.Input.Keyboard.JustDown(this.key2)) { return 1; }
    if (Phaser.Input.Keyboard.JustDown(this.key3)) { return 2; }
    return null;
  }
}