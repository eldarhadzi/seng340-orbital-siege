// src/systems/AudioSystem.ts
//
// Complete audio system for Orbital Siege.
//
// ARCHITECTURE:
// Uses the Web Audio API directly via Phaser's sound manager wrapper.
// All SFX are generated procedurally using oscillators and noise —
// no external audio files required. This is important for the project
// because it means the game runs completely without any asset downloads.
//
// THREE AUDIO TIERS:
//
//   Tier 1: Music Layer
//     Procedurally generated ambient music using oscillators.
//     State machine: MENU → GAMEPLAY → BOSS → VICTORY
//     Crossfade duration: 2 seconds between states.
//
//   Tier 2: SFX Manager
//     Web Audio API oscillator-based sound effects.
//     Each SFX type has a synthesizer function that generates
//     the appropriate waveform, frequency sweep, and envelope.
//     Spatial audio: pan = clamp(worldX / PAN_RANGE, -1, 1)
//     Volume attenuation: 1 - clamp(distance / MAX_DIST, 0, 1)
//
//   Tier 3: Ambient Layer
//     Continuous low-frequency hum simulating space ambience.
//     Volume scales with number of active enemies (tension building).
//
// WHY PROCEDURAL AUDIO?
//   1. Zero external dependencies — game runs without any audio files
//   2. Demonstrates Web Audio API knowledge (academic value)
//   3. Each play is slightly varied (random pitch offsets)
//   4. Smaller bundle size
//
// ACADEMIC NOTE:
// Web Audio API uses a graph-based DSP (Digital Signal Processing) model.
// OscillatorNode → GainNode → StereoPannerNode → AudioContext.destination
// This is the same architecture used in professional audio software.

import Phaser from 'phaser';
import { AudioConfig } from '@config/AudioConfig';
import { eventBus } from '@managers/EventManager';
import { GameEvents } from '@utils/Constants';
import { MathUtils } from '@utils/MathUtils';
import { SaveManager } from '@managers/SaveManager';

// ─── Music States ─────────────────────────────────────────────────────────────

export enum MusicState {
  NONE      = 'NONE',
  MENU      = 'MENU',
  GAMEPLAY  = 'GAMEPLAY',
  BOSS      = 'BOSS',
  VICTORY   = 'VICTORY',
}

// ─── SFX Types ────────────────────────────────────────────────────────────────

export enum SFXType {
  FIRE_CANNON         = 'FIRE_CANNON',
  FIRE_MISSILE        = 'FIRE_MISSILE',
  ASTEROID_EXPLODE_LG = 'ASTEROID_EXPLODE_LG',
  ASTEROID_EXPLODE_MD = 'ASTEROID_EXPLODE_MD',
  ASTEROID_EXPLODE_SM = 'ASTEROID_EXPLODE_SM',
  ASTEROID_HIT        = 'ASTEROID_HIT',
  ENEMY_EXPLODE       = 'ENEMY_EXPLODE',
  STATION_DAMAGE      = 'STATION_DAMAGE',
  SHIELD_HIT          = 'SHIELD_HIT',
  SHIELD_BREAK        = 'SHIELD_BREAK',
  WEAPON_OVERHEAT     = 'WEAPON_OVERHEAT',
  WEAPON_COOLED       = 'WEAPON_COOLED',
  WAVE_START          = 'WAVE_START',
  WAVE_COMPLETE       = 'WAVE_COMPLETE',
  RESOURCE_COLLECT    = 'RESOURCE_COLLECT',
  UPGRADE_SELECT      = 'UPGRADE_SELECT',
  COMBO_MILESTONE     = 'COMBO_MILESTONE',
  GAME_OVER           = 'GAME_OVER',
  VICTORY             = 'VICTORY',
}

// ─── Debounce tracker ────────────────────────────────────────────────────────

interface DebounceEntry {
  lastPlayed: number;
  minInterval: number;
}

// ─── AudioSystem ─────────────────────────────────────────────────────────────

export class AudioSystem {
  private scene:       Phaser.Scene;
  private audioCtx:    AudioContext | null = null;
  private masterGain!: GainNode;
  private sfxGain!:    GainNode;
  private musicGain!:  GainNode;
  private ambientGain!: GainNode;

  // Music state
  private musicState:   MusicState = MusicState.NONE;
  private musicNodes:   OscillatorNode[] = [];
  private musicTimers:  ReturnType<typeof setInterval>[] = [];

  // Ambient
  private ambientNodes: OscillatorNode[] = [];
  private ambientActive: boolean = false;

  // Volume settings
  private masterVol: number;
  private sfxVol:    number;
  private musicVol:  number;

  // Debounce: prevent SFX spam
  private debounce: Map<string, DebounceEntry> = new Map();

  // Track if audio context has been resumed (browser autoplay policy)
  private contextStarted: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const settings  = SaveManager.getInstance().settings;
    this.masterVol  = settings.masterVolume;
    this.sfxVol     = settings.sfxVolume;
    this.musicVol   = settings.musicVolume;
  }

  // ─── Initialization ───────────────────────────────────────────────────────

  /**
   * Initialize Web Audio API context and gain graph.
   * Must be called after a user gesture (browser autoplay policy).
   */
  init(): void {
    try {
      this.audioCtx = new AudioContext();

      // Build gain graph:
      // masterGain → destination
      //   ├── sfxGain → masterGain
      //   ├── musicGain → masterGain
      //   └── ambientGain → masterGain

      this.masterGain  = this.audioCtx.createGain();
      this.sfxGain     = this.audioCtx.createGain();
      this.musicGain   = this.audioCtx.createGain();
      this.ambientGain = this.audioCtx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.applyVolumes();
      this.contextStarted = true;

      console.log('[AudioSystem] Web Audio API initialized.');
    } catch (e) {
      console.warn('[AudioSystem] Web Audio API not available:', e);
    }
  }

  /**
   * Resume audio context after user interaction.
   * Required by browser autoplay policy.
   */
  async resumeContext(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  // ─── Event Bus Wiring ─────────────────────────────────────────────────────

  /**
   * Subscribe to all game events and play appropriate audio.
   * Called once during GameScene.create().
   */
  wireEvents(): void {
    // Weapon fired
    eventBus.on(GameEvents.WEAPON_FIRED, (data: unknown) => {
      const d = data as { type: string; position: { x: number; y: number } };
      if (d.type === 'CANNON') {
        this.playSFX(SFXType.FIRE_CANNON, d.position.x, d.position.y);
      } else if (d.type === 'MISSILE') {
        this.playSFX(SFXType.FIRE_MISSILE, d.position.x, d.position.y);
      }
    });

    // Collision — plays on every collision, spatially positioned
    eventBus.on(GameEvents.COLLISION_OCCURRED, (data: unknown) => {
      const d = data as { contactPoint: { x: number; y: number } };
      this.playSFX(SFXType.ASTEROID_HIT, d.contactPoint.x, d.contactPoint.y);
    });

    // Asteroid destroyed
    eventBus.on(GameEvents.ASTEROID_DESTROYED, (data: unknown) => {
      const d = data as { size: string; position: { x: number; y: number } };
      if (d.size === 'LARGE') {
        this.playSFX(SFXType.ASTEROID_EXPLODE_LG, d.position.x, d.position.y);
      } else if (d.size === 'MEDIUM') {
        this.playSFX(SFXType.ASTEROID_EXPLODE_MD, d.position.x, d.position.y);
      } else {
        this.playSFX(SFXType.ASTEROID_EXPLODE_SM, d.position.x, d.position.y);
      }
    });

    // Enemy destroyed
    eventBus.on(GameEvents.ENEMY_DESTROYED, (data: unknown) => {
      const d = data as { position: { x: number; y: number } };
      this.playSFX(SFXType.ENEMY_EXPLODE, d.position.x, d.position.y);
    });

    // Station damaged
    eventBus.on(GameEvents.STATION_DAMAGED, () => {
      this.playSFX(SFXType.STATION_DAMAGE, 0, 0);
    });

    // Shield events
    eventBus.on(GameEvents.SHIELD_HIT, () => {
      this.playSFX(SFXType.SHIELD_HIT, 0, 0);
    });
    eventBus.on(GameEvents.SHIELD_BROKEN, () => {
      this.playSFX(SFXType.SHIELD_BREAK, 0, 0);
    });

    // Weapon heat
    eventBus.on(GameEvents.WEAPON_OVERHEATED, () => {
      this.playSFX(SFXType.WEAPON_OVERHEAT, 0, 0);
    });
    eventBus.on(GameEvents.WEAPON_COOLED, () => {
      this.playSFX(SFXType.WEAPON_COOLED, 0, 0);
    });

    // Wave events
    eventBus.on(GameEvents.WAVE_STARTED, () => {
      this.playSFX(SFXType.WAVE_START, 0, 0);
    });
    eventBus.on(GameEvents.WAVE_COMPLETED, () => {
      this.playSFX(SFXType.WAVE_COMPLETE, 0, 0);
    });

    // Score / combo
    eventBus.on(GameEvents.RESOURCE_COLLECTED, (data: unknown) => {
      const d = data as { position: { x: number; y: number } };
      this.playSFX(SFXType.RESOURCE_COLLECT, d.position.x, d.position.y);
    });
    eventBus.on(GameEvents.COMBO_CHANGED, (data: unknown) => {
      const d = data as { multiplier: number };
      if (d.multiplier >= 3.0) {
        this.playSFX(SFXType.COMBO_MILESTONE, 0, 0);
      }
    });

    // Game state
    eventBus.on(GameEvents.GAME_OVER, () => {
      this.stopMusic();
      this.stopAmbient();
      this.playSFX(SFXType.GAME_OVER, 0, 0);
    });
    eventBus.on(GameEvents.GAME_VICTORY, () => {
      this.stopMusic();
      this.stopAmbient();
      this.playSFX(SFXType.VICTORY, 0, 0);
    });

    // Upgrade
    eventBus.on(GameEvents.UPGRADE_PURCHASED, () => {
      this.playSFX(SFXType.UPGRADE_SELECT, 0, 0);
    });
  }

  // ─── SFX Synthesis ────────────────────────────────────────────────────────

  /**
   * Play a synthesized sound effect.
   *
   * SPATIAL AUDIO:
   * If worldX/worldY are provided, calculates:
   *   pan    = clamp(worldX / PAN_RANGE, -1, 1)
   *   volume = 1 - clamp(distance / MAX_DISTANCE, 0, 1)
   *
   * @param type    SFX type to synthesize
   * @param worldX  World X position (0 = center)
   * @param worldY  World Y position (0 = center)
   */
  playSFX(type: SFXType, worldX: number = 0, worldY: number = 0): void {
    if (!this.audioCtx || !this.contextStarted) { return; }

    // Debounce check — prevent same SFX playing too frequently
    const now = this.audioCtx.currentTime * 1000;
    const key = type.toString();
    const db  = this.debounce.get(key);
    if (db && (now - db.lastPlayed) < db.minInterval) { return; }
    this.debounce.set(key, {
      lastPlayed: now,
      minInterval: AudioConfig.SFX_DEBOUNCE_MS,
    });

    // Calculate spatial audio parameters
    const pan    = this.calculatePan(worldX);
    const volume = this.calculateSpatialVolume(worldX, worldY);

    if (volume < 0.01) { return; } // Too far away — skip

    // Synthesize the appropriate sound
    switch (type) {
      case SFXType.FIRE_CANNON:         this.synthCannon(pan, volume);     break;
      case SFXType.FIRE_MISSILE:        this.synthMissile(pan, volume);    break;
      case SFXType.ASTEROID_EXPLODE_LG: this.synthBoomLarge(pan, volume);  break;
      case SFXType.ASTEROID_EXPLODE_MD: this.synthBoomMedium(pan, volume); break;
      case SFXType.ASTEROID_EXPLODE_SM: this.synthBoomSmall(pan, volume);  break;
      case SFXType.ASTEROID_HIT:        this.synthImpact(pan, volume);     break;
      case SFXType.ENEMY_EXPLODE:       this.synthEnemyBoom(pan, volume);  break;
      case SFXType.STATION_DAMAGE:      this.synthStationHit(pan, volume); break;
      case SFXType.SHIELD_HIT:          this.synthShieldHit(pan, volume);  break;
      case SFXType.SHIELD_BREAK:        this.synthShieldBreak(pan, volume);break;
      case SFXType.WEAPON_OVERHEAT:     this.synthOverheat(pan, volume);   break;
      case SFXType.WEAPON_COOLED:       this.synthCooled(pan, volume);     break;
      case SFXType.WAVE_START:          this.synthWaveStart(pan, volume);  break;
      case SFXType.WAVE_COMPLETE:       this.synthWaveComplete(pan, volume);break;
      case SFXType.RESOURCE_COLLECT:    this.synthCollect(pan, volume);    break;
      case SFXType.UPGRADE_SELECT:      this.synthUpgrade(pan, volume);    break;
      case SFXType.COMBO_MILESTONE:     this.synthCombo(pan, volume);      break;
      case SFXType.GAME_OVER:           this.synthGameOver(pan, volume);   break;
      case SFXType.VICTORY:             this.synthVictory(pan, volume);    break;
    }
  }

  // ─── Spatial Audio Calculation ────────────────────────────────────────────

  private calculatePan(worldX: number): number {
    return MathUtils.clamp(
      worldX / AudioConfig.SPATIAL_PAN_RANGE,
      -1, 1
    );
  }

  private calculateSpatialVolume(worldX: number, worldY: number): number {
    const dist = Math.sqrt(worldX * worldX + worldY * worldY);
    return 1 - MathUtils.clamp(dist / AudioConfig.SPATIAL_MAX_DISTANCE, 0, 1);
  }

  // ─── Web Audio DSP Helpers ────────────────────────────────────────────────

  /**
   * Create a complete audio node chain: oscillator → gain → panner → sfxGain
   *
   * DSP GRAPH:
   *   OscillatorNode (frequency, waveform)
   *     → GainNode (envelope: attack, sustain, release)
   *       → StereoPannerNode (spatial positioning)
   *         → sfxGain (SFX volume control)
   *           → masterGain (master volume)
   *             → AudioContext.destination (speakers)
   */
  private createOscChain(
    frequency:  number,
    type:       OscillatorType,
    volume:     number,
    pan:        number,
    duration:   number,
    freqEnd?:   number  // Optional frequency sweep end value
  ): { osc: OscillatorNode; gain: GainNode } {
    const ctx  = this.audioCtx!;
    const now  = ctx.currentTime;

    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    const panner = ctx.createStereoPanner();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    // Frequency sweep (for percussive sounds)
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(freqEnd, 0.01),
        now + duration
      );
    }

    // Amplitude envelope: fast attack, held sustain, quick release
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(
      volume * this.sfxVol * this.masterVol,
      now + 0.005  // 5ms attack
    );
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    panner.pan.setValueAtTime(pan, now);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    return { osc, gain };
  }

  /**
   * Create a noise burst (for explosions and impacts).
   * Uses a white noise buffer instead of an oscillator.
   *
   * DSP: BufferSourceNode (white noise) → BiquadFilterNode (bandpass) → GainNode
   */
  private createNoiseBurst(
    volume:    number,
    pan:       number,
    duration:  number,
    filterFreq: number = 800,
    filterType: BiquadFilterType = 'bandpass'
  ): void {
    const ctx = this.audioCtx!;
    const now = ctx.currentTime;

    // Create white noise buffer (1 second of random samples)
    const bufferSize = ctx.sampleRate;
    const buffer     = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type            = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value         = 1.0;

    const gain   = ctx.createGain();
    const panner = ctx.createStereoPanner();

    gain.gain.setValueAtTime(volume * this.sfxVol * this.masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    panner.pan.setValueAtTime(pan, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.sfxGain);

    source.start(now);
    source.stop(now + duration + 0.05);
  }

  // ─── SFX Synthesizers ─────────────────────────────────────────────────────

  /** Cannon shot — sharp high-frequency click with quick decay */
  private synthCannon(pan: number, vol: number): void {
    const pitch = MathUtils.randomRange(0.9, 1.1);
    this.createOscChain(800 * pitch, 'square', vol * 0.4, pan, 0.12, 200);
    this.createNoiseBurst(vol * 0.3, pan, 0.08, 1200, 'highpass');
  }

  /** Missile launch — lower frequency whoosh */
  private synthMissile(pan: number, vol: number): void {
    this.createOscChain(300, 'sawtooth', vol * 0.5, pan, 0.3, 80);
    this.createNoiseBurst(vol * 0.4, pan, 0.3, 400, 'lowpass');
  }

  /** Large asteroid explosion — deep boom with long decay */
  private synthBoomLarge(pan: number, vol: number): void {
    this.createOscChain(120, 'sine', vol * 0.9, pan, 0.8, 30);
    this.createOscChain(80,  'sine', vol * 0.7, pan, 1.2, 20);
    this.createNoiseBurst(vol * 0.8, pan, 0.8, 200, 'lowpass');
  }

  /** Medium asteroid explosion */
  private synthBoomMedium(pan: number, vol: number): void {
    this.createOscChain(200, 'sine', vol * 0.6, pan, 0.5, 60);
    this.createNoiseBurst(vol * 0.6, pan, 0.5, 400, 'bandpass');
  }

  /** Small asteroid explosion — quick crack */
  private synthBoomSmall(pan: number, vol: number): void {
    this.createOscChain(400, 'square', vol * 0.4, pan, 0.2, 150);
    this.createNoiseBurst(vol * 0.5, pan, 0.2, 800, 'highpass');
  }

  /** Impact sound — short percussive hit */
  private synthImpact(pan: number, vol: number): void {
    this.createNoiseBurst(vol * 0.3, pan, 0.1, 600, 'bandpass');
  }

  /** Enemy explosion — higher pitch with electronic quality */
  private synthEnemyBoom(pan: number, vol: number): void {
    this.createOscChain(500, 'square', vol * 0.6, pan, 0.4, 100);
    this.createOscChain(300, 'sawtooth', vol * 0.4, pan, 0.6, 50);
    this.createNoiseBurst(vol * 0.5, pan, 0.5, 600, 'bandpass');
  }

  /** Station damage — heavy impact with low rumble */
  private synthStationHit(pan: number, vol: number): void {
    this.createOscChain(60,  'sine', vol * 0.8, pan, 0.6, 40);
    this.createOscChain(180, 'square', vol * 0.5, pan, 0.4, 80);
    this.createNoiseBurst(vol * 0.7, pan, 0.6, 150, 'lowpass');
  }

  /** Shield hit — metallic ring */
  private synthShieldHit(pan: number, vol: number): void {
    this.createOscChain(1200, 'sine', vol * 0.5, pan, 0.3, 1400);
    this.createOscChain(800,  'sine', vol * 0.3, pan, 0.5, 1000);
  }

  /** Shield break — descending tone */
  private synthShieldBreak(pan: number, vol: number): void {
    this.createOscChain(600, 'sawtooth', vol * 0.7, pan, 0.8, 100);
    this.createOscChain(300, 'sawtooth', vol * 0.6, pan, 1.0, 80);
    this.createNoiseBurst(vol * 0.5, pan, 0.4, 300, 'bandpass');
  }

  /** Weapon overheat — rising alarm tone */
  private synthOverheat(pan: number, vol: number): void {
    this.createOscChain(400, 'square', vol * 0.5, pan, 0.5, 800);
    this.createOscChain(600, 'square', vol * 0.4, pan, 0.4, 1000);
  }

  /** Weapon cooled — satisfying click */
  private synthCooled(pan: number, vol: number): void {
    this.createOscChain(800, 'sine', vol * 0.3, pan, 0.15, 400);
  }

  /** Wave start — ascending arpeggio */
  private synthWaveStart(pan: number, vol: number): void {
    const notes = [220, 330, 440, 660];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscChain(freq, 'sine', vol * 0.4, pan, 0.3);
      }, i * 120);
    });
  }

  /** Wave complete — triumphant ascending chord */
  private synthWaveComplete(pan: number, vol: number): void {
    const chord = [440, 550, 660, 880];
    chord.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscChain(freq, 'sine', vol * 0.35, pan, 0.6);
      }, i * 80);
    });
  }

  /** Resource collect — bright ping */
  private synthCollect(pan: number, vol: number): void {
    const pitch = MathUtils.randomRange(0.9, 1.3);
    this.createOscChain(1000 * pitch, 'sine', vol * 0.35, pan, 0.2, 1400);
  }

  /** Upgrade selected — positive two-tone */
  private synthUpgrade(pan: number, vol: number): void {
    this.createOscChain(660, 'sine', vol * 0.5, pan, 0.25);
    setTimeout(() => {
      this.createOscChain(880, 'sine', vol * 0.5, pan, 0.3);
    }, 150);
  }

  /** Combo milestone — quick three-note fanfare */
  private synthCombo(pan: number, vol: number): void {
    [440, 550, 880].forEach((f, i) => {
      setTimeout(() => {
        this.createOscChain(f, 'triangle', vol * 0.4, pan, 0.2);
      }, i * 60);
    });
  }

  /** Game over — descending minor arpeggio */
  private synthGameOver(pan: number, vol: number): void {
    const notes = [440, 370, 311, 277];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscChain(freq, 'sawtooth', vol * 0.4, pan, 0.6);
      }, i * 200);
    });
  }

  /** Victory — ascending major fanfare */
  private synthVictory(pan: number, vol: number): void {
    const notes = [440, 550, 660, 880, 1100];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.createOscChain(freq, 'sine', vol * 0.45, pan, 0.5);
      }, i * 150);
    });
  }

  // ─── Music System ─────────────────────────────────────────────────────────

  /**
   * Transition to a new music state with crossfade.
   *
   * MUSIC GENERATION:
   * Each state generates a different set of drone oscillators
   * at harmonically-related frequencies. The oscillators are
   * slowly modulated in frequency to create organic movement.
   *
   * Menu:     Slow ambient drones (low frequencies, long periods)
   * Gameplay: Mid-tempo pulsing (arpeggiated rhythm pattern)
   * Boss:     Dissonant tones (tension, minor intervals)
   * Victory:  Bright major chord held
   */
  setMusicState(state: MusicState): void {
    if (this.musicState === state) { return; }

    const prevState = this.musicState;
    this.musicState = state;

    // Fade out current music
    if (prevState !== MusicState.NONE) {
      this.fadeOutMusic();
    }

    // Short crossfade delay
    setTimeout(() => {
      this.startMusicForState(state);
    }, prevState === MusicState.NONE ? 0 : AudioConfig.MUSIC_CROSSFADE_DURATION_MS);
  }

  private startMusicForState(state: MusicState): void {
    if (!this.audioCtx || !this.contextStarted) { return; }

    switch (state) {
      case MusicState.MENU:     this.startMenuMusic();     break;
      case MusicState.GAMEPLAY: this.startGameplayMusic(); break;
      case MusicState.BOSS:     this.startBossMusic();     break;
      case MusicState.VICTORY:  this.startVictoryMusic();  break;
      default: break;
    }
  }

  /** Menu music — slow ethereal ambient drones */
  private startMenuMusic(): void {
    if (!this.audioCtx) { return; }

    const freqs    = [55, 82.5, 110, 165];
    const baseVol  = this.musicVol * this.masterVol * 0.08;

    for (const freq of freqs) {
      const osc  = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Slow vibrato
      const lfo  = this.audioCtx.createOscillator();
      const lfoG = this.audioCtx.createGain();
      lfo.frequency.value = MathUtils.randomRange(0.1, 0.3);
      lfoG.gain.value     = freq * 0.02;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      lfo.start();
      this.musicNodes.push(lfo);

      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(
        baseVol * MathUtils.randomRange(0.5, 1.0),
        this.audioCtx.currentTime + 2
      );

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.musicNodes.push(osc);
    }
  }

  /** Gameplay music — rhythmic pulsing space tension */
  private startGameplayMusic(): void {
    if (!this.audioCtx) { return; }

    const baseVol = this.musicVol * this.masterVol * 0.06;
    const ctx     = this.audioCtx;

    // Base drone
    const droneFreqs = [55, 73.4, 110];
    for (const freq of droneFreqs) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      // Filter to soften sawtooth
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(baseVol, ctx.currentTime + 1.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.musicNodes.push(osc);
    }

    // Rhythmic pulse — quarter note pattern
    const bpm      = 90;
    const interval = (60 / bpm) * 1000;
    let   beat     = 0;

    const pulsePattern = this.scene.time.addEvent({
      delay: interval,
      repeat: -1,
      callback: () => {
        if (!this.audioCtx || this.musicState !== MusicState.GAMEPLAY) { return; }
        const notes = [110, 138.6, 110, 146.8];
        const note  = notes[beat % notes.length];
        const osc   = this.audioCtx.createOscillator();
        const gain  = this.audioCtx.createGain();
        const now   = this.audioCtx.currentTime;

        osc.type = 'square';
        osc.frequency.value = note;
        gain.gain.setValueAtTime(baseVol * 0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.35);

        beat++;
      },
    });

    // Store interval reference for cleanup
    void pulsePattern;
  }

  /** Boss music — dissonant, tense */
  private startBossMusic(): void {
    if (!this.audioCtx) { return; }

    const baseVol  = this.musicVol * this.masterVol * 0.07;
    const dissonant = [55, 58.3, 82.5, 87.3]; // Minor 2nd intervals

    for (const freq of dissonant) {
      const osc  = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(baseVol, this.audioCtx.currentTime + 1);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.musicNodes.push(osc);
    }
  }

  /** Victory music — bright major chord */
  private startVictoryMusic(): void {
    if (!this.audioCtx) { return; }

    const baseVol = this.musicVol * this.masterVol * 0.1;
    const major   = [440, 550, 660, 880];

    major.forEach((freq, i) => {
      setTimeout(() => {
        if (!this.audioCtx) { return; }
        const osc  = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(baseVol, this.audioCtx.currentTime + 0.3);
        gain.gain.linearRampToValueAtTime(baseVol * 0.6, this.audioCtx.currentTime + 3);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        this.musicNodes.push(osc);
      }, i * 200);
    });
  }

  private fadeOutMusic(): void {
    if (!this.audioCtx) { return; }

    const now          = this.audioCtx.currentTime;
    const fadeDuration = AudioConfig.MUSIC_CROSSFADE_DURATION_MS / 1000;

    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    // Stop all music nodes after fade
    setTimeout(() => {
      for (const node of this.musicNodes) {
        try { node.stop(); } catch (_e) { /* already stopped */ }
      }
      this.musicNodes = [];

      // Restore music gain
      if (this.audioCtx) {
        this.musicGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
      }
    }, AudioConfig.MUSIC_CROSSFADE_DURATION_MS + 100);
  }

  stopMusic(): void {
    this.fadeOutMusic();
    this.musicState = MusicState.NONE;
  }

  // ─── Ambient System ───────────────────────────────────────────────────────

  /**
   * Start continuous space ambient hum.
   * Volume scales dynamically with enemy count (tension building).
   */
  startAmbient(): void {
    if (!this.audioCtx || this.ambientActive) { return; }

    const baseVol  = this.masterVol * 0.04;
    const ambFreqs = [40, 60, 80];

    for (const freq of ambFreqs) {
      const osc  = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq + MathUtils.randomRange(-2, 2);

      gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(
        baseVol,
        this.audioCtx.currentTime + 3
      );

      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start();
      this.ambientNodes.push(osc);
    }

    this.ambientActive = true;
  }

  /** Update ambient intensity based on threat level (0-1) */
  updateAmbientIntensity(threatLevel: number): void {
    if (!this.audioCtx || !this.ambientActive) { return; }

    const targetVol = this.masterVol * MathUtils.lerp(0.03, 0.08, threatLevel);
    this.ambientGain.gain.setValueAtTime(
      targetVol,
      this.audioCtx.currentTime
    );
  }

  stopAmbient(): void {
    if (!this.audioCtx || !this.ambientActive) { return; }

    const now = this.audioCtx.currentTime;
    this.ambientGain.gain.linearRampToValueAtTime(0, now + 1.5);

    setTimeout(() => {
      for (const node of this.ambientNodes) {
        try { node.stop(); } catch (_e) { /* already stopped */ }
      }
      this.ambientNodes  = [];
      this.ambientActive = false;
    }, 1600);
  }

  // ─── Volume Control ───────────────────────────────────────────────────────

  setMasterVolume(vol: number): void {
    this.masterVol = MathUtils.clamp01(vol);
    this.applyVolumes();
  }

  setSFXVolume(vol: number): void {
    this.sfxVol = MathUtils.clamp01(vol);
    this.applyVolumes();
  }

  setMusicVolume(vol: number): void {
    this.musicVol = MathUtils.clamp01(vol);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.audioCtx) { return; }
    this.masterGain.gain.value = this.masterVol;
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.stopMusic();
    this.stopAmbient();

    for (const timer of this.musicTimers) {
      clearInterval(timer);
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
    }
  }
}