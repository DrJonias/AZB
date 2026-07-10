// Auszugs-Budget — Kosten in mehreren Listen planen, Einnahmen checken. Speichert in localStorage.
(function () {
  var KEY = 'auszugs-budget';
  var WEEKS_PER_MONTH = 4.33;

  var DEFAULT_TEMPLATES = [
    { n: 'Miete', m: 1200 },
    { n: 'Nebenkosten (NK/Akonto)', m: 150 },
    { n: 'Strom', m: 60 },
    { n: 'Krankenkasse (Grundvers.)', m: 320 },
    { n: 'Hausratversicherung', m: 20 },
    { n: 'Privathaftpflicht', m: 13.35 },
    { n: 'Internet', m: 35 },
    { n: 'Handy-Abo', m: 20 },
    { n: 'Serafe (Radio/TV)', m: 27.9 },
    { n: 'Essen', m: 380 },
    { n: 'Haushalt / Verbrauchsmaterial', m: 70 },
    { n: 'Motorrad-Versicherung', m: 33.35 },
    { n: 'Motorrad-Steuer', m: 10.85 },
    { n: 'Benzin', m: 10 },
    { n: 'Steuern (Rückstellung)', m: 300 },
    { n: 'Gym', m: 40 },
    { n: 'Streaming / Abos', m: 18 },
    { n: 'Freizeit', m: 50 },
    { n: 'Sparen / Reserve', m: 300 }
  ];

  var DEFAULT_LISTS = [
    { name: 'Fixkosten', rows: [] },
    { name: 'Alltag', rows: [] },
    { name: 'Sparen', rows: [] }
  ];

  var DEFAULTS = {
    incomeMode: 'monat',
    income: null,
    hourly: 25,
    hoursPerWeek: 8,
    ref100: null,
    pensum: 40,
    lists: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
    activeList: 0,
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES))
  };

  var rowsEl = document.getElementById('rows');
  var tabsEl = document.getElementById('tabs');
  var totalsEl = document.getElementById('totals');
  var tplListEl = document.getElementById('tplList');
  var statusEl = document.getElementById('status');
  var incEl = document.getElementById('inc');
  var hourlyEl = document.getElementById('hourly');
  var hpwEl = document.getElementById('hpw');
  var ref100El = document.getElementById('ref100');
  var pensumSeg = document.getElementById('pensumSeg');
  var modeSeg = document.querySelector('.seg');
  var saveTimer = null;

  var incomeMode = 'monat';
  var pensum = 40;
  var templates = [];
  var lists = [];
  var activeIdx = 0;

  function r2(v) { return Math.round(v * 100) / 100; }
  function fmt(v) {
    return 'CHF ' + r2(v).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  /* ── Leere-Liste-Hinweis ─────────────────────────────────────── */
  function updateEmptyHint() {
    var hint = rowsEl.querySelector('.empty-hint');
    var hasRows = rowsEl.querySelector('.row');
    if (!hasRows && !hint) {
      var d = document.createElement('div');
      d.className = 'empty-hint';
      d.textContent = 'Noch keine Posten — Vorlagen hierher ziehen oder antippen.';
      rowsEl.appendChild(d);
    } else if (hasRows && hint) {
      hint.remove();
    }
  }

  /* ── Einkommen ───────────────────────────────────────────────── */
  function effectiveIncome() {
    if (incomeMode === 'stunde') {
      var h = parseFloat(hourlyEl.value);
      var w = parseFloat(hpwEl.value);
      if (isNaN(h) || isNaN(w)) return null;
      return r2(h * w * WEEKS_PER_MONTH);
    }
    if (incomeMode === 'pensum') {
      var ref = parseFloat(ref100El.value);
      if (isNaN(ref)) return null;
      return r2(ref * pensum / 100);
    }
    var inc = parseFloat(incEl.value);
    return isNaN(inc) ? null : inc;
  }

  function updateModeUI() {
    modeSeg.querySelectorAll('button').forEach(function (b) {
      var on = b.getAttribute('data-mode') === incomeMode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['monat', 'stunde', 'pensum'].forEach(function (m) {
      document.getElementById('panel-' + m).classList.toggle('visible', m === incomeMode);
    });
    pensumSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', parseFloat(b.getAttribute('data-pct')) === pensum);
    });
  }

  /* ── Listen (Tabs) ───────────────────────────────────────────── */
  function syncActiveRows() {
    if (!lists[activeIdx]) return;
    var rows = [];
    rowsEl.querySelectorAll('.row').forEach(function (r) {
      var n = r.querySelector('.name').value;
      var m = parseFloat(r.querySelector('.m').value);
      rows.push({ n: n, m: isNaN(m) ? null : m });
    });
    lists[activeIdx].rows = rows;
  }

  function listTotal(list) {
    var t = 0;
    list.rows.forEach(function (r) {
      if (typeof r.m === 'number' && !isNaN(r.m)) t += r.m;
    });
    return t;
  }

  function renderRows() {
    rowsEl.innerHTML = '';
    lists[activeIdx].rows.forEach(function (d) { makeRow(d.n, d.m); });
    updateEmptyHint();
  }

  function switchTo(i) {
    if (i === activeIdx || !lists[i]) return;
    syncActiveRows();
    activeIdx = i;
    renderTabs(); renderRows(); recalc(); scheduleSave();
  }

  function addList() {
    var name = prompt('Name der neuen Liste:', 'Neue Liste');
    if (name === null) return;
    name = name.trim() || 'Neue Liste';
    syncActiveRows();
    lists.push({ name: name, rows: [] });
    activeIdx = lists.length - 1;
    renderTabs(); renderRows(); recalc(); scheduleSave();
  }

  function renameList(i) {
    var name = prompt('Liste umbenennen:', lists[i].name);
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    lists[i].name = name;
    renderTabs(); recalc(); scheduleSave();
  }

  function deleteList(i) {
    if (lists.length <= 1) return;
    syncActiveRows();
    var l = lists[i];
    if (l.rows.length && !confirm('Liste «' + l.name + '» mit ' + l.rows.length + ' Posten löschen?')) return;
    lists.splice(i, 1);
    if (activeIdx >= lists.length) activeIdx = lists.length - 1;
    renderTabs(); renderRows(); recalc(); scheduleSave();
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    lists.forEach(function (l, i) {
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab' + (i === activeIdx ? ' active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', i === activeIdx ? 'true' : 'false');

      var label = document.createElement('span');
      label.className = 'tlabel';
      label.textContent = l.name;
      tab.appendChild(label);

      if (i === activeIdx) {
        var ren = document.createElement('span');
        ren.className = 'tact';
        ren.textContent = '✎';
        ren.title = 'Liste umbenennen';
        ren.addEventListener('click', function (e) { e.stopPropagation(); renameList(i); });
        tab.appendChild(ren);

        if (lists.length > 1) {
          var cls = document.createElement('span');
          cls.className = 'tact tclose';
          cls.textContent = '×';
          cls.title = 'Liste löschen';
          cls.addEventListener('click', function (e) { e.stopPropagation(); deleteList(i); });
          tab.appendChild(cls);
        }
      }

      tab.addEventListener('click', function () { switchTo(i); });
      tab.addEventListener('dblclick', function () { renameList(i); });
      tabsEl.appendChild(tab);
    });

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'tab tab-add';
    add.textContent = '+';
    add.title = 'Neue Liste hinzufügen';
    add.setAttribute('aria-label', 'Neue Liste hinzufügen');
    add.addEventListener('click', addList);
    tabsEl.appendChild(add);
  }

  /* ── Totale + Bilanz ─────────────────────────────────────────── */
  function recalc() {
    syncActiveRows();

    totalsEl.innerHTML = '';
    var head = document.createElement('div');
    head.className = 'trow thead';
    head.innerHTML = '<span>Liste</span><span>Monatlich</span><span>Jährlich</span><span></span>';
    totalsEl.appendChild(head);

    var grand = 0;
    lists.forEach(function (l, i) {
      var t = listTotal(l);
      grand += t;
      var row = document.createElement('div');
      row.className = 'trow' + (i === activeIdx ? ' current' : '');
      var name = document.createElement('span');
      name.className = 'lname';
      name.textContent = l.name;
      var m = document.createElement('span');
      m.className = 'num';
      m.textContent = fmt(t);
      var j = document.createElement('span');
      j.className = 'num';
      j.textContent = fmt(t * 12);
      row.appendChild(name); row.appendChild(m); row.appendChild(j);
      row.appendChild(document.createElement('span'));
      row.addEventListener('click', function () { switchTo(i); });
      totalsEl.appendChild(row);
    });

    var g = document.createElement('div');
    g.className = 'trow grand';
    var gn = document.createElement('span');
    gn.className = 'lname';
    gn.textContent = 'Gesamt (alle Listen)';
    var gm = document.createElement('span');
    gm.className = 'num';
    gm.textContent = fmt(grand);
    var gj = document.createElement('span');
    gj.className = 'num';
    gj.textContent = fmt(grand * 12);
    g.appendChild(gn); g.appendChild(gm); g.appendChild(gj);
    g.appendChild(document.createElement('span'));
    totalsEl.appendChild(g);

    var inc = effectiveIncome();

    var ds = document.getElementById('derivedStunde');
    if (incomeMode === 'stunde') {
      ds.innerHTML = inc === null ? 'Stundenlohn und Wochenstunden eingeben.'
        : 'Entspricht <span class="num">' + fmt(inc) + '</span> pro Monat.';
    }
    var dp = document.getElementById('derivedPensum');
    if (incomeMode === 'pensum') {
      dp.innerHTML = inc === null ? '100%-Lohn eingeben.'
        : 'Bei ' + pensum + '% entspricht das <span class="num">' + fmt(inc) + '</span> pro Monat.';
    }

    var bal = document.getElementById('bal');
    if (inc === null) { bal.textContent = ''; bal.className = 'balance'; return; }
    var diff = r2(inc - grand);
    if (diff >= 0) {
      bal.className = 'balance pos';
      bal.innerHTML = 'Es bleiben <span class="num">' + fmt(diff) + '</span> pro Monat übrig.';
    } else {
      bal.className = 'balance neg';
      bal.innerHTML = 'Es fehlen <span class="num">' + fmt(-diff) + '</span> pro Monat.';
    }
  }

  /* ── Speichern ───────────────────────────────────────────────── */
  function collect() {
    syncActiveRows();
    function num(el) { var v = parseFloat(el.value); return isNaN(v) ? null : v; }
    return {
      lists: lists,
      activeList: activeIdx,
      templates: templates,
      incomeMode: incomeMode,
      income: num(incEl),
      hourly: num(hourlyEl),
      hoursPerWeek: num(hpwEl),
      ref100: num(ref100El),
      pensum: pensum
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }

  function saveNow() {
    try {
      localStorage.setItem(KEY, JSON.stringify(collect()));
      statusEl.textContent = 'Gespeichert · ' + new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      statusEl.textContent = 'Speichern fehlgeschlagen — Werte gelten nur für diese Sitzung.';
    }
  }

  /* ── Budget-Zeilen ───────────────────────────────────────────── */
  function makeRow(name, monthly) {
    var row = document.createElement('div');
    row.className = 'row';

    var nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.className = 'name';
    nameIn.value = name || ''; nameIn.placeholder = 'Posten';

    var mIn = document.createElement('input');
    mIn.type = 'number'; mIn.className = 'm';
    mIn.step = '0.05'; mIn.min = '0'; mIn.inputMode = 'decimal';

    var jIn = document.createElement('input');
    jIn.type = 'number'; jIn.className = 'j';
    jIn.step = '0.05'; jIn.min = '0'; jIn.inputMode = 'decimal';

    if (monthly !== null && monthly !== undefined) {
      mIn.value = r2(monthly);
      jIn.value = r2(monthly * 12);
    }

    var del = document.createElement('button');
    del.className = 'del'; del.textContent = '×';
    del.setAttribute('aria-label', 'Zeile löschen');

    mIn.addEventListener('input', function () {
      var v = parseFloat(mIn.value);
      jIn.value = isNaN(v) ? '' : r2(v * 12);
      recalc(); scheduleSave();
    });
    jIn.addEventListener('input', function () {
      var v = parseFloat(jIn.value);
      mIn.value = isNaN(v) ? '' : r2(v / 12);
      recalc(); scheduleSave();
    });
    nameIn.addEventListener('input', function () { recalc(); scheduleSave(); });
    del.addEventListener('click', function () {
      row.remove(); updateEmptyHint(); recalc(); scheduleSave();
    });

    row.appendChild(nameIn); row.appendChild(mIn); row.appendChild(jIn); row.appendChild(del);
    rowsEl.appendChild(row);
    updateEmptyHint();
  }

  function addFromTemplate(t) {
    makeRow(t.n, t.m);
    recalc(); scheduleSave();
  }

  /* ── Vorlagen ────────────────────────────────────────────────── */
  function renderTemplates() {
    tplListEl.innerHTML = '';
    templates.forEach(function (t, idx) {
      var el = document.createElement('div');
      el.className = 'tpl';
      el.draggable = true;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', t.n + ' zur Liste hinzufügen');

      var grip = document.createElement('span');
      grip.className = 'grip'; grip.textContent = '⠿';

      var name = document.createElement('span');
      name.className = 'tname'; name.textContent = t.n;

      var amt = document.createElement('span');
      amt.className = 'tamt';
      amt.textContent = (t.m !== null && t.m !== undefined) ? r2(t.m).toLocaleString('de-CH') : '';

      var del = document.createElement('button');
      del.className = 'tdel'; del.textContent = '×';
      del.setAttribute('aria-label', 'Vorlage löschen');
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        templates.splice(idx, 1);
        renderTemplates(); scheduleSave();
      });

      el.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', JSON.stringify(t));
        e.dataTransfer.effectAllowed = 'copy';
        el.classList.add('dragging');
      });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); });

      // Antippen/Klick = hinzufügen (funktioniert auch auf dem Handy)
      el.addEventListener('click', function () { addFromTemplate(t); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addFromTemplate(t); }
      });

      el.appendChild(grip); el.appendChild(name); el.appendChild(amt); el.appendChild(del);
      tplListEl.appendChild(el);
    });
  }

  // Drop-Zone: Budget-Liste
  ['dragover', 'dragenter'].forEach(function (ev) {
    rowsEl.addEventListener(ev, function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      rowsEl.classList.add('dragover');
    });
  });
  rowsEl.addEventListener('dragleave', function (e) {
    if (!rowsEl.contains(e.relatedTarget)) rowsEl.classList.remove('dragover');
  });
  rowsEl.addEventListener('drop', function (e) {
    e.preventDefault();
    rowsEl.classList.remove('dragover');
    try {
      var t = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (t && typeof t.n === 'string') addFromTemplate(t);
    } catch (err) { /* kein gültiges Template */ }
  });

  // Neue Vorlage speichern
  document.getElementById('tplAdd').addEventListener('click', function () {
    var nameIn = document.getElementById('tplName');
    var amtIn = document.getElementById('tplAmt');
    var n = nameIn.value.trim();
    if (!n) { nameIn.focus(); return; }
    var m = parseFloat(amtIn.value);
    templates.push({ n: n, m: isNaN(m) ? null : m });
    nameIn.value = ''; amtIn.value = '';
    renderTemplates(); scheduleSave();
    nameIn.focus();
  });
  ['tplName', 'tplAmt'].forEach(function (id) {
    document.getElementById(id).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('tplAdd').click();
    });
  });

  /* ── Render ──────────────────────────────────────────────────── */
  function sanitizeLists(src) {
    var out = [];
    (Array.isArray(src) ? src : []).forEach(function (l) {
      if (!l || typeof l !== 'object') return;
      var rows = Array.isArray(l.rows)
        ? l.rows.filter(function (r) { return r && typeof r === 'object'; })
        : [];
      out.push({
        name: (typeof l.name === 'string' && l.name.trim()) ? l.name : 'Liste',
        rows: rows
      });
    });
    return out;
  }

  function render(state) {
    lists = sanitizeLists(state.lists);
    if (!lists.length) {
      lists = JSON.parse(JSON.stringify(DEFAULT_LISTS));
      // Migration: alte Einzel-Liste landet im ersten Tab
      if (Array.isArray(state.rows) && state.rows.length) lists[0].rows = state.rows;
    }
    activeIdx = (typeof state.activeList === 'number' && state.activeList >= 0 && state.activeList < lists.length)
      ? state.activeList : 0;

    renderTabs();
    renderRows();

    templates = Array.isArray(state.templates) && state.templates.length
      ? state.templates
      : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    renderTemplates();

    incomeMode = state.incomeMode || 'monat';
    pensum = typeof state.pensum === 'number' ? state.pensum : 40;

    function setVal(el, v, fallback) {
      var val = (v !== null && v !== undefined) ? v : fallback;
      el.value = (val !== null && val !== undefined) ? val : '';
    }
    setVal(incEl, state.income, null);
    setVal(hourlyEl, state.hourly, DEFAULTS.hourly);
    setVal(hpwEl, state.hoursPerWeek, DEFAULTS.hoursPerWeek);
    setVal(ref100El, state.ref100, null);

    updateModeUI();
    recalc();
  }

  /* ── Events ──────────────────────────────────────────────────── */
  modeSeg.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      incomeMode = b.getAttribute('data-mode');
      updateModeUI(); recalc(); scheduleSave();
    });
  });

  pensumSeg.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      pensum = parseFloat(b.getAttribute('data-pct'));
      updateModeUI(); recalc(); scheduleSave();
    });
  });

  [incEl, hourlyEl, hpwEl, ref100El].forEach(function (el) {
    el.addEventListener('input', function () { recalc(); scheduleSave(); });
  });

  document.getElementById('addRow').addEventListener('click', function () {
    makeRow('', null); recalc(); scheduleSave();
  });

  document.getElementById('exportPdf').addEventListener('click', function () {
    // Öffnet den Druckdialog — dort "Als PDF speichern" wählen.
    window.print();
  });

  document.getElementById('reset').addEventListener('click', function () {
    if (confirm('Alle Listen leeren und Vorlagen auf den Standard zurücksetzen?')) {
      render(JSON.parse(JSON.stringify(DEFAULTS)));
      scheduleSave();
    }
  });

  /* ── Init ────────────────────────────────────────────────────── */
  var state = null;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { state = null; }
  render(state || JSON.parse(JSON.stringify(DEFAULTS)));
  if (state) statusEl.textContent = 'Gespeicherte Werte geladen.';
})();
