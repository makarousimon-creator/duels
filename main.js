// DOM elements - initialized after DOMContentLoaded
let canvas = null;
let ctx = null;
let hud = null;

// Timers and state
let hudHideTimer = null;
let hudDismissed = false;
let eventListeners = [];

const config = {
  speed: 120,
  baseLength: 160,
  segmentDistance: 6,
  foodGrowth: 48,
  maxBrightness: 1.7,
  fadeDuration: 1.5,
  respawnDelay: 2,
  intersectionCooldown: 0.8,
  // Collision detection parameters
  collisionThreshold: 8,
  collisionSkipPoints: 6,
  // Food spawn parameters
  foodSpawnPaddingMin: 40,
  foodSpawnPaddingMax: 80,
  foodSpawnPaddingRatio: 0.1,
  foodPickupRadius: 20,
};

const overlayTextStyle = {
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  weight: 600,
  subWeight: 400,
  baseRatio: 0.07,
  minSize: 22,
  maxSize: 68,
  secondaryScale: 0.6,
  lineSpacing: 1.4,
  primaryFill: "rgba(255, 255, 255, 0.95)",
  secondaryFill: "rgba(210, 225, 255, 0.88)",
  shadowColor: "rgba(5, 10, 25, 0.65)",
  shadowBlur: 10,
};

const state = {
  points: [],
  totalLength: 0,
  targetLength: config.baseLength,
  direction: { x: 1, y: 0 },
  pendingDirection: { x: 1, y: 0 },
  brightness: 0.7,
  intersections: 0,
  lastIntersection: config.intersectionCooldown,
  food: null,
  foodPulse: Math.random() * Math.PI * 2,
  cycle: 0,
  memoryShift: 210,
  mode: "play", // play | fade | wait
  fadeTimer: 0,
  waitTimer: 0,
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
};

/**
 * Initialize DOM elements with error handling
 * @throws {Error} If required DOM elements are not found
 */
function initDOMElements() {
  canvas = document.getElementById("game");
  if (!canvas) {
    throw new Error("Canvas element with id='game' not found");
  }

  ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not supported by browser");
  }

  hud = document.querySelector(".hud");
  // HUD is optional, so no error if not found
}

/**
 * Cleanup all timers and event listeners
 */
function cleanup() {
  // Clear HUD timer
  if (hudHideTimer) {
    clearTimeout(hudHideTimer);
    hudHideTimer = null;
  }

  // Remove all event listeners
  eventListeners.forEach(({ target, event, handler, options }) => {
    target.removeEventListener(event, handler, options);
  });
  eventListeners.length = 0;
}

/**
 * Add event listener with tracking for cleanup
 */
function addTrackedListener(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  eventListeners.push({ target, event, handler, options });
}

function resize() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewportWidth = rect.width;
  state.viewportHeight = rect.height;
}

function init() {
  try {
    initDOMElements();
    resize();
    addTrackedListener(window, "resize", resize);
    addTrackedListener(window, "beforeunload", cleanup);
    setupInput();
    resetSnake(true);
    scheduleHudHide();
    requestAnimationFrame(loop);
  } catch (error) {
    console.error("Failed to initialize game:", error);
    const errorMessage = document.createElement("div");
    errorMessage.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,0,0,0.9);color:white;padding:20px;border-radius:10px;font-family:sans-serif;text-align:center;";
    errorMessage.innerHTML = `<h2>Ошибка инициализации</h2><p>${error.message}</p><p>Попробуйте обновить страницу или использовать другой браузер.</p>`;
    document.body.appendChild(errorMessage);
    throw error;
  }
}

function scheduleHudHide() {
  if (!hud || hudDismissed) return;
  if (hudHideTimer) {
    clearTimeout(hudHideTimer);
  }
  hudHideTimer = window.setTimeout(() => {
    dismissHud();
  }, 9000);
}

function dismissHud() {
  if (!hud || hudDismissed) return;
  hudDismissed = true;
  hud.classList.add("hud--hidden");
  if (hudHideTimer) {
    clearTimeout(hudHideTimer);
    hudHideTimer = null;
  }
}

function resetSnake(initial = false) {
  const center = {
    x: state.viewportWidth / 2,
    y: state.viewportHeight / 2,
  };
  state.points = [];
  state.totalLength = 0;
  state.targetLength = config.baseLength;
  state.direction = { x: 1, y: 0 };
  state.pendingDirection = { x: 1, y: 0 };
  state.brightness = 0.7;
  state.intersections = 0;
  state.lastIntersection = config.intersectionCooldown;
  state.foodPulse = Math.random() * Math.PI * 2;
  state.mode = "play";
  state.fadeTimer = 0;
  state.waitTimer = 0;

  const initialSegments = Math.ceil(config.baseLength / config.segmentDistance);
  for (let i = 0; i <= initialSegments; i += 1) {
    state.points.push({
      x: center.x - i * config.segmentDistance,
      y: center.y,
    });
    if (i > 0) {
      state.totalLength += config.segmentDistance;
    }
  }

  state.food = spawnFood();

  if (!initial) {
    state.cycle += 1;
    state.memoryShift = (state.memoryShift + 14) % 360;
  }
}

/**
 * Spawn food at random position with adaptive padding
 * @returns {{x: number, y: number}} Food coordinates
 */
function spawnFood() {
  // Adaptive padding based on viewport size
  const padding = Math.max(
    config.foodSpawnPaddingMin,
    Math.min(
      config.foodSpawnPaddingMax,
      state.viewportWidth * config.foodSpawnPaddingRatio
    )
  );

  const availableWidth = Math.max(state.viewportWidth - padding * 2, 0);
  const availableHeight = Math.max(state.viewportHeight - padding * 2, 0);

  let x, y;

  // Handle small viewports
  if (availableWidth === 0 || availableHeight === 0) {
    x = state.viewportWidth / 2;
    y = state.viewportHeight / 2;
  } else {
    x = padding + Math.random() * availableWidth;
    y = padding + Math.random() * availableHeight;
  }

  // Utility function for clamping values
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const xMin = Math.min(padding, state.viewportWidth - padding);
  const xMax = Math.max(padding, state.viewportWidth - padding);
  const yMin = Math.min(padding, state.viewportHeight - padding);
  const yMax = Math.max(padding, state.viewportHeight - padding);

  return {
    x: clamp(x, xMin, xMax),
    y: clamp(y, yMin, yMax),
  };
}

/**
 * Setup all input handlers (keyboard, touch, buttons)
 */
function setupInput() {
  const keyMap = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    a: { x: -1, y: 0 },
    s: { x: 0, y: 1 },
    d: { x: 1, y: 0 },
  };

  // Keyboard input
  const handleKeydown = (event) => {
    const dir = keyMap[event.key];
    if (!dir) return;
    setDirection(dir);
  };
  addTrackedListener(window, "keydown", handleKeydown);

  // Touch input
  let touchStart = null;

  const handleTouchStart = (event) => {
    event.preventDefault();
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    event.preventDefault();
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 24) {
      if (Math.abs(dx) > Math.abs(dy)) {
        setDirection({ x: Math.sign(dx), y: 0 });
      } else {
        setDirection({ x: 0, y: Math.sign(dy) });
      }
    }
    touchStart = null;
  };

  const handleTouchMove = (event) => {
    event.preventDefault();
  };

  addTrackedListener(canvas, "touchstart", handleTouchStart, { passive: false });
  addTrackedListener(canvas, "touchend", handleTouchEnd, { passive: false });
  addTrackedListener(canvas, "touchmove", handleTouchMove, { passive: false });

  // Button input
  const buttonDirections = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const applyButtonDirection = (button) => {
    const dirKey = button.dataset.dir;
    if (!dirKey) return;
    const dir = buttonDirections[dirKey];
    if (!dir) return;
    setDirection(dir);
  };

  document.querySelectorAll(".arrow").forEach((button) => {
    const handlePointerDown = (event) => {
      event.preventDefault();
      applyButtonDirection(button);
    };

    const handleClick = () => {
      applyButtonDirection(button);
    };

    const handleKeydown = (event) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        applyButtonDirection(button);
      }
    };

    addTrackedListener(button, "pointerdown", handlePointerDown);
    addTrackedListener(button, "click", handleClick);
    addTrackedListener(button, "keydown", handleKeydown);
  });
}

/**
 * Set direction with validation and reversal prevention
 * @param {{x: number, y: number}} dir - Direction vector
 */
function setDirection(dir) {
  // Validate input
  if (!dir || typeof dir.x !== "number" || typeof dir.y !== "number") {
    console.warn("Invalid direction:", dir);
    return;
  }

  // Validate that direction is a unit vector (or zero)
  const magnitude = Math.abs(dir.x) + Math.abs(dir.y);
  if (magnitude !== 0 && magnitude !== 1) {
    console.warn("Direction must be a unit vector:", dir);
    return;
  }

  const isOpposite = (a, b) => a.x === -b.x && a.y === -b.y;
  const reversingPending = isOpposite(dir, state.pendingDirection);
  const reversingCurrent = isOpposite(dir, state.direction);
  const pendingMatchesCurrent =
    state.pendingDirection.x === state.direction.x &&
    state.pendingDirection.y === state.direction.y;

  if (reversingPending || (reversingCurrent && pendingMatchesCurrent)) {
    return;
  }

  state.pendingDirection = dir;
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (state.mode === "fade") {
    state.fadeTimer += dt;
    if (state.fadeTimer >= config.fadeDuration) {
      state.mode = "wait";
      state.fadeTimer = config.fadeDuration;
      state.waitTimer = 0;
    }
    return;
  }

  if (state.mode === "wait") {
    state.waitTimer += dt;
    if (state.waitTimer >= config.respawnDelay) {
      resetSnake();
    }
    return;
  }

  state.direction = state.pendingDirection;
  state.lastIntersection += dt;
  state.foodPulse += dt * 2;

  const step = config.speed * dt;
  const head = state.points[0];
  const proposedHead = {
    x: head.x + state.direction.x * step,
    y: head.y + state.direction.y * step,
  };

  const segmentDistance = Math.hypot(
    proposedHead.x - head.x,
    proposedHead.y - head.y
  );

  const newHead = { ...proposedHead };
  wrapPosition(newHead);
  if (segmentDistance > 0) {
    state.points.unshift(newHead);
    state.totalLength += segmentDistance;
  }

  trimTail();
  checkFood(newHead);
  checkSelfIntersection(newHead);
}

function wrapPosition(point) {
  const padding = 2;
  const width = state.viewportWidth;
  const height = state.viewportHeight;

  if (point.x < -padding) point.x = width + padding;
  if (point.x > width + padding) point.x = -padding;
  if (point.y < -padding) point.y = height + padding;
  if (point.y > height + padding) point.y = -padding;
}

function trimTail() {
  while (state.totalLength > state.targetLength && state.points.length > 1) {
    const tail = state.points[state.points.length - 1];
    const beforeTail = state.points[state.points.length - 2];
    const segLen = Math.hypot(tail.x - beforeTail.x, tail.y - beforeTail.y);
    const excess = state.totalLength - state.targetLength;

    if (excess >= segLen) {
      state.points.pop();
      state.totalLength -= segLen;
      continue;
    }

    const keep = segLen - excess;
    const ratio = keep / segLen;
    tail.x = beforeTail.x + (tail.x - beforeTail.x) * ratio;
    tail.y = beforeTail.y + (tail.y - beforeTail.y) * ratio;
    state.totalLength -= excess;
    break;
  }
}

/**
 * Check if player collected food
 * @param {{x: number, y: number}} head - Player head position
 */
function checkFood(head) {
  if (!state.food) return;
  const distance = Math.hypot(head.x - state.food.x, head.y - state.food.y);
  if (distance <= config.foodPickupRadius) {
    state.targetLength += config.foodGrowth;
    state.brightness = Math.min(state.brightness + 0.18, config.maxBrightness);
    state.food = spawnFood();
  }
}

/**
 * Check if player intersects with their own trail
 * @param {{x: number, y: number}} head - Player head position
 */
function checkSelfIntersection(head) {
  let intersecting = false;
  for (let i = config.collisionSkipPoints; i < state.points.length - 2; i += 1) {
    const start = state.points[i];
    const end = state.points[i + 1];
    if (pointToSegmentDistance(head, start, end) < config.collisionThreshold) {
      intersecting = true;
      break;
    }
  }

  if (intersecting && state.lastIntersection >= config.intersectionCooldown) {
    state.intersections += 1;
    state.brightness = Math.max(state.brightness * 0.7, 0.25);
    state.lastIntersection = 0;
    if (state.intersections >= 3) {
      state.mode = "fade";
      state.fadeTimer = 0;
      state.waitTimer = 0;
    }
  }
}

function pointToSegmentDistance(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  if (vx === 0 && vy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = ((point.x - start.x) * vx + (point.y - start.y) * vy) / (vx * vx + vy * vy);
  const clamped = Math.max(0, Math.min(1, t));
  const closest = {
    x: start.x + vx * clamped,
    y: start.y + vy * clamped,
  };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function draw() {
  paintBackdrop();
  drawFood();
  drawSnake();
  drawFadeOverlay();
}

function paintBackdrop() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, 0, state.viewportWidth, state.viewportHeight);

  const tint = hsl(state.memoryShift, 45, 12, 0.08);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, state.viewportWidth, state.viewportHeight);
}

function drawFood() {
  if (!state.food) return;
  const pulse = (Math.sin(state.foodPulse) + 1) / 2;
  const radius = 10 + pulse * 6;
  const gradient = ctx.createRadialGradient(
    state.food.x,
    state.food.y,
    0,
    state.food.x,
    state.food.y,
    radius
  );
  gradient.addColorStop(0, "rgba(180, 220, 255, 0.9)");
  gradient.addColorStop(1, "rgba(90, 140, 255, 0)");

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(state.food.x, state.food.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake() {
  if (state.points.length < 2) return;
  const brightness = state.brightness * fadeMultiplier();
  const head = state.points[0];
  const tail = state.points[state.points.length - 1];

  const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
  gradient.addColorStop(0, `hsla(185, 90%, 72%, ${Math.min(brightness, 1.2)})`);
  gradient.addColorStop(1, `hsla(285, 85%, 65%, ${Math.min(brightness * 0.9, 1.1)})`);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `hsla(200, 100%, 75%, ${Math.min(brightness * 0.6, 1)})`;
  ctx.shadowBlur = 30;
  ctx.lineWidth = 14;
  ctx.strokeStyle = gradient;
  ctx.globalCompositeOperation = "lighter";

  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  for (let i = 1; i < state.points.length; i += 1) {
    const point = state.points[i];
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function fadeMultiplier() {
  if (state.mode === "fade") {
    return Math.max(0, 1 - state.fadeTimer / config.fadeDuration);
  }
  if (state.mode === "wait") {
    return 0;
  }
  return 1;
}

function drawFadeOverlay() {
  if (state.mode !== "fade" && state.mode !== "wait") {
    return;
  }

  const fadeProgress = Math.min(state.fadeTimer / config.fadeDuration, 1);
  const waitProgress = Math.min(state.waitTimer / config.respawnDelay, 1);
  const overlayAlpha =
    state.mode === "fade" ? 0.35 + fadeProgress * 0.45 : 0.78;

  ctx.save();
  ctx.fillStyle = `rgba(10, 10, 22, ${overlayAlpha})`;
  ctx.fillRect(0, 0, state.viewportWidth, state.viewportHeight);

  const minDimension = Math.min(state.viewportWidth, state.viewportHeight);
  const baseFontSize = Math.max(
    overlayTextStyle.minSize,
    Math.min(
      overlayTextStyle.maxSize,
      minDimension * overlayTextStyle.baseRatio
    )
  );
  const secondaryFontSize = Math.round(
    baseFontSize * overlayTextStyle.secondaryScale
  );
  const secondaryOffset = secondaryFontSize * overlayTextStyle.lineSpacing;

  const countdown = Math.max(
    0,
    Math.ceil(Math.max(config.respawnDelay - state.waitTimer, 0))
  );
  const headline =
    countdown > 0 ? `Перерождение через ${countdown}…` : "Перерождение!";
  const subline =
    state.mode === "fade"
      ? `Затухание: ${Math.round(fadeProgress * 100)}%`
      : `Готовность: ${Math.round(waitProgress * 100)}%`;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = overlayTextStyle.shadowColor;
  ctx.shadowBlur = overlayTextStyle.shadowBlur;

  const centerX = state.viewportWidth / 2;
  const centerY = state.viewportHeight / 2;

  ctx.font = `${overlayTextStyle.weight} ${Math.round(baseFontSize)}px ${overlayTextStyle.fontFamily}`;
  ctx.fillStyle = overlayTextStyle.primaryFill;
  ctx.fillText(headline, centerX, centerY - secondaryFontSize * 0.4);

  ctx.font = `${overlayTextStyle.subWeight} ${secondaryFontSize}px ${overlayTextStyle.fontFamily}`;
  ctx.fillStyle = overlayTextStyle.secondaryFill;
  ctx.fillText(subline, centerX, centerY + secondaryOffset);

  ctx.restore();
}

/**
 * Utility function to create HSL color strings
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @param {number} a - Alpha (0-1)
 * @returns {string} HSL color string
 */
function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// Initialize game after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  // DOM already loaded
  init();
}
