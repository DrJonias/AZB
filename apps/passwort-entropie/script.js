const pwInput = document.getElementById('pw-input');
const toggleBtn = document.getElementById('toggle-visibility');
const entropyNumber = document.getElementById('entropy-number');
const strengthLabel = document.getElementById('strength-label');
const strengthFill = document.getElementById('strength-fill');
const chipLower = document.getElementById('chip-lower');
const chipUpper = document.getElementById('chip-upper');
const chipDigits = document.getElementById('chip-digits');
const chipSymbol = document.getElementById('chip-symbol');
const timeOnline = document.getElementById('time-online');
const timeFast = document.getElementById('time-fast');
const timeGpu = document.getElementById('time-gpu');
const timeCluster = document.getElementById('time-cluster');

const speeds = {
  online: 1e3,
  fast: 1e8,
  gpu: 1e11,
  cluster: 1e14,
};

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  const days = hours / 24;
  if (days < 365) return `${days.toFixed(1)} d`;
  const years = days / 365;
  if (years < 1e6) return `${years.toFixed(1)} Jahre`;
  return `~${Math.round(years).toLocaleString()} Jahre`;
}

function getCharPool(password) {
  const has = { lower: false, upper: false, digits: false, symbol: false };
  for (const ch of password) {
    if (/[a-z]/.test(ch)) has.lower = true;
    else if (/[A-Z]/.test(ch)) has.upper = true;
    else if (/[0-9]/.test(ch)) has.digits = true;
    else has.symbol = true;
  }

  const pool = (has.lower ? 26 : 0) + (has.upper ? 26 : 0) + (has.digits ? 10 : 0) + (has.symbol ? 32 : 0);
  return { pool, has };
}

function computeEntropy(password) {
  const { pool, has } = getCharPool(password);
  const entropy = password.length && pool > 0 ? password.length * Math.log2(pool) : 0;
  return { entropy, has, pool };
}

function updateStrength(entropy) {
  const levels = [0, 40, 60, 80, 100];
  const label = entropy < levels[1] ? 'Sehr schwach' : entropy < levels[2] ? 'Schwach' : entropy < levels[3] ? 'Mittel' : entropy < levels[4] ? 'Stark' : 'Sehr stark';
  const percent = Math.min(100, Math.max(0, (entropy / 100) * 100));
  return { label, percent };
}

function updateUI() {
  const password = pwInput.value.trim();
  const { entropy, has } = computeEntropy(password);
  entropyNumber.textContent = entropy ? entropy.toFixed(1) : '—';

  const { label, percent } = updateStrength(entropy);
  strengthLabel.textContent = entropy ? label : '—';
  strengthFill.style.width = entropy ? `${percent}%` : '0%';
  strengthFill.style.background = percent < 30 ? '#ff6b6b' : percent < 60 ? '#ffb748' : percent < 85 ? '#64d58f' : '#7d9bff';

  chipLower.classList.toggle('active', has.lower);
  chipUpper.classList.toggle('active', has.upper);
  chipDigits.classList.toggle('active', has.digits);
  chipSymbol.classList.toggle('active', has.symbol);

  const time = password.length && entropy ? 2 ** entropy : 0;
  timeOnline.textContent = password ? formatDuration(time / speeds.online) : '—';
  timeFast.textContent = password ? formatDuration(time / speeds.fast) : '—';
  timeGpu.textContent = password ? formatDuration(time / speeds.gpu) : '—';
  timeCluster.textContent = password ? formatDuration(time / speeds.cluster) : '—';
}

pwInput.addEventListener('input', updateUI);

let visible = false;
toggleBtn.addEventListener('click', () => {
  visible = !visible;
  pwInput.type = visible ? 'text' : 'password';
  toggleBtn.textContent = visible ? '🙈' : '👁️';
});

updateUI();
