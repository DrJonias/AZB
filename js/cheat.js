// Dev cheat panel. Deliberately merge-safe: only activates under /dev/
// (or localhost), and the backend only responds to /api/cheat if CHEAT_TOKEN is set.
// In production neither is true, so this code is safe to keep on master.
// Open with Ctrl+Alt+C or tap the page icon 5 times quickly.
(() => {
  const isDev = location.pathname.startsWith('/dev/') || location.hostname === 'localhost';
  if (!isDev) return;

  const basePath = location.pathname.startsWith('/dev/') ? '/dev' : '';
  const apiBase = location.origin + basePath;

  let panel = null;
  let gstate = null;   // last /api/state payload for the dropdowns
  const refs = {};     // named controls

  // ── styles ──────────────────────────────────────────────────────
  const C = {
    input: 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;' +
           'padding:7px 9px;color:#fff;font:12px Consolas,Menlo,monospace;outline:none;min-width:0',
    btn:   'background:rgba(255,143,143,.12);border:1px solid rgba(255,143,143,.4);border-radius:8px;' +
           'padding:7px 11px;color:#ffb4b4;font:12px Inter,sans-serif;cursor:pointer;white-space:nowrap',
    row:   'display:flex;gap:6px;align-items:center;margin-bottom:7px',
    head:  'margin:12px 0 6px;font:600 11px Inter,sans-serif;color:#8da3c8;text-transform:uppercase;letter-spacing:.1em',
  };

  function el(tag, style, props = {}) {
    const n = document.createElement(tag);
    if (style) n.style.cssText = style;
    Object.assign(n, props);
    return n;
  }

  function row(...children) {
    const r = el('div', C.row);
    children.forEach(c => r.appendChild(c));
    return r;
  }

  function head(text) { return el('div', C.head, { textContent: text }); }

  // ── backend ─────────────────────────────────────────────────────
  async function post(body) {
    const token = localStorage.getItem('cheat-token') || '';
    const res = await fetch(apiBase + '/api/cheat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(res.status === 404
        ? 'Backend hat keinen CHEAT_TOKEN gesetzt (Compose: backend-dev).'
        : data.error || res.status);
    }
    return data;
  }

  function status(msg, ok) {
    refs.status.textContent = (ok ? '✓ ' : '✗ ') + msg;
    refs.status.style.color = ok ? '#3dffa0' : '#ff8f8f';
  }

  function run(body) {
    post(body)
      .then(r => { status(r.ok || 'ok', true); refreshState(); })
      .catch(e => status(e.message, false));
  }

  async function refreshState() {
    try {
      gstate = await (await fetch(apiBase + '/api/state')).json();
      fillSelectors();
    } catch { /* Anzeige bleibt beim alten Stand */ }
  }

  function option(select, value, label) {
    const o = el('option', '', { value, textContent: label });
    o.style.background = '#0c1426';
    select.appendChild(o);
  }

  function fillSelectors() {
    if (!gstate || !panel) return;
    const keepPlot = refs.plot.value, keepSp = refs.plantSpecies.value, keepBoost = refs.boostSpecies.value;

    refs.plot.innerHTML = '';
    gstate.plots.forEach((plot, i) => {
      if (plot) {
        const sp = gstate.species.find(s => s.id === plot.species);
        option(refs.plot, i, `${i}: ${sp.emoji} ${sp.name} ${plot.growth}/${sp.growth}`);
      } else {
        option(refs.plot, i, `${i}: (leer)`);
      }
    });

    refs.plantSpecies.innerHTML = '';
    refs.boostSpecies.innerHTML = '';
    gstate.species.forEach(sp => {
      option(refs.plantSpecies, sp.id, `${sp.emoji} ${sp.name}`);
      option(refs.boostSpecies, sp.id, `${sp.boost ? sp.boost.emoji : sp.emoji} ${sp.boost ? sp.boost.name : sp.name}`);
    });

    if (keepPlot) refs.plot.value = keepPlot;
    if (keepSp) refs.plantSpecies.value = keepSp;
    if (keepBoost) refs.boostSpecies.value = keepBoost;
  }

  // ── panel ───────────────────────────────────────────────────────
  function buildPanel() {
    panel = el('div',
      'position:fixed;left:14px;bottom:14px;z-index:9999;width:min(400px,calc(100vw - 28px));' +
      'max-height:min(75vh,640px);overflow-y:auto;background:#0c1426;border:1px solid rgba(255,120,120,.5);' +
      'border-radius:14px;padding:14px;color:#d8e4ff;box-shadow:0 16px 40px rgba(0,0,0,.6)');

    // header
    const close = el('button', 'background:none;border:none;color:#8da3c8;cursor:pointer;font-size:15px', { textContent: '✕' });
    close.addEventListener('click', () => { panel.remove(); panel = null; });
    const title = el('strong', 'color:#ff8f8f;font:600 13px Inter,sans-serif', { textContent: '🛠 Cheats (dev)' });
    panel.appendChild(row(title, el('span', 'flex:1'), close));

    // token
    refs.token = el('input', C.input + ';flex:1', {
      type: 'password', placeholder: 'Cheat-Token',
      value: localStorage.getItem('cheat-token') || '',
    });
    const saveTok = el('button', C.btn, { textContent: '💾' });
    saveTok.addEventListener('click', () => {
      localStorage.setItem('cheat-token', refs.token.value.trim());
      status('Token saved', true);
    });
    panel.appendChild(row(refs.token, saveTok));

    // Plot
    panel.appendChild(head('Plot'));
    refs.plot = el('select', C.input + ';flex:1');
    const reload = el('button', C.btn, { textContent: '↻', title: 'Reload' });
    reload.addEventListener('click', refreshState);
    panel.appendChild(row(refs.plot, reload));

    const fill = el('button', C.btn + ';flex:1', { textContent: '✨ Fully grown' });
    fill.addEventListener('click', () => run({ cmd: 'fill', plot: +refs.plot.value }));
    const clear = el('button', C.btn + ';flex:1', { textContent: '🗑 Clear' });
    clear.addEventListener('click', () => run({ cmd: 'clear', plot: +refs.plot.value }));
    panel.appendChild(row(fill, clear));

    refs.growth = el('input', C.input + ';flex:1', { type: 'number', min: 0, placeholder: 'Growth' });
    const setGrowth = el('button', C.btn, { textContent: 'Set' });
    setGrowth.addEventListener('click', () => run({ cmd: 'grow', plot: +refs.plot.value, value: +refs.growth.value }));
    panel.appendChild(row(refs.growth, setGrowth));

    refs.plantSpecies = el('select', C.input + ';flex:1');
    const plant = el('button', C.btn, { textContent: '🌱 Plant' });
    plant.addEventListener('click', () => run({ cmd: 'plant', plot: +refs.plot.value, species: refs.plantSpecies.value }));
    panel.appendChild(row(refs.plantSpecies, plant));

    // Community
    panel.appendChild(head('Community'));
    refs.clicks = el('input', C.input + ';flex:1', { type: 'number', min: 0, placeholder: 'totalClicks' });
    const setClicks = el('button', C.btn, { textContent: 'Set' });
    setClicks.addEventListener('click', () => run({ cmd: 'clicks', value: +refs.clicks.value }));
    panel.appendChild(row(refs.clicks, setClicks));

    // Boost
    panel.appendChild(head('Boost'));
    refs.boostSpecies = el('select', C.input + ';flex:1');
    refs.boostMin = el('input', C.input + ';width:70px', { type: 'number', min: 0, value: 60, title: 'Minutes' });
    const boostOn = el('button', C.btn, { textContent: 'On' });
    boostOn.addEventListener('click', () => run({ cmd: 'boost', species: refs.boostSpecies.value, value: +refs.boostMin.value }));
    const boostOff = el('button', C.btn, { textContent: 'Off' });
    boostOff.addEventListener('click', () => run({ cmd: 'boost', species: refs.boostSpecies.value, value: 0 }));
    panel.appendChild(row(refs.boostSpecies, refs.boostMin, boostOn, boostOff));

    // Players
    panel.appendChild(head('Players'));
    refs.player = el('input', C.input + ';flex:1', {
      placeholder: 'Name', value: localStorage.getItem('zen-name') || localStorage.getItem('doodle-name') || '',
    });
    const cd = el('button', C.btn, { textContent: '⏱ Remove cooldown' });
    cd.addEventListener('click', () => run({ cmd: 'cooldown', player: refs.player.value.trim() }));
    panel.appendChild(row(refs.player, cd));

    // Doodle Jump
    panel.appendChild(head('Doodle Jump Score'));
    refs.scoreName = el('input', C.input + ';flex:1', {
      placeholder: 'Name', value: localStorage.getItem('doodle-name') || '',
    });
    refs.scoreVal = el('input', C.input + ';width:80px', { type: 'number', placeholder: 'Points' });
    const setScore = el('button', C.btn, { textContent: 'Set' });
    setScore.addEventListener('click', () =>
      run({ cmd: 'score', game: 'doodle-jump', player: refs.scoreName.value.trim(), value: +refs.scoreVal.value }));
    const delScore = el('button', C.btn, { textContent: '🗑' , title: 'Delete entry' });
    delScore.addEventListener('click', () =>
      run({ cmd: 'unscore', game: 'doodle-jump', player: refs.scoreName.value.trim() }));
    panel.appendChild(row(refs.scoreName, refs.scoreVal, setScore, delScore));

    // status line
    refs.status = el('div', 'margin-top:10px;font:12px Consolas,Menlo,monospace;min-height:16px;color:#8da3c8', {
      textContent: localStorage.getItem('cheat-token') ? 'Ready.' : 'Enter a token and save it first.',
    });
    panel.appendChild(refs.status);

    document.body.appendChild(panel);
    refreshState();
  }

  function toggle() {
    if (panel) { panel.remove(); panel = null; } else buildPanel();
  }

  // Desktop: Ctrl+Alt+C
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); toggle(); }
  });

  // Mobile: tap the page icon 5× quickly
  const icon = document.querySelector('.page-icon');
  if (icon) {
    let taps = 0, timer = null;
    icon.addEventListener('click', () => {
      taps += 1;
      clearTimeout(timer);
      timer = setTimeout(() => { taps = 0; }, 2500);
      if (taps >= 5) { taps = 0; toggle(); }
    });
  }
})();
