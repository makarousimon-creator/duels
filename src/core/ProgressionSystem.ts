/**
 * Progression system - levels, XP, achievements
 */

import type { PlayerProgress, Achievement, ComboSystem } from '../types/progression';

export class ProgressionSystem {
  private progress: PlayerProgress;
  private combo: ComboSystem;
  private achievements: Map<string, Achievement>;

  constructor() {
    this.progress = this.loadProgress();
    this.combo = {
      currentCombo: 0,
      multiplier: 1,
      comboTimer: 0,
      maxComboTime: 3
    };
    this.achievements = this.initAchievements();
  }

  /**
   * Initialize achievements
   */
  private initAchievements(): Map<string, Achievement> {
    const achievements = new Map<string, Achievement>();

    const achievementList: Achievement[] = [
      {
        id: 'first_particle',
        name: 'Создатель',
        description: 'Создайте первую частицу',
        icon: '⚛️',
        unlocked: false,
        requirement: 1,
        progress: 0
      },
      {
        id: 'particle_master',
        name: 'Мастер частиц',
        description: 'Создайте 1000 частиц',
        icon: '💫',
        unlocked: false,
        requirement: 1000,
        progress: 0
      },
      {
        id: 'field_creator',
        name: 'Создатель полей',
        description: 'Разместите 100 силовых полей',
        icon: '🌀',
        unlocked: false,
        requirement: 100,
        progress: 0
      },
      {
        id: 'combo_10',
        name: 'Комбо новичок',
        description: 'Достигните комбо x10',
        icon: '🔥',
        unlocked: false,
        requirement: 10,
        progress: 0
      },
      {
        id: 'combo_50',
        name: 'Комбо мастер',
        description: 'Достигните комбо x50',
        icon: '⚡',
        unlocked: false,
        requirement: 50,
        progress: 0
      },
      {
        id: 'level_10',
        name: 'Опытный',
        description: 'Достигните 10 уровня',
        icon: '⭐',
        unlocked: false,
        requirement: 10,
        progress: 0
      },
      {
        id: 'cosmic_unlock',
        name: 'Космический исследователь',
        description: 'Разблокируйте космические частицы',
        icon: '🌌',
        unlocked: false,
        requirement: 1,
        progress: 0
      }
    ];

    achievementList.forEach(ach => achievements.set(ach.id, ach));
    return achievements;
  }

  /**
   * Load progress from localStorage
   */
  private loadProgress(): PlayerProgress {
    const saved = localStorage.getItem('quantum_garden_progress');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to load progress, using default');
      }
    }

    return {
      level: 1,
      experience: 0,
      experienceToNext: 100,
      totalParticlesCreated: 0,
      totalFieldsPlaced: 0,
      totalPlayTime: 0,
      highestCombo: 0,
      achievements: [],
      unlockedParticleTypes: ['standard']
    };
  }

  /**
   * Save progress to localStorage
   */
  saveProgress(): void {
    try {
      localStorage.setItem('quantum_garden_progress', JSON.stringify(this.progress));
    } catch (e) {
      console.warn('Failed to save progress');
    }
  }

  /**
   * Add experience points
   */
  addExperience(amount: number): boolean {
    this.progress.experience += Math.floor(amount * this.combo.multiplier);

    if (this.progress.experience >= this.progress.experienceToNext) {
      return this.levelUp();
    }
    return false;
  }

  /**
   * Level up
   */
  private levelUp(): boolean {
    this.progress.level++;
    this.progress.experience -= this.progress.experienceToNext;
    this.progress.experienceToNext = Math.floor(100 * Math.pow(1.2, this.progress.level - 1));

    // Check achievements
    this.checkAchievement('level_10', this.progress.level);

    // Unlock new particle types
    this.checkUnlocks();

    this.saveProgress();
    return true;
  }

  /**
   * Check for unlocks at current level
   */
  private checkUnlocks(): void {
    const unlocks: { [key: number]: string } = {
      3: 'energy',
      5: 'quantum',
      8: 'plasma',
      12: 'cosmic',
      15: 'nebula'
    };

    const newType = unlocks[this.progress.level];
    if (newType && !this.progress.unlockedParticleTypes.includes(newType)) {
      this.progress.unlockedParticleTypes.push(newType);
      if (newType === 'cosmic') {
        this.unlockAchievement('cosmic_unlock');
      }
    }
  }

  /**
   * Update combo
   */
  updateCombo(dt: number, particleCreated: boolean): void {
    if (particleCreated) {
      this.combo.currentCombo++;
      this.combo.comboTimer = this.combo.maxComboTime;
      this.combo.multiplier = 1 + Math.floor(this.combo.currentCombo / 10) * 0.5;

      if (this.combo.currentCombo > this.progress.highestCombo) {
        this.progress.highestCombo = this.combo.currentCombo;
        this.checkAchievement('combo_10', this.combo.currentCombo);
        this.checkAchievement('combo_50', this.combo.currentCombo);
      }
    } else {
      this.combo.comboTimer -= dt;
      if (this.combo.comboTimer <= 0) {
        this.combo.currentCombo = 0;
        this.combo.multiplier = 1;
      }
    }
  }

  /**
   * Track particle creation
   */
  onParticleCreated(): void {
    this.progress.totalParticlesCreated++;
    this.addExperience(1);
    this.checkAchievement('first_particle', 1);
    this.checkAchievement('particle_master', this.progress.totalParticlesCreated);
  }

  /**
   * Track field placement
   */
  onFieldPlaced(): void {
    this.progress.totalFieldsPlaced++;
    this.addExperience(5);
    this.checkAchievement('field_creator', this.progress.totalFieldsPlaced);
  }

  /**
   * Check achievement progress
   */
  private checkAchievement(id: string, progress: number): void {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlocked) return;

    achievement.progress = progress;
    if (achievement.progress >= achievement.requirement) {
      this.unlockAchievement(id);
    }
  }

  /**
   * Unlock achievement
   */
  private unlockAchievement(id: string): void {
    const achievement = this.achievements.get(id);
    if (!achievement || achievement.unlocked) return;

    achievement.unlocked = true;
    this.progress.achievements.push(achievement);
    this.addExperience(50);
    this.saveProgress();

    // Trigger achievement notification (will be handled by UI)
    window.dispatchEvent(new CustomEvent('achievement-unlocked', {
      detail: achievement
    }));
  }

  /**
   * Get current progress
   */
  getProgress(): PlayerProgress {
    return this.progress;
  }

  /**
   * Get combo state
   */
  getCombo(): ComboSystem {
    return this.combo;
  }

  /**
   * Get all achievements
   */
  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Reset progress (for testing)
   */
  reset(): void {
    localStorage.removeItem('quantum_garden_progress');
    this.progress = this.loadProgress();
    this.achievements.forEach(ach => {
      ach.unlocked = false;
      ach.progress = 0;
    });
  }
}
