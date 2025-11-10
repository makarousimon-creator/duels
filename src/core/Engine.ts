/**
 * Game engine with fixed timestep game loop
 */

export class Engine {
  private running: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDelta: number = 1 / 60; // 60 FPS
  private fps: number = 60;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;

  private updateCallback: (dt: number) => void;
  private renderCallback: () => void;

  constructor(updateCallback: (dt: number) => void, renderCallback: () => void) {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.loop(this.lastTime);
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Main game loop with fixed timestep
   */
  private loop = (currentTime: number): void => {
    if (!this.running) return;

    requestAnimationFrame(this.loop);

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.accumulator += deltaTime;

    // Fixed timestep updates
    while (this.accumulator >= this.fixedDelta) {
      this.updateCallback(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
    }

    // Render
    this.renderCallback();

    // Update FPS counter
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }
  };

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.running;
  }
}
