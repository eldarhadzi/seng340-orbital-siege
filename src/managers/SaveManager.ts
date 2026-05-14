// src/managers/SaveManager.ts
//
// localStorage persistence for settings, high scores, and wave progress.

import { SaveData, GameSettings } from '@typedefs/GameTypes';

const SAVE_KEY     = 'orbital_siege_save';
const SAVE_VERSION = '1.0.0';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume:     0.8,
  sfxVolume:        0.7,
  musicVolume:      0.4,
  showTrajectory:   true,
  showDebugOverlay: false,
};

const DEFAULT_SAVE: SaveData = {
  version:          SAVE_VERSION,
  timestamp:        0,
  highScore:        0,
  highestWave:      0,
  totalGamesPlayed: 0,
  settings:         { ...DEFAULT_SETTINGS },
};

export class SaveManager {
  private static _instance: SaveManager | null = null;
  private currentData: SaveData;

  private constructor() {
    this.currentData = this.load();
  }

  static getInstance(): SaveManager {
    if (!SaveManager._instance) {
      SaveManager._instance = new SaveManager();
    }
    return SaveManager._instance;
  }

  // ─── Load ─────────────────────────────────────────────────────────────────

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } }; }

      const parsed = JSON.parse(raw) as Partial<SaveData>;

      // Version migration: if save version doesn't match, migrate or reset
      if (parsed.version !== SAVE_VERSION) {
        console.warn(`[SaveManager] Save version mismatch: ${parsed.version} → ${SAVE_VERSION}. Migrating.`);
        return this.migrate(parsed);
      }

      // Merge with defaults to handle any missing fields from older saves
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
    } catch (err) {
      console.error('[SaveManager] Failed to load save data:', err);
      return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
    }
  }

  private migrate(oldData: Partial<SaveData>): SaveData {
    // Preserve gameplay stats, reset version
    return {
      ...DEFAULT_SAVE,
      highScore:        oldData.highScore        ?? 0,
      highestWave:      oldData.highestWave       ?? 0,
      totalGamesPlayed: oldData.totalGamesPlayed  ?? 0,
      settings:         { ...DEFAULT_SETTINGS, ...oldData.settings },
      version:          SAVE_VERSION,
    };
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  save(): void {
    try {
      this.currentData.timestamp = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.currentData));
    } catch (err) {
      console.error('[SaveManager] Failed to save:', err);
    }
  }

  // ─── Getters / Setters ────────────────────────────────────────────────────

  get highScore(): number             { return this.currentData.highScore; }
  get highestWave(): number           { return this.currentData.highestWave; }
  get totalGamesPlayed(): number      { return this.currentData.totalGamesPlayed; }
  get settings(): GameSettings        { return this.currentData.settings; }

  submitScore(score: number, wave: number): boolean {
    let newHighScore = false;
    this.currentData.totalGamesPlayed++;

    if (score > this.currentData.highScore) {
      this.currentData.highScore = score;
      newHighScore = true;
    }

    if (wave > this.currentData.highestWave) {
      this.currentData.highestWave = wave;
    }

    this.save();
    return newHighScore;
  }

  updateSettings(settings: Partial<GameSettings>): void {
    this.currentData.settings = { ...this.currentData.settings, ...settings };
    this.save();
  }

  deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    this.currentData = { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
  }
}

export const saveManager = SaveManager.getInstance();