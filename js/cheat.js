// Dev-Cheat-Konsole. Bewusst merge-sicher: aktiviert sich NUR unter /dev/
// (oder localhost), und das Backend beantwortet /api/cheat nur, wenn dort
// CHEAT_TOKEN gesetzt ist — in Produktion ist beides nie der Fall, der Code
// darf also gefahrlos auf master liegen.
(() => {
  const isDev = location.pathname.startsWith('/dev/') || location.hostname === 'localhost';
  if (!isDev) return;

  const basePath = location.pathname.startsWith('/dev/') ? '/dev' : '';
  const apiBase = location.origin + basePath;

  let panel = null;

  const HELP = [
    'Befehle:',
    '  token <wert>              Cheat-Token speichern (einmalig)',
    '  grow <beet> <wert>        Wachstum eines Beets setzen (0-basiert)',
    '  fill <beet>               Pflanze sofort ausgewachsen',
    '  clear <beet>              Beet leeren',
    '  plant <beet> <sorte>      Pflanzen, Unlock egal (moos, gras, bambus,',
    '                            blume, ahorn, bonsai, lotus, sakura)',
    '  clicks <wert>             Community-totalClicks setzen',
    '  boost <sorte> <minuten>   Boost aktivieren (0 = aus)',
    '  cooldown <spieler>        Cooldown eines Spielers zurücksetzen',
    '  score <spieler> <punkte>  Doodle-Jump-Score setzen',
    '  unscore <spieler>         Doodle-Jump-Eintrag löschen',
    '  help                      diese Hilfe',
  ].join('\n');

  function buildPanel() {
    panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;left:14px;bottom:14px;z-index:9999;width:min(440px,calc(100vw - 28px));' +
      'background:#0c1426;border:1px solid rgba(255,120,120,.5);border-radius:12px;padding:12px;' +
      'font:12px/1.5 Consolas,Menlo,monospace;color:#d8e4ff;box-shadow:0 16px 40px rgba(0,0,0,.6)';
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<strong style="color:#ff8f8f">🛠 Cheat-Konsole (dev)</strong>' +
      '<button id="cheatClose" style="background:none;border:none;color:#8da3c8;cursor:pointer;font-size:14px">✕</button></div>' +
      '<pre id="cheatOut" style="margin:0 0 8px;max-height:200px;overflow:auto;white-space:pre-wrap;background:rgba(0,0,0,.3);border-radius:8px;padding:8px"></pre>' +
      '<input id="cheatIn" placeholder="Befehl… (help)" autocomplete="off" spellcheck="false" style="width:100%;box-sizing:border-box;' +
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 10px;color:#fff;font:inherit;outline:none">';
    document.body.appendChild(panel);

    panel.querySelector('#cheatClose').addEventListener('click', () => panel.remove() || (panel = null));
    const input = panel.querySelector('#cheatIn');
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const line = input.value.trim();
      input.value = '';
      if (line) run(line);
    });
    print(localStorage.getItem('cheat-token')
      ? 'Bereit. "help" für Befehle.'
      : 'Kein Token gesetzt — zuerst: token <wert>');
    input.focus();
  }

  function print(msg) {
    const out = panel && panel.querySelector('#cheatOut');
    if (!out) return;
    out.textContent += (out.textContent ? '\n' : '') + msg;
    out.scrollTop = out.scrollHeight;
  }

  async function post(body) {
    const token = localStorage.getItem('cheat-token') || '';
    const res = await fetch(apiBase + '/api/cheat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.status);
    return data;
  }

  async function run(line) {
    print('> ' + line);
    const [cmd, ...args] = line.split(/\s+/);
    try {
      switch (cmd) {
        case 'help': print(HELP); break;
        case 'token':
          localStorage.setItem('cheat-token', args[0] || '');
          print('Token gespeichert.');
          break;
        case 'grow':     print((await post({ cmd, plot: +args[0], value: +args[1] })).ok); break;
        case 'fill':
        case 'clear':    print((await post({ cmd, plot: +args[0] })).ok); break;
        case 'plant':    print((await post({ cmd, plot: +args[0], species: args[1] })).ok); break;
        case 'clicks':   print((await post({ cmd, value: +args[0] })).ok); break;
        case 'boost':    print((await post({ cmd, species: args[0], value: +args[1] })).ok); break;
        case 'cooldown': print((await post({ cmd, player: args.join(' ') })).ok); break;
        case 'score':    print((await post({ cmd, player: args.slice(0, -1).join(' '), value: +args[args.length - 1] })).ok); break;
        case 'unscore':  print((await post({ cmd, player: args.join(' ') })).ok); break;
        default: print('Unbekannter Befehl — "help" zeigt alle.');
      }
    } catch (err) {
      print('✗ ' + err.message);
    }
  }

  function toggle() {
    if (panel) { panel.remove(); panel = null; } else buildPanel();
  }

  // Desktop: Ctrl+Alt+C
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); toggle(); }
  });

  // Mobil: 5× schnell auf das Seiten-Icon tippen
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
