/**
 * Main game class coordinating all systems
 */

import type { GameConfig, GameState, ForceField, ForceFieldType, ToolType, Vector2 } from '../types';
import type { ParticleType } from '../types/progression';
import { Engine } from './Engine';
import { EventBus } from './EventBus';
import { ParticleSystem } from '../physics/ParticleSystem';
import { EnhancedRenderer } from '../rendering/EnhancedRenderer';
import { ProgressionSystem } from './ProgressionSystem';
import { hsl } from '../utils/math';

export class Game {
  private engine: Engine;
  private eventBus: EventBus;
  private particleSystem: ParticleSystem;
  private renderer: EnhancedRenderer;
  private progression: ProgressionSystem;
  private state: GameState;
  private canvas: HTMLCanvasElement;

  private fields: ForceField[] = [];
  private nextFieldId: number = 0;
  private mousePosition: Vector2 | null = null;
  private isMouseDown: boolean = false;
  private particleSpawnTimer: number = 0;
  private gameTime: number = 0;

  // Particle type selection
  private currentParticleType: ParticleType = 'standard';

  // Event listener tracking for cleanup
  private eventListeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  }> = [];

  private isDestroyed: boolean = false;
  private readonly MAX_FIELDS = 30;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.eventBus = new EventBus();
    this.renderer = new EnhancedRenderer(canvas);
    this.progression = new ProgressionSystem();

    const dims = this.renderer.getDimensions();

    const config: GameConfig = {
      gravity: 50,
      friction: 98,
      maxParticles: 2000,
      spatialGridSize: 50,
      particleRadius: 3,
      particleLifetime: 30,
      fieldStrength: 300,
      fieldRadius: 150
    };

    this.particleSystem = new ParticleSystem(config, dims.width, dims.height);

    this.state = {
      particles: [],
      fields: this.fields,
      activeTool: 'particle',
      isPaused: false,
      config,
      stats: {
        fps: 0,
        particleCount: 0,
        fieldCount: 0,
        lastFrameTime: 0
      }
    };

    this.engine = new Engine(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.setupInput();
    this.setupResize();
  }

  /**
   * Start the game
   */
  start(): void {
    this.engine.start();
  }

  /**
   * Update game state
   */
  private update(dt: number): void {
    if (this.state.isPaused) return;

    // Update game time
    this.gameTime += dt;

    // Handle mouse input
    let particleCreatedThisFrame = false;
    if (this.isMouseDown && this.mousePosition) {
      particleCreatedThisFrame = this.handleToolAction(this.mousePosition, dt);
    }

    // Update progression system
    this.progression.updateCombo(dt, particleCreatedThisFrame);

    // Update particles
    this.particleSystem.update(dt, this.fields);
    this.state.particles = this.particleSystem.getParticles();

    // Update stats
    this.state.stats.fps = this.engine.getFPS();
    this.state.stats.particleCount = this.state.particles.length;
    this.state.stats.fieldCount = this.fields.length;

    // Emit update event
    this.eventBus.emit('update', this.state);
    this.eventBus.emit('progression', this.progression.getProgress());
  }

  /**
   * Render game
   */
  private render(): void {
    this.renderer.clear(0.12, this.gameTime);
    this.renderer.updateAndRenderEffects(1/60); // Fixed timestep for effects
    this.renderer.renderConnections(this.state.particles, 80);
    this.renderer.renderTrails(this.state.particles, this.currentParticleType);
    this.renderer.renderFields(this.fields);
    this.renderer.renderParticles(this.state.particles, this.currentParticleType);
  }

  /**
   * Handle tool actions
   * @returns true if a particle was created this frame
   */
  private handleToolAction(position: Vector2, dt: number): boolean {
    let particleCreated = false;

    switch (this.state.activeTool) {
      case 'particle':
        this.particleSpawnTimer += dt;
        if (this.particleSpawnTimer >= 0.03) {
          this.particleSystem.createParticle(position);
          this.progression.onParticleCreated();
          this.particleSpawnTimer = 0;
          particleCreated = true;

          // Add spark effect at creation
          this.renderer.addEffect({
            id: `spark_${Date.now()}_${Math.random()}`,
            type: 'spark',
            position: { ...position },
            lifetime: 0,
            maxLifetime: 0.3,
            radius: 5,
            color: hsl(200, 80, 70),
            intensity: 0.8
          });
        }
        break;

      case 'attractor':
      case 'repulsor':
      case 'vortex':
        // Fields are created on mouse down, handled in setupInput
        break;

      case 'clear':
        // Clear is handled immediately
        break;
    }

    return particleCreated;
  }

  /**
   * Create a force field with limit
   */
  private createField(type: ForceFieldType, position: Vector2): void {
    // Limit number of fields to prevent performance issues
    if (this.fields.length >= this.MAX_FIELDS) {
      // Remove oldest field
      this.fields.shift();
    }

    const colors = {
      attractor: hsl(180, 70, 60, 0.8),
      repulsor: hsl(0, 80, 60, 0.8),
      vortex: hsl(280, 80, 60, 0.8),
      directional: hsl(120, 70, 60, 0.8)
    };

    const field: ForceField = {
      id: this.nextFieldId++,
      type,
      position: { ...position },
      strength: this.state.config.fieldStrength,
      radius: this.state.config.fieldRadius,
      color: colors[type],
      active: true
    };

    this.fields.push(field);

    // Track field creation for progression
    this.progression.onFieldPlaced();

    // Add ripple effect
    this.renderer.addEffect({
      id: `ripple_${Date.now()}_${Math.random()}`,
      type: 'ripple',
      position: { ...position },
      lifetime: 0,
      maxLifetime: 0.8,
      radius: 30,
      color: colors[type],
      intensity: 0.7
    });
  }

  /**
   * Add tracked event listener for cleanup
   */
  private addListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window,
    type: K | string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type as string, handler as EventListener, options);
    this.eventListeners.push({ target, type: type as string, handler, options });
  }

  /**
   * Set up input handling
   */
  private setupInput(): void {
    this.addListener(this.canvas, 'mousedown', (e: any) => {
      this.isMouseDown = true;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.mousePosition = { x, y };

      // Create field for field tools
      if (['attractor', 'repulsor', 'vortex'].includes(this.state.activeTool)) {
        this.createField(this.state.activeTool as ForceFieldType, this.mousePosition);
      }
    });

    this.addListener(this.canvas, 'mouseup', () => {
      this.isMouseDown = false;
      this.particleSpawnTimer = 0;
    });

    this.addListener(this.canvas, 'mousemove', (e: any) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.mousePosition = { x, y };
    });

    this.addListener(this.canvas, 'mouseleave', () => {
      this.isMouseDown = false;
      this.mousePosition = null;
    });

    // Touch support
    this.addListener(this.canvas, 'touchstart', (e: any) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.mousePosition = { x, y };
      this.isMouseDown = true;

      if (['attractor', 'repulsor', 'vortex'].includes(this.state.activeTool)) {
        this.createField(this.state.activeTool as ForceFieldType, this.mousePosition);
      }
    }, { passive: false });

    this.addListener(this.canvas, 'touchend', (e: any) => {
      e.preventDefault();
      this.isMouseDown = false;
      this.particleSpawnTimer = 0;
    });

    this.addListener(this.canvas, 'touchmove', (e: any) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.mousePosition = { x, y };
    }, { passive: false });
  }

  /**
   * Set up resize handling
   */
  private setupResize(): void {
    this.addListener(window, 'resize', () => {
      this.renderer.resize(this.canvas);
      const dims = this.renderer.getDimensions();
      this.particleSystem.resize(dims.width, dims.height);
    });
  }

  /**
   * Set active tool
   */
  setTool(tool: ToolType): void {
    if (tool === 'clear') {
      this.particleSystem.clear();
      this.fields = [];
      this.state.fields = this.fields;
    } else {
      this.state.activeTool = tool;
    }
  }

  /**
   * Update config value with validation
   */
  updateConfig(key: keyof GameConfig, value: number): void {
    // Validate input
    if (!Number.isFinite(value) || value < 0) {
      console.warn(`Invalid config value for ${key}: ${value}`);
      return;
    }

    this.state.config[key] = value;
    // Note: ParticleSystem reads config on each update, so changes apply immediately
  }

  /**
   * Pause/resume the simulation
   */
  setPaused(paused: boolean): void {
    this.state.isPaused = paused;
  }

  /**
   * Check if game is paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Destroy game instance and cleanup resources
   */
  destroy(): void {
    if (this.isDestroyed) return;

    // Stop engine
    this.engine.stop();

    // Remove all event listeners
    this.eventListeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
    this.eventListeners = [];

    // Clear event bus
    this.eventBus.clear();

    // Clear game state
    this.particleSystem.clear();
    this.fields = [];
    this.state.fields = [];

    this.isDestroyed = true;
  }

  /**
   * Check if game is destroyed
   */
  isGameDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: (...args: any[]) => void): () => void {
    return this.eventBus.on(event, handler);
  }

  /**
   * Get current state
   */
  getState(): GameState {
    return this.state;
  }

  /**
   * Get progression info
   */
  getProgression() {
    return this.progression.getProgress();
  }

  /**
   * Set particle type
   */
  setParticleType(type: ParticleType): void {
    const unlocked = this.progression.getProgress().unlockedParticleTypes;
    if (unlocked.includes(type)) {
      this.currentParticleType = type;

      // Add visual feedback
      this.renderer.addEffect({
        id: `type_change_${Date.now()}`,
        type: 'explosion',
        position: { x: this.renderer.getDimensions().width / 2, y: this.renderer.getDimensions().height / 2 },
        lifetime: 0,
        maxLifetime: 0.5,
        radius: 50,
        color: hsl(200, 80, 70),
        intensity: 0.6
      });
    } else {
      console.warn(`Particle type ${type} is not unlocked yet`);
    }
  }

  /**
   * Get current particle type
   */
  getCurrentParticleType(): ParticleType {
    return this.currentParticleType;
  }
}
