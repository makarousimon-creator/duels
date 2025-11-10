/**
 * Enhanced renderer with advanced visual effects
 */

import type { ForceField } from '../types';
import type { VisualEffect } from '../types/progression';
import { Vec2 } from '../utils/math';

export class EnhancedRenderer {
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private bloomCanvas: HTMLCanvasElement;

  private width: number;
  private height: number;
  private dpr: number;

  // Gradient cache
  private gradientCache: Map<string, CanvasGradient> = new Map();
  private readonly MAX_CACHED_GRADIENTS = 200;

  // Visual effects
  private effects: VisualEffect[] = [];

  // Particle type configurations
  private particleConfigs = {
    standard: { glow: 1.0, trail: 0.5, size: 1.0, color: [180, 240] },
    energy: { glow: 1.5, trail: 0.8, size: 1.2, color: [60, 120] },
    quantum: { glow: 2.0, trail: 1.0, size: 0.8, color: [270, 330] },
    plasma: { glow: 1.8, trail: 0.9, size: 1.5, color: [0, 60] },
    cosmic: { glow: 2.5, trail: 1.2, size: 1.0, color: [200, 260] },
    nebula: { glow: 3.0, trail: 1.5, size: 1.3, color: [300, 360] }
  };

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }

    this.ctx = ctx;
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    // Create offscreen canvas for bloom
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

    this.bloomCanvas = document.createElement('canvas');

    this.resize(canvas);
  }

  /**
   * Resize all canvases
   */
  resize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    // Main canvas
    canvas.width = Math.round(this.width * this.dpr);
    canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Offscreen canvas (full resolution)
    this.offscreenCanvas.width = canvas.width;
    this.offscreenCanvas.height = canvas.height;
    this.offscreenCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Bloom canvas (lower resolution for performance)
    this.bloomCanvas.width = Math.round(canvas.width / 2);
    this.bloomCanvas.height = Math.round(canvas.height / 2);

    this.gradientCache.clear();
  }

  /**
   * Clear with animated background
   */
  clear(fadeAmount: number = 0.12, time: number = 0): void {
    // Animated gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);

    const hue1 = (time * 10) % 360;
    const hue2 = (hue1 + 60) % 360;

    gradient.addColorStop(0, `hsla(${hue1}, 30%, 5%, ${fadeAmount})`);
    gradient.addColorStop(1, `hsla(${hue2}, 30%, 8%, ${fadeAmount})`);

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Parse HSL color
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
   * Get or create cached gradient
   */
  private getGradient(radius: number, colorKey: string, intensity: number = 1): CanvasGradient {
    const cacheKey = `${colorKey}_${radius}_${intensity}`;

    if (this.gradientCache.size > this.MAX_CACHED_GRADIENTS) {
      this.gradientCache.clear();
    }

    let gradient = this.gradientCache.get(cacheKey);
    if (!gradient) {
      gradient = this.offscreenCtx.createRadialGradient(0, 0, 0, 0, 0, radius);
      const parsed = this.parseHSL(colorKey);

      if (parsed) {
        gradient.addColorStop(0, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${intensity})`);
        gradient.addColorStop(0.3, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${intensity * 0.7})`);
        gradient.addColorStop(0.6, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${intensity * 0.3})`);
        gradient.addColorStop(1, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0)`);
      }

      this.gradientCache.set(cacheKey, gradient);
    }

    return gradient;
  }

  /**
   * Render particles with enhanced effects
   */
  renderParticles(particles: any[], particleType: string = 'standard'): void {
    const config = this.particleConfigs[particleType as keyof typeof this.particleConfigs] || this.particleConfigs.standard;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio, 1);

      if (alpha <= 0) continue;

      const parsed = this.parseHSL(particle.color);
      if (!parsed) continue;

      const glowRadius = particle.radius * 4 * config.glow;
      const baseSize = particle.radius * config.size;

      // Pulsating effect
      const pulse = Math.sin(Date.now() * 0.003 + particle.id) * 0.15 + 1;
      const pulseSize = baseSize * pulse;

      // Outer glow layers (multiple for stronger bloom)
      for (let i = 0; i < 3; i++) {
        const layerAlpha = alpha * (0.4 - i * 0.1);
        const layerRadius = glowRadius * (1 + i * 0.5);

        this.ctx.save();
        this.ctx.globalAlpha = layerAlpha * config.glow;
        this.ctx.translate(particle.position.x, particle.position.y);

        const gradient = this.getGradient(layerRadius, particle.color, config.glow);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, layerRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // Core with additional brightness
      this.ctx.shadowBlur = 20 * config.glow;
      this.ctx.shadowColor = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${alpha})`;
      this.ctx.fillStyle = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l + 20}%, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        pulseSize,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Inner bright core
      this.ctx.fillStyle = `hsla(${parsed.h}, ${parsed.s}%, 95%, ${alpha * 0.8})`;
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        pulseSize * 0.4,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * Render enhanced trails
   */
  renderTrails(particles: any[], particleType: string = 'standard'): void {
    const config = this.particleConfigs[particleType as keyof typeof this.particleConfigs] || this.particleConfigs.standard;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.lineCap = 'round';

    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio * 0.6 * config.trail, 0.6);

      if (alpha <= 0) continue;

      const parsed = this.parseHSL(particle.color);
      if (!parsed) continue;

      // Multi-layered trail
      for (let layer = 0; layer < 2; layer++) {
        const layerAlpha = alpha * (1 - layer * 0.4);
        const layerWidth = particle.radius * (1 + layer * 0.5) * config.trail;

        this.ctx.strokeStyle = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${layerAlpha})`;
        this.ctx.lineWidth = layerWidth;

        this.ctx.beginPath();
        this.ctx.moveTo(particle.oldPosition.x, particle.oldPosition.y);
        this.ctx.lineTo(particle.position.x, particle.position.y);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  /**
   * Render force fields with enhanced visuals
   */
  renderFields(fields: ForceField[]): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (const field of fields) {
      if (!field.active) continue;

      const parsed = this.parseHSL(field.color);
      if (!parsed) continue;

      // Animated ripples
      const time = Date.now() * 0.001;
      const rippleCount = 3;

      for (let i = 0; i < rippleCount; i++) {
        const phase = (time + i * 0.5) % 2;
        const rippleRadius = field.radius * (0.3 + phase * 0.7);
        const rippleAlpha = 0.3 * (1 - phase * 0.5);

        this.ctx.strokeStyle = `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, ${rippleAlpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(field.position.x, field.position.y, rippleRadius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Field area
      const gradient = this.ctx.createRadialGradient(
        field.position.x, field.position.y, 0,
        field.position.x, field.position.y, field.radius
      );

      gradient.addColorStop(0, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0.4)`);
      gradient.addColorStop(0.5, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0.2)`);
      gradient.addColorStop(1, `hsla(${parsed.h}, ${parsed.s}%, ${parsed.l}%, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, field.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Rotating core
      const coreSize = 12;
      const rotation = time * 2;

      this.ctx.save();
      this.ctx.translate(field.position.x, field.position.y);
      this.ctx.rotate(rotation);

      // Core glow
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = field.color;
      this.ctx.fillStyle = field.color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Rotating particles around core
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + rotation;
        const dist = coreSize * 2;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        this.ctx.fillStyle = field.color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  /**
   * Render connections with fade effect
   */
  renderConnections(particles: any[], maxDistance: number = 100): void {
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
          const alpha = (1 - dist / maxDistance) * 0.25;

          // Gradient line
          const gradient = this.ctx.createLinearGradient(
            p1.position.x, p1.position.y,
            p2.position.x, p2.position.y
          );

          const c1 = this.parseHSL(p1.color);
          const c2 = this.parseHSL(p2.color);

          if (c1 && c2) {
            gradient.addColorStop(0, `hsla(${c1.h}, ${c1.s}%, ${c1.l}%, ${alpha})`);
            gradient.addColorStop(0.5, `hsla(${(c1.h + c2.h)/2}, 80%, 65%, ${alpha * 1.5})`);
            gradient.addColorStop(1, `hsla(${c2.h}, ${c2.s}%, ${c2.l}%, ${alpha})`);
          }

          this.ctx.strokeStyle = gradient;
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
   * Add visual effect
   */
  addEffect(effect: VisualEffect): void {
    this.effects.push(effect);
  }

  /**
   * Update and render visual effects
   */
  updateAndRenderEffects(dt: number): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.lifetime += dt;

      if (effect.lifetime >= effect.maxLifetime) {
        this.effects.splice(i, 1);
        continue;
      }

      const progress = effect.lifetime / effect.maxLifetime;
      const alpha = (1 - progress) * effect.intensity;

      switch (effect.type) {
        case 'explosion':
          this.renderExplosion(effect, progress, alpha);
          break;
        case 'ripple':
          this.renderRipple(effect, progress, alpha);
          break;
        case 'spark':
          this.renderSpark(effect, progress, alpha);
          break;
      }
    }

    this.ctx.restore();
  }

  private renderExplosion(effect: VisualEffect, progress: number, alpha: number): void {
    const radius = effect.radius * (1 + progress * 2);
    const gradient = this.ctx.createRadialGradient(
      effect.position.x, effect.position.y, 0,
      effect.position.x, effect.position.y, radius
    );

    gradient.addColorStop(0, effect.color.replace(/[\d.]+\)$/, `${alpha})`));
    gradient.addColorStop(0.5, effect.color.replace(/[\d.]+\)$/, `${alpha * 0.5})`));
    gradient.addColorStop(1, effect.color.replace(/[\d.]+\)$/, '0)'));

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderRipple(effect: VisualEffect, progress: number, alpha: number): void {
    const radius = effect.radius * (0.5 + progress * 1.5);
    this.ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, `${alpha})`);
    this.ctx.lineWidth = 3 * (1 - progress);
    this.ctx.beginPath();
    this.ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private renderSpark(effect: VisualEffect, progress: number, alpha: number): void {
    const size = effect.radius * (1 - progress * 0.5);
    this.ctx.fillStyle = effect.color.replace(/[\d.]+\)$/, `${alpha})`);
    this.ctx.beginPath();
    this.ctx.arc(effect.position.x, effect.position.y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
