const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.querySelector(".hud");

let hudHideTimer = null;
let hudDismissed = false;

const config = {
  speed: 120,
  baseLength: 160,
  segmentDistance: 6,
  foodGrowth: 48,
  maxBrightness: 1.7,
  fadeDuration: 1.5,
  respawnDelay: 2,
  intersectionCooldown: 0.8,
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

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.viewportWidth = rect.width;
  state.viewportHeight = rect.height;
}

function init() {
  resize();
  window.addEventListener("resize", resize);
  setupInput();
  resetSnake(true);
  scheduleHudHide();
  requestAnimationFrame(loop);
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

function spawnFood() {
  const margin = 80;
  const width = Math.max(state.viewportWidth - margin * 2, margin);
  const height = Math.max(state.viewportHeight - margin * 2, margin);
  const x = margin + Math.random() * width;
  const y = margin + Math.random() * height;
  return { x, y };
}

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

  window.addEventListener("keydown", (event) => {
    const dir = keyMap[event.key];
    if (!dir) return;
    setDirection(dir);
  });

  let touchStart = null;
  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
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
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );

  document.querySelectorAll(".arrow").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const dir = button.dataset.dir;
      if (!dir) return;
      const mapping = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };
      setDirection(mapping[dir]);
    });
  });
}

function setDirection(dir) {
  if (!dir) return;
  dismissHud();
  // Prevent instant reversal.
  if (dir.x === -state.direction.x && dir.y === -state.direction.y) {
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

function checkFood(head) {
  if (!state.food) return;
  const distance = Math.hypot(head.x - state.food.x, head.y - state.food.y);
  const pickupRadius = 20;
  if (distance <= pickupRadius) {
    state.targetLength += config.foodGrowth;
    state.brightness = Math.min(state.brightness + 0.18, config.maxBrightness);
    state.food = spawnFood();
  }
}

function checkSelfIntersection(head) {
  const threshold = 8;
  let intersecting = false;
  for (let i = 6; i < state.points.length - 2; i += 1) {
    const start = state.points[i];
    const end = state.points[i + 1];
    if (pointToSegmentDistance(head, start, end) < threshold) {
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
  if (state.mode === "fade") {
    const alpha = Math.min(state.fadeTimer / config.fadeDuration, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
    ctx.fillRect(0, 0, state.viewportWidth, state.viewportHeight);
  }
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

init();
