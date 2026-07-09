/*
 * Site-Backend — zero-dependency Node.js server.
 *
 *   node server/server.js          → http://localhost:8787
 *   PORT=3000 node server/server.js
 *
 * Serves the whole static site (repo root) plus the JSON APIs:
 * Zen Garden (/api/state, /api/action), highscores (/api/scores/<game>)
 * and anonymous feedback (/api/feedback).
 * State is persisted as JSON files in DATA_DIR (default: this folder).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'garden-data.json');
const APP_DIR = path.resolve(__dirname, '..');

const PLOT_COUNT = 24;   // divisible by 6/4/3 → the grid always shows full rows
const COOLDOWN_MS = 60 * 1000;       // 1 action per player per minute
const IP_THROTTLE_MS = 1000;         // basic request throttle per IP
const LOG_MAX = 15;

// Anonymous site feedback — appended as JSON lines, one entry per line.
// Readable via File Station (DATA_DIR is bind-mounted) or, if FEEDBACK_TOKEN
// is set, via GET /api/feedback?token=...
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');
const FEEDBACK_TOKEN = process.env.FEEDBACK_TOKEN || '';
const FEEDBACK_COOLDOWN_MS = 60 * 1000;
const feedbackLast = new Map();      // ip → last submission ts (in-memory only)

// Dev cheat console — the /api/cheat endpoint only exists while CHEAT_TOKEN
// is set. Set it ONLY on the dev backend container, NEVER in production:
// without the env var the endpoint is a plain 404, so this code is inert
// even if it ships on master.
const CHEAT_TOKEN = process.env.CHEAT_TOKEN || '';

// Global highscores, one board per game (allowlist so nobody creates
// arbitrary boards). Keeps each player's best score only.
const SCORE_GAMES = ['doodle-jump'];
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const SCORE_COOLDOWN_MS = 10 * 1000;
const SCORE_MAX_ENTRIES = 100;
const scoreLast = new Map();         // ip → last submission ts
let scores = {};                     // game → [{ name, score, ts }] sorted desc

function loadScores() {
  try { scores = JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); } catch { scores = {}; }
}

function saveScores() {
  fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2), err => {
    if (err) console.error('scores save failed:', err.message);
  });
}

function submitScore(game, name, score) {
  const board = scores[game] || (scores[game] = []);
  const existing = board.find(e => e.name === name);
  if (existing) {
    if (score <= existing.score) return board;
    existing.score = score;
    existing.ts = Date.now();
  } else {
    board.push({ name, score, ts: Date.now() });
  }
  board.sort((a, b) => b.score - a.score);
  scores[game] = board.slice(0, SCORE_MAX_ENTRIES);
  saveScores();
  return scores[game];
}

// Growth = number of community waterings until fully grown.
// Unlock = lifetime community clicks needed before the species can be planted.
// Deliberately steep — the garden is meant to grow over months, not days.
// The final species is a mystery: nobody knows what it is until someone
// harvests it — then it reveals itself as a malicious weed that strangles
// the whole garden and forces a fresh start (prestige +1, see applyAction).
const SPECIES = [
  { id: 'moos',    name: 'Moss',           emoji: '🍀', stages: ['🟤', '🌱', '🍀'],       growth: 30,    unlock: 0 },
  { id: 'gras',    name: 'Pampas Grass',   emoji: '🌾', stages: ['🟤', '🌱', '🌾'],       growth: 80,    unlock: 0 },
  { id: 'bambus',  name: 'Bamboo',         emoji: '🎍', stages: ['🟤', '🌱', '🎋', '🎍'], growth: 250,   unlock: 300 },
  { id: 'blume',   name: 'Chrysanthemum',  emoji: '🌼', stages: ['🟤', '🌱', '🌿', '🌼'], growth: 600,   unlock: 1500 },
  { id: 'ahorn',   name: 'Japanese Maple', emoji: '🍁', stages: ['🟤', '🌱', '🌿', '🍁'], growth: 1500,  unlock: 6000 },
  { id: 'bonsai',  name: 'Bonsai',         emoji: '🌳', stages: ['🟤', '🌱', '🪴', '🌳'], growth: 4000,  unlock: 25000 },
  { id: 'lotus',   name: 'Lotus',          emoji: '🪷', stages: ['🟤', '🌱', '🌿', '🪷'], growth: 10000, unlock: 90000 },
  { id: 'mystery', name: '???',            emoji: '❓', stages: ['🟤', '🌱', '🌿', '❓'], growth: 25000, unlock: 300000,
    hint: 'Nobody knows what grows here. Surely something wonderful…' },
];

// Every species has its own global boost: harvesting a fully grown plant
// raises that boost's level FOR EVERYONE — permanently. Different types
// combine freely. Fresh Moss and Autumn Wind scale with their level (up to
// maxLevel); for the other boosts the level is a community prestige counter.
const MIN_COOLDOWN_MS = 10 * 1000;   // Fresh Moss floor — it never gets faster than this
const BOOSTS = {
  moos:   { name: 'Fresh Moss',    emoji: '🍀', type: 'cooldownStep', value: 1000, maxLevel: 50, desc: '−1 s cooldown per level (10 s at level 50)' },
  gras:   { name: 'Pampas Power',  emoji: '🌾', type: 'multiplier',   value: 2,    desc: 'Watering counts double (+2 growth)' },
  bambus: { name: 'Sprinkler',     emoji: '🎍', type: 'splash',       value: 1,    desc: 'Watering also hits one random plant' },
  blume:  { name: 'Lucky Bloom',   emoji: '🌼', type: 'lucky',        value: 0.25, desc: '25 % chance: click without cooldown' },
  ahorn:  { name: 'Autumn Wind',   emoji: '🍁', type: 'reseed',       value: 0.02, maxLevel: 25, desc: '+2 % chance per level that a harvested plant re-seeds itself (50 % at level 25)' },
  bonsai: { name: 'Enlightenment', emoji: '🌳', type: 'unlock',       value: 2,    desc: 'Clicks count double towards unlocks' },
  lotus:  { name: 'Monsoon',       emoji: '🪷', type: 'rain',         value: 1,    desc: 'All plants grow +1 per minute' },
  // 'mystery' has no boost on purpose — harvesting it triggers the prestige reset.
};

// Effective level: stored level clamped to the boost's cap (if any).
function boostLevel(id) {
  const lvl = (garden.boosts || {})[id] || 0;
  const max = BOOSTS[id] && BOOSTS[id].maxLevel;
  return max ? Math.min(lvl, max) : lvl;
}

// ── State ─────────────────────────────────────────────────────────
let garden = {
  plots: Array(PLOT_COUNT).fill(null),   // { species, growth, plantedBy, plantedAt }
  totalClicks: 0,                        // lifetime community actions → unlocks
  harvestedTotal: 0,
  players: {},                           // name → { clicks, harvests, lastAction }
  log: [],                               // newest first
  boosts: {},                            // speciesId → boost level (permanent, global!)
  prestige: 0,                           // how often the mystery weed has reset the garden
};
let dirty = false;
const ipLast = new Map();

function loadGarden() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    garden = { ...garden, ...saved };
    while (garden.plots.length < PLOT_COUNT) garden.plots.push(null);
    // Migrate pre-permanent boosts, which stored expiry timestamps instead of
    // levels: a still-active boost becomes level 1, expired ones are dropped.
    // (Also drops the removed Hanami/sakura boost.)
    for (const [id, v] of Object.entries(garden.boosts || {})) {
      if (!BOOSTS[id]) delete garden.boosts[id];
      else if (v > 1e12) {
        if (v > Date.now()) garden.boosts[id] = 1;
        else delete garden.boosts[id];
      }
    }
    // The former Cherry Blossom is now the mystery plant.
    for (const plot of garden.plots) {
      if (plot && plot.species === 'sakura') plot.species = 'mystery';
    }
  } catch {
    /* first start — empty garden */
  }
}

function saveGarden() {
  if (!dirty) return;
  dirty = false;
  fs.writeFile(DATA_FILE, JSON.stringify(garden, null, 2), err => {
    if (err) console.error('save failed:', err.message);
  });
}
setInterval(saveGarden, 10 * 1000);

// Monsun boost: every plant grows by itself once a minute while active.
setInterval(() => {
  if (!boostEffects().rain) return;
  let changed = false;
  for (const plot of garden.plots) {
    if (plot && plot.growth < speciesById(plot.species).growth) {
      growPlot(plot, 1, null);
      changed = true;
    }
  }
  if (changed) dirty = true;
}, 60 * 1000);
// SIGTERM is what Docker sends on stop/restart; SIGINT covers Ctrl+C.
function shutdown() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(garden, null, 2)); } catch {} process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Game logic ────────────────────────────────────────────────────
function speciesById(id) { return SPECIES.find(s => s.id === id); }

function addLog(entry) {
  garden.log.unshift({ ts: Date.now(), ...entry });
  garden.log = garden.log.slice(0, LOG_MAX);
}

// Combined effect of all boosts (permanent, level-based per species).
function boostEffects() {
  const eff = { cooldown: COOLDOWN_MS, mult: 1, splash: false, lucky: 0, rain: false, unlockX: 1, reseed: 0 };
  for (const id of Object.keys(garden.boosts || {})) {
    const b = BOOSTS[id];
    const level = boostLevel(id);
    if (!b || level < 1) continue;
    if (b.type === 'cooldownStep')    eff.cooldown = Math.min(eff.cooldown, Math.max(MIN_COOLDOWN_MS, COOLDOWN_MS - level * b.value));
    else if (b.type === 'multiplier') eff.mult = Math.max(eff.mult, b.value);
    else if (b.type === 'splash')     eff.splash = true;
    else if (b.type === 'lucky')      eff.lucky = Math.max(eff.lucky, b.value);
    else if (b.type === 'reseed')     eff.reseed = level * b.value;
    else if (b.type === 'rain')       eff.rain = true;
    else if (b.type === 'unlock')     eff.unlockX = Math.max(eff.unlockX, b.value);
  }
  return eff;
}

// Grow a plot by `amount`, clamped at full growth; logs the bloom once.
function growPlot(plot, amount, byPlayer) {
  const sp = speciesById(plot.species);
  const before = plot.growth;
  plot.growth = Math.min(sp.growth, plot.growth + amount);
  if (before < sp.growth && plot.growth >= sp.growth) {
    addLog({ player: byPlayer || '🌧️', text: `${sp.name} ${sp.emoji} is in full bloom! ✨` });
  }
}

// Sprinkler boost: watering also hits one random other unfinished plant.
function waterRandomOther(exceptIdx, byPlayer) {
  const candidates = garden.plots
    .map((plot, i) => ({ plot, i }))
    .filter(({ plot, i }) => plot && i !== exceptIdx && plot.growth < speciesById(plot.species).growth);
  if (!candidates.length) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  growPlot(pick.plot, 1, byPlayer);
}

function applyAction(player, action, plotIdx, speciesId) {
  const now = Date.now();
  const eff = boostEffects();
  const p = garden.players[player] || (garden.players[player] = { clicks: 0, harvests: 0, lastAction: 0 });
  let prestigeReset = false;

  const wait = p.lastAction + eff.cooldown - now;
  if (wait > 0) return { error: 'cooldown', wait };

  if (!Number.isInteger(plotIdx) || plotIdx < 0 || plotIdx >= garden.plots.length) {
    return { error: 'Invalid plot.' };
  }
  const plot = garden.plots[plotIdx];

  if (action === 'plant') {
    if (plot) return { error: 'That plot is already planted.' };
    const sp = speciesById(speciesId);
    if (!sp) return { error: 'Unknown species.' };
    if (garden.totalClicks < sp.unlock) return { error: 'This species is not unlocked yet.' };
    garden.plots[plotIdx] = { species: sp.id, growth: 0, plantedBy: player, plantedAt: now };
    addLog({ player, text: `planted ${sp.name} ${sp.emoji}` });
  } else if (action === 'water') {
    if (!plot) return { error: 'Nothing grows here.' };
    const sp = speciesById(plot.species);
    if (plot.growth >= sp.growth) return { error: 'Fully grown — ready to harvest!' };
    growPlot(plot, eff.mult, player);
    if (eff.splash) waterRandomOther(plotIdx, player);
  } else if (action === 'harvest') {
    if (!plot) return { error: 'Nothing grows here.' };
    const sp = speciesById(plot.species);
    if (plot.growth < sp.growth) return { error: 'Not fully grown yet.' };
    garden.plots[plotIdx] = null;
    garden.harvestedTotal += 1;
    p.harvests += 1;
    if (sp.id === 'mystery') {
      // The moment of truth — the actual reset happens below, after the
      // common bookkeeping, so nothing overwrites the fresh start.
      prestigeReset = true;
      addLog({ player, text: `harvested the mysterious ${sp.emoji} plant…` });
    } else {
      // Raise this species' permanent global boost by one level
      const boost = BOOSTS[sp.id];
      garden.boosts[sp.id] = (garden.boosts[sp.id] || 0) + 1;
      addLog({ player, text: `harvested ${sp.name} ${sp.emoji} — "${boost.name}" ${boost.emoji} is now level ${boostLevel(sp.id)}!` });
      // Autumn Wind: chance that the harvested plant re-seeds itself right away
      if (eff.reseed > 0 && Math.random() < eff.reseed) {
        garden.plots[plotIdx] = { species: sp.id, growth: 0, plantedBy: '🍁 wind', plantedAt: now };
        addLog({ player: '🍁', text: `the autumn wind re-seeded ${sp.name} ${sp.emoji}!` });
      }
    }
  } else {
    return { error: 'Unknown action.' };
  }

  p.clicks += 1;
  // Lucky Bloom: with some luck the action does not trigger a cooldown
  const lucky = eff.lucky > 0 && Math.random() < eff.lucky;
  if (!lucky) p.lastAction = now;
  garden.totalClicks += eff.unlockX;

  // The mystery plant reveals itself as a malicious weed: its roots strangle
  // the whole garden. Plots, unlocks and boost levels start from scratch —
  // only the players' personal stats and the prestige counter survive.
  if (prestigeReset) {
    garden.prestige = (garden.prestige || 0) + 1;
    garden.plots = Array(PLOT_COUNT).fill(null);
    garden.totalClicks = 0;
    garden.boosts = {};
    addLog({ player: '🥀', text: `the ??? was a malicious weed! It strangled the whole garden — everything begins anew. Prestige ${garden.prestige} 🌱` });
  }

  dirty = true;
  return { ok: true, lucky };
}

function stateFor(player) {
  const now = Date.now();
  const eff = boostEffects();
  const me = player && garden.players[player];
  const top = Object.entries(garden.players)
    .map(([name, v]) => ({ name, clicks: v.clicks, harvests: v.harvests }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  const activeBoosts = Object.keys(garden.boosts || {})
    .filter(id => BOOSTS[id] && boostLevel(id) > 0)
    .map(id => ({ species: id, ...BOOSTS[id], level: boostLevel(id), maxLevel: BOOSTS[id].maxLevel || null }))
    .sort((a, b) => SPECIES.findIndex(s => s.id === a.species) - SPECIES.findIndex(s => s.id === b.species));
  return {
    species: SPECIES.map(s => ({ ...s, boost: BOOSTS[s.id] })),
    plots: garden.plots,
    plotCount: garden.plots.length,
    totalClicks: garden.totalClicks,
    harvestedTotal: garden.harvestedTotal,
    top,
    log: garden.log,
    boosts: activeBoosts,
    prestige: garden.prestige || 0,
    serverTime: now,
    cooldownMs: eff.cooldown,
    waitMs: me ? Math.max(0, me.lastAction + eff.cooldown - now) : 0,
  };
}

function cleanName(raw) {
  const name = String(raw || '').trim().slice(0, 20);
  return /^[\w\däöüÄÖÜß .-]{2,20}$/.test(name) ? name : null;
}

// ── Cheat commands (dev only, see CHEAT_TOKEN above) ──────────────
function applyCheat(b) {
  const now = Date.now();
  const idxOk = Number.isInteger(b.plot) && b.plot >= 0 && b.plot < garden.plots.length;
  const plot = idxOk ? garden.plots[b.plot] : null;

  switch (b.cmd) {
    case 'grow': {
      if (!plot) return { error: 'Plot empty or invalid.' };
      const sp = speciesById(plot.species);
      plot.growth = Math.max(0, Math.min(sp.growth, Math.round(Number(b.value) || 0)));
      return { ok: `Plot ${b.plot}: ${sp.name} at ${plot.growth}/${sp.growth}` };
    }
    case 'fill': {
      if (!plot) return { error: 'Plot empty or invalid.' };
      const sp = speciesById(plot.species);
      plot.growth = sp.growth;
      return { ok: `Plot ${b.plot}: ${sp.name} fully grown — ready to harvest` };
    }
    case 'clear': {
      if (!idxOk) return { error: 'Invalid plot.' };
      garden.plots[b.plot] = null;
      return { ok: `Plot ${b.plot} cleared` };
    }
    case 'plant': {
      if (!idxOk) return { error: 'Invalid plot.' };
      const sp = speciesById(b.species);
      if (!sp) return { error: `Unknown species "${b.species}". Ids: ${SPECIES.map(s => s.id).join(', ')}` };
      garden.plots[b.plot] = { species: sp.id, growth: 0, plantedBy: 'cheat', plantedAt: now };
      return { ok: `Plot ${b.plot}: ${sp.name} planted (unlock ignored)` };
    }
    case 'clicks': {
      garden.totalClicks = Math.max(0, Math.round(Number(b.value) || 0));
      return { ok: `totalClicks = ${garden.totalClicks}` };
    }
    case 'boost': {
      if (!BOOSTS[b.species]) return { error: `Unknown species "${b.species}".` };
      const level = Math.round(Number(b.value) || 0);
      if (level <= 0) { delete garden.boosts[b.species]; return { ok: `Boost ${b.species} removed` }; }
      garden.boosts[b.species] = level;
      return { ok: `Boost "${BOOSTS[b.species].name}" set to level ${boostLevel(b.species)}` };
    }
    case 'cooldown': {
      const p = garden.players[b.player];
      if (!p) return { error: `Unknown player "${b.player}".` };
      p.lastAction = 0;
      return { ok: `Cooldown of ${b.player} reset` };
    }
    case 'score': {
      const game = SCORE_GAMES.includes(b.game) ? b.game : SCORE_GAMES[0];
      const name = String(b.player || '').trim().slice(0, 20);
      if (name.length < 2) return { error: 'Name too short.' };
      const value = Math.round(Number(b.value) || 0);
      const board = scores[game] || (scores[game] = []);
      const existing = board.find(e => e.name === name);
      if (existing) { existing.score = value; existing.ts = now; }
      else board.push({ name, score: value, ts: now });
      board.sort((a, z) => z.score - a.score);
      scores[game] = board.slice(0, SCORE_MAX_ENTRIES);
      saveScores();
      return { ok: `${game}: ${name} = ${value}` };
    }
    case 'unscore': {
      const game = SCORE_GAMES.includes(b.game) ? b.game : SCORE_GAMES[0];
      const before = (scores[game] || []).length;
      scores[game] = (scores[game] || []).filter(e => e.name !== String(b.player || ''));
      saveScores();
      return { ok: before === (scores[game] || []).length ? 'Nothing removed.' : `Removed ${b.player} from ${game}` };
    }
    default:
      return { error: 'Unknown command.' };
  }
}

// When the checkout was last updated: mtime of the current branch ref,
// which git rewrites whenever a pull actually moves the branch. Falls back
// to packed-refs (git may pack refs) and finally to the server start time.
const SERVER_START = Date.now();
function checkoutUpdatedAt() {
  const gitDir = path.join(APP_DIR, '.git');
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const candidates = [];
    if (head.startsWith('ref: ')) candidates.push(path.join(gitDir, head.slice(5)));
    candidates.push(path.join(gitDir, 'packed-refs'));
    for (const f of candidates) {
      if (fs.existsSync(f)) return Math.round(fs.statSync(f).mtimeMs);
    }
  } catch { /* not a git checkout */ }
  return SERVER_START;
}

// ── HTTP server ───────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, {
    'Content-Type': `${type}; charset=utf-8`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Light per-IP throttle against request spam
  const ip = req.socket.remoteAddress || '?';
  if (url.pathname.startsWith('/api/')) {
    const last = ipLast.get(ip) || 0;
    if (req.method === 'POST' && Date.now() - last < IP_THROTTLE_MS) {
      return send(res, 429, { error: 'Slow down — the garden is not going anywhere.' });
    }
    if (req.method === 'POST') ipLast.set(ip, Date.now());
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return send(res, 200, stateFor(cleanName(url.searchParams.get('player'))));
  }

  // Site version = when this checkout last received an update (epoch ms).
  // The footers fetch this and render it as DDMMYYYYHHMM in local time.
  if (url.pathname === '/api/version' && req.method === 'GET') {
    return send(res, 200, { ts: checkoutUpdatedAt() });
  }

  // Highscores: GET /api/scores/<game> · POST /api/scores/<game> {name, score}
  const scoreMatch = url.pathname.match(/^\/api\/scores\/([a-z0-9-]+)$/);
  if (scoreMatch) {
    const game = scoreMatch[1];
    if (!SCORE_GAMES.includes(game)) return send(res, 404, { error: 'Unknown game.' });

    if (req.method === 'GET') {
      return send(res, 200, { scores: (scores[game] || []).slice(0, 50) });
    }
    if (req.method === 'POST') {
      const last = scoreLast.get(ip) || 0;
      if (Date.now() - last < SCORE_COOLDOWN_MS) {
        return send(res, 429, { error: 'Please wait a moment before the next submission.' });
      }
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 2048) req.destroy(); });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Broken JSON.' }); }
        const name = cleanName(body.player);
        if (!name) return send(res, 400, { error: 'Please provide a name (2–20 characters).' });
        const score = Number(body.score);
        if (!Number.isInteger(score) || score < 1 || score > 1000000) {
          return send(res, 400, { error: 'Invalid score.' });
        }
        scoreLast.set(ip, Date.now());
        const board = submitScore(game, name, score);
        const rank = board.findIndex(e => e.name === name) + 1;
        return send(res, 200, { scores: board.slice(0, 50), rank: rank || null });
      });
      return;
    }
    return send(res, 405, { error: 'Method not allowed.' });
  }

  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    const last = feedbackLast.get(ip) || 0;
    if (Date.now() - last < FEEDBACK_COOLDOWN_MS) {
      return send(res, 429, { error: 'Please wait a minute before the next feedback.' });
    }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Broken JSON.' }); }
      const text = String(body.text || '').trim().slice(0, 2000);
      if (text.length < 3) return send(res, 400, { error: 'Please write a few more characters.' });
      // Deliberately anonymous: timestamp, page and text only — no IP, no user agent.
      const entry = { ts: new Date().toISOString(), page: String(body.page || '').slice(0, 200), text };
      feedbackLast.set(ip, Date.now());
      fs.appendFile(FEEDBACK_FILE, JSON.stringify(entry) + '\n', err => {
        if (err) return send(res, 500, { error: 'Failed to save.' });
        send(res, 200, { ok: true });
      });
    });
    return;
  }

  // View feedback — only when FEEDBACK_TOKEN is set as an env variable.
  if (url.pathname === '/api/feedback' && req.method === 'GET') {
    if (!FEEDBACK_TOKEN || url.searchParams.get('token') !== FEEDBACK_TOKEN) {
      return send(res, 404, { error: 'Not found.' });
    }
    let entries = [];
    try {
      entries = fs.readFileSync(FEEDBACK_FILE, 'utf8')
        .split('\n').filter(Boolean).map(l => JSON.parse(l)).reverse();
    } catch { /* no feedback yet */ }
    return send(res, 200, entries);
  }

  // Dev cheat console — 404 unless CHEAT_TOKEN is configured (never in prod)
  if (url.pathname === '/api/cheat' && req.method === 'POST') {
    if (!CHEAT_TOKEN) return send(res, 404, { error: 'Not found.' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Broken JSON.' }); }
      if (body.token !== CHEAT_TOKEN) return send(res, 403, { error: 'Wrong token.' });
      const result = applyCheat(body);
      if (result.error) return send(res, 400, result);
      dirty = true;
      return send(res, 200, result);
    });
    return;
  }

  if (url.pathname === '/api/action' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2048) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Broken JSON.' }); }
      const player = cleanName(body.player);
      if (!player) return send(res, 400, { error: 'Please provide a name (2–20 characters).' });
      const result = applyAction(player, body.action, body.plot, body.species);
      if (result.error === 'cooldown') {
        return send(res, 429, { error: `Wait ${Math.ceil(result.wait / 1000)}s until your next click.`, waitMs: result.wait, ...stateFor(player) });
      }
      if (result.error) return send(res, 400, { error: result.error, ...stateFor(player) });
      return send(res, 200, { lucky: !!result.lucky, ...stateFor(player) });
    });
    return;
  }

  // Static frontend (never the server/ folder itself, never dotfiles like .git)
  if (req.method === 'GET' && !url.pathname.split('/').some(seg => seg.startsWith('.'))) {
    const rel = (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname).slice(1);
    const file = path.resolve(APP_DIR, rel);
    const inApp = file.startsWith(APP_DIR + path.sep) && !file.startsWith(__dirname + path.sep);
    if (inApp && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    }
  }

  send(res, 404, { error: 'Not found.' });
});

loadGarden();
loadScores();
server.listen(PORT, () => console.log(`🪴 Site backend running at http://localhost:${PORT}`));
