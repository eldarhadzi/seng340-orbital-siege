// src/managers/EntityManager.ts
//
// Central registry for all active game entities.

import { BaseEntity } from '@entities/BaseEntity';

export class EntityManager {
  private static _instance: EntityManager | null = null;

  // Master registry: id → entity
  private entities: Map<string, BaseEntity> = new Map();

  // Tag index for fast filtered queries: tag → Set of entity ids
  private tagIndex: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): EntityManager {
    if (!EntityManager._instance) {
      EntityManager._instance = new EntityManager();
    }
    return EntityManager._instance;
  }

  static resetInstance(): void {
    EntityManager._instance = null;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  register(entity: BaseEntity): void {
    this.entities.set(entity.id, entity);

    if (!this.tagIndex.has(entity.tag)) {
      this.tagIndex.set(entity.tag, new Set());
    }
    this.tagIndex.get(entity.tag)!.add(entity.id);
  }

  unregister(entity: BaseEntity): void {
    this.entities.delete(entity.id);
    this.tagIndex.get(entity.tag)?.delete(entity.id);
  }

  unregisterId(id: string): void {
    const entity = this.entities.get(id);
    if (entity) { this.unregister(entity); }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getAll(): BaseEntity[] {
    const result: BaseEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.active) { result.push(entity); }
    }
    return result;
  }

  getByTag(tag: string): BaseEntity[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) { return []; }

    const result: BaseEntity[] = [];
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity && entity.active) { result.push(entity); }
    }
    return result;
  }

  getById(id: string): BaseEntity | undefined {
    return this.entities.get(id);
  }

  /** Count active entities with a specific tag */
  countByTag(tag: string): number {
    // FIX: iterate all entities and check tag + active directly.
    // The tag index can fall out of sync if entities are re-tagged
    // after registration. Direct iteration is authoritative.
    let count = 0;
    for (const entity of this.entities.values()) {
      if (entity.tag === tag && entity.active) {
        count++;
      }
    }
    return count;
  }

  /** Check if at least one active entity with this tag exists */
  hasTag(tag: string): boolean {
    for (const entity of this.entities.values()) {
      if (entity.tag === tag && entity.active) { return true; }
    }
    return false;
  }

  get totalActive(): number {
    let count = 0;
    for (const e of this.entities.values()) {
      if (e.active) { count++; }
    }
    return count;
  }

  /** Clear all entities — call on game reset */
  clear(): void {
    this.entities.clear();
    this.tagIndex.clear();
  }
}

export const entityManager = EntityManager.getInstance();