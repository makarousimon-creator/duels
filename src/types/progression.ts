/**
 * Game progression and achievement system
 */

import type { Particle, Vector2 } from './index';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  requirement: number;
  progress: number;
}

export interface UnlockableParticleType {
  id: string;
  name: string;
  color: string;
  size: number;
  unlocked: boolean;
  unlockLevel: number;
  special: boolean;
}

export interface PlayerProgress {
  level: number;
  experience: number;
  experienceToNext: number;
  totalParticlesCreated: number;
  totalFieldsPlaced: number;
  totalPlayTime: number;
  highestCombo: number;
  achievements: Achievement[];
  unlockedParticleTypes: string[];
}

export interface ComboSystem {
  currentCombo: number;
  multiplier: number;
  comboTimer: number;
  maxComboTime: number;
}

export type ParticleType = 'standard' | 'energy' | 'quantum' | 'plasma' | 'cosmic' | 'nebula';

export interface EnhancedParticle extends Particle {
  type: ParticleType;
  energy: number;
  generation: number;
  trail: Vector2[];
}

export interface VisualEffect {
  id: string;
  type: 'explosion' | 'ripple' | 'spark' | 'glow';
  position: Vector2;
  lifetime: number;
  maxLifetime: number;
  radius: number;
  color: string;
  intensity: number;
}
