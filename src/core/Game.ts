/**
 * Main game class coordinating all systems
 */

import type { GameConfig, GameState, ForceField, ForceFieldType, ToolType, Vector2 } from '../types';
import { Engine } from './Engine';
import { EventBus } from './EventBus';
import { ParticleSystem } from '../physics/ParticleSystem';
import { Renderer } from '../rendering/Renderer';
import { hsl } from '../utils/math';

export class Game {
  private engine: Engine;
  private eventBus: EventBus;
  private particleSystem: ParticleSystem;
  private renderer: Renderer;
  private state: GameState;
  private canvas: HTMLCanvasElement;

  private fields: ForceField[] = [];
  private nextFieldId: number = 0;
  private mousePosition: Vector2 | null = null;
  private isMouseDown: boolean = false;
  private particleSpawnTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.eventBus = new EventBus();
    this.renderer = new Renderer(canvas);

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

    // Handle mouse input
    if (this.isMouseDown && this.mousePosition) {
      this.handleToolAction(this.mousePosition, dt);
    }

    // Update particles
    this.particleSystem.update(dt, this.fields);
    this.state.particles = this.particleSystem.getParticles();

    // Update stats
    this.state.stats.fps = this.engine.getFPS();
    this.state.stats.particleCount = this.state.particles.length;
    this.state.stats.fieldCount = this.fields.length;

    // Emit update event
    this.eventBus.emit('update', this.state);
  }

  /**
   * Render game
   */
  private render(): void {
    this.renderer.clear(0.15);
    this.renderer.renderConnections(this.state.particles, 80);
    this.renderer.renderTrails(this.state.particles);
    this.renderer.renderFields(this.fields);
    this.renderer.renderParticles(this.state.particles);
  }

  /**
   * Handle tool actions
   */
  private handleToolAction(position: Vector2, dt: number): void {
    switch (this.state.activeTool) {
      case 'particle':
        this.particleSpawnTimer += dt;
        if (this.particleSpawnTimer >= 0.03) {
          this.particleSystem.createParticle(position);
          this.particleSpawnTimer = 0;
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
  }

  /**
   * Create a force field
   */
  private createField(type: ForceFieldType, position: Vector2): void {
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
  }

  /**
   * Set up input handling
   */
  private setupInput(): void {
    this.canvas.addEventListener('mousedown', (e) => {
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

    this.canvas.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.particleSpawnTimer = 0;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.mousePosition = { x, y };
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      this.mousePosition = null;
    });

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
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

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isMouseDown = false;
      this.particleSpawnTimer = 0;
    });

    this.canvas.addEventListener('touchmove', (e) => {
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
    window.addEventListener('resize', () => {
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
   * Update config value
   */
  updateConfig(key: keyof GameConfig, value: number): void {
    this.state.config[key] = value;
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
}
