// src/utils/ObjectPool.ts
//
// Generic object pool — the most important performance system in the game.
//
// THE PROBLEM IT SOLVES:
// JavaScript's garbage collector (GC) runs when many objects are created
// and discarded. In a 60fps game, GC can cause frame spikes (16ms+ pauses)
// that appear as stutters. The worst offenders:
//   - Bullets: fired and discarded many times per second
//   - Particles: hundreds created on each explosion
//   - Asteroids: fragmentation creates 2-3 new objects per hit
//
// THE SOLUTION:
// Pre-create N objects at startup. Instead of creating/destroying them,
// we "check out" an inactive object (acquire) and "return" it when done
// (release). The object is reset and reused — zero GC pressure.
//
// POOL SIZING GUIDE (from BalanceConfig):
//   Projectiles:  100  (rapid fire weapon can have 50 active at once)
//   Particles:    500  (large explosions spawn 50-100 particles each)
//   Asteroids:    80   (max active + fragments waiting to be recycled)
//
// HOW IT WORKS WITH BaseEntity:
// Every poolable entity must implement the Poolable interface.
// The pool calls reset() when an object is released, cleaning its state
// so it's ready to be reused without leftover data from its previous life.

/** Interface that poolable objects must implement */
export interface Poolable {
  /** Called when acquired from pool — initialize with new values */
  reset(): void;
  /** Whether this object is currently active (in use) */
  active: boolean;
}

/** Factory function type for creating new pool objects */
export type PoolFactory<T extends Poolable> = () => T;

// ─── Object Pool ─────────────────────────────────────────────────────────────

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private factory: PoolFactory<T>;
  private maxSize: number;
  private _activeCount: number = 0;
  private _name: string;

  /**
   * @param factory    Function that creates a new instance of T
   * @param initialSize Number of objects to pre-create at startup
   * @param maxSize    Maximum pool size (prevents unbounded growth)
   * @param name       Debug label (shown in performance logs)
   */
  constructor(
    factory: PoolFactory<T>,
    initialSize: number,
    maxSize: number,
    name: string = 'Pool'
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this._name = name;

    // Pre-warm the pool — create all objects upfront
    this.prewarm(initialSize);
  }

  // ─── Pool API ─────────────────────────────────────────────────────────────

  /**
   * Acquire an inactive object from the pool.
   * If all objects are active and pool is under maxSize, creates a new one.
   * Returns null if pool is exhausted.
   *
   * USAGE:
   *   const bullet = projectilePool.acquire();
   *   if (bullet) {
   *     bullet.init(position, velocity, damage);
   *   }
   */
  acquire(): T | null {
    // Find first inactive object
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        const obj = this.pool[i];
        obj.active = true;
        obj.reset();
        this._activeCount++;
        return obj;
      }
    }

    // Pool exhausted — try to expand (up to maxSize)
    if (this.pool.length < this.maxSize) {
      const obj = this.factory();
      obj.active = true;
      obj.reset();
      this.pool.push(obj);
      this._activeCount++;
      console.warn(`[ObjectPool:${this._name}] Expanded to ${this.pool.length}/${this.maxSize}`);
      return obj;
    }

    // Pool truly exhausted — log and return null
    console.error(`[ObjectPool:${this._name}] Pool exhausted! All ${this.maxSize} objects active.`);
    return null;
  }

  /**
   * Acquire multiple objects at once (for asteroid fragmentation).
   * Returns array of successfully acquired objects (may be shorter than n).
   */
  acquireMultiple(n: number): T[] {
    const results: T[] = [];
    for (let i = 0; i < n; i++) {
      const obj = this.acquire();
      if (obj) { results.push(obj); }
    }
    return results;
  }

  /**
   * Return an object to the pool.
   * The object is marked inactive — it will be reused on next acquire().
   *
   * USAGE:
   *   projectilePool.release(bullet);
   *   // Do NOT use bullet reference after this call
   */
  release(obj: T): void {
    if (!obj.active) {
      console.warn(`[ObjectPool:${this._name}] Attempted to release already-inactive object.`);
      return;
    }
    obj.active = false;
    this._activeCount = Math.max(0, this._activeCount - 1);
  }

  /** Release all active objects at once (e.g., on wave end or game reset) */
  releaseAll(): void {
    for (const obj of this.pool) {
      obj.active = false;
    }
    this._activeCount = 0;
  }

  // ─── Pool Management ──────────────────────────────────────────────────────

  /** Pre-create objects to fill the pool to a given size */
  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize) - this.pool.length;
    for (let i = 0; i < toCreate; i++) {
      const obj = this.factory();
      obj.active = false;
      this.pool.push(obj);
    }
  }

  /** Iterate over all currently active objects */
  forEachActive(callback: (obj: T, index: number) => void): void {
    let activeIndex = 0;
    for (const obj of this.pool) {
      if (obj.active) {
        callback(obj, activeIndex++);
      }
    }
  }

  /** Get all active objects as an array (allocates — avoid in hot path) */
  getActive(): T[] {
    return this.pool.filter(obj => obj.active);
  }

  // ─── Debug & Stats ────────────────────────────────────────────────────────

  get activeCount(): number { return this._activeCount; }
  get totalSize(): number   { return this.pool.length; }
  get availableCount(): number { return this.pool.length - this._activeCount; }
  get utilizationPercent(): number {
    return this.pool.length > 0 ? (this._activeCount / this.pool.length) * 100 : 0;
  }

  getStats(): string {
    return `[${this._name}] Active: ${this._activeCount}/${this.pool.length} (${this.utilizationPercent.toFixed(1)}%)`;
  }

  logStats(): void {
    console.log(this.getStats());
  }
}