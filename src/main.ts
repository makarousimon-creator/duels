/**
 * Main entry point for Quantum Garden
 */

import { Game } from './core/Game';
import type { ToolType } from './types';

class App {
  private game: Game | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      // Show loading screen
      const loading = document.getElementById('loading');

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Get canvas
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      // Initialize game
      this.game = new Game(canvas);

      // Setup UI
      this.setupUI();

      // Start game
      this.game.start();

      // Hide loading screen
      if (loading) {
        loading.classList.add('hidden');
        setTimeout(() => {
          loading.remove();
        }, 500);
      }

      // Auto-hide info panel after 5 seconds
      setTimeout(() => {
        const infoPanel = document.querySelector('.info-panel');
        if (infoPanel) {
          infoPanel.classList.remove('visible');
        }
      }, 5000);

    } catch (error) {
      console.error('Failed to initialize game:', error);
      this.showError(error as Error);
    }
  }

  private setupUI(): void {
    if (!this.game) return;

    // Tool buttons
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tool = (button as HTMLElement).dataset.tool as ToolType;

        if (tool === 'clear') {
          this.game?.setTool(tool);
          return;
        }

        // Update active state
        toolButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Set tool
        this.game?.setTool(tool);
      });
    });

    // Controls
    const gravitySlider = document.getElementById('gravity') as HTMLInputElement;
    const frictionSlider = document.getElementById('friction') as HTMLInputElement;

    if (gravitySlider) {
      gravitySlider.addEventListener('input', () => {
        const value = parseFloat(gravitySlider.value);
        this.game?.updateConfig('gravity', value);
      });
    }

    if (frictionSlider) {
      frictionSlider.addEventListener('input', () => {
        const value = parseFloat(frictionSlider.value);
        this.game?.updateConfig('friction', value);
      });
    }

    // Update stats
    this.game.on('update', (state) => {
      const particleCount = document.getElementById('particle-count');
      const fps = document.getElementById('fps');
      const fieldCount = document.getElementById('field-count');

      if (particleCount) {
        particleCount.textContent = state.stats.particleCount.toString();
      }

      if (fps) {
        fps.textContent = state.stats.fps.toString();
      }

      if (fieldCount) {
        fieldCount.textContent = state.stats.fieldCount.toString();
      }
    });

    // Update progression UI
    this.game.on('progression', (progress) => {
      this.updateProgressionUI(progress);
    });

    // Particle type selector
    const particleTypeButtons = document.querySelectorAll('.particle-type-btn');
    particleTypeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const type = (button as HTMLElement).dataset.type;
        if (!type || button.classList.contains('locked')) return;

        // Update active state
        particleTypeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Set particle type
        this.game?.setParticleType(type as any);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case '1':
          this.activateTool('particle', toolButtons);
          break;
        case '2':
          this.activateTool('attractor', toolButtons);
          break;
        case '3':
          this.activateTool('repulsor', toolButtons);
          break;
        case '4':
          this.activateTool('vortex', toolButtons);
          break;
        case 'c':
        case 'C':
          this.game?.setTool('clear');
          break;
        case ' ':
          e.preventDefault();
          this.game?.setTool('clear');
          break;
      }
    });
  }

  private activateTool(tool: ToolType, buttons: NodeListOf<Element>): void {
    buttons.forEach(btn => {
      const btnTool = (btn as HTMLElement).dataset.tool;
      if (btnTool === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.game?.setTool(tool);
  }

  private updateProgressionUI(progress: any): void {
    // Update level
    const levelElement = document.getElementById('level');
    if (levelElement) {
      levelElement.textContent = progress.level.toString();
    }

    // Update XP bar
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    if (xpBar && xpText) {
      const xpPercent = (progress.experience / progress.experienceToNext) * 100;
      xpBar.style.width = `${xpPercent}%`;
      xpText.textContent = `${progress.experience} / ${progress.experienceToNext} XP`;
    }

    // Update combo display
    const comboDisplay = document.getElementById('combo-display');
    if (comboDisplay) {
      const combo = progress.currentCombo || 0;
      const multiplier = progress.multiplier || 1;

      if (combo > 1) {
        comboDisplay.textContent = `Комбо: ${combo}x  ×${multiplier.toFixed(1)} XP`;
        comboDisplay.classList.add('active');
      } else {
        comboDisplay.classList.remove('active');
      }
    }

    // Update unlocked particle types
    const particleTypeButtons = document.querySelectorAll('.particle-type-btn');
    particleTypeButtons.forEach(button => {
      const type = (button as HTMLElement).dataset.type;
      if (!type) return;

      if (progress.unlockedParticleTypes.includes(type)) {
        button.classList.remove('locked');
      }
    });

    // Check for new achievements
    const newAchievements = progress.achievements.filter(
      (a: any) => a.unlocked && !a.notified
    );

    if (newAchievements.length > 0) {
      this.showAchievementNotification(newAchievements[0]);
    }
  }

  private showAchievementNotification(achievement: any): void {
    const notification = document.getElementById('achievement-notification');
    const icon = document.getElementById('achievement-icon');
    const title = document.getElementById('achievement-title');
    const description = document.getElementById('achievement-description');

    if (!notification || !icon || !title || !description) return;

    // Set content
    icon.textContent = achievement.icon;
    title.textContent = achievement.name;
    description.textContent = achievement.description;

    // Show notification
    notification.classList.add('show');

    // Hide after 4 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 4000);

    // Mark as notified (in memory only, not persisted)
    achievement.notified = true;
  }

  private showError(error: Error): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <div class="loading-content" style="color: #ff6b6b;">
          <h2>Ошибка инициализации</h2>
          <p>${error.message}</p>
          <p style="font-size: 0.9em; margin-top: 20px;">
            Попробуйте обновить страницу или использовать другой браузер.
          </p>
        </div>
      `;
    }
  }
}

// Initialize app
new App();
