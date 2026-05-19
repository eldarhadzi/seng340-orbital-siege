    // src/managers/UpgradeManager.ts
//
// Manages upgrade definitions, purchased upgrades, and stat modifications.

import { UpgradeDefinition, UpgradeCategory } from '@typedefs/GameTypes';
import { MathUtils } from '@utils/MathUtils';

// ─── All Available Upgrades ───────────────────────────────────────────────────

const ALL_UPGRADES: UpgradeDefinition[] = [
  // ── Weapon upgrades ────────────────────────────────────────────────────
  {
    id: 'cannon_damage_1',
    name: 'Reinforced Rounds',
    description: 'Cannon shots deal 25% more damage to asteroids and enemies.',
    category: UpgradeCategory.WEAPON,
    cost: 40,
    maxLevel: 3,
    effect: { statKey: 'cannon.damage', addValue: 5, multiplyValue: 1.25 },
  },
  {
    id: 'fire_rate_1',
    name: 'Rapid Cycling',
    description: 'Reduce cannon cooldown by 20%. Fire faster under pressure.',
    category: UpgradeCategory.WEAPON,
    cost: 50,
    maxLevel: 2,
    effect: { statKey: 'cannon.cooldown', addValue: 0, multiplyValue: 0.8 },
  },
  {
    id: 'missile_damage_1',
    name: 'Warhead Upgrade',
    description: 'Missiles deal 40% more damage on direct impact.',
    category: UpgradeCategory.WEAPON,
    cost: 60,
    maxLevel: 2,
    effect: { statKey: 'missile.damage', addValue: 25, multiplyValue: 1.4 },
  },
  {
    id: 'heat_sink_1',
    name: 'Heat Sink',
    description: 'Weapon heat dissipates 30% faster. Sustain fire longer.',
    category: UpgradeCategory.WEAPON,
    cost: 45,
    maxLevel: 2,
    effect: { statKey: 'weapon.coolRate', addValue: 5, multiplyValue: 1.3 },
  },

  // ── Defense upgrades ────────────────────────────────────────────────────
  {
    id: 'hull_plating_1',
    name: 'Hull Plating',
    description: 'Increases station hull integrity by 25 points.',
    category: UpgradeCategory.DEFENSE,
    cost: 55,
    maxLevel: 3,
    effect: { statKey: 'station.maxHealth', addValue: 25, multiplyValue: 1.0 },
  },
  {
    id: 'shield_capacity_1',
    name: 'Shield Emitter',
    description: 'Shield energy capacity increased by 30 points.',
    category: UpgradeCategory.DEFENSE,
    cost: 50,
    maxLevel: 2,
    effect: { statKey: 'station.shieldCapacity', addValue: 30, multiplyValue: 1.0 },
  },
  {
    id: 'shield_regen_1',
    name: 'Shield Regenerator',
    description: 'Shield recharges 50% faster between hits.',
    category: UpgradeCategory.DEFENSE,
    cost: 65,
    maxLevel: 2,
    effect: { statKey: 'station.shieldRegen', addValue: 4, multiplyValue: 1.5 },
  },

  // ── Utility upgrades ────────────────────────────────────────────────────
  {
    id: 'gravity_lens_1',
    name: 'Gravity Lens',
    description: 'Trajectory prediction shows 50% further. Better aim.',
    category: UpgradeCategory.UTILITY,
    cost: 35,
    maxLevel: 1,
    effect: { statKey: 'trajectory.steps', addValue: 45, multiplyValue: 1.0 },
  },
  {
    id: 'scanner_1',
    name: 'Deep Scanner',
    description: 'Minimap range extended by 40%. See threats earlier.',
    category: UpgradeCategory.UTILITY,
    cost: 30,
    maxLevel: 1,
    effect: { statKey: 'minimap.scale', addValue: 0, multiplyValue: 1.4 },
  },
  {
    id: 'collector_beam_1',
    name: 'Collector Beam',
    description: 'Resources are attracted toward the station automatically.',
    category: UpgradeCategory.UTILITY,
    cost: 45,
    maxLevel: 1,
    effect: { statKey: 'collector.range', addValue: 200, multiplyValue: 1.0 },
  },
];

// ─── UpgradeManager ───────────────────────────────────────────────────────────

export class UpgradeManager {
  private purchasedIds:  Set<string> = new Set();
  private resources:     number      = 0;

  // ─── Resources ────────────────────────────────────────────────────────────

  addResources(amount: number): void {
    this.resources += amount;
  }

  get currentResources(): number { return this.resources; }

  canAfford(upgrade: UpgradeDefinition): boolean {
    return this.resources >= upgrade.cost
        && !this.purchasedIds.has(upgrade.id);
  }

  // ─── Upgrade Options ──────────────────────────────────────────────────────

  /**
   * Get 3 random upgrade options for the shop.
   * Filters out already-purchased upgrades.
   * Tries to offer one from each category for variety.
   */
  getUpgradeOptions(count: number = 3): UpgradeDefinition[] {
    const available = ALL_UPGRADES.filter(u => !this.purchasedIds.has(u.id));
    if (available.length === 0) { return []; }

    // Try to get one from each category
    const byCategory: Record<string, UpgradeDefinition[]> = {};
    for (const u of available) {
      if (!byCategory[u.category]) { byCategory[u.category] = []; }
      byCategory[u.category].push(u);
    }

    const options: UpgradeDefinition[] = [];
    const categories = Object.values(byCategory);

    // Round-robin from categories
    for (let i = 0; i < count && available.length > 0; i++) {
      const cat = categories[i % categories.length];
      if (cat && cat.length > 0) {
        const pick = MathUtils.randomElement(cat);
        options.push(pick);
        // Remove from available to avoid duplicates
        const idx = cat.indexOf(pick);
        cat.splice(idx, 1);
      }
    }

    // Fill remaining slots with random picks
    while (options.length < count) {
      const remaining = available.filter(u => !options.includes(u));
      if (remaining.length === 0) { break; }
      options.push(MathUtils.randomElement(remaining));
    }

    return options.slice(0, count);
  }

  // ─── Purchase ─────────────────────────────────────────────────────────────

  purchase(upgrade: UpgradeDefinition): boolean {
    if (!this.canAfford(upgrade)) { return false; }

    this.resources    -= upgrade.cost;
    this.purchasedIds.add(upgrade.id);

    console.log(`[UpgradeManager] Purchased: ${upgrade.name}`);
    return true;
  }

  hasPurchased(id: string): boolean {
    return this.purchasedIds.has(id);
  }

  getPurchasedIds(): string[] {
    return Array.from(this.purchasedIds);
  }

  reset(): void {
    this.purchasedIds.clear();
    this.resources = 0;
  }
}