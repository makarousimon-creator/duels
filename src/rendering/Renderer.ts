/**
 * Advanced Canvas renderer with visual effects
 */

import type { Particle, ForceField } from '../types';
import { Vec2, hsl } from '../utils/math';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private dpr: number;

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
  }

  /**
   * Clear canvas with fade effect
   */
  clear(fadeAmount: number = 0.15): void {
    this.ctx.fillStyle = `rgba(10, 10, 18, ${fadeAmount})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Render all particles with glow effects
   */
  renderParticles(particles: Particle[]): void {
    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio, 1);

      // Outer glow
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'lighter';

      const gradient = this.ctx.createRadialGradient(
        particle.position.x,
        particle.position.y,
        0,
        particle.position.x,
        particle.position.y,
        particle.radius * 3
      );

      const color = particle.color;
      gradient.addColorStop(0, color.replace(/[\d.]+\)$/g, `${alpha})`));
      gradient.addColorStop(0.4, color.replace(/[\d.]+\)$/g, `${alpha * 0.6})`));
      gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, '0)'));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.radius * 3,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      // Core particle
      this.ctx.fillStyle = color.replace(/[\d.]+\)$/g, `${alpha})`);
      this.ctx.beginPath();
      this.ctx.arc(
        particle.position.x,
        particle.position.y,
        particle.radius,
        0,
        Math.PI * 2
      );
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  /**
   * Render particle trails
   */
  renderTrails(particles: Particle[]): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.lineCap = 'round';

    for (const particle of particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = Math.min(lifeRatio * 0.5, 0.5);

      this.ctx.strokeStyle = particle.color.replace(/[\d.]+\)$/g, `${alpha})`);
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

      const color = field.color;
      gradient.addColorStop(0, color.replace(/[\d.]+\)$/g, '0.3)'));
      gradient.addColorStop(0.7, color.replace(/[\d.]+\)$/g, '0.1)'));
      gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, '0)'));

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, field.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Core
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, 8, 0, Math.PI * 2);
      this.ctx.fill();

      // Ring
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(field.position.x, field.position.y, 12, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  /**
   * Render connection lines between nearby particles
   */
  renderConnections(particles: Particle[], maxDistance: number = 100): void {
    if (particles.length > 200) return; // Performance limit

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
