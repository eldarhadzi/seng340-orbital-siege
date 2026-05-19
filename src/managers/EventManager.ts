// src/managers/EventManager.ts
//
// The EventBus — central pub/sub event dispatcher.
//
// ARCHITECTURE PURPOSE:
// This is THE most important architectural component in Orbital Siege.
// It enables zero-coupling communication between all game systems.
//
// WITHOUT EventBus (tightly coupled — BAD):
//   PhysicsSystem directly imports ScoreManager and calls scoreManager.addPoints()
//   PhysicsSystem directly imports AudioSystem and calls audioSystem.play()
//   PhysicsSystem directly imports ParticleSystem and calls particles.explode()
//   → PhysicsSystem now depends on 3 other systems
//   → Can't test PhysicsSystem without all 3 systems present
//   → Circular imports become inevitable
//
// WITH EventBus (loosely coupled — GOOD):
//   PhysicsSystem.emit(GameEvents.ASTEROID_DESTROYED, { position, size })
//   ScoreManager listens for ASTEROID_DESTROYED and adds points
//   AudioSystem listens for ASTEROID_DESTROYED and plays sfx
//   ParticleSystem listens for ASTEROID_DESTROYED and spawns explosion
//   → PhysicsSystem has ZERO dependencies on those systems
//   → Each system can be developed, tested, and replaced independently
//
// IMPLEMENTATION:
// Singleton pattern — one EventManager instance for the entire game.
// Access via: EventManager.getInstance()

type EventCallback<T = unknown> = (data: T) => void;

interface ListenerEntry {
  callback: EventCallback<unknown>;
  once: boolean;  // If true, auto-remove after first trigger
}

export class EventManager {
  // Singleton instance
  private static _instance: EventManager | null = null;

  // Map of eventName → array of listener entries
  private listeners: Map<string, ListenerEntry[]> = new Map();

  // Debug mode: logs all events to console
  private debugMode: boolean = false;

  // Private constructor enforces singleton
  private constructor() {}

  /** Get the singleton instance */
  static getInstance(): EventManager {
    if (!EventManager._instance) {
      EventManager._instance = new EventManager();
    }
    return EventManager._instance;
  }

  /** Reset singleton (use only in tests) */
  static resetInstance(): void {
    EventManager._instance = null;
  }

  // ─── Subscribe ────────────────────────────────────────────────────────────

  /**
   * Subscribe to an event.
   * @param event    Event name (use GameEvents constants)
   * @param callback Function called when event fires
   * @returns Unsubscribe function — call it to remove the listener
   *
   * USAGE:
   *   const unsub = EventManager.getInstance().on(
   *     GameEvents.ASTEROID_DESTROYED,
   *     (data: AsteroidDestroyedData) => {
   *       this.score += data.points;
   *     }
   *   );
   *   // Later, in cleanup:
   *   unsub();
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry: ListenerEntry = {
      callback: callback as EventCallback<unknown>,
      once: false,
    };

    this.listeners.get(event)!.push(entry);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event — fires ONCE then auto-removes.
   * Use for: one-time notifications (wave start, game over).
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry: ListenerEntry = {
      callback: callback as EventCallback<unknown>,
      once: true,
    };

    this.listeners.get(event)!.push(entry);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe a specific callback from an event.
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const entries = this.listeners.get(event);
    if (!entries) { return; }

    const index = entries.findIndex(e => e.callback === callback);
    if (index !== -1) {
      entries.splice(index, 1);
    }
  }

  // ─── Emit ─────────────────────────────────────────────────────────────────

  /**
   * Emit an event, calling all registered listeners synchronously.
   * @param event Event name (use GameEvents constants)
   * @param data  Data payload passed to all listeners
   *
   * USAGE:
   *   EventManager.getInstance().emit(GameEvents.ASTEROID_DESTROYED, {
   *     position: asteroid.transform.position,
   *     size: asteroid.size,
   *     points: 150,
   *   });
   */
  emit<T = unknown>(event: string, data?: T): void {
    if (this.debugMode) {
      console.log(`[EventBus] Emit: ${event}`, data);
    }

    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) { return; }

    // Copy array before iterating — callbacks may add/remove listeners
    const snapshot = [...entries];

    for (const entry of snapshot) {
      entry.callback(data as unknown);
    }

    // Remove 'once' listeners that fired
    const remaining = entries.filter(e => !e.once || !snapshot.includes(e));
    this.listeners.set(event, remaining);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * Remove ALL listeners for a specific event.
   * Use when a scene shuts down to prevent memory leaks.
   */
  removeAllListeners(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove ALL listeners for ALL events.
   * Use on game reset or scene transition.
   */
  clearAll(): void {
    this.listeners.clear();
    if (this.debugMode) {
      console.log('[EventBus] All listeners cleared.');
    }
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /** List all registered events and listener counts */
  getRegisteredEvents(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [event, entries] of this.listeners.entries()) {
      result[event] = entries.length;
    }
    return result;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

// ─── Convenience Export ───────────────────────────────────────────────────────
// Saves typing EventManager.getInstance() everywhere.
// Usage: import { eventBus } from '@managers/EventManager';
//        eventBus.emit(GameEvents.ASTEROID_DESTROYED, data);

export const eventBus = EventManager.getInstance();