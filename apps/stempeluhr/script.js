const STORE_KEY = 'stempeluhr';

const els = {
  clockIn: document.getElementById('clockIn'),
  clockOut: document.getElementById('clockOut'),
  breakMin: document.getElementById('breakMin'),
  weekHours: document.getElementById('weekHours'),
  dailyTarget: document.getElementById('dailyTarget'),
  resultEmpty: document.getElementById('resultEmpty'),
  resultEnd: document.getElementById('resultEnd'),
  resultOvertime: document.getElementById('resultOvertime'),
  endTime: document.getElementById('endTime'),
  countdown: document.getElementById('countdown'),
  progressBar: document.getElementById('progressBar'),
  progressCaption: document.getElementById('progressCaption'),
  workedTime: document.getElementById('workedTime'),
  overtime: document.getElementById('overtime'),
  overtimeNote: document.getElementById('overtimeNote'),
};

// ── Time helpers (minutes since midnight) ─────────────────────────
function parseTime(value) {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function formatClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function formatDuration(minutes) {
  const abs = Math.abs(Math.round(minutes));
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function dailyTargetMinutes() {
  const week = parseFloat(els.weekHours.value) || 42;
  return Math.round((week / 5) * 60);
}

// ── Persistence: keep today's stamps, reset on a new day ──────────
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    date: new Date().toDateString(),
    clockIn: els.clockIn.value,
    clockOut: els.clockOut.value,
    breakMin: els.breakMin.value,
    weekHours: els.weekHours.value,
  }));
}

function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return; }
  if (!data) return;
  // Settings survive across days, stamps only for today
  if (data.breakMin) els.breakMin.value = data.breakMin;
  if (data.weekHours) els.weekHours.value = data.weekHours;
  if (data.date === new Date().toDateString()) {
    if (data.clockIn) els.clockIn.value = data.clockIn;
    if (data.clockOut) els.clockOut.value = data.clockOut;
  }
}

// ── Rendering ─────────────────────────────────────────────────────
function show(block) {
  [els.resultEmpty, els.resultEnd, els.resultOvertime].forEach(el =>
    el.classList.toggle('hidden', el !== block));
}

function update() {
  const target = dailyTargetMinutes();
  els.dailyTarget.textContent = formatDuration(target);

  const start = parseTime(els.clockIn.value);
  const breakMin = Math.max(0, parseInt(els.breakMin.value, 10) || 0);

  if (start === null) { show(els.resultEmpty); return; }

  let end = parseTime(els.clockOut.value);
  if (end !== null) {
    if (end < start) end += 1440; // over midnight
    const worked = Math.max(0, end - start - breakMin);
    const diff = worked - target;
    els.workedTime.textContent = `${formatDuration(worked)} h (Pause: ${breakMin} Min.)`;
    els.overtime.textContent = `${diff < 0 ? '−' : '+'}${formatDuration(diff)} h`;
    els.overtime.className = 'big-time ' + (diff >= 0 ? 'positive' : 'negative');
    els.overtimeNote.textContent = diff >= 0
      ? 'Soll erfüllt — schönen Feierabend! 🎉'
      : `Es fehlen noch ${formatDuration(-diff)} h zum Tagessoll.`;
    show(els.resultOvertime);
    return;
  }

  // No clock-out yet → show projected end of day
  const endOfDay = start + target + breakMin;
  els.endTime.textContent = `${formatClock(endOfDay)} Uhr`;

  const now = nowMinutes() + (nowMinutes() < start ? 1440 : 0);
  const remaining = endOfDay - now;
  const progress = Math.min(1, Math.max(0, (now - start) / (endOfDay - start)));
  els.progressBar.style.width = `${(progress * 100).toFixed(1)}%`;
  els.progressBar.classList.toggle('done', remaining <= 0);

  if (remaining > 0) {
    els.countdown.textContent = `noch ${formatDuration(remaining)} h`;
    els.progressCaption.textContent = `${Math.round(progress * 100)} % des Tages geschafft`;
  } else {
    els.countdown.textContent = `Feierabend! Bereits ${formatDuration(-remaining)} h Überstunden heute.`;
    els.progressCaption.textContent = '100 % — Zeit zu gehen 🏃';
  }
  show(els.resultEnd);
}

function onChange() { save(); update(); }

document.getElementById('stampInBtn').addEventListener('click', () => {
  els.clockIn.value = formatClock(nowMinutes());
  onChange();
});
document.getElementById('stampOutBtn').addEventListener('click', () => {
  els.clockOut.value = formatClock(nowMinutes());
  onChange();
});
document.getElementById('clearOutBtn').addEventListener('click', () => {
  els.clockOut.value = '';
  onChange();
});
[els.clockIn, els.clockOut, els.breakMin, els.weekHours].forEach(el =>
  el.addEventListener('input', onChange));

load();
update();
setInterval(update, 30 * 1000); // keep countdown fresh
