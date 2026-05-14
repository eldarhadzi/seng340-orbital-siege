// src/utils/Vector2.ts
//
// 2D Vector mathematics library — the foundation of all physics.
//
// ARCHITECTURE NOTE:
// Every position, velocity, acceleration, and force in Orbital Siege
// is represented as a Vector2. This class is used in hundreds of places
// per frame, so it is designed for both correctness and performance.
//
// PERFORMANCE DESIGN:
// JavaScript's garbage collector is the enemy of smooth gameplay.
// Object creation (new Vector2()) during the game loop triggers GC.
// To fight this, we provide two patterns:
//   1. Method chaining that returns NEW vectors (safe, readable, slower)
//   2. Static "in-place" methods that write into an existing vector (fast)
//
// Use pattern 1 for setup code.
// Use pattern 2 in the physics loop (called 60× per second).
//
// PHYSICS RELEVANCE:
// Vector2 implements the mathematical objects required by:
//   - Newton's law:     F = G * m1 * m2 / r²   (r is a Vector2 distance)
//   - Euler integration: pos += vel * dt         (vector addition + scalar multiply)
//   - Impulse response:  vel += impulse / mass   (vector addition)
//   - Dot product:       used for collision normal projection
//   - Cross product:     used for angular velocity calculation

export class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  // ─── Factory Methods ──────────────────────────────────────────────────────

  /** Create a zero vector (0, 0) */
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  /** Create a unit vector pointing right (1, 0) */
  static right(): Vector2 {
    return new Vector2(1, 0);
  }

  /** Create a unit vector pointing up (0, -1) — screen space Y is inverted */
  static up(): Vector2 {
    return new Vector2(0, -1);
  }

  /** Create a vector from an angle in radians (unit circle) */
  static fromAngle(radians: number): Vector2 {
    return new Vector2(Math.cos(radians), Math.sin(radians));
  }

  /** Create a random unit vector pointing in any direction */
  static randomDirection(): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return Vector2.fromAngle(angle);
  }

  // ─── Instance Methods (return new vectors — safe for setup code) ──────────

  /** Add another vector. Returns new vector. */
  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  /** Subtract another vector. Returns new vector. */
  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  /** Multiply by a scalar. Returns new vector. */
  scale(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /** Divide by a scalar. Returns new vector. Guards against division by zero. */
  divide(scalar: number): Vector2 {
    if (Math.abs(scalar) < 1e-10) {
      console.warn('Vector2.divide: division by near-zero scalar');
      return Vector2.zero();
    }
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  /** Return a normalized (unit length) copy of this vector. */
  normalized(): Vector2 {
    const mag = this.magnitude();
    if (mag < 1e-10) {
      return Vector2.zero();
    }
    return new Vector2(this.x / mag, this.y / mag);
  }

  /** Return a copy of this vector */
  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  /** Return this vector negated */
  negated(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  /** Return vector rotated by angle in radians */
  rotated(radians: number): Vector2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /** Linear interpolation toward another vector */
  lerp(target: Vector2, t: number): Vector2 {
    const clamped = Math.max(0, Math.min(1, t));
    return new Vector2(
      this.x + (target.x - this.x) * clamped,
      this.y + (target.y - this.y) * clamped
    );
  }

  /** Return vector with each component clamped to [min, max] */
  clampMagnitude(maxMagnitude: number): Vector2 {
    const mag = this.magnitude();
    if (mag > maxMagnitude) {
      return this.normalized().scale(maxMagnitude);
    }
    return this.clone();
  }

  // ─── Measurement Methods ──────────────────────────────────────────────────

  /** Euclidean magnitude (length) of this vector.
   *  Used in: gravity formula denominator, distance checks.
   *  Formula: √(x² + y²)
   */
  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /** Squared magnitude — avoids sqrt, faster for comparisons.
   *  Use when comparing distances: sqrMag(a) < sqrMag(b)
   *  is equivalent to mag(a) < mag(b) but faster.
   */
  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  /** Distance to another vector.
   *  Used in: collision detection, gravity calculation.
   */
  distanceTo(other: Vector2): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Squared distance — avoids sqrt for performance in hot paths */
  distanceToSquared(other: Vector2): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return dx * dx + dy * dy;
  }

  /** Dot product: a·b = |a||b|cos(θ)
   *  Used in: collision response (project velocity onto normal),
   *           angle between vectors.
   */
  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** 2D cross product magnitude: a×b = |a||b|sin(θ)
   *  Used in: angular velocity, determining rotation direction.
   *  Returns a scalar (z-component of the 3D cross product).
   */
  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  /** Angle of this vector in radians (from positive X axis) */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Angle to another vector in radians */
  angleTo(other: Vector2): number {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  /** Check if this vector equals another (with epsilon tolerance) */
  equals(other: Vector2, epsilon: number = 1e-6): boolean {
    return Math.abs(this.x - other.x) < epsilon &&
           Math.abs(this.y - other.y) < epsilon;
  }

  /** Check if this is approximately a zero vector */
  isZero(epsilon: number = 1e-6): boolean {
    return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
  }

  // ─── In-Place Methods (NO allocations — use in physics loop) ─────────────
  // These mutate 'this' directly. Faster, but less readable.
  // Naming convention: suffix 'Self' to indicate mutation.

  /** Add another vector to this one IN PLACE. Returns this for chaining. */
  addSelf(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  /** Subtract another vector from this one IN PLACE */
  subtractSelf(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  /** Scale this vector IN PLACE */
  scaleSelf(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /** Normalize this vector IN PLACE */
  normalizeSelf(): this {
    const mag = this.magnitude();
    if (mag > 1e-10) {
      this.x /= mag;
      this.y /= mag;
    }
    return this;
  }

  /** Copy values from another vector INTO this one (no allocation) */
  copyFrom(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  /** Set x and y directly (no allocation) */
  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  /** Reset to zero IN PLACE */
  reset(): this {
    this.x = 0;
    this.y = 0;
    return this;
  }

  // ─── Static Utility Methods ───────────────────────────────────────────────

  /** Distance between two vectors (static convenience) */
  static distance(a: Vector2, b: Vector2): number {
    return a.distanceTo(b);
  }

  /** Dot product (static convenience) */
  static dot(a: Vector2, b: Vector2): number {
    return a.dot(b);
  }

  /** Linear interpolation between two vectors (static) */
  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return a.lerp(b, t);
  }

  /** Add two vectors and write result into 'out' (zero allocation) */
  static addInto(a: Vector2, b: Vector2, out: Vector2): void {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
  }

  /** Subtract b from a, write into 'out' (zero allocation) */
  static subtractInto(a: Vector2, b: Vector2, out: Vector2): void {
    out.x = a.x - b.x;
    out.y = a.y - b.y;
  }

  /** Scale a vector and write into 'out' (zero allocation) */
  static scaleInto(a: Vector2, scalar: number, out: Vector2): void {
    out.x = a.x * scalar;
    out.y = a.y * scalar;
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  toString(): string {
    return `Vector2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }

  toJSON(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  static fromJSON(data: { x: number; y: number }): Vector2 {
    return new Vector2(data.x, data.y);
  }
}