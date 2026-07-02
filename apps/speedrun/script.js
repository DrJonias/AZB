const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 800;
canvas.height = 450;

// ── Difficulty ────────────────────────────────────────────────
const DIFFICULTIES = {
  easy:   { cols: 3, rows: 3, halfW: 24 },
  medium: { cols: 5, rows: 5, halfW: 18 },
  hard:   { cols: 7, rows: 7, halfW: 13 },
  expert: { cols: 9, rows: 9, halfW: 10 },
};

let GCOLS, GROWS, GX, GY, HALF_W, N_PTS;
let currentDiff = 'medium';

function applyDifficulty(name) {
  currentDiff = name;
  const d = DIFFICULTIES[name];
  GCOLS  = d.cols;
  GROWS  = d.rows;
  HALF_W = d.halfW;
  GX = Array.from({length: GCOLS}, (_, i) => 140 + i * (520 / (GCOLS - 1)));
  GY = Array.from({length: GROWS}, (_, i) =>  60 + i * (330 / (GROWS - 1)));
  N_PTS  = (GCOLS * GROWS + 2) * 55;

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === name);
  });
}

// ── Hamiltonian path via Warnsdorff's heuristic ───────────────
function warnsdorffMoves(c, r, vis) {
  return [[1,0],[-1,0],[0,1],[0,-1]].reduce((n, [dc, dr]) => {
    const nc = c+dc, nr = r+dr;
    return n + (nc>=0 && nc<GCOLS && nr>=0 && nr<GROWS && !vis[nr][nc] ? 1 : 0);
  }, 0);
}

function tryPath(startRow) {
  const vis = Array.from({length: GROWS}, () => new Uint8Array(GCOLS));
  let c = 0, r = startRow;
  const path = [[c, r]];
  vis[r][c] = 1;

  while (path.length < GCOLS * GROWS) {
    const nbrs = [[1,0],[-1,0],[0,1],[0,-1]]
      .map(([dc, dr]) => [c+dc, r+dr])
      .filter(([nc, nr]) => nc>=0 && nc<GCOLS && nr>=0 && nr<GROWS && !vis[nr][nc]);

    if (nbrs.length === 0) return null;

    // Warnsdorff: prefer cells with fewer onward moves; tiny random tiebreak for variety
    nbrs.sort((a, b) =>
      (warnsdorffMoves(a[0], a[1], vis) + Math.random()*0.9) -
      (warnsdorffMoves(b[0], b[1], vis) + Math.random()*0.9)
    );

    [c, r] = nbrs[0];
    vis[r][c] = 1;
    path.push([c, r]);
  }

  return c === GCOLS - 1 ? path : null;
}

function generateGridPath() {
  let result = null;

  for (let attempt = 0; attempt < 300 && !result; attempt++) {
    result = tryPath(Math.floor(Math.random() * GROWS));
  }

  // guaranteed fallback
  if (!result) {
    result = [];
    for (let col = 0; col < GCOLS; col++) {
      if (col % 2 === 0) for (let row = 0; row < GROWS; row++) result.push([col, row]);
      else               for (let row = GROWS-1; row >= 0; row--) result.push([col, row]);
    }
  }

  return [
    [40,  GY[result[0][1]]],
    ...result.map(([c, r]) => [GX[c], GY[r]]),
    [760, GY[result[result.length - 1][1]]],
  ];
}

// ── Catmull-Rom spline ────────────────────────────────────────
function cr(p0, p1, p2, p3, t) {
  const [x0,y0]=p0,[x1,y1]=p1,[x2,y2]=p2,[x3,y3]=p3, t2=t*t, t3=t2*t;
  return [
    .5*((2*x1)+(-x0+x2)*t+(2*x0-5*x1+4*x2-x3)*t2+(-x0+3*x1-3*x2+x3)*t3),
    .5*((2*y1)+(-y0+y2)*t+(2*y0-5*y1+4*y2-y3)*t2+(-y0+3*y1-3*y2+y3)*t3),
  ];
}

function buildPath(ctrl, n) {
  const pts=[], segs=ctrl.length-1, sps=Math.floor(n/segs);
  for (let i=0;i<segs;i++) {
    const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(segs,i+2)];
    for (let j=0;j<sps;j++) pts.push(cr(p0,p1,p2,p3,j/sps));
  }
  pts.push(ctrl[ctrl.length-1]);
  return pts;
}

function buildNormals(pts) {
  return pts.map((_,i) => {
    const [ax,ay]=pts[Math.max(0,i-1)], [bx,by]=pts[Math.min(pts.length-1,i+1)];
    const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy)||1;
    return [-dy/len, dx/len];
  });
}

// ── Track ─────────────────────────────────────────────────────
let PATH, NORM, LEFT, RIGHT;

function buildTrack() {
  const ctrl = generateGridPath();
  PATH  = buildPath(ctrl, N_PTS);
  NORM  = buildNormals(PATH);
  LEFT  = PATH.map(([x,y],i) => [x+NORM[i][0]*HALF_W, y+NORM[i][1]*HALF_W]);
  RIGHT = PATH.map(([x,y],i) => [x-NORM[i][0]*HALF_W, y-NORM[i][1]*HALF_W]);
}

// ── Game state ────────────────────────────────────────────────
let state='idle', mx=-999, my=-999;
let t0=0, elapsed=0, best=null;
let progressIdx=0, flashTimer=0;

// ── Helpers ───────────────────────────────────────────────────
function nearest(px, py) {
  const sps = Math.floor(N_PTS / (GCOLS * GROWS + 2));
  const lookahead = sps * 6;
  let bestD=Infinity, bestI=0;
  const lo=Math.max(0, progressIdx - sps);
  const hi=Math.min(PATH.length-1, progressIdx + lookahead);
  for (let i=lo;i<=hi;i++) {
    const dx=PATH[i][0]-px, dy=PATH[i][1]-py, d=dx*dx+dy*dy;
    if (d<bestD){bestD=d;bestI=i;}
  }
  return {i:bestI, d:Math.sqrt(bestD)};
}

function inZone(px, py, idx) {
  const [zx,zy]=PATH[idx];
  return Math.hypot(px-zx, py-zy) < HALF_W;
}

function fmt(ms) { return (ms/1000).toFixed(3)+' s'; }

// ── DOM ──────────────────────────────────────────────────────
const timerEl      = document.getElementById('timer');
const bestEl       = document.getElementById('best-display');
const overlayStart = document.getElementById('overlay-start');
const overlayDead  = document.getElementById('overlay-dead');
const overlayWin   = document.getElementById('overlay-win');
const deadInfoEl   = document.getElementById('dead-info');
const winTimeEl    = document.getElementById('win-time-info');
const winRecEl     = document.getElementById('win-record-info');

document.getElementById('btn-start').addEventListener('click', () => {
  buildTrack();
  overlayStart.classList.add('hidden');
});

document.getElementById('btn-retry').addEventListener('click', reset);
document.getElementById('btn-again').addEventListener('click', reset);

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.diff === currentDiff) return;
    applyDifficulty(btn.dataset.diff);
    best = null;
    bestEl.textContent = '';
    buildTrack();
  });
});

function reset() {
  buildTrack();
  state='idle'; elapsed=0; progressIdx=0; flashTimer=0;
  timerEl.textContent='0.000 s';
  timerEl.style.color='white';
  overlayStart.classList.remove('hidden');
  overlayDead.classList.add('hidden');
  overlayWin.classList.add('hidden');
}

function die() {
  if (state!=='playing') return;
  state='dead'; flashTimer=1.0;
  const pct=Math.round(progressIdx/PATH.length*100);
  deadInfoEl.innerHTML=`Time: <strong>${fmt(elapsed)}</strong> &mdash; ${pct} % completed`;
  overlayDead.classList.remove('hidden');
  timerEl.style.color='#ff4d6d';
}

function win() {
  if (state!=='playing') return;
  state='win';
  const isNew=best===null||elapsed<best;
  if (isNew) best=elapsed;
  winTimeEl.innerHTML=`Time: <strong>${fmt(elapsed)}</strong>`;
  winRecEl.textContent=isNew ? '🏆 New Record!' : `Best: ${fmt(best)}`;
  bestEl.textContent=`Best: ${fmt(best)}`;
  overlayWin.classList.remove('hidden');
  timerEl.style.color='#00e5ff';
}

// ── Render ────────────────────────────────────────────────────
function polyPath(pts, from, to) {
  ctx.moveTo(pts[from][0], pts[from][1]);
  for (let i=from+1;i<=to;i++) ctx.lineTo(pts[i][0],pts[i][1]);
}

function drawBg() {
  ctx.fillStyle='#04071a';
  ctx.fillRect(0,0,800,450);
  ctx.fillStyle='rgba(61,90,254,0.065)';
  for (let x=20;x<800;x+=40)
    for (let y=20;y<450;y+=40){
      ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
    }
}

function drawTrack() {
  ctx.beginPath();
  polyPath(LEFT,0,LEFT.length-1);
  for (let i=RIGHT.length-1;i>=0;i--) ctx.lineTo(RIGHT[i][0],RIGHT[i][1]);
  ctx.closePath();
  ctx.fillStyle='rgba(8,14,46,0.97)';
  ctx.fill();

  ctx.lineWidth=1.5;
  ctx.strokeStyle='rgba(61,90,254,0.7)';
  [LEFT,RIGHT].forEach(side=>{
    ctx.beginPath(); polyPath(side,0,side.length-1); ctx.stroke();
  });
}

function drawTrail() {
  if (progressIdx<2) return;
  ctx.beginPath();
  polyPath(PATH,0,progressIdx);
  ctx.strokeStyle='rgba(0,229,255,0.2)';
  ctx.lineWidth=HALF_W*2-5;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.stroke();
}

function drawZones(ts) {
  const p=(Math.sin(ts*0.0042)+1)/2;
  const fontSize = Math.max(7, Math.min(10, HALF_W - 3));

  const [sx,sy]=PATH[0];
  const g1=ctx.createRadialGradient(sx,sy,0,sx,sy,HALF_W);
  g1.addColorStop(0,`rgba(0,230,118,${0.35+p*0.25})`);
  g1.addColorStop(1,'rgba(0,230,118,0)');
  ctx.beginPath(); ctx.arc(sx,sy,HALF_W,0,Math.PI*2);
  ctx.fillStyle=g1; ctx.fill();
  ctx.fillStyle=`rgba(0,230,118,${0.7+p*0.3})`;
  ctx.font=`bold ${fontSize}px Inter,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('START',sx,sy);

  const [fx,fy]=PATH[PATH.length-1];
  const g2=ctx.createRadialGradient(fx,fy,0,fx,fy,HALF_W);
  g2.addColorStop(0,`rgba(0,229,255,${0.35+p*0.25})`);
  g2.addColorStop(1,'rgba(0,229,255,0)');
  ctx.beginPath(); ctx.arc(fx,fy,HALF_W,0,Math.PI*2);
  ctx.fillStyle=g2; ctx.fill();
  ctx.fillStyle=`rgba(0,229,255,${0.7+p*0.3})`;
  ctx.fillText('FINISH',fx,fy);
}

function drawCursor() {
  if (mx<-100) return;
  ctx.shadowColor='rgba(255,255,255,0.8)';
  ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(mx,my,5,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill();
  ctx.shadowBlur=0;
}

function drawFlash() {
  ctx.fillStyle=`rgba(255,55,75,${flashTimer*0.45})`;
  ctx.fillRect(0,0,800,450);
  flashTimer=Math.max(0,flashTimer-0.055);
}

// ── Game loop ─────────────────────────────────────────────────
requestAnimationFrame(function loop(ts) {
  requestAnimationFrame(loop);

  if (state==='playing') {
    elapsed=ts-t0;
    timerEl.textContent=fmt(elapsed);
    const {i,d}=nearest(mx,my);
    if (i>progressIdx) progressIdx=i;
    if (d>HALF_W+2) die();
    else if (progressIdx>PATH.length*0.92 && inZone(mx,my,PATH.length-1)) win();
  }

  if (state==='idle' && inZone(mx,my,0)) {
    state='playing'; t0=ts; elapsed=0; progressIdx=0;
    overlayStart.classList.add('hidden');
  }

  drawBg();
  drawTrack();
  if (state==='playing'||state==='win') drawTrail();
  drawZones(ts);
  drawCursor();
  if (flashTimer>0) drawFlash();
});

// ── Mouse ─────────────────────────────────────────────────────
canvas.addEventListener('mousemove', e => {
  const r=canvas.getBoundingClientRect();
  mx=(e.clientX-r.left)*(800/r.width);
  my=(e.clientY-r.top)*(450/r.height);
});

canvas.addEventListener('mouseleave', () => {
  if (state==='playing') { deadInfoEl.innerHTML='Mouse left the track!'; die(); }
  mx=-999; my=-999;
});

// ── Touch ─────────────────────────────────────────────────────
function touchMove(e) {
  e.preventDefault();
  const t=e.touches[0];
  if (!t) return;
  const r=canvas.getBoundingClientRect();
  mx=(t.clientX-r.left)*(800/r.width);
  my=(t.clientY-r.top)*(450/r.height);
}
canvas.addEventListener('touchstart', touchMove, { passive:false });
canvas.addEventListener('touchmove',  touchMove, { passive:false });
// Lifting the finger keeps the last position so it doesn't count as leaving the track.
canvas.addEventListener('touchend', e => { e.preventDefault(); }, { passive:false });

// ── Init ──────────────────────────────────────────────────────
applyDifficulty('medium');
buildTrack();

// ── Scaling ───────────────────────────────────────────────────
function scaleCanvas() {
  const s=Math.min((window.innerWidth-32)/800,(window.innerHeight-80)/450,1.5);
  canvas.style.transform=`scale(${s})`;
}
window.addEventListener('resize',scaleCanvas);
scaleCanvas();
