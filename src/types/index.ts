/**
 * Core type definitions for Quantum Garden
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface Particle {
  id: number;
  position: Vector2;
  oldPosition: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  fixed: boolean;
}

export type ForceFieldType = 'attractor' | 'repulsor' | 'vortex' | 'directional';

export interface ForceField {
  id: number;
  type: ForceFieldType;
  position: Vector2;
  strength: number;
  radius: number;
  color: string;
  active: boolean;
}

export type ToolType = 'particle' | 'attractor' | 'repulsor' | 'vortex' | 'clear';

export interface GameConfig {
  gravity: number;
  friction: number;
  maxParticles: number;
  spatialGridSize: number;
  particleRadius: number;
  particleLifetime: number;
  fieldStrength: number;
  fieldRadius: number;
}

export interface GameState {
  particles: Particle[];
  fields: ForceField[];
  activeTool: ToolType;
  isPaused: boolean;
  config: GameConfig;
  stats: {
    fps: number;
    particleCount: number;
    fieldCount: number;
    lastFrameTime: number;
  };
}
