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
const IP_THROTTLE_MS = 1500;         // basic request throttle per IP
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
const SPECIES = [
  { id: 'moos',   name: 'Moos',         emoji: '🍀', stages: ['🟤', '🌱', '🍀'],       growth: 30,    unlock: 0 },
  { id: 'gras',   name: 'Pampasgras',   emoji: '🌾', stages: ['🟤', '🌱', '🌾'],       growth: 80,    unlock: 0 },
  { id: 'bambus', name: 'Bambus',       emoji: '🎍', stages: ['🟤', '🌱', '🎋', '🎍'], growth: 250,   unlock: 300 },
  { id: 'blume',  name: 'Chrysantheme', emoji: '🌼', stages: ['🟤', '🌱', '🌿', '🌼'], growth: 600,   unlock: 1500 },
  { id: 'ahorn',  name: 'Fächerahorn',  emoji: '🍁', stages: ['🟤', '🌱', '🌿', '🍁'], growth: 1500,  unlock: 6000 },
  { id: 'bonsai', name: 'Bonsai',       emoji: '🌳', stages: ['🟤', '🌱', '🪴', '🌳'], growth: 4000,  unlock: 25000 },
  { id: 'lotus',  name: 'Lotus',        emoji: '🪷', stages: ['🟤', '🌱', '🌿', '🪷'], growth: 10000, unlock: 90000 },
  { id: 'sakura', name: 'Kirschblüte',  emoji: '🌸', stages: ['🟤', '🌱', '🌳', '🌸'], growth: 25000, unlock: 300000 },
];

// Every species has its own global boost: harvesting a fully grown plant
// activates it FOR EVERYONE. Base duration 1 h; harvesting the same species
// again extends it (capped 12 h ahead). Different types combine freely,
// within the same type the strongest active boost wins.
const BOOST_BASE_MS = 60 * 60 * 1000;
const BOOST_CAP_MS = 12 * 60 * 60 * 1000;
const BOOSTS = {
  moos:   { name: 'Frisches Moos', emoji: '🍀', type: 'cooldown',   value: 40000, desc: 'Cooldown nur 40 s statt 60 s' },
  gras:   { name: 'Pampas-Power',  emoji: '🌾', type: 'multiplier', value: 2,     desc: 'Gießen zählt doppelt (+2 Wachstum)' },
  bambus: { name: 'Sprinkler',     emoji: '🎍', type: 'splash',     value: 1,     desc: 'Gießen bewässert zusätzlich eine zufällige Pflanze' },
  blume:  { name: 'Glücksblüte',   emoji: '🌼', type: 'lucky',      value: 0.25,  desc: '25 % Chance: Klick ohne Cooldown' },
  ahorn:  { name: 'Herbstwind',    emoji: '🍁', type: 'duration',   value: 2,     desc: 'Neu aktivierte Boosts halten 2 h statt 1 h' },
  bonsai: { name: 'Erleuchtung',   emoji: '🌳', type: 'unlock',     value: 2,     desc: 'Klicks zählen doppelt für Freischaltungen' },
  lotus:  { name: 'Monsun',        emoji: '🪷', type: 'rain',       value: 1,     desc: 'Alle Pflanzen wachsen +1 pro Minute' },
  sakura: { name: 'Hanami',        emoji: '🌸', type: 'cooldown',   value: 0,     desc: 'Kein Cooldown!' },
};

// ── State ─────────────────────────────────────────────────────────
let garden = {
  plots: Array(PLOT_COUNT).fill(null),   // { species, growth, plantedBy, plantedAt }
  totalClicks: 0,                        // lifetime community actions → unlocks
  harvestedTotal: 0,
  players: {},                           // name → { clicks, harvests, lastAction }
  log: [],                               // newest first
  boosts: {},                            // speciesId → expiry timestamp (global!)
};
let dirty = false;
const ipLast = new Map();

function loadGarden() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    garden = { ...garden, ...saved };
    while (garden.plots.length < PLOT_COUNT) garden.plots.push(null);
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

// Combined effect of all currently active boosts.
function boostEffects(now = Date.now()) {
  const eff = { cooldown: COOLDOWN_MS, mult: 1, splash: false, lucky: 0, durationX: 1, rain: false, unlockX: 1 };
  for (const [id, until] of Object.entries(garden.boosts || {})) {
    if (until <= now) continue;
    const b = BOOSTS[id];
    if (!b) continue;
    if (b.type === 'cooldown')        eff.cooldown = Math.min(eff.cooldown, b.value);
    else if (b.type === 'multiplier') eff.mult = Math.max(eff.mult, b.value);
    else if (b.type === 'splash')     eff.splash = true;
    else if (b.type === 'lucky')      eff.lucky = Math.max(eff.lucky, b.value);
    else if (b.type === 'duration')   eff.durationX = Math.max(eff.durationX, b.value);
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
    addLog({ player: byPlayer || '🌧️', text: `${sp.name} ${sp.emoji} ist voll erblüht! ✨` });
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
  const eff = boostEffects(now);
  const p = garden.players[player] || (garden.players[player] = { clicks: 0, harvests: 0, lastAction: 0 });

  const wait = p.lastAction + eff.cooldown - now;
  if (wait > 0) return { error: 'cooldown', wait };

  if (!Number.isInteger(plotIdx) || plotIdx < 0 || plotIdx >= garden.plots.length) {
    return { error: 'Ungültiges Beet.' };
  }
  const plot = garden.plots[plotIdx];

  if (action === 'plant') {
    if (plot) return { error: 'Das Beet ist schon bepflanzt.' };
    const sp = speciesById(speciesId);
    if (!sp) return { error: 'Unbekannte Sorte.' };
    if (garden.totalClicks < sp.unlock) return { error: 'Diese Sorte ist noch nicht freigeschaltet.' };
    garden.plots[plotIdx] = { species: sp.id, growth: 0, plantedBy: player, plantedAt: now };
    addLog({ player, text: `hat ${sp.name} ${sp.emoji} gepflanzt` });
  } else if (action === 'water') {
    if (!plot) return { error: 'Hier wächst nichts.' };
    const sp = speciesById(plot.species);
    if (plot.growth >= sp.growth) return { error: 'Ausgewachsen — bereit zur Ernte!' };
    growPlot(plot, eff.mult, player);
    if (eff.splash) waterRandomOther(plotIdx, player);
  } else if (action === 'harvest') {
    if (!plot) return { error: 'Hier wächst nichts.' };
    const sp = speciesById(plot.species);
    if (plot.growth < sp.growth) return { error: 'Noch nicht ausgewachsen.' };
    garden.plots[plotIdx] = null;
    garden.harvestedTotal += 1;
    p.harvests += 1;
    // Activate (or extend) this species' global boost for everyone
    const boost = BOOSTS[sp.id];
    const from = Math.max(garden.boosts[sp.id] || 0, now);
    garden.boosts[sp.id] = Math.min(now + BOOST_CAP_MS, from + BOOST_BASE_MS * eff.durationX);
    addLog({ player, text: `hat ${sp.name} ${sp.emoji} geerntet — Boost „${boost.name}" ${boost.emoji} für alle!` });
  } else {
    return { error: 'Unbekannte Aktion.' };
  }

  p.clicks += 1;
  // Glücksblüte: with some luck the action does not trigger a cooldown
  const lucky = eff.lucky > 0 && Math.random() < eff.lucky;
  if (!lucky) p.lastAction = now;
  garden.totalClicks += eff.unlockX;
  dirty = true;
  return { ok: true, lucky };
}

function stateFor(player) {
  const now = Date.now();
  const eff = boostEffects(now);
  const me = player && garden.players[player];
  const top = Object.entries(garden.players)
    .map(([name, v]) => ({ name, clicks: v.clicks, harvests: v.harvests }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  const activeBoosts = Object.entries(garden.boosts || {})
    .filter(([id, until]) => until > now && BOOSTS[id])
    .map(([id, until]) => ({ species: id, until, ...BOOSTS[id] }))
    .sort((a, b) => a.until - b.until);
  return {
    species: SPECIES.map(s => ({ ...s, boost: BOOSTS[s.id] })),
    plots: garden.plots,
    plotCount: garden.plots.length,
    totalClicks: garden.totalClicks,
    harvestedTotal: garden.harvestedTotal,
    top,
    log: garden.log,
    boosts: activeBoosts,
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
      if (!plot) return { error: 'Beet leer oder ungültig.' };
      const sp = speciesById(plot.species);
      plot.growth = Math.max(0, Math.min(sp.growth, Math.round(Number(b.value) || 0)));
      return { ok: `Beet ${b.plot}: ${sp.name} auf ${plot.growth}/${sp.growth}` };
    }
    case 'fill': {
      if (!plot) return { error: 'Beet leer oder ungültig.' };
      const sp = speciesById(plot.species);
      plot.growth = sp.growth;
      return { ok: `Beet ${b.plot}: ${sp.name} ausgewachsen — bereit zur Ernte` };
    }
    case 'clear': {
      if (!idxOk) return { error: 'Ungültiges Beet.' };
      garden.plots[b.plot] = null;
      return { ok: `Beet ${b.plot} geleert` };
    }
    case 'plant': {
      if (!idxOk) return { error: 'Ungültiges Beet.' };
      const sp = speciesById(b.species);
      if (!sp) return { error: `Unbekannte Sorte "${b.species}". Ids: ${SPECIES.map(s => s.id).join(', ')}` };
      garden.plots[b.plot] = { species: sp.id, growth: 0, plantedBy: 'cheat', plantedAt: now };
      return { ok: `Beet ${b.plot}: ${sp.name} gepflanzt (Unlock ignoriert)` };
    }
    case 'clicks': {
      garden.totalClicks = Math.max(0, Math.round(Number(b.value) || 0));
      return { ok: `totalClicks = ${garden.totalClicks}` };
    }
    case 'boost': {
      if (!BOOSTS[b.species]) return { error: `Unbekannte Sorte "${b.species}".` };
      const min = Math.round(Number(b.value) || 0);
      if (min <= 0) { delete garden.boosts[b.species]; return { ok: `Boost ${b.species} deaktiviert` }; }
      garden.boosts[b.species] = now + min * 60000;
      return { ok: `Boost „${BOOSTS[b.species].name}" aktiv für ${min} min` };
    }
    case 'cooldown': {
      const p = garden.players[b.player];
      if (!p) return { error: `Spieler "${b.player}" unbekannt.` };
      p.lastAction = 0;
      return { ok: `Cooldown von ${b.player} zurückgesetzt` };
    }
    case 'score': {
      const game = SCORE_GAMES.includes(b.game) ? b.game : SCORE_GAMES[0];
      const name = String(b.player || '').trim().slice(0, 20);
      if (name.length < 2) return { error: 'Name zu kurz.' };
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
      return { ok: before === (scores[game] || []).length ? 'Nichts gelöscht.' : `${b.player} aus ${game} entfernt` };
    }
    default:
      return { error: 'Unbekannter Befehl.' };
  }
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
      return send(res, 429, { error: 'Langsam — der Garten läuft nicht weg.' });
    }
    if (req.method === 'POST') ipLast.set(ip, Date.now());
  }

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return send(res, 200, stateFor(cleanName(url.searchParams.get('player'))));
  }

  // Highscores: GET /api/scores/<game> · POST /api/scores/<game> {name, score}
  const scoreMatch = url.pathname.match(/^\/api\/scores\/([a-z0-9-]+)$/);
  if (scoreMatch) {
    const game = scoreMatch[1];
    if (!SCORE_GAMES.includes(game)) return send(res, 404, { error: 'Unbekanntes Spiel.' });

    if (req.method === 'GET') {
      return send(res, 200, { scores: (scores[game] || []).slice(0, 50) });
    }
    if (req.method === 'POST') {
      const last = scoreLast.get(ip) || 0;
      if (Date.now() - last < SCORE_COOLDOWN_MS) {
        return send(res, 429, { error: 'Bitte warte kurz vor dem nächsten Eintrag.' });
      }
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 2048) req.destroy(); });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Kaputtes JSON.' }); }
        const name = cleanName(body.player);
        if (!name) return send(res, 400, { error: 'Bitte gib einen Namen mit 2–20 Zeichen an.' });
        const score = Number(body.score);
        if (!Number.isInteger(score) || score < 1 || score > 1000000) {
          return send(res, 400, { error: 'Ungültiger Score.' });
        }
        scoreLast.set(ip, Date.now());
        const board = submitScore(game, name, score);
        const rank = board.findIndex(e => e.name === name) + 1;
        return send(res, 200, { scores: board.slice(0, 50), rank: rank || null });
      });
      return;
    }
    return send(res, 405, { error: 'Methode nicht erlaubt.' });
  }

  if (url.pathname === '/api/feedback' && req.method === 'POST') {
    const last = feedbackLast.get(ip) || 0;
    if (Date.now() - last < FEEDBACK_COOLDOWN_MS) {
      return send(res, 429, { error: 'Bitte warte eine Minute bis zum nächsten Feedback.' });
    }
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Kaputtes JSON.' }); }
      const text = String(body.text || '').trim().slice(0, 2000);
      if (text.length < 3) return send(res, 400, { error: 'Bitte schreib ein paar Zeichen mehr.' });
      // Deliberately anonymous: timestamp, page and text only — no IP, no user agent.
      const entry = { ts: new Date().toISOString(), page: String(body.page || '').slice(0, 200), text };
      feedbackLast.set(ip, Date.now());
      fs.appendFile(FEEDBACK_FILE, JSON.stringify(entry) + '\n', err => {
        if (err) return send(res, 500, { error: 'Speichern fehlgeschlagen.' });
        send(res, 200, { ok: true });
      });
    });
    return;
  }

  // Feedback einsehen — nur wenn FEEDBACK_TOKEN als Env-Variable gesetzt ist.
  if (url.pathname === '/api/feedback' && req.method === 'GET') {
    if (!FEEDBACK_TOKEN || url.searchParams.get('token') !== FEEDBACK_TOKEN) {
      return send(res, 404, { error: 'Nicht gefunden.' });
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
    if (!CHEAT_TOKEN) return send(res, 404, { error: 'Nicht gefunden.' });
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Kaputtes JSON.' }); }
      if (body.token !== CHEAT_TOKEN) return send(res, 403, { error: 'Falscher Token.' });
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
      try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Kaputtes JSON.' }); }
      const player = cleanName(body.player);
      if (!player) return send(res, 400, { error: 'Bitte gib einen Namen mit 2–20 Zeichen an.' });
      const result = applyAction(player, body.action, body.plot, body.species);
      if (result.error === 'cooldown') {
        return send(res, 429, { error: `Noch ${Math.ceil(result.wait / 1000)}s bis zum nächsten Klick.`, waitMs: result.wait, ...stateFor(player) });
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

  send(res, 404, { error: 'Nicht gefunden.' });
});

loadGarden();
loadScores();
server.listen(PORT, () => console.log(`🪴 Zen Garden läuft auf http://localhost:${PORT}`));
