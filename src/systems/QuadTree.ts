// src/systems/QuadTree.ts
//
// Spatial partitioning data structure for broad-phase collision detection.
//
// THE PROBLEM WITHOUT QUADTREE:
// Checking every entity against every other entity = O(n²) comparisons.
// With 80 entities: 80×79/2 = 3,160 checks per physics tick.
// At 60 ticks/second = 189,600 checks/second. Too slow at higher counts.
//
// THE SOLUTION WITH QUADTREE:
// Divide the world into recursive quadrants. Only check pairs that share
// the same quadrant leaf node. Reduces to O(n log n) average case.
// With 80 entities in a balanced tree: ~80×log₂(80) ≈ 480 checks.
// That is a 6.6× reduction in collision checks.
//
// HOW IT WORKS:
// 1. Every physics tick: clear and rebuild the entire tree
// 2. Insert all active entities by their AABB (axis-aligned bounding box)
// 3. Query: for each entity, retrieve all candidates in the same region
// 4. Return candidate pairs to the NarrowPhase for precise circle testing
//
// REBUILD EVERY TICK: Yes, this seems expensive, but entities move every
// tick so a persistent tree would need constant rebalancing — rebuilding
// is simpler and comparable in cost for our entity counts.

import { Vector2 } from '@utils/Vector2';

/** Axis-Aligned Bounding Box — the query shape for QuadTree */
export interface AABB {
  x:      number;  // Left edge
  y:      number;  // Top edge
  width:  number;
  height: number;
}

/** Minimal interface for objects that can be inserted into the QuadTree */
export interface QuadTreeItem {
  id:       string;
  position: Vector2;  // We read transform.position via this reference
  radius:   number;   // Collider radius — used to build AABB
}

// ─── QuadTree Node ────────────────────────────────────────────────────────────

class QuadTreeNode {
  private bounds:   AABB;
  private capacity: number;
  private items:    QuadTreeItem[] = [];
  private divided:  boolean = false;
  private depth:    number;
  private maxDepth: number;

  // Child nodes (NW, NE, SW, SE)
  private nw: QuadTreeNode | null = null;
  private ne: QuadTreeNode | null = null;
  private sw: QuadTreeNode | null = null;
  private se: QuadTreeNode | null = null;

  constructor(bounds: AABB, capacity: number, depth: number, maxDepth: number) {
    this.bounds   = bounds;
    this.capacity = capacity;
    this.depth    = depth;
    this.maxDepth = maxDepth;
  }

  // ─── Insert ───────────────────────────────────────────────────────────────

  insert(item: QuadTreeItem): boolean {
    // Build item AABB from position + radius
    const itemAABB: AABB = {
      x:      item.position.x - item.radius,
      y:      item.position.y - item.radius,
      width:  item.radius * 2,
      height: item.radius * 2,
    };

    // Reject if item doesn't intersect this node's bounds
    if (!this.intersectsAABB(itemAABB)) {
      return false;
    }

    // If we have capacity and haven't subdivided, store here
    if (this.items.length < this.capacity && !this.divided) {
      this.items.push(item);
      return true;
    }

    // Subdivide if not already done and not at max depth
    if (!this.divided && this.depth < this.maxDepth) {
      this.subdivide();
    }

    // If subdivided, try to insert into children
    if (this.divided) {
      // Item may overlap multiple quadrants — insert into all that intersect
      let inserted = false;
      if (this.nw!.insert(item)) { inserted = true; }
      if (this.ne!.insert(item)) { inserted = true; }
      if (this.sw!.insert(item)) { inserted = true; }
      if (this.se!.insert(item)) { inserted = true; }
      if (inserted) { return true; }
    }

    // Max depth reached — store at this node regardless of capacity
    this.items.push(item);
    return true;
  }

  // ─── Subdivide ────────────────────────────────────────────────────────────

  private subdivide(): void {
    const x  = this.bounds.x;
    const y  = this.bounds.y;
    const hw = this.bounds.width  / 2;
    const hh = this.bounds.height / 2;
    const nextDepth = this.depth + 1;

    this.nw = new QuadTreeNode(
      { x,      y,      width: hw, height: hh },
      this.capacity, nextDepth, this.maxDepth
    );
    this.ne = new QuadTreeNode(
      { x: x+hw, y,      width: hw, height: hh },
      this.capacity, nextDepth, this.maxDepth
    );
    this.sw = new QuadTreeNode(
      { x,       y: y+hh, width: hw, height: hh },
      this.capacity, nextDepth, this.maxDepth
    );
    this.se = new QuadTreeNode(
      { x: x+hw, y: y+hh, width: hw, height: hh },
      this.capacity, nextDepth, this.maxDepth
    );

    this.divided = true;

    // Re-insert existing items into children
    const existing = [...this.items];
    this.items = [];
    for (const item of existing) {
      let inserted = false;
      if (this.nw!.insert(item)) { inserted = true; }
      if (this.ne!.insert(item)) { inserted = true; }
      if (this.sw!.insert(item)) { inserted = true; }
      if (this.se!.insert(item)) { inserted = true; }
      if (!inserted) { this.items.push(item); }
    }
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  /**
   * Return all items that could collide with the given AABB.
   * Results are written into the provided array (avoids allocation).
   */
  query(range: AABB, results: QuadTreeItem[]): void {
    if (!this.intersectsAABB(range)) { return; }

    for (const item of this.items) {
      results.push(item);
    }

    if (this.divided) {
      this.nw!.query(range, results);
      this.ne!.query(range, results);
      this.sw!.query(range, results);
      this.se!.query(range, results);
    }
  }

  // ─── AABB Intersection Test ───────────────────────────────────────────────

  private intersectsAABB(other: AABB): boolean {
    return !(
      other.x > this.bounds.x + this.bounds.width  ||
      other.x + other.width  < this.bounds.x        ||
      other.y > this.bounds.y + this.bounds.height  ||
      other.y + other.height < this.bounds.y
    );
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  /** Collect all node bounds for debug rendering */
  collectBounds(out: AABB[]): void {
    out.push({ ...this.bounds });
    if (this.divided) {
      this.nw!.collectBounds(out);
      this.ne!.collectBounds(out);
      this.sw!.collectBounds(out);
      this.se!.collectBounds(out);
    }
  }

  getTotalItems(): number {
    let count = this.items.length;
    if (this.divided) {
      count += this.nw!.getTotalItems();
      count += this.ne!.getTotalItems();
      count += this.sw!.getTotalItems();
      count += this.se!.getTotalItems();
    }
    return count;
  }
}

// ─── QuadTree (Public API) ────────────────────────────────────────────────────

export class QuadTree {
  private root: QuadTreeNode;
  private capacity: number;
  private maxDepth: number;
  private worldBounds: AABB;

  // Reusable query results array — avoids allocation per query
  private _queryResults: QuadTreeItem[] = [];

  constructor(
    worldBounds: AABB,
    capacity: number = 4,
    maxDepth: number = 6
  ) {
    this.worldBounds = worldBounds;
    this.capacity    = capacity;
    this.maxDepth    = maxDepth;
    this.root        = new QuadTreeNode(worldBounds, capacity, 0, maxDepth);
  }

  /** Clear all items and reset the tree (call at start of each physics tick) */
  clear(): void {
    this.root = new QuadTreeNode(
      this.worldBounds, this.capacity, 0, this.maxDepth
    );
  }

  /** Insert a physics item into the tree */
  insert(item: QuadTreeItem): void {
    this.root.insert(item);
  }

  /** Insert multiple items at once */
  insertAll(items: QuadTreeItem[]): void {
    for (const item of items) {
      this.root.insert(item);
    }
  }

  /**
   * Get all candidate collision pairs.
   * For each item, query its neighborhood and form pairs.
   * Deduplicates pairs (A,B) and (B,A) using a Set.
   *
   * @returns Array of [itemA, itemB] pairs for narrow-phase testing
   */
  getCandidatePairs(items: QuadTreeItem[]): [QuadTreeItem, QuadTreeItem][] {
    const pairs: [QuadTreeItem, QuadTreeItem][] = [];
    const seen  = new Set<string>();

    for (const item of items) {
      // Build query range — slightly larger than collider to catch edge cases
      const range: AABB = {
        x:      item.position.x - item.radius * 2,
        y:      item.position.y - item.radius * 2,
        width:  item.radius * 4,
        height: item.radius * 4,
      };

      // Clear and reuse results array
      this._queryResults.length = 0;
      this.root.query(range, this._queryResults);

      for (const candidate of this._queryResults) {
        if (candidate.id === item.id) { continue; }

        // Create a canonical pair key (smaller ID first) to avoid duplicates
        const pairKey = item.id < candidate.id
          ? `${item.id}|${candidate.id}`
          : `${candidate.id}|${item.id}`;

        if (!seen.has(pairKey)) {
          seen.add(pairKey);
          pairs.push([item, candidate]);
        }
      }
    }

    return pairs;
  }

  /** Debug: get all node bounding boxes for rendering */
  getDebugBounds(): AABB[] {
    const bounds: AABB[] = [];
    this.root.collectBounds(bounds);
    return bounds;
  }

  get totalItems(): number {
    return this.root.getTotalItems();
  }
}