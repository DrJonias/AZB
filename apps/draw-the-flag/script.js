const COUNTRIES = [
  { name: "Germany",        code: "de" },
  { name: "France",         code: "fr" },
  { name: "Italy",          code: "it" },
  { name: "Spain",          code: "es" },
  { name: "Portugal",       code: "pt" },
  { name: "Switzerland",    code: "ch" },
  { name: "Austria",        code: "at" },
  { name: "Netherlands",    code: "nl" },
  { name: "Belgium",        code: "be" },
  { name: "Denmark",        code: "dk" },
  { name: "Sweden",         code: "se" },
  { name: "Norway",         code: "no" },
  { name: "Finland",        code: "fi" },
  { name: "Poland",         code: "pl" },
  { name: "Czech Republic", code: "cz" },
  { name: "Hungary",        code: "hu" },
  { name: "Greece",         code: "gr" },
  { name: "Turkey",         code: "tr" },
  { name: "Ukraine",        code: "ua" },
  { name: "Russia",         code: "ru" },
  { name: "USA",            code: "us" },
  { name: "Canada",         code: "ca" },
  { name: "Mexico",         code: "mx" },
  { name: "Brazil",         code: "br" },
  { name: "Argentina",      code: "ar" },
  { name: "Colombia",       code: "co" },
  { name: "Chile",          code: "cl" },
  { name: "Peru",           code: "pe" },
  { name: "Japan",          code: "jp" },
  { name: "China",          code: "cn" },
  { name: "South Korea",    code: "kr" },
  { name: "India",          code: "in" },
  { name: "Pakistan",       code: "pk" },
  { name: "Bangladesh",     code: "bd" },
  { name: "Nepal",          code: "np" },
  { name: "Bhutan",         code: "bt" },
  { name: "Sri Lanka",      code: "lk" },
  { name: "Thailand",       code: "th" },
  { name: "Vietnam",        code: "vn" },
  { name: "Indonesia",      code: "id" },
  { name: "Philippines",    code: "ph" },
  { name: "Malaysia",       code: "my" },
  { name: "Australia",      code: "au" },
  { name: "New Zealand",    code: "nz" },
  { name: "Kiribati",       code: "ki" },
  { name: "Egypt",          code: "eg" },
  { name: "Nigeria",        code: "ng" },
  { name: "South Africa",   code: "za" },
  { name: "Kenya",          code: "ke" },
  { name: "Morocco",        code: "ma" },
  { name: "Israel",         code: "il" },
  { name: "Saudi Arabia",   code: "sa" },
  { name: "Iran",           code: "ir" },
  { name: "Iraq",           code: "iq" },
];

const PALETTE = [
  "#000000", "#ffffff", "#e63946", "#2196f3",
  "#4caf50", "#ffeb3b", "#ff9800", "#9c27b0",
  "#795548", "#00bcd4",
];

const BRUSH_SIZES = [
  { label: "S",  size: 2,  dot: 7  },
  { label: "M",  size: 5,  dot: 12 },
  { label: "L",  size: 12, dot: 18 },
  { label: "XL", size: 22, dot: 24 },
];

// --- State ---
let currentCountry = null;
let activeColor = "#e63946";
let activeBrush = 5;
let erasing = false;
let drawing = false;
let lastX = 0, lastY = 0;

// --- Elements ---
const canvas   = document.getElementById("drawCanvas");
const ctx      = canvas.getContext("2d");
const nameEl   = document.getElementById("countryName");
const revealEl = document.getElementById("flagReveal");
const flagImg  = document.getElementById("flagImg");
const revealBtn = document.getElementById("revealBtn");
const eraserBtn = document.getElementById("eraserBtn");

// --- Init ---
buildPalette();
buildBrushSizes();
pickCountry();
clearCanvas();

document.getElementById("colorPicker").addEventListener("input", e => {
  setColor(e.target.value);
});

// Wire controls via addEventListener (CSP-safe, unlike inline onclick).
document.getElementById("eraserBtn").addEventListener("click", toggleEraser);
document.getElementById("clearBtn").addEventListener("click", clearCanvas);
document.getElementById("revealBtn").addEventListener("click", revealFlag);
document.getElementById("nextBtn").addEventListener("click", nextCountry);

// --- Canvas drawing ---
canvas.addEventListener("mousedown",  onDown);
canvas.addEventListener("mousemove",  onMove);
canvas.addEventListener("mouseup",    onUp);
canvas.addEventListener("mouseleave", onUp);
canvas.addEventListener("touchstart", onDown, { passive: false });
canvas.addEventListener("touchmove",  onMove, { passive: false });
canvas.addEventListener("touchend",   onUp);

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

function onDown(e) {
  e.preventDefault();
  drawing = true;
  const { x, y } = getPos(e);
  lastX = x; lastY = y;
  // dot on single click
  ctx.beginPath();
  ctx.fillStyle = erasing ? "#ffffff" : activeColor;
  ctx.arc(x, y, currentLineWidth() / 2, 0, Math.PI * 2);
  ctx.fill();
}

function onMove(e) {
  e.preventDefault();
  if (!drawing) return;
  const { x, y } = getPos(e);
  ctx.beginPath();
  ctx.strokeStyle = erasing ? "#ffffff" : activeColor;
  ctx.lineWidth   = currentLineWidth();
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  lastX = x; lastY = y;
}

function onUp() {
  drawing = false;
}

function currentLineWidth() {
  return erasing ? activeBrush * 2.5 : activeBrush;
}

// --- Controls ---
function clearCanvas() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function toggleEraser() {
  erasing = !erasing;
  eraserBtn.classList.toggle("active", erasing);
}

function setColor(c) {
  activeColor = c;
  erasing = false;
  eraserBtn.classList.remove("active");
  document.querySelectorAll(".swatch").forEach(s => {
    s.classList.toggle("active", s.dataset.color === c);
  });
}

function revealFlag() {
  revealEl.classList.remove("hidden");
  revealBtn.classList.add("hidden");
  flagImg.src = `https://flagcdn.com/${currentCountry.code}.svg`;
  flagImg.alt = `Flag of ${currentCountry.name}`;
}

function nextCountry() {
  pickCountry();
  clearCanvas();
  revealEl.classList.add("hidden");
  revealBtn.classList.remove("hidden");
}

// --- Country ---
function pickCountry() {
  const pool = currentCountry
    ? COUNTRIES.filter(c => c !== currentCountry)
    : COUNTRIES;
  currentCountry = pool[Math.floor(Math.random() * pool.length)];
  nameEl.textContent = currentCountry.name;
}

// --- Build UI ---
function buildPalette() {
  const container = document.getElementById("palette");
  PALETTE.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "swatch" + (c === activeColor ? " active" : "");
    btn.dataset.color = c;
    btn.style.background = c;
    if (c === "#ffffff") btn.style.outline = "1.5px solid rgba(255,255,255,0.25)";
    btn.title = c;
    btn.onclick = () => setColor(c);
    container.appendChild(btn);
  });
}

function buildBrushSizes() {
  const container = document.getElementById("brushSizes");
  BRUSH_SIZES.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "brush-btn" + (b.size === activeBrush ? " active" : "");
    btn.title = `Brush ${b.label}`;
    btn.style.width  = (b.dot + 6) + "px";
    btn.style.height = (b.dot + 6) + "px";

    const dot = document.createElement("span");
    dot.className = "brush-dot";
    dot.style.width  = b.dot + "px";
    dot.style.height = b.dot + "px";

    btn.appendChild(dot);
    btn.onclick = () => {
      activeBrush = b.size;
      document.querySelectorAll(".brush-btn").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
    };
    container.appendChild(btn);
  });
}
