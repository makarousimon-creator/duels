/**
 * Advanced Canvas renderer with visual effects (optimized)
 */

import type { Particle, ForceField } from '../types';
import { Vec2, hsl } from '../utils/math';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private dpr: number;

  // Performance: Cache gradients to avoid recreation every frame
  private gradientCache: Map<string, CanvasGradient> = new Map();
  private readonly MAX_CACHED_GRADIENTS = 100;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }

    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.resize(canvas);
  }

  /**
   * Resize canvas
   */
  resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Clear gradient cache on resize
    this.gradientCache.clear();
  }

  /**
   * Clear canvas with fade effect
   */
  clear(fadeAmount: number = 0.15): void {
    this.ctx.fillStyle = `rgba(10, 10, 18, ${fadeAmount})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Parse HSL color string to components (performance optimization)
   */
  private parseHSL(color: string): { h: number; s: number; l: number; a: number } | null {
    const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
    if (!match) return null;
    return {
      h: parseInt(match[1]),
      s: parseInt(match[2]),
      l: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1
    };
  }

  /**
   * Get cached or create gradient (performance optimization)
   */
  private getGradient(
    radius: number,
    colorKey: string
  ): CanvasGradient {
    const cacheKey = `${colorKey}_${radius}`;

    // Clear cache if too large
    if (this.gradientCache.size > this.MAX_CACHED_GRADIENTS) {
      this.gradientCache.clear();
    }

    let gradient = this.gradientCache.get(cacheKey);
    if (!gradient) {
      gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      const parsed = this.parseHSL(colorKey);

      if (parsed) {
        gradient.addColorStop(0, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 1)`);
        gradient.addColorStop(0.4, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0.6)`);
        gradient.addColorStop(1, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0)`);
      } else {
        // Fallback
        gradient.addColorStop(0, colorKey);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
      }

      this.gradientCache.set(cacheKey, gradient);
    }

    return gradient;
  }

  /**
   * Render all particles with glow effects (optimized)
   */
  renderParticles(particles: Particle[]): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio, 1);

      // Parse color once
      const parsed = this.parseHSL(particle.color);
      if (!parsed) continue;

      const glowRadius = particle.radius * 3;

      // Outer glow with cached gradient
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(particle.position.x, particle.position.y);

      const gradient = this.getGradient(glowRadius, particle.color);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // Core particle (optimized color string)
      this.ctx.fillStyle = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.radius,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * Render particle trails (optimized)
   */
  renderTrails(particles: Particle[]): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.lineCap = 'round';

    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio * 0.5, 0.5);

      const parsed = this.parseHSL(particle.color);
      if (!parsed) continue;

      this.ctx.strokeStyle = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${alpha})`;
      this.ctx.lineWidth = particle.radius * 0.5;

      this.ctx.beginPath();
      this.ctx.moveTo(particle.oldPosition.x, particle.oldPosition.y);
      this.ctx.lineTo(particle.position.x, particle.position.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Render force fields
   */
  renderFields(fields: ForceField[]): void {
    for (const field of fields) {
      if (!field.active) continue;

      this.ctx.save();
      this.ctx.globalCompositeOperation = 'lighter';

      // Field influence area
      const gradient = this.ctx.createRadialGradient(
        field.position.x,
        field.position.y,
        0,
        field.position.x,
        field.position.y,
        field.radius
      );

      const parsed = this.parseHSL(field.color);
      if (parsed) {
        gradient.addColorStop(0, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0.3)`);
        gradient.addColorStop(0.7, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0.1)`);
        gradient.addColorStop(1, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0)`);
      }

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, field.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Core
      this.ctx.fillStyle = field.color;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, 8, 0, Math.PI * 2);
      this.ctx.fill();

      // Ring
      this.ctx.strokeStyle = field.color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, 12, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  /**
   * Render connection lines between nearby particles (optimized with limit)
   */
  renderConnections(particles: Particle[], maxDistance: number = 100): void {
    // Performance limit: disable for large particle counts
    if (particles.length > 200) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        const distSq = Vec2.distanceSq(p1.position, p2.position);
        const maxDistSq = maxDistance * maxDistance;

        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDistance) * 0.2;

          this.ctx.strokeStyle = hsl(200, 80, 60, alpha);
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.position.x, p1.position.y);
          this.ctx.lineTo(p2.position.x, p2.position.y);
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
