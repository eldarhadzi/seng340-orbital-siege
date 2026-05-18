// src/systems/WeaponSystem.ts
//
// Weapon management — firing logic, cooldowns, heat system.
//
// WEAPONS:
//   CANNON  → Fast, low damage, generates heat
//   MISSILE → Slow, high damage, gravity-affected arc
//   LASER   → Hold to charge, continuous damage (Phase 6+)
//
// HEAT SYSTEM:
// Firing generates heat (0-100 scale).
// At 100: weapon overheats — locked for OVERHEAT_COOLDOWN ms.
// When not firing: heat dissipates at PASSIVE_COOL_RATE per second.
// Creates a resource management mechanic: don't spam fire.

import { Vector2 } from '@utils/Vector2';
import { WeaponType } from '@typedefs/GameTypes';
import { BalanceConfig } from '@config/BalanceConfig';
import { ObjectPool } from '@utils/ObjectPool';
import { Projectile } from '@entities/Projectile';
import { entityManager } from '@managers/EntityManager';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';

export interface WeaponState {
  type:        WeaponType;
  heat:        number;       // 0-100
  overheated:  boolean;
  cooldownPct: number;       // 0=ready, 1=on cooldown
  ammo:        number;       // -1 = infinite
}

export class WeaponSystem {
  private activeWeapon:   WeaponType = WeaponType.CANNON;
  private projectilePool: ObjectPool<Projectile>;
  private ownerId:        string;

  // Per-weapon cooldown trackers (ms elapsed)
  private cooldownElapsed: number = 0;
  private cooldownDuration: number = BalanceConfig.CANNON_COOLDOWN_MS;
  private canFire:         boolean = true;

  // Heat
  private heat:            number  = 0;
  private overheated:      boolean = false;
  private overheatTimer:   number  = 0;

  constructor(projectilePool: ObjectPool<Projectile>, ownerId: string) {
    this.projectilePool = projectilePool;
    this.ownerId        = ownerId;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // ── Cooldown ───────────────────────────────────────────────────────────
    if (!this.canFire) {
      this.cooldownElapsed += deltaMs;
      if (this.cooldownElapsed >= this.cooldownDuration) {
        this.canFire         = true;
        this.cooldownElapsed = 0;
      }
    }

    // ── Overheat recovery ──────────────────────────────────────────────────
    if (this.overheated) {
      this.overheatTimer += deltaMs;
      if (this.overheatTimer >= BalanceConfig.WEAPON_OVERHEAT_COOLDOWN_MS) {
        this.overheated    = false;
        this.overheatTimer = 0;
        this.heat          = 0;
        eventBus.emit(GameEvents.WEAPON_COOLED, { type: this.activeWeapon });
      }
      return;
    }

    // ── Passive heat dissipation ───────────────────────────────────────────
    this.heat = Math.max(
      0,
      this.heat - BalanceConfig.WEAPON_PASSIVE_COOL_RATE * dt
    );
  }

  // ─── Fire ─────────────────────────────────────────────────────────────────

  /**
   * Attempt to fire the active weapon.
   * Returns true if a projectile was spawned.
   *
   * @param spawnPos   World position where projectile spawns
   * @param aimAngle   Direction in radians
   */
  tryFire(spawnPos: Vector2, aimAngle: number): boolean {
    if (!this.canFire || this.overheated) { return false; }

    switch (this.activeWeapon) {
      case WeaponType.CANNON:  return this.fireCannon(spawnPos, aimAngle);
      case WeaponType.MISSILE: return this.fireMissile(spawnPos, aimAngle);
      default: return false;
    }
  }

  private fireCannon(spawnPos: Vector2, aimAngle: number): boolean {
    const projectile = this.projectilePool.acquire();
    if (!projectile) { return false; }

    const vel = new Vector2(
      Math.cos(aimAngle) * BalanceConfig.CANNON_SPEED,
      Math.sin(aimAngle) * BalanceConfig.CANNON_SPEED
    );

    projectile.init(spawnPos.clone(), vel, WeaponType.CANNON,
                    BalanceConfig.CANNON_DAMAGE, this.ownerId);
    entityManager.register(projectile);

    // Heat and cooldown
    this.heat += BalanceConfig.CANNON_HEAT_PER_SHOT;
    this.cooldownDuration = BalanceConfig.CANNON_COOLDOWN_MS;
    this.canFire          = false;
    this.cooldownElapsed  = 0;

    if (this.heat >= BalanceConfig.WEAPON_MAX_HEAT) {
      this.overheated = true;
      this.heat       = BalanceConfig.WEAPON_MAX_HEAT;
      eventBus.emit(GameEvents.WEAPON_OVERHEATED, { type: this.activeWeapon });
    }

    eventBus.emit(GameEvents.WEAPON_FIRED, {
      type:     this.activeWeapon,
      position: spawnPos,
      angle:    aimAngle,
    });

    return true;
  }

  private fireMissile(spawnPos: Vector2, aimAngle: number): boolean {
    const projectile = this.projectilePool.acquire();
    if (!projectile) { return false; }

    const vel = new Vector2(
      Math.cos(aimAngle) * BalanceConfig.MISSILE_SPEED,
      Math.sin(aimAngle) * BalanceConfig.MISSILE_SPEED
    );

    projectile.init(spawnPos.clone(), vel, WeaponType.MISSILE,
                    BalanceConfig.MISSILE_DAMAGE, this.ownerId);
    entityManager.register(projectile);

    this.cooldownDuration = BalanceConfig.MISSILE_COOLDOWN_MS;
    this.canFire          = false;
    this.cooldownElapsed  = 0;

    eventBus.emit(GameEvents.WEAPON_FIRED, {
      type:     this.activeWeapon,
      position: spawnPos,
      angle:    aimAngle,
    });

    return true;
  }

  // ─── Weapon Switch ────────────────────────────────────────────────────────

  switchWeapon(type: WeaponType): void {
    if (this.activeWeapon === type) { return; }
    this.activeWeapon    = type;
    this.heat            = 0;
    this.overheated      = false;
    this.canFire         = true;
    this.cooldownElapsed = 0;
    this.cooldownDuration = type === WeaponType.CANNON
      ? BalanceConfig.CANNON_COOLDOWN_MS
      : BalanceConfig.MISSILE_COOLDOWN_MS;

    eventBus.emit(GameEvents.WEAPON_SWITCHED, { type });
  }

  // ─── State ────────────────────────────────────────────────────────────────

  getState(): WeaponState {
    return {
      type:        this.activeWeapon,
      heat:        this.heat,
      overheated:  this.overheated,
      cooldownPct: this.canFire ? 0 : this.cooldownElapsed / this.cooldownDuration,
      ammo:        -1,
    };
  }

  get currentWeapon(): WeaponType { return this.activeWeapon; }
  get isOverheated():  boolean    { return this.overheated; }
  get currentHeat():   number     { return this.heat; }

  applyDamageUpgrade(multiplier: number): void {
    // Called by UpgradeSystem — modifies damage output
    void multiplier; // Placeholder for Phase 6
  }

  reset(): void {
    this.heat            = 0;
    this.overheated      = false;
    this.canFire         = true;
    this.cooldownElapsed = 0;
    this.activeWeapon    = WeaponType.CANNON;
    this.cooldownDuration = BalanceConfig.CANNON_COOLDOWN_MS;
  }
}