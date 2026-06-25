const CELL = 10;
const WIN_TOP_K = 10;
const WIN_CONF = 0.08;

let classifier = null;
let p5sketch = null;
let currentWord = null;
let penSize = 1;
let timerInterval = null;
let startTime = null;
let hasDrawn = false;
let round = 1;
let won = false;
let inferInterval = null;


const PLAYABLE = [
  "airplane","alarm clock","apple","axe","banana","basketball","bat","bathtub","bear","bee", "bicycle",
  "bird","birthday cake","book","bridge","broccoli","broom","bus","butterfly","cactus","cake","camel","camera",
  "campfire","candle","car","carrot","castle","cat","clock","cloud","coffee cup","compass","computer","cookie",
  "couch","cow","crab","crown","cup","diamond","dog","dolphin","door","dragon","drums","duck","ear","elephant",
  "eye","eyeglasses","face","feather","fence","fish","flamingo","flashlight","flower","fork","frog","frying pan",
  "giraffe","grapes","guitar","hamburger","hammer","hand","hat","headphones","hedgehog","helicopter","horse",
  "hot air balloon","hot dog","hourglass","house","ice cream","jacket","kangaroo","key","keyboard","knife","ladder",
  "leaf","light bulb","lighthouse","lightning","lion","lobster","lollipop","mailbox","moon","mountain","mouse",
  "mug","mushroom","octopus","owl","palm tree","panda","pencil","penguin","piano","pig","pineapple","pizza",
  "rabbit","radio","rain","rainbow","rhinoceros","sailboat","saxophone","scissors","shark","sheep","shoe","skull",
  "snail","snake","snowflake","snowman","soccer ball","spider","squirrel","stairs","star","strawberry","submarine",
  "suitcase","sun","swan","sword","table","teapot","teddy-bear","telephone","television","tent","tiger","toilet",
  "tooth","toothbrush","tornado","tractor","traffic light","train","tree","triangle","truck","trumpet","umbrella","vase",
  "violin","whale","windmill","wine glass","zebra"
];

function normalizeLabel(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

function displayLabel(en) {
  return String(en).trim();
}

function initSketch() {
  new p5(p => {
    p5sketch = p;
    let isDrawing = false;

    p.setup = () => {
      p.pixelDensity(1);
      p.createCanvas(280, 280).parent('canvas-container');
      p.background(255);
      p.noStroke();
    };

    p.draw = () => {};

    function paintCell(x, y) {
      const gx = Math.floor(x / CELL) * CELL;
      const gy = Math.floor(y / CELL) * CELL;
      p.fill(0);
      p.rect(gx, gy, penSize * CELL, penSize * CELL);
    }

    function paintLine(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (CELL / 2)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        paintCell(x1 + dx * t, y1 + dy * t);
      }
    }

    function beginStroke() {
      isDrawing = true;
      document.getElementById('canvas-container').classList.add('drawing');
      if (!hasDrawn && !won) { hasDrawn = true; startTimer(); }
    }

    function endStroke() {
      isDrawing = false;
      document.getElementById('canvas-container').classList.remove('drawing');
    }

    function inBounds() {
      return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }

    p.mousePressed = () => { if (!inBounds()) return; beginStroke(); paintCell(p.mouseX, p.mouseY); };
    p.mouseDragged = () => { if (!isDrawing || won) return; paintLine(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY); };
    p.mouseReleased = () => endStroke();

    p.touchStarted = () => {
      if (!inBounds()) return false;
      beginStroke(); paintCell(p.mouseX, p.mouseY);
      return false;
    };
    p.touchMoved = () => {
      if (!isDrawing || won) return false;
      const t = p.touches[0];
      const r = p.canvas.getBoundingClientRect();
      const x = (t.clientX - r.left) * (p.width / r.width);
      const y = (t.clientY - r.top) * (p.height / r.height);
      paintLine(p.pmouseX, p.pmouseY, x, y);
      return false;
    };
    p.touchEnded = () => { endStroke(); return false; };
  });
}

function getClassifyCanvas() {
  const tmp = document.createElement('canvas');
  tmp.width = 28;
  tmp.height = 28;
  const ctx = tmp.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(p5sketch.canvas, 0, 0, 28, 28);
  return tmp;
}

async function initClassifier() {
  try {
    classifier = await ml5.imageClassifier('DoodleNet');
    document.getElementById('statusDot').className = 'status-dot ready';
    document.getElementById('statusText').textContent = 'AI ready!';
    document.getElementById('startBtn').disabled = false;
  } catch (err) {
    document.getElementById('statusText').textContent = 'Load error — refresh the page';
    console.error('DoodleNet load error:', err);
  }
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const s = (Date.now() - startTime) / 1000;
    const el = document.getElementById('timer');
    el.textContent = s.toFixed(1) + 's';
    el.className = 'timer ' + (s < 10 ? 'fast' : s < 20 ? '' : 'slow');
  }, 100);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function runClassify() {
  if (!classifier || !hasDrawn || won || !p5sketch) return;
  const target = normalizeLabel(currentWord.label);
  classifier.classify(getClassifyCanvas()).then(results => {
    if (!results || won) return;
    updatePredUI(results.slice(0, 5));
    const match = results.slice(0, WIN_TOP_K).find(r => normalizeLabel(r.label) === target);
    if (match && match.confidence > WIN_CONF) triggerWin();
  }).catch(() => {});
}

function updatePredUI(results) {
  const target = normalizeLabel(currentWord.label);
  const list = document.getElementById('predList');
  list.innerHTML = '';
  results.forEach(r => {
    const labelNormalized = normalizeLabel(r.label);
    const label = displayLabel(labelNormalized);
    const pct = Math.round(r.confidence * 100);
    const isMatch = labelNormalized === target;
    const item = document.createElement('div');
    item.className = 'pred-item';
    item.innerHTML = `
      <div class="pred-top">
        <span class="pred-name ${isMatch ? 'match' : ''}">${label}</span>
        <span class="pred-pct">${pct}%</span>
      </div>
      <div class="pred-bar-wrap">
        <div class="pred-bar ${isMatch ? 'match' : ''}" style="width:${Math.min(pct, 100)}%"></div>
      </div>`;
    list.appendChild(item);
  });

  if (results[0]) {
    document.getElementById('topGuess').textContent = displayLabel(results[0].label);
  }
}

function startGame() {
  document.getElementById('startScreen').classList.add('hidden');
  nextRound();
}

function nextRound() {
  won = false;
  hasDrawn = false;
  stopTimer();
  clearInterval(inferInterval);
  document.getElementById('winOverlay').classList.add('hidden');
  document.getElementById('canvas-container').classList.remove('win');

  const label = PLAYABLE[Math.floor(Math.random() * PLAYABLE.length)];
  currentWord = { label: displayLabel(label) };

  document.getElementById('wordLabel').textContent = currentWord.label;
  document.getElementById('roundNum').textContent = round++;
  document.getElementById('timer').textContent = '0.0s';
  document.getElementById('timer').className = 'timer';
  document.getElementById('topGuess').textContent = '–';
  document.getElementById('predList').innerHTML = '<div class="pred-empty">Start drawing…</div>';

  if (p5sketch) p5sketch.background(255);
  inferInterval = setInterval(runClassify, 500);
}

function clearDrawing() {
  if (p5sketch) p5sketch.background(255);
  hasDrawn = false;
  stopTimer();
  document.getElementById('timer').textContent = '0.0s';
  document.getElementById('timer').className = 'timer';
  document.getElementById('predList').innerHTML = '<div class="pred-empty">Start drawing…</div>';
  document.getElementById('topGuess').textContent = '–';
}

function skipWord() {
  nextRound();
}

function setPen(el) {
  penSize = parseInt(el.dataset.size, 10);
  document.querySelectorAll('.pen-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function triggerWin() {
  if (won) return;
  won = true;
  stopTimer();
  clearInterval(inferInterval);
  document.getElementById('canvas-container').classList.add('win');
  const elapsed = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '?';
  document.getElementById('winSub').textContent = `The AI guessed "${currentWord.label}"!`;
  document.getElementById('winTime').textContent = elapsed;
  document.getElementById('winOverlay').classList.remove('hidden');
  launchConfetti();
}

function launchConfetti() {
  const cc = document.getElementById('confettiCanvas');
  cc.width = window.innerWidth;
  cc.height = window.innerHeight;
  const ctx = cc.getContext('2d');
  const COLORS = ['#7c6aff', '#ff6ab0', '#3dffa0', '#ffb347', '#4fc3f7'];

  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * cc.width,
    y: -10 - Math.random() * 300,
    r: 4 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 5,
    vy: 2 + Math.random() * 5,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 7,
  }));

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, cc.width, cc.height);
    pieces.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
      ctx.restore();
    });
    frame += 1;
    if (frame < 150) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, cc.width, cc.height);
  }
  animate();
}

(function waitForMl5() {
  if (typeof ml5 !== 'undefined') {
    initSketch();
    initClassifier();
  } else {
    setTimeout(waitForMl5, 100);
  }
})();
