/**
 * Particle system with Verlet integration
 */

import type { Particle, Vector2, ForceField, GameConfig } from '../types';
import { Vec2, hsl, random } from '../utils/math';

export class ParticleSystem {
  private particles: Particle[] = [];
  private nextId: number = 0;
  private config: GameConfig;
  private width: number;
  private height: number;

  constructor(config: GameConfig, width: number, height: number) {
    this.config = config;
    this.width = width;
    this.height = height;
  }

  /**
   * Create a new particle
   */
  createParticle(position: Vector2, velocity?: Vector2): Particle {
    if (this.particles.length >= this.config.maxParticles) {
      // Remove oldest particle efficiently from end
      // (shift() is O(n), pop() is O(1))
      this.particles.pop();
    }

    const vel = velocity || Vec2.create(random(-2, 2), random(-2, 2));
    const hue = random(180, 240);

    const particle: Particle = {
      id: this.nextId++,
      position: { ...position },
      oldPosition: Vec2.sub(position, vel),
      velocity: vel,
      acceleration: Vec2.create(),
      mass: 1,
      radius: this.config.particleRadius,
      color: hsl(hue, 80, 60),
      life: this.config.particleLifetime,
      maxLife: this.config.particleLifetime,
      fixed: false
    };

    this.particles.push(particle);
    return particle;
  }

  /**
   * Update all particles using Verlet integration
   */
  update(dt: number, fields: ForceField[]): void {
    const dtSq = dt * dt;
    const friction = this.config.friction / 100;

    for (const particle of this.particles) {
      if (particle.fixed) continue;

      // Store current position
      const pos = particle.position;
      const oldPos = particle.oldPosition;

      // Verlet integration: x' = 2x - x_old + a * dt^2
      const velocity = Vec2.sub(pos, oldPos);
      const dampedVelocity = Vec2.mult(velocity, friction);

      // Apply forces
      const acceleration = this.calculateForces(particle, fields);

      // Update position
      particle.position = {
        x: pos.x + dampedVelocity.x + acceleration.x * dtSq,
        y: pos.y + dampedVelocity.y + acceleration.y * dtSq
      };

      particle.oldPosition = pos;

      // Update velocity for external use (with safety check)
      if (dt > 0.0001) {
        particle.velocity = Vec2.mult(velocity, 1 / dt);
      }

      // Apply constraints (bounce off walls)
      this.applyConstraints(particle);

      // Update lifetime
      particle.life -= dt;
    }

    // Remove dead particles
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /**
   * Calculate forces acting on a particle
   */
  private calculateForces(particle: Particle, fields: ForceField[]): Vector2 {
    let totalForce = Vec2.create(0, this.config.gravity);

    // Apply field forces
    for (const field of fields) {
      if (!field.active) continue;

      const direction = Vec2.sub(field.position, particle.position);
      const distanceSq = Vec2.magnitudeSq(direction);
      const radiusSq = field.radius * field.radius;

      if (distanceSq < radiusSq && distanceSq > 0.1) {
        const distance = Math.sqrt(distanceSq);
        const force = this.calculateFieldForce(field, direction, distance);
        totalForce = Vec2.add(totalForce, force);
      }
    }

    return totalForce;
  }

  /**
   * Calculate force from a field
   */
  private calculateFieldForce(
    field: ForceField,
    direction: Vector2,
    distance: number
  ): Vector2 {
    const strength = field.strength * (1 - distance / field.radius);
    const normalized = Vec2.normalize(direction);

    switch (field.type) {
      case 'attractor':
        return Vec2.mult(normalized, strength);

      case 'repulsor':
        return Vec2.mult(normalized, -strength);

      case 'vortex': {
        // Perpendicular force for rotation
        const perpendicular = Vec2.rotate(normalized, Math.PI / 2);
        const tangential = Vec2.mult(perpendicular, strength);
        const radial = Vec2.mult(normalized, strength * 0.2);
        return Vec2.add(tangential, radial);
      }

      default:
        return Vec2.create();
    }
  }

  /**
   * Apply boundary constraints
   */
  private applyConstraints(particle: Particle): void {
    const restitution = 0.8; // Bounce factor

    // Left/right walls
    if (particle.position.x < particle.radius) {
      particle.position.x = particle.radius;
      const oldVelX = particle.position.x - particle.oldPosition.x;
      particle.oldPosition.x = particle.position.x + oldVelX * restitution;
    } else if (particle.position.x > this.width - particle.radius) {
      particle.position.x = this.width - particle.radius;
      const oldVelX = particle.position.x - particle.oldPosition.x;
      particle.oldPosition.x = particle.position.x + oldVelX * restitution;
    }

    // Top/bottom walls
    if (particle.position.y < particle.radius) {
      particle.position.y = particle.radius;
      const oldVelY = particle.position.y - particle.oldPosition.y;
      particle.oldPosition.y = particle.position.y + oldVelY * restitution;
    } else if (particle.position.y > this.height - particle.radius) {
      particle.position.y = this.height - particle.radius;
      const oldVelY = particle.position.y - particle.oldPosition.y;
      particle.oldPosition.y = particle.position.y + oldVelY * restitution;
    }
  }

  /**
   * Get all particles
   */
  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Clear all particles
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * Update canvas dimensions
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
