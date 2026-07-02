/*
 * Zen Garden — zero-dependency Node.js backend.
 *
 *   node server/server.js          → http://localhost:8787
 *   PORT=3000 node server/server.js
 *
 * Serves the frontend (parent folder) and a small JSON API.
 * State is persisted to garden-data.json next to this file.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'garden-data.json');
const APP_DIR = path.resolve(__dirname, '..');

const PLOT_COUNT = 20;
const COOLDOWN_MS = 60 * 1000;       // 1 action per player per minute
const IP_THROTTLE_MS = 1500;         // basic request throttle per IP
const LOG_MAX = 15;

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

// ── State ─────────────────────────────────────────────────────────
let garden = {
  plots: Array(PLOT_COUNT).fill(null),   // { species, growth, plantedBy, plantedAt }
  totalClicks: 0,                        // lifetime community actions → unlocks
  harvestedTotal: 0,
  players: {},                           // name → { clicks, harvests, lastAction }
  log: [],                               // newest first
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

function applyAction(player, action, plotIdx, speciesId) {
  const now = Date.now();
  const p = garden.players[player] || (garden.players[player] = { clicks: 0, harvests: 0, lastAction: 0 });

  const wait = p.lastAction + COOLDOWN_MS - now;
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
    plot.growth += 1;
    if (plot.growth === sp.growth) addLog({ player, text: `${sp.name} ${sp.emoji} ist voll erblüht! ✨` });
  } else if (action === 'harvest') {
    if (!plot) return { error: 'Hier wächst nichts.' };
    const sp = speciesById(plot.species);
    if (plot.growth < sp.growth) return { error: 'Noch nicht ausgewachsen.' };
    garden.plots[plotIdx] = null;
    garden.harvestedTotal += 1;
    p.harvests += 1;
    addLog({ player, text: `hat ${sp.name} ${sp.emoji} geerntet 🙏` });
  } else {
    return { error: 'Unbekannte Aktion.' };
  }

  p.clicks += 1;
  p.lastAction = now;
  garden.totalClicks += 1;
  dirty = true;
  return { ok: true };
}

function stateFor(player) {
  const now = Date.now();
  const me = player && garden.players[player];
  const top = Object.entries(garden.players)
    .map(([name, v]) => ({ name, clicks: v.clicks, harvests: v.harvests }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  return {
    species: SPECIES,
    plots: garden.plots,
    plotCount: garden.plots.length,
    totalClicks: garden.totalClicks,
    harvestedTotal: garden.harvestedTotal,
    top,
    log: garden.log,
    serverTime: now,
    cooldownMs: COOLDOWN_MS,
    waitMs: me ? Math.max(0, me.lastAction + COOLDOWN_MS - now) : 0,
  };
}

function cleanName(raw) {
  const name = String(raw || '').trim().slice(0, 20);
  return /^[\w\däöüÄÖÜß .-]{2,20}$/.test(name) ? name : null;
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
      return send(res, 200, stateFor(player));
    });
    return;
  }

  // Static frontend (never the server/ folder itself)
  if (req.method === 'GET') {
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const file = path.resolve(APP_DIR, rel);
    const inApp = file.startsWith(APP_DIR + path.sep) && !file.startsWith(__dirname + path.sep);
    if (inApp && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    }
  }

  send(res, 404, { error: 'Nicht gefunden.' });
});

loadGarden();
server.listen(PORT, () => console.log(`🪴 Zen Garden läuft auf http://localhost:${PORT}`));
