/* globals Matter */
const { Engine, Render, Runner, World, Bodies, Body, Events, Query, Constraint } = Matter;

const CW = 900, CH = 560, WALL_T = 40;
const MARBLE_R = 14, TRAIL_MAX = 35;
const MARBLE_X = CW / 2, MARBLE_Y = 30;

// ── Render helpers ────────────────────────────────────────────────
function fill(color, stroke = 'rgba(255,255,255,0.25)') {
  return { fillStyle: color, strokeStyle: stroke, lineWidth: 2 };
}

function ghostRect(ctx, p, w, h, color, angle = 0) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, -w / 2, -h / 2, w, h, 5);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function ghostCircle(ctx, p, r, color, angle = 0) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Tool definitions ──────────────────────────────────────────────
const TOOLS = [
  {
    id: 'linie', label: 'Linie', icon: '━━━', color: '#f5a623',
    create(p, a) {
      return Bodies.rectangle(p.x, p.y, 200, 12, {
        chamfer: { radius: 5 }, angle: a,
        isStatic: false, density: 0.003, friction: 0.55, frictionAir: 0.01,
        restitution: 0.25, label: 'linie', render: fill('#f5a623'),
      });
    },
    ghost(ctx, p, a) { ghostRect(ctx, p, 200, 12, '#f5a623', a); },
  },

  {
    id: 'bruecke', label: 'Bridge', icon: '∩', color: '#f0c040',
    create(p, a) {
      const W = 120, wH = 50, wT = 10, fT = 12;
      const r = fill('#f0c040');
      const floor = Bodies.rectangle(p.x,       p.y + wH / 2, W + wT * 2, fT, { render: r });
      const left  = Bodies.rectangle(p.x - W/2, p.y,          wT, wH,         { render: r });
      const right = Bodies.rectangle(p.x + W/2, p.y,          wT, wH,         { render: r });
      const body = Body.create({
        parts: [floor, left, right],
        isStatic: false, density: 0.004, friction: 0.5, frictionAir: 0.01,
        restitution: 0.2, label: 'bruecke',
      });
      Body.setAngle(body, a);
      return body;
    },
    ghost(ctx, p, a) {
      const W = 120, wH = 50, wT = 10, fT = 12;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#f0c040';
      ctx.fillRect(-W/2 - wT, -wH/2, wT, wH);
      ctx.fillRect( W/2,      -wH/2, wT, wH);
      ctx.fillRect(-W/2 - wT,  wH/2, W + wT*2, fT);
      ctx.restore();
    },
  },

  {
    id: 'rohr', label: 'Rohr', icon: '⟹', color: '#4ecdc4',
    create(p, a) {
      const pW = 180, rH = 10, gap = 36;
      const half = (gap + rH) / 2;
      const r = fill('#4ecdc4');
      const top = Bodies.rectangle(p.x, p.y - half, pW, rH, { chamfer: { radius: 4 }, render: r });
      const bot = Bodies.rectangle(p.x, p.y + half, pW, rH, { chamfer: { radius: 4 }, render: r });
      const body = Body.create({
        parts: [top, bot],
        isStatic: false, density: 0.004, friction: 0.3, frictionAir: 0.01,
        restitution: 0.2, label: 'rohr',
      });
      Body.setAngle(body, a);
      return body;
    },
    ghost(ctx, p, a) {
      const pW = 180, rH = 10, gap = 36;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#4ecdc4';
      ctx.fillRect(-pW/2, -(gap/2 + rH), pW, rH);
      ctx.fillRect(-pW/2,   gap/2,        pW, rH);
      ctx.restore();
    },
  },

  {
    id: 'trampolin', label: 'Trampolin', icon: '⌒', color: '#ff5e7e',
    create(p) {
      return Bodies.rectangle(p.x, p.y, 110, 14, {
        chamfer: { radius: 6 },
        isStatic: false, density: 0.003, friction: 0.05, frictionAir: 0.01,
        restitution: 0.05,  // bounce handled by collision event, not built-in restitution
        label: 'trampolin', render: fill('#ff5e7e'),
      });
    },
    ghost(ctx, p, a) { ghostRect(ctx, p, 110, 14, '#ff5e7e', a); },
  },

  {
    // Static — no gravity. Blows things in direction it faces (rotate with scroll)
    id: 'ventilator', label: 'Ventilator', icon: '🌀', color: '#45b7d1',
    create(p) {
      return Bodies.circle(p.x, p.y, 22, {
        isStatic: true,
        label: 'ventilator',
        render: { fillStyle: '#0d3d54', strokeStyle: '#45b7d1', lineWidth: 2.5 },
      });
    },
    ghost(ctx, p) { ghostCircle(ctx, p, 22, '#0d3d54'); },
  },

  {
    // Static — no gravity. Attracts the marble within range
    id: 'magnet', label: 'Magnet', icon: '🧲', color: '#c678dd',
    create(p) {
      return Bodies.circle(p.x, p.y, 18, {
        isStatic: true,
        label: 'magnet',
        render: { fillStyle: '#3a1050', strokeStyle: '#c678dd', lineWidth: 2.5 },
      });
    },
    ghost(ctx, p) { ghostCircle(ctx, p, 18, '#3a1050'); },
  },

  {
    // Static peg, no gravity — fixed support point. Dropped onto an object it
    // pins the object to that spot (one nail = revolute joint, it can swing).
    id: 'nagel', label: 'Nagel', icon: '📌', color: '#d0dae8',
    create(p) {
      return Bodies.circle(p.x, p.y, 6, {
        isStatic: true, friction: 0.9, restitution: 0.1,
        label: 'nagel',
        render: { fillStyle: '#d0dae8', strokeStyle: '#8090b8', lineWidth: 2 },
      });
    },
    ghost(ctx, p) { ghostCircle(ctx, p, 6, '#d0dae8'); },
  },
];

// ── State ─────────────────────────────────────────────────────────
let engine, render, runner;
let marble = null;
let trailPoints = [];
let placedBodies = [];
let selectedTool = null;
let placementAngle = 0;     // pre-placement rotation angle
let isRunning = false;
let isFrozen = false;
let mousePos = { x: 0, y: 0 };
let fanSpin = 0;
let frameTick = 0;

let dragBody = null, dragOffX = 0, dragOffY = 0;
let isDragging = false, dragWasDynamic = false;
let lastTouchedBody = null;   // most recently grabbed body, target for rotate buttons
let nailPins = [];            // { nail, body, constraint } — nails pinned onto objects

const BASE_GRAVITY = 1.3;

// ── Bootstrap ─────────────────────────────────────────────────────
function init() {
  engine = Engine.create();
  engine.gravity.y = 1.3;

  const canvas = document.getElementById('marble-canvas');
  render = Render.create({
    canvas, engine,
    options: { width: CW, height: CH, wireframes: false, background: '#0f0c24' },
  });
  runner = Runner.create();

  // Boundaries — floor is slightly visible, side walls are invisible
  const floorOpts = {
    isStatic: true, label: 'boundary', restitution: 0.25, friction: 0.5,
    render: { fillStyle: '#1e2d56', strokeStyle: '#2a3f80', lineWidth: 1 },
  };
  const sideOpts = { ...floorOpts, render: { fillStyle: '#0f0c24', strokeStyle: 'transparent', lineWidth: 0 } };

  World.add(engine.world, [
    Bodies.rectangle(CW / 2,          CH + WALL_T / 2, CW + 80, WALL_T, floorOpts),
    Bodies.rectangle(-WALL_T / 2,     CH / 2,          WALL_T,  CH * 2, sideOpts),
    Bodies.rectangle(CW + WALL_T / 2, CH / 2,          WALL_T,  CH * 2, sideOpts),
  ]);

  Events.on(engine, 'afterUpdate', afterUpdate);
  Events.on(engine, 'collisionStart', handleCollisions);
  Events.on(render, 'afterRender', afterRender);
  Render.run(render);
  Runner.run(runner, engine);

  buildPalette();
  setupEvents(canvas);
  document.getElementById('startBtn').onclick       = startRun;
  document.getElementById('resetBallBtn').onclick   = resetBall;
  document.getElementById('resetCanvasBtn').onclick = resetCanvas;
  document.getElementById('freezeBtn').onclick      = toggleFreeze;
  document.getElementById('rotateLeftBtn').onclick  = () => rotateSelection(-1);
  document.getElementById('rotateRightBtn').onclick = () => rotateSelection(1);
}

// Rotate the placement ghost (when a tool is selected) or the last-grabbed body.
function rotateSelection(dir) {
  const step = dir * 0.2;
  if (selectedTool) {
    placementAngle = (placementAngle + step) % (Math.PI * 2);
  } else if (lastTouchedBody && placedBodies.includes(lastTouchedBody)) {
    Body.setAngle(lastTouchedBody, lastTouchedBody.angle + step);
    Body.setAngularVelocity(lastTouchedBody, 0);
  }
}

// ── Marble ────────────────────────────────────────────────────────
function addMarble() {
  marble = Bodies.circle(MARBLE_X, MARBLE_Y, MARBLE_R, {
    restitution: 0.45, friction: 0.06, frictionAir: 0.004, density: 0.003,
    label: 'marble',
    render: { fillStyle: '#ffd700', strokeStyle: '#ffaa00', lineWidth: 2 },
  });
  World.add(engine.world, marble);
  trailPoints = [];
}

function removeMarble() {
  if (!marble) return;
  World.remove(engine.world, marble);
  marble = null;
  trailPoints = [];
}

function startRun() {
  if (isRunning) return;
  isRunning = true;
  selectedTool = null; refreshToolButtons();
  addMarble();
  document.getElementById('startBtn').disabled     = true;
  document.getElementById('resetBallBtn').disabled = false;
}

function resetBall() {
  isRunning = false; removeMarble();
  document.getElementById('startBtn').disabled     = false;
  document.getElementById('resetBallBtn').disabled = true;
}

function resetCanvas() {
  resetBall();
  nailPins.forEach(pin => World.remove(engine.world, pin.constraint));
  nailPins = [];
  placedBodies.forEach(b => World.remove(engine.world, b));
  placedBodies = [];
  lastTouchedBody = null;
}

function toggleFreeze() {
  isFrozen = !isFrozen;
  engine.gravity.y = isFrozen ? 0 : BASE_GRAVITY;
  if (isFrozen) {
    // Stop all motion when freezing
    Matter.Composite.allBodies(engine.world).forEach(b => {
      if (!b.isStatic) {
        Body.setVelocity(b, { x: 0, y: 0 });
        Body.setAngularVelocity(b, 0);
      }
    });
  }
  const btn = document.getElementById('freezeBtn');
  btn.textContent = isFrozen ? '🔥 Unfreeze' : '❄️ Freeze';
  btn.classList.toggle('frozen', isFrozen);
}

// ── Physics tick ──────────────────────────────────────────────────
function afterUpdate() {
  fanSpin = (fanSpin + 0.16) % (Math.PI * 2);
  frameTick++;

  const dynamicPlaced = placedBodies.filter(b => !b.isStatic);
  const targets = marble ? [...dynamicPlaced, marble] : dynamicPlaced;

  placedBodies.forEach(b => {
    if (b.label === 'ventilator') {
      const bx = Math.sin(b.angle);
      const by = Math.cos(b.angle);
      const range = 150, strength = 0.003;
      targets.forEach(t => {
        if (t === b) return;
        const dx = t.position.x - b.position.x;
        const dy = t.position.y - b.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < range) {
          const s = (1 - dist / range) * strength;
          Body.applyForce(t, t.position, { x: bx * s * t.mass, y: by * s * t.mass });
        }
      });
    }

    if (b.label === 'magnet' && marble) {
      const dx = marble.position.x - b.position.x;
      const dy = marble.position.y - b.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 160 && dist > 0) {
        const s = (1 - dist / 160) * 0.009;
        Body.applyForce(marble, marble.position, {
          x: -(dx / dist) * s * marble.mass,
          y: -(dy / dist) * s * marble.mass,
        });
      }
    }
  });

  if (!marble) return;
  trailPoints.push({ x: marble.position.x, y: marble.position.y });
  if (trailPoints.length > TRAIL_MAX) trailPoints.shift();
  if (marble.position.y > CH + 80) resetBall();
}

// Trampoline: only bounce the marble, not other bodies
function handleCollisions(e) {
  e.pairs.forEach(({ bodyA, bodyB }) => {
    const a = bodyA.label, b = bodyB.label;
    if (!((a === 'trampolin' && b === 'marble') || (a === 'marble' && b === 'trampolin'))) return;
    const marb = a === 'marble' ? bodyA : bodyB;
    // Only apply when marble is moving toward the trampoline (downward or lateral)
    const vy = marb.velocity.y;
    Body.setVelocity(marb, {
      x: marb.velocity.x * 0.9,
      y: -(Math.abs(vy) * 2.3 + 2),
    });
  });
}

// ── Rendering ─────────────────────────────────────────────────────
function afterRender() {
  const ctx = render.context;

  // Background dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 30; x < CW; x += 45) {
    for (let y = 30; y < CH; y += 45) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Special body overlays
  placedBodies.forEach(b => {
    if (b.label === 'ventilator') drawFan(ctx, b);
    if (b.label === 'magnet')     drawMagnetField(ctx, b);
  });

  // Rainbow trail
  if (trailPoints.length > 1) {
    for (let i = 1; i < trailPoints.length; i++) {
      const t = i / trailPoints.length;
      const hue = (i * 7 + frameTick * 2) % 360;
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${t * 0.55})`;
      ctx.lineWidth = MARBLE_R * 1.8 * t;
      ctx.lineCap = 'round';
      ctx.moveTo(trailPoints[i - 1].x, trailPoints[i - 1].y);
      ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
      ctx.stroke();
    }
  }

  // Marble shine
  if (marble) {
    const { x, y } = marble.position;
    const a = marble.angle;

    // Rotation indicator
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * MARBLE_R * 0.72, y + Math.sin(a) * MARBLE_R * 0.72);
    ctx.stroke();

    // Specular highlight
    const grad = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, MARBLE_R);
    grad.addColorStop(0, 'rgba(255,255,220,0.75)');
    grad.addColorStop(0.5, 'rgba(255,200,0,0)');
    grad.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, MARBLE_R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Start position indicator
  if (!isRunning) {
    const pulse = 0.4 + Math.sin(frameTick * 0.08) * 0.2;
    ctx.beginPath();
    ctx.arc(MARBLE_X, MARBLE_Y, MARBLE_R + 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,211,107,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Small marble preview
    ctx.beginPath();
    ctx.arc(MARBLE_X, MARBLE_Y, MARBLE_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.fill();
  }

  // Placement ghost with current angle
  if (selectedTool) {
    const tool = TOOLS.find(t => t.id === selectedTool);
    if (tool) tool.ghost(ctx, mousePos, placementAngle);
    // Rotation indicator text
    if (placementAngle !== 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(placementAngle * 180 / Math.PI)}°`, mousePos.x + 18, mousePos.y - 14);
      ctx.restore();
    }
  }
}

function drawFan(ctx, body) {
  const { x, y } = body.position;
  // Spinning blades
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle + fanSpin);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(
      Math.cos(a) * 7,        Math.sin(a) * 7,
      Math.cos(a + 0.7) * 17, Math.sin(a + 0.7) * 17,
      Math.cos(a + 0.35) * 20, Math.sin(a + 0.35) * 20,
    );
    ctx.fillStyle = '#7ad8f0';
    ctx.fill();
  }
  // Hub
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#a0e8ff'; ctx.fill();
  ctx.restore();

  // Blow direction arrow
  const bx = Math.sin(body.angle), by = Math.cos(body.angle);
  ctx.save();
  ctx.translate(x + bx * 30, y + by * 30);
  ctx.rotate(body.angle);
  ctx.strokeStyle = 'rgba(100,210,240,0.7)';
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 18);
  ctx.lineTo(-5, 12); ctx.moveTo(0, 18); ctx.lineTo(5, 12);
  ctx.stroke();
  ctx.restore();
}

function drawMagnetField(ctx, body) {
  const { x, y } = body.position;
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  for (let r = 40; r <= 160; r += 40) {
    const alpha = 0.35 - (r / 160) * 0.28;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(198,120,221,${alpha})`;
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#e8c0f8';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', x, y);
  ctx.restore();
}

// ── Canvas events ─────────────────────────────────────────────────
function setupEvents(canvas) {
  canvas.addEventListener('mousemove', e => {
    mousePos = canvasPos(e);
    if (isDragging && dragBody) {
      Body.setPosition(dragBody, { x: mousePos.x - dragOffX, y: mousePos.y - dragOffY });
      Body.setVelocity(dragBody, { x: 0, y: 0 });
      Body.setAngularVelocity(dragBody, 0);
      if (dragBody.label === 'nagel') syncPinsToNail(dragBody);
    }
    canvas.style.cursor = selectedTool ? 'crosshair'
      : isDragging ? 'grabbing'
      : Query.point(placedBodies, mousePos).length ? 'grab'
      : 'default';
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const p = canvasPos(e);
    if (selectedTool) { placeElement(selectedTool, p); return; }

    const hit = Query.point(placedBodies, p);
    if (hit.length) {
      dragBody = hit[0];
      lastTouchedBody = dragBody;
      dragWasDynamic = !dragBody.isStatic;
      if (dragWasDynamic) Body.setStatic(dragBody, true);
      dragOffX = p.x - dragBody.position.x;
      dragOffY = p.y - dragBody.position.y;
      isDragging = true;
    }
  });

  canvas.addEventListener('mouseup',    releaseDrag);
  canvas.addEventListener('mouseleave', releaseDrag);

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = canvasPos(e);
    const step = e.deltaY > 0 ? 0.12 : -0.12;
    const hit = Query.point(placedBodies, p);
    if (hit.length) {
      // Rotate existing placed body
      Body.setAngle(hit[0], hit[0].angle + step);
      Body.setAngularVelocity(hit[0], 0);
    } else if (selectedTool) {
      // Rotate placement ghost
      placementAngle = (placementAngle + step) % (Math.PI * 2);
    }
  }, { passive: false });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const p = canvasPos(e);
    const hit = Query.point(placedBodies, p);
    if (hit.length) removePlaced(hit[0]);
  });

  // ── Touch: place / drag / double-tap-to-delete ──
  let touchDragging = false, lastTapTime = 0, lastTapBody = null;

  function touchPoint(t) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - r.left) * (CW / r.width),
      y: (t.clientY - r.top)  * (CH / r.height),
    };
  }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const p = touchPoint(t);
    mousePos = p;

    if (selectedTool) { placeElement(selectedTool, p); return; }

    const hit = Query.point(placedBodies, p);
    if (!hit.length) return;

    const body = hit[0];
    const now = Date.now();
    if (body === lastTapBody && now - lastTapTime < 320) {
      // Double-tap → delete
      removePlaced(body);
      lastTapBody = null; lastTapTime = 0;
      return;
    }
    lastTapBody = body; lastTapTime = now;
    lastTouchedBody = body;

    dragBody = body;
    dragWasDynamic = !dragBody.isStatic;
    if (dragWasDynamic) Body.setStatic(dragBody, true);
    dragOffX = p.x - dragBody.position.x;
    dragOffY = p.y - dragBody.position.y;
    isDragging = true;
    touchDragging = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const p = touchPoint(t);
    mousePos = p;
    if (touchDragging && dragBody) {
      Body.setPosition(dragBody, { x: p.x - dragOffX, y: p.y - dragOffY });
      Body.setVelocity(dragBody, { x: 0, y: 0 });
      Body.setAngularVelocity(dragBody, 0);
      if (dragBody.label === 'nagel') syncPinsToNail(dragBody);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (touchDragging) { releaseDrag(); touchDragging = false; }
  }, { passive: false });
}

function releaseDrag() {
  if (dragBody && dragWasDynamic) {
    Body.setStatic(dragBody, false);
    Body.setVelocity(dragBody, { x: 0, y: 0 });
    Body.setAngularVelocity(dragBody, 0);
  }
  isDragging = false; dragBody = null; dragWasDynamic = false;
}

function canvasPos(e) {
  const r = e.target.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (CW / r.width),
    y: (e.clientY - r.top)  * (CH / r.height),
  };
}

// ── Placement ─────────────────────────────────────────────────────
function placeElement(toolId, p) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  const body = tool.create(p, placementAngle);
  World.add(engine.world, body);
  placedBodies.push(body);
  if (toolId === 'nagel') pinBodyAt(body, p);
}

// A nail dropped onto a dynamic object pins the object to that world point.
// One nail acts as a revolute joint (the object can still swing around it),
// a second nail on the same object fixes it completely.
function pinBodyAt(nail, p) {
  const dynamic = placedBodies.filter(b => !b.isStatic && b !== nail);
  const target = Query.point(dynamic, p)[0];
  if (!target) return;

  // Anchor in target-local coordinates so it rotates along with the body
  const dx = p.x - target.position.x;
  const dy = p.y - target.position.y;
  const cos = Math.cos(-target.angle), sin = Math.sin(-target.angle);
  const constraint = Constraint.create({
    pointA: { x: p.x, y: p.y },
    bodyB: target,
    pointB: { x: dx * cos - dy * sin, y: dx * sin + dy * cos },
    length: 0, stiffness: 0.9, damping: 0.05,
    render: { visible: false },
  });
  World.add(engine.world, constraint);

  // The pinned nail is just an anchor — it must not collide with the
  // board it holds (or the marble), otherwise everything jitters.
  nail.isSensor = true;
  nailPins.push({ nail, body: target, constraint });
}

// Remove a placed body plus any pin constraints referencing it.
function removePlaced(body) {
  nailPins = nailPins.filter(pin => {
    if (pin.nail !== body && pin.body !== body) return true;
    World.remove(engine.world, pin.constraint);
    return false;
  });
  World.remove(engine.world, body);
  placedBodies = placedBodies.filter(b => b !== body);
  if (lastTouchedBody === body) lastTouchedBody = null;
}

// Keep pin anchors in sync while their nail is being dragged around.
function syncPinsToNail(nail) {
  nailPins.forEach(pin => {
    if (pin.nail === nail) pin.constraint.pointA = { x: nail.position.x, y: nail.position.y };
  });
}

// ── Palette ───────────────────────────────────────────────────────
function buildPalette() {
  const container = document.getElementById('palette');
  TOOLS.forEach(tool => {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.dataset.id = tool.id;
    btn.style.setProperty('--tool-color', tool.color);
    btn.innerHTML =
      `<span class="tool-icon">${tool.icon}</span>` +
      `<span class="tool-label" style="color:${tool.color}">${tool.label}</span>`;
    btn.onclick = () => {
      selectedTool = selectedTool === tool.id ? null : tool.id;
      placementAngle = 0;
      refreshToolButtons();
    };
    container.appendChild(btn);
  });
}

function refreshToolButtons() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    const isActive = btn.dataset.id === selectedTool;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      const color = TOOLS.find(t => t.id === btn.dataset.id)?.color || 'var(--accent)';
      btn.style.borderColor = color;
      btn.style.boxShadow = `0 0 12px ${color}55`;
    } else {
      btn.style.borderColor = '';
      btn.style.boxShadow = '';
    }
  });
}

init();
