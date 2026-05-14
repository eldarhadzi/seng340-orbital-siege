// src/utils/MathUtils.ts
//
// Pure mathematical utility functions used throughout the simulation.
//
// DESIGN PRINCIPLE:
// All functions here are PURE — no side effects, no state.
// Given the same inputs, they always return the same output.
// This makes them trivially testable and safe to use anywhere.
//
// PHYSICS RELEVANCE:
// These functions appear directly in physics calculations:
//   - clamp()      → clamping velocity to terminal velocity
//   - lerp()       → render interpolation between physics frames
//   - angleLerp()  → smooth camera rotation
//   - wrapAngle()  → keeping rotation values in [-π, π] range

export class MathUtils {
  // ─── Constants ────────────────────────────────────────────────────────────

  static readonly TWO_PI    = Math.PI * 2;
  static readonly HALF_PI   = Math.PI / 2;
  static readonly DEG_TO_RAD = Math.PI / 180;
  static readonly RAD_TO_DEG = 180 / Math.PI;
  static readonly EPSILON   = 1e-10;

  // ─── Clamping & Ranges ────────────────────────────────────────────────────

  /** Clamp a value between min and max (inclusive) */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /** Clamp a value between 0 and 1 */
  static clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /** Clamp magnitude of a number without changing sign */
  static clampAbs(value: number, maxAbs: number): number {
    return Math.max(-maxAbs, Math.min(maxAbs, value));
  }

  // ─── Interpolation ────────────────────────────────────────────────────────

  /** Linear interpolation from a to b by t (t=0 → a, t=1 → b)
   *  PHYSICS USE: render interpolation between previous and current position.
   *  renderPos = lerp(prevPos, currentPos, alpha)
   *  where alpha = accumulator / FIXED_TIMESTEP
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * MathUtils.clamp01(t);
  }

  /** Lerp without clamping t (allows overshoot) */
  static lerpUnclamped(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** Smooth step interpolation (ease in/out curve)
   *  Produces smoother motion than linear lerp.
   *  Used for: camera movement, UI animations.
   */
  static smoothStep(a: number, b: number, t: number): number {
    const c = MathUtils.clamp01(t);
    const smooth = c * c * (3 - 2 * c);
    return a + (b - a) * smooth;
  }

  /** Smoother step (Ken Perlin's improved version — even smoother) */
  static smootherStep(a: number, b: number, t: number): number {
    const c = MathUtils.clamp01(t);
    const smooth = c * c * c * (c * (c * 6 - 15) + 10);
    return a + (b - a) * smooth;
  }

  /** Inverse lerp: given value between a and b, return the t (0-1) */
  static inverseLerp(a: number, b: number, value: number): number {
    if (Math.abs(b - a) < MathUtils.EPSILON) { return 0; }
    return MathUtils.clamp01((value - a) / (b - a));
  }

  // ─── Angle Mathematics ────────────────────────────────────────────────────

  /** Convert degrees to radians */
  static degToRad(degrees: number): number {
    return degrees * MathUtils.DEG_TO_RAD;
  }

  /** Convert radians to degrees */
  static radToDeg(radians: number): number {
    return radians * MathUtils.RAD_TO_DEG;
  }

  /** Wrap an angle to the range [-π, π]
   *  PHYSICS USE: keeps rotation values normalized.
   *  Without wrapping, angles accumulate infinitely on rotating asteroids.
   */
  static wrapAngle(radians: number): number {
    let angle = radians % MathUtils.TWO_PI;
    if (angle > Math.PI) { angle -= MathUtils.TWO_PI; }
    if (angle < -Math.PI) { angle += MathUtils.TWO_PI; }
    return angle;
  }

  /** Shortest angular difference between two angles (signed)
   *  Returns value in range [-π, π].
   *  PHYSICS USE: calculating rotation toward target without spinning wrong way.
   */
  static angleDifference(from: number, to: number): number {
    return MathUtils.wrapAngle(to - from);
  }

  /** Smoothly interpolate between two angles (handles wrap-around)
   *  RENDER USE: smooth turret rotation toward aim target.
   */
  static angleLerp(from: number, to: number, t: number): number {
    const diff = MathUtils.angleDifference(from, to);
    return from + diff * MathUtils.clamp01(t);
  }

  // ─── Random ───────────────────────────────────────────────────────────────

  /** Random float between min and max */
  static randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /** Random integer between min and max (inclusive) */
  static randomInt(min: number, max: number): number {
    return Math.floor(MathUtils.randomRange(min, max + 1));
  }

  /** Random sign: returns either +1 or -1 with equal probability */
  static randomSign(): number {
    return Math.random() < 0.5 ? 1 : -1;
  }

  /** Random boolean with optional probability */
  static randomBool(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /** Pick a random element from an array */
  static randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /** Shuffle array in place using Fisher-Yates algorithm */
  static shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ─── Number Utilities ─────────────────────────────────────────────────────

  /** Check if a number is approximately equal to another */
  static approximately(a: number, b: number, epsilon: number = 1e-6): boolean {
    return Math.abs(a - b) < epsilon;
  }

  /** Round to a given number of decimal places */
  static roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /** Map a value from one range to another
   *  Example: map(0.5, 0, 1, 0, 100) → 50
   *  GAMEPLAY USE: mapping health (0-100) to bar width (0-200px)
   */
  static mapRange(
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number {
    const t = MathUtils.inverseLerp(fromMin, fromMax, value);
    return MathUtils.lerpUnclamped(toMin, toMax, t);
  }

  /** Sign of a number: returns -1, 0, or 1 */
  static sign(value: number): number {
    if (value > 0) { return 1; }
    if (value < 0) { return -1; }
    return 0;
  }

  /** Approach target value by step without overshooting
   *  PHYSICS USE: drag/damping that stops cleanly at zero.
   */
  static moveToward(current: number, target: number, step: number): number {
    const diff = target - current;
    if (Math.abs(diff) <= step) { return target; }
    return current + MathUtils.sign(diff) * step;
  }

  /** Ping-pong a value between 0 and max (bounces back and forth)
   *  ANIMATION USE: pulsing glow effects.
   */
  static pingPong(t: number, max: number): number {
    const mod = t % (max * 2);
    return mod <= max ? mod : max * 2 - mod;
  }

  // ─── Geometry ─────────────────────────────────────────────────────────────

  /** Check if a point (px, py) is inside a circle */
  static pointInCircle(
    px: number, py: number,
    cx: number, cy: number,
    radius: number
  ): boolean {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  /** Check if two circles overlap */
  static circlesOverlap(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const combined = r1 + r2;
    return dx * dx + dy * dy <= combined * combined;
  }
}