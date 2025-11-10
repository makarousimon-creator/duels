/**
 * Math utilities for physics and vector operations
 */

import type { Vector2 } from '../types';

export class Vec2 {
  /**
   * Create a new vector
   */
  static create(x: number = 0, y: number = 0): Vector2 {
    return { x, y };
  }

  /**
   * Add two vectors
   */
  static add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  /**
   * Subtract two vectors
   */
  static sub(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /**
   * Multiply vector by scalar
   */
  static mult(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  /**
   * Divide vector by scalar
   */
  static div(v: Vector2, scalar: number): Vector2 {
    return scalar !== 0 ? { x: v.x / scalar, y: v.y / scalar } : { x: 0, y: 0 };
  }

  /**
   * Get magnitude (length) of vector
   */
  static magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  /**
   * Get squared magnitude (for performance)
   */
  static magnitudeSq(v: Vector2): number {
    return v.x * v.x + v.y * v.y;
  }

  /**
   * Normalize vector to unit length
   */
  static normalize(v: Vector2): Vector2 {
    const mag = Vec2.magnitude(v);
    return mag > 0 ? Vec2.div(v, mag) : { x: 0, y: 0 };
  }

  /**
   * Distance between two points
   */
  static distance(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Squared distance (for performance)
   */
  static distanceSq(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  }

  /**
   * Dot product
   */
  static dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y;
  }

  /**
   * Limit magnitude of vector
   */
  static limit(v: Vector2, max: number): Vector2 {
    const magSq = Vec2.magnitudeSq(v);
    if (magSq > max * max) {
      const mag = Math.sqrt(magSq);
      return Vec2.mult(v, max / mag);
    }
    return v;
  }

  /**
   * Rotate vector by angle (radians)
   */
  static rotate(v: Vector2, angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos
    };
  }

  /**
   * Lerp between two vectors
   */
  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Map value from one range to another
 */
export function map(
  value: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number
): number {
  return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1));
}

/**
 * Linear interpolation
 */
export function lerp(start: number, stop: number, amt: number): number {
  return start + (stop - start) * amt;
}

/**
 * Random number between min and max
 */
export function random(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Convert HSL to RGB color string
 */
export function hsl(h: number, s: number, l: number, a: number = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}
