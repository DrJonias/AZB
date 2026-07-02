// Doodle Jump — canvas game with a global scoreboard (backend: zen-garden server).

const CW = 400, CH = 600;
const GRAVITY = 0.35;
const JUMP_V = -11.5;          // apex ≈ 190px — platform spacing stays well below
const SPRING_V = -19;
const MOVE_ACC = 0.9, MOVE_MAX = 6.5, FRICTION = 0.92;
const PLAT_W = 62, PLAT_H = 14;
const PLAYER_R = 18;           // collision half-width / feet offset

// Same-origin API; pages under /dev/ use the separate dev backend.
const basePath = location.pathname.startsWith('/dev/') ? '/dev' : '';
const apiBase = location.protocol.startsWith('http') ? location.origin + basePath : 'http://localhost:8787';
const GAME_ID = 'doodle-jump';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

let state = 'menu';            // menu | playing | over
let player, platforms, score, bestThisRun;
let keys = { left: false, right: false };
let touchDir = 0;              // -1 | 0 | 1
let tiltDir = 0;               // from deviceorientation, -1..1 (analog)
let scoreSubmitted = false;

// ── Platforms ─────────────────────────────────────────────────────
function platformAt(y, forceSafe = false) {
  const type = forceSafe ? 'static'
    : Math.random() < Math.min(0.28, score / 40000) ? 'moving'
    : 'static';
  return {
    x: Math.random() * (CW - PLAT_W),
    y,
    type,
    vx: type === 'moving' ? (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.2) : 0,
    spring: type === 'static' && Math.random() < 0.07,
  };
}

// Brittle platforms are spawned as EXTRAS between safe ones, so the course
// is always climbable no matter how unlucky the rolls are.
function maybeBrittle(yAbove, yBelow) {
  if (score < 3000 || Math.random() > Math.min(0.35, score / 60000)) return null;
  return {
    x: Math.random() * (CW - PLAT_W),
    y: (yAbove + yBelow) / 2,
    type: 'brittle',
    vx: 0, spring: false, broken: false,
  };
}

function spacing() {
  return 55 + Math.random() * (20 + Math.min(45, score / 1500));
}

function initGame() {
  score = 0; bestThisRun = 0; scoreSubmitted = false;
  player = { x: CW / 2, y: CH - 80, vx: 0, vy: JUMP_V, dir: 1 };
  platforms = [{ x: CW / 2 - PLAT_W / 2, y: CH - 40, type: 'static', vx: 0, spring: false }];
  let y = CH - 40;
  while (y > -40) {
    const prev = y;
    y -= spacing();
    platforms.push(platformAt(y, true));
    const extra = maybeBrittle(y, prev);
    if (extra) platforms.push(extra);
  }
}

// ── Update ────────────────────────────────────────────────────────
function update() {
  // horizontal input: keyboard > touch > tilt
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  if (!dir && touchDir) dir = touchDir;
  if (!dir && tiltDir) dir = tiltDir;

  player.vx = (player.vx + dir * MOVE_ACC) * FRICTION;
  player.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, player.vx));
  if (Math.abs(player.vx) > 0.3) player.dir = player.vx > 0 ? 1 : -1;

  const prevY = player.y;
  player.x += player.vx;
  player.vy += GRAVITY;
  player.y += player.vy;

  // wrap around screen edges
  if (player.x < -PLAYER_R) player.x = CW + PLAYER_R;
  if (player.x > CW + PLAYER_R) player.x = -PLAYER_R;

  // land on platforms (only while falling)
  if (player.vy > 0) {
    const prevFeet = prevY + PLAYER_R;
    const feet = player.y + PLAYER_R;
    for (const p of platforms) {
      if (p.broken) continue;
      if (prevFeet <= p.y && feet >= p.y &&
          player.x > p.x - PLAYER_R * 0.6 && player.x < p.x + PLAT_W + PLAYER_R * 0.6) {
        if (p.type === 'brittle') { p.broken = true; continue; }
        player.y = p.y - PLAYER_R;
        player.vy = p.spring ? SPRING_V : JUMP_V;
        break;
      }
    }
  }

  // moving platforms
  for (const p of platforms) {
    if (p.type !== 'moving') continue;
    p.x += p.vx;
    if (p.x < 0 || p.x + PLAT_W > CW) p.vx *= -1;
  }

  // camera: keep player in upper 40 %, scroll world down, score = height
  const limit = CH * 0.4;
  if (player.y < limit) {
    const shift = limit - player.y;
    player.y = limit;
    score += shift;
    bestThisRun = Math.max(bestThisRun, score);
    for (const p of platforms) p.y += shift;
    platforms = platforms.filter(p => p.y < CH + 40 && !(p.broken && p.y > CH));
    let top = Math.min(...platforms.filter(p => p.type !== 'brittle').map(p => p.y));
    while (top > -40) {
      const prev = top;
      top -= spacing();
      platforms.push(platformAt(top));
      const extra = maybeBrittle(top, prev);
      if (extra) platforms.push(extra);
    }
  }

  if (player.y > CH + 60) gameOver();
}

// ── Render ────────────────────────────────────────────────────────
function render() {
  ctx.fillStyle = '#0f0c24';
  ctx.fillRect(0, 0, CW, CH);

  // dot grid backdrop
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 20; x < CW; x += 40) {
    for (let y = ((-score) % 40 + 40) % 40; y < CH; y += 40) {
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  for (const p of platforms) {
    if (p.broken) continue;
    ctx.fillStyle = p.type === 'moving' ? '#4fc3f7' : p.type === 'brittle' ? '#b58963' : '#3dffa0';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, PLAT_W, PLAT_H, 7);
    ctx.fill();
    if (p.type === 'brittle') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + PLAT_W * 0.3, p.y + 2);
      ctx.lineTo(p.x + PLAT_W * 0.5, p.y + PLAT_H - 2);
      ctx.lineTo(p.x + PLAT_W * 0.65, p.y + 4);
      ctx.stroke();
    }
    if (p.spring) {
      ctx.fillStyle = '#ffd36b';
      ctx.fillRect(p.x + PLAT_W / 2 - 7, p.y - 7, 14, 7);
    }
  }

  // player
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(player.dir, 1);
  ctx.font = '32px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐸', 0, 0);
  ctx.restore();

  // score
  ctx.fillStyle = '#e6eef8';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(displayScore(score), 14, 28);
}

function displayScore(s) { return String(Math.floor(s / 10)); }

function loop() {
  if (state !== 'playing') return;
  update();
  render();
  requestAnimationFrame(loop);
}

// ── Game flow ─────────────────────────────────────────────────────
function startGame() {
  initGame();
  state = 'playing';
  $('startOverlay').classList.add('hidden');
  $('overOverlay').classList.add('hidden');
  requestAnimationFrame(loop);
}

function gameOver() {
  state = 'over';
  const finalScore = Math.floor(bestThisRun / 10);
  $('finalScore').textContent = finalScore;

  const best = Math.max(finalScore, Number(localStorage.getItem('doodle-best') || 0));
  localStorage.setItem('doodle-best', best);
  $('finalBest').textContent = `Dein Rekord: ${best}`;
  $('myBest').textContent = best;

  $('submitStatus').textContent = '';
  $('submitRow').classList.toggle('hidden', finalScore < 1);
  $('overOverlay').classList.remove('hidden');
}

// ── Scoreboard ────────────────────────────────────────────────────
function renderBoard(entries, highlightName) {
  const list = $('boardList');
  if (!entries.length) {
    list.innerHTML = '<li class="board-empty">Noch keine Einträge — sei die/der Erste!</li>';
    return;
  }
  list.innerHTML = entries.slice(0, 10).map(e =>
    `<li class="${e.name === highlightName ? 'me' : ''}"><span>${esc(e.name)}</span><span>${e.score.toLocaleString('de-DE')}</span></li>`
  ).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function fetchBoard() {
  try {
    const res = await fetch(`${apiBase}/api/scores/${GAME_ID}`);
    const data = await res.json();
    renderBoard(data.scores || [], localStorage.getItem('doodle-name'));
  } catch {
    $('boardList').innerHTML = '<li class="board-empty">Scoreboard nicht erreichbar.</li>';
  }
}

async function submitScore() {
  if (scoreSubmitted) return;
  const name = $('nameInput').value.trim();
  const finalScore = Math.floor(bestThisRun / 10);
  if (name.length < 2) { $('submitStatus').textContent = 'Mindestens 2 Zeichen, bitte.'; return; }
  localStorage.setItem('doodle-name', name);
  $('submitStatus').textContent = 'Eintragen…';
  try {
    const res = await fetch(`${apiBase}/api/scores/${GAME_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: name, score: finalScore }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    scoreSubmitted = true;
    $('submitStatus').textContent = data.rank ? `Platz ${data.rank} weltweit! 🎉` : 'Eingetragen!';
    $('submitRow').classList.add('hidden');
    renderBoard(data.scores || [], name);
  } catch (err) {
    $('submitStatus').textContent = 'Fehler: ' + err.message;
  }
}

// ── Input ─────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === ' ' && state !== 'playing' && document.activeElement !== $('nameInput')) startGame();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// touch: hold left/right half of the canvas
function touchXDir(e) {
  const t = e.touches[0];
  if (!t) return 0;
  const r = canvas.getBoundingClientRect();
  return (t.clientX - r.left) < r.width / 2 ? -1 : 1;
}
canvas.addEventListener('touchstart', e => { e.preventDefault(); touchDir = touchXDir(e); }, { passive: false });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); touchDir = touchXDir(e); }, { passive: false });
canvas.addEventListener('touchend',   e => { e.preventDefault(); if (!e.touches.length) touchDir = 0; }, { passive: false });

// tilt (where the browser allows it without an extra permission prompt)
window.addEventListener('deviceorientation', e => {
  if (e.gamma === null) return;
  tiltDir = Math.abs(e.gamma) < 4 ? 0 : Math.max(-1, Math.min(1, e.gamma / 20));
});

// ── Wire up ───────────────────────────────────────────────────────
$('startBtn').addEventListener('click', startGame);
$('retryBtn').addEventListener('click', startGame);
$('submitBtn').addEventListener('click', submitScore);
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') submitScore(); });

$('nameInput').value = localStorage.getItem('doodle-name') || localStorage.getItem('zen-name') || '';
$('myBest').textContent = localStorage.getItem('doodle-best') || '–';

// roundRect landed in all evergreen browsers in 2022/23 — tiny fallback for older ones
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
    return this;
  };
}

initGame();
render();
fetchBoard();
setInterval(() => { if (state !== 'playing') fetchBoard(); }, 30 * 1000);
