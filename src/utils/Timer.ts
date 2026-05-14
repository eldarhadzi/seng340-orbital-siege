// src/utils/Timer.ts
//
// Lightweight timer utility — independent of Phaser's event system.
//
// WHY NOT USE PHASER TIMERS?
// Phaser's built-in timers (scene.time.addEvent) are tied to a specific
// scene. If the scene pauses or restarts, timers behave unexpectedly.
// Our Timer class runs on raw delta time, giving us full control.
//
// USE CASES IN ORBITAL SIEGE:
//   - Weapon cooldown timers
//   - Wave countdown (3... 2... 1...)
//   - Shield recharge delay after breaking
//   - Enemy AI state transitions
//   - Combo timer (break combo if no kill in 3 seconds)
//   - Upgrade animation delays

export type TimerCallback = () => void;

// ─── Single-fire Timer ────────────────────────────────────────────────────────

export class Timer {
  private duration: number;      // Total duration in milliseconds
  private elapsed: number = 0;   // Time elapsed since start
  private running: boolean = false;
  private completed: boolean = false;
  private callback: TimerCallback | null = null;
  private loops: boolean = false;

  constructor(duration: number, callback?: TimerCallback, autoStart: boolean = false) {
    this.duration = duration;
    this.callback = callback ?? null;

    if (autoStart) {
      this.start();
    }
  }

  // ─── Control ─────────────────────────────────────────────────────────────

  start(): void {
    this.elapsed = 0;
    this.running = true;
    this.completed = false;
  }

  stop(): void {
    this.running = false;
  }

  reset(): void {
    this.elapsed = 0;
    this.completed = false;
  }

  restart(): void {
    this.start();
  }

  setLoop(loops: boolean): this {
    this.loops = loops;
    return this;
  }

  setDuration(ms: number): this {
    this.duration = ms;
    return this;
  }

  setCallback(cb: TimerCallback): this {
    this.callback = cb;
    return this;
  }

  // ─── Update (call every frame with deltaTime in ms) ───────────────────────

  update(deltaMs: number): void {
    if (!this.running || this.completed) { return; }

    this.elapsed += deltaMs;

    if (this.elapsed >= this.duration) {
      if (this.loops) {
        // Carry over excess time for accurate looping
        this.elapsed = this.elapsed % this.duration;
      } else {
        this.elapsed = this.duration;
        this.running = false;
        this.completed = true;
      }

      if (this.callback) {
        this.callback();
      }
    }
  }

  // ─── State Queries ────────────────────────────────────────────────────────

  /** Progress from 0.0 (just started) to 1.0 (complete) */
  get progress(): number {
    return this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
  }

  /** Remaining time in milliseconds */
  get remaining(): number {
    return Math.max(0, this.duration - this.elapsed);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isComplete(): boolean {
    return this.completed;
  }

  get isDone(): boolean {
    return this.completed || !this.running;
  }
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────
// Fires a callback at each whole-second mark while counting down.
// USE: "Wave starts in 3... 2... 1..."

export class CountdownTimer {
  private timer: Timer;
  private totalSeconds: number;
  private lastSecond: number;
  private onTick: ((secondsLeft: number) => void) | null = null;
  private onComplete: TimerCallback | null = null;

  constructor(seconds: number) {
    this.totalSeconds = seconds;
    this.lastSecond = seconds;
    this.timer = new Timer(seconds * 1000);
  }

  setOnTick(cb: (secondsLeft: number) => void): this {
    this.onTick = cb;
    return this;
  }

  setOnComplete(cb: TimerCallback): this {
    this.onComplete = cb;
    return this;
  }

  start(): void {
    this.lastSecond = this.totalSeconds;
    this.timer.start();
  }

  update(deltaMs: number): void {
    this.timer.update(deltaMs);

    const secondsLeft = Math.ceil(this.timer.remaining / 1000);
    if (secondsLeft !== this.lastSecond) {
      this.lastSecond = secondsLeft;
      if (this.onTick) {
        this.onTick(secondsLeft);
      }
    }

    if (this.timer.isComplete && this.onComplete) {
      this.onComplete();
    }
  }

  get progress(): number { return this.timer.progress; }
  get isComplete(): boolean { return this.timer.isComplete; }
}

// ─── Cooldown Timer ───────────────────────────────────────────────────────────
// Simpler timer optimized for weapon/ability cooldowns.
// USE: weapon.cooldown.trigger() on fire, weapon.cooldown.isReady to check.

export class CooldownTimer {
  private duration: number;
  private elapsed: number;
  private active: boolean = false;

  constructor(durationMs: number) {
    this.duration = durationMs;
    this.elapsed = durationMs; // Start ready
  }

  /** Trigger the cooldown (e.g., on weapon fire) */
  trigger(): void {
    this.elapsed = 0;
    this.active = true;
  }

  update(deltaMs: number): void {
    if (!this.active) { return; }
    this.elapsed += deltaMs;
    if (this.elapsed >= this.duration) {
      this.elapsed = this.duration;
      this.active = false;
    }
  }

  /** True if cooldown is finished and action can be performed again */
  get isReady(): boolean {
    return !this.active;
  }

  /** Progress 0 (just triggered) to 1 (ready) */
  get progress(): number {
    return this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
  }

  setDuration(ms: number): void {
    this.duration = ms;
  }

  forceReady(): void {
    this.elapsed = this.duration;
    this.active = false;
  }
}