// Zen Garden frontend — talks to the small Node backend in ./server.
// One action per player per minute; the server is the source of truth.

// Same-origin in production (nginx proxies /api/ to the backend). Pages under
// /dev/ talk to the separate dev backend via /dev/api/ instead. The localhost
// fallback is only for opening the file directly during development.
const basePath = location.pathname.startsWith('/dev/') ? '/dev' : '';
const apiBase = location.protocol.startsWith('http') ? location.origin + basePath : 'http://localhost:8787';

let playerName = localStorage.getItem('zen-name') || '';
let state = null;          // last server state
let nextActionAt = 0;      // local timestamp when the next click is allowed
let pickerPlot = null;

const $ = id => document.getElementById(id);

// ── API ───────────────────────────────────────────────────────────
async function api(path, options) {
  const res = await fetch(apiBase + path, options);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}

async function fetchState() {
  try {
    applyState(await api(`/api/state?player=${encodeURIComponent(playerName)}`));
    $('offlineBanner').classList.add('hidden');
  } catch {
    $('offlineBanner').classList.remove('hidden');
  }
}

async function sendAction(action, plot, species) {
  if (Date.now() < nextActionAt) {
    toast(`Noch ${Math.ceil((nextActionAt - Date.now()) / 1000)}s Geduld 🧘`);
    return;
  }
  try {
    const data = await api('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player: playerName, action, plot, species }),
    });
    applyState(data);
    if (data.lucky) toast('🌼 Glücksblüte — dein Klick war gratis, kein Cooldown!');
  } catch (err) {
    if (err.data && err.data.plots) applyState(err.data);
    toast(err.message);
  }
}

function applyState(data) {
  state = data;
  nextActionAt = Date.now() + (data.waitMs || 0);
  render();
}

// ── Rendering ─────────────────────────────────────────────────────
function speciesById(id) { return state.species.find(s => s.id === id); }

function stageEmoji(sp, growth) {
  if (growth >= sp.growth) return sp.stages[sp.stages.length - 1];
  const idx = Math.floor((growth / sp.growth) * (sp.stages.length - 1));
  return sp.stages[Math.min(idx, sp.stages.length - 2)];
}

function render() {
  if (!state) return;

  // Garden grid
  const garden = $('garden');
  garden.innerHTML = '';
  state.plots.forEach((plot, i) => {
    const btn = document.createElement('button');
    btn.className = 'plot';
    if (!plot) {
      btn.classList.add('empty');
      btn.innerHTML = '<span class="plot-emoji">🪨</span><span class="plot-cap">pflanzen</span>';
      btn.addEventListener('click', () => openPicker(i));
    } else {
      const sp = speciesById(plot.species);
      const done = plot.growth >= sp.growth;
      const pct = Math.min(100, (plot.growth / sp.growth) * 100);
      btn.classList.toggle('done', done);
      btn.innerHTML =
        `<span class="plot-emoji">${stageEmoji(sp, plot.growth)}</span>` +
        `<span class="plot-cap">${done ? 'ernten ✨' : sp.name}</span>` +
        `<span class="plot-bar"><span class="plot-fill" style="width:${pct}%"></span></span>`;
      btn.title = `${sp.name} · ${plot.growth}/${sp.growth} · gepflanzt von ${plot.plantedBy}`;
      btn.addEventListener('click', () => sendAction(done ? 'harvest' : 'water', i));
    }
    garden.appendChild(btn);
  });

  // Species list with unlock state and each species' harvest boost
  const list = $('speciesList');
  list.innerHTML = '';
  state.species.forEach(sp => {
    const unlocked = state.totalClicks >= sp.unlock;
    const row = document.createElement('div');
    row.className = 'species-row' + (unlocked ? '' : ' locked');
    const boostLine = unlocked && sp.boost
      ? `<span class="sp-boost">Ernte-Boost „${esc(sp.boost.name)}": ${esc(sp.boost.desc)}</span>`
      : '';
    row.innerHTML =
      `<span class="sp-emoji">${unlocked ? sp.emoji : '🔒'}</span>` +
      `<span class="sp-main"><span class="sp-name">${unlocked ? sp.name : '???'}</span>${boostLine}</span>` +
      `<span class="sp-info">${unlocked
        ? `${sp.growth.toLocaleString('de-DE')} 💧`
        : `ab ${sp.unlock.toLocaleString('de-DE')} Klicks`}</span>`;
    list.appendChild(row);
  });

  renderBoosts();

  // Community stats
  $('statClicks').textContent = state.totalClicks.toLocaleString('de-DE');
  $('statHarvest').textContent = state.harvestedTotal.toLocaleString('de-DE');

  const next = state.species.find(sp => state.totalClicks < sp.unlock);
  $('unlockProgress').innerHTML = next
    ? `Nächste Sorte bei <strong>${next.unlock.toLocaleString('de-DE')}</strong> Klicks ` +
      `<span class="unlock-bar"><span style="width:${(state.totalClicks / next.unlock * 100).toFixed(1)}%"></span></span>`
    : 'Alle Sorten freigeschaltet 🎉';

  $('topList').innerHTML = state.top
    .map(p => `<li><span>${esc(p.name)}</span><span>${p.clicks.toLocaleString('de-DE')} Klicks · ${p.harvests} 🙏</span></li>`)
    .join('') || '<li>Noch niemand hier.</li>';

  $('logList').innerHTML = state.log
    .map(e => `<li><strong>${esc(e.player)}</strong> ${esc(e.text)}</li>`)
    .join('') || '<li>Noch ganz still hier.</li>';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Active global boosts ──────────────────────────────────────────
function fmtRemaining(ms) {
  const min = Math.ceil(ms / 60000);
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60 ? (min % 60) + ' min' : ''}`.trim();
  return `${Math.max(1, min)} min`;
}

function renderBoosts() {
  const bar = $('boostBar');
  if (!bar) return;
  const now = Date.now();
  const active = (state && state.boosts || []).filter(b => b.until > now);
  bar.classList.toggle('hidden', !active.length);
  bar.innerHTML = active.map(b =>
    `<span class="boost-chip" title="${esc(b.desc)}">` +
    `${b.emoji} ${esc(b.name)}<span class="boost-time">${fmtRemaining(b.until - now)}</span></span>`
  ).join('');
}

// ── Cooldown ticker ───────────────────────────────────────────────
let lastBoostTick = 0;
setInterval(() => {
  if (!state) return;
  // refresh boost countdowns once a minute (they display minutes)
  if (Date.now() - lastBoostTick > 60 * 1000) {
    lastBoostTick = Date.now();
    renderBoosts();
  }
  const left = nextActionAt - Date.now();
  const fill = $('cooldownFill');
  const text = $('cooldownText');
  if (left <= 0) {
    fill.style.width = '100%';
    fill.classList.add('ready');
    text.textContent = 'bereit 🌊';
  } else {
    fill.classList.remove('ready');
    fill.style.width = `${(100 - left / state.cooldownMs * 100).toFixed(1)}%`;
    text.textContent = `nächster Klick in ${Math.ceil(left / 1000)}s`;
  }
}, 250);

// ── Species picker ────────────────────────────────────────────────
function openPicker(plotIdx) {
  if (Date.now() < nextActionAt) {
    toast(`Noch ${Math.ceil((nextActionAt - Date.now()) / 1000)}s Geduld 🧘`);
    return;
  }
  pickerPlot = plotIdx;
  const list = $('pickerList');
  list.innerHTML = '';
  state.species.filter(sp => state.totalClicks >= sp.unlock).forEach(sp => {
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    btn.innerHTML = `<span>${sp.emoji}</span><span>${sp.name}</span><span class="sp-info">${sp.growth.toLocaleString('de-DE')} 💧</span>`;
    btn.addEventListener('click', () => {
      const plot = pickerPlot;   // closePicker() nulls pickerPlot — grab it first
      closePicker();
      sendAction('plant', plot, sp.id);
    });
    list.appendChild(btn);
  });
  $('picker').classList.remove('hidden');
}

function closePicker() { $('picker').classList.add('hidden'); pickerPlot = null; }

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Setup ─────────────────────────────────────────────────────────
function enterGarden(name) {
  playerName = name;
  localStorage.setItem('zen-name', name);
  $('namePanel').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('meLabel').textContent = `🧑‍🌾 ${name}`;
  fetchState();
}

$('nameBtn').addEventListener('click', () => {
  const name = $('nameInput').value.trim();
  if (name.length < 2) { toast('Mindestens 2 Zeichen, bitte.'); return; }
  enterGarden(name);
});
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('nameBtn').click(); });

$('pickerCancel').addEventListener('click', closePicker);
$('picker').addEventListener('click', e => { if (e.target === $('picker')) closePicker(); });

if (playerName) enterGarden(playerName);
setInterval(() => { if (playerName) fetchState(); }, 15 * 1000);
