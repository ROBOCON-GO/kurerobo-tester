// ② 手動テストタブ: スライダー/トグルで各モーター・PWM・GPIOを直接操作(ノーコード)。
// ・出力増減をキーボードの任意キーにバインド可能
// ・全停止中は 0 を送る(駆動停止)が、スライダー値は記憶し解除で復元

import { Frame } from "./robomas.js";
import { config } from "./config.js";

const LS_BINDS = "kurerobo_manual_keybinds";

// kind: speed=ロボマス速度 / gm6020=GM6020速度 / brushed=新モタドラ / pwm=PWM
// keyStep: キー1押下あたりの増減量
const SECTIONS = [
  { grp: "grp-robomas", kind: "speed", ids: [1, 2, 3, 4, 5, 6, 7, 8], min: -8000, max: 8000, step: 100, keyStep: 500 },
  { grp: "grp-gm6020", kind: "gm6020", ids: [1, 2, 3, 4, 5, 6, 7], min: -1000, max: 1000, step: 50, keyStep: 100 },
  { grp: "grp-brushed", kind: "brushed", ids: [1, 2, 3, 4, 5, 6, 7, 8], min: -999, max: 999, step: 10, keyStep: 50 },
  { grp: "grp-pwm", kind: "pwm", ids: [1, 2, 3, 4, 5, 6], min: 0, max: 20000, step: 100, keyStep: 500 },
];

const rows = [];
const gpioToggles = []; // {bit, cb}
let gpioBits = 0;
let savedGpio = 0;
let estopped = false;
let capturing = null; // {rec, dir, btn}
let binds = loadBinds(); // { "speed-1": { up:"w", down:"s" }, ... }

export function initManual() {
  for (const sec of SECTIONS) {
    const container = document.querySelector(`#${sec.grp} .rows`);
    if (!container) continue;
    for (const id of sec.ids) container.appendChild(buildRow(sec, id));
  }
  buildGpio();

  const inv = document.getElementById("pwm-invert");
  if (inv) {
    inv.checked = config.pwmInvert;
    inv.addEventListener("change", () => (config.pwmInvert = inv.checked));
  }

  document.addEventListener("keydown", onKeyDown);
}

// ── 行(モーター/PWM)の生成 ──
function buildRow(sec, id) {
  const key = `${sec.kind}-${id}`;
  const row = document.createElement("div");
  row.className = "row disabled";

  const en = document.createElement("input");
  en.type = "checkbox";
  en.className = "en";

  const label = document.createElement("label");
  label.className = "id";
  label.textContent = sec.kind === "pwm" ? `ch${id}` : `ID${id}`;

  const range = document.createElement("input");
  range.type = "range";
  range.min = sec.min;
  range.max = sec.max;
  range.step = sec.step;
  range.value = 0;
  range.disabled = true;

  const val = document.createElement("span");
  val.className = "val";
  val.textContent = "0";

  const tail = document.createElement("span");
  tail.className = "tail";

  const rec = {
    kind: sec.kind, id, key, en, range, val,
    keyStep: sec.keyStep, min: sec.min, max: sec.max,
    saved: 0,
  };

  // キーバインド用ボタン(▲増 / ▼減)
  rec.upBtn = makeKeyBtn(rec, "up");
  rec.downBtn = makeKeyBtn(rec, "down");
  tail.append(rec.upBtn, rec.downBtn);

  row.append(en, label, range, val, tail);

  en.addEventListener("change", () => setRowEnabled(rec, en.checked));
  range.addEventListener("input", () => (val.textContent = range.value));

  rows.push(rec);
  return row;
}

function makeKeyBtn(rec, dir) {
  const btn = document.createElement("button");
  btn.className = "keybtn";
  btn.title = dir === "up" ? "増やすキーを割り当て(クリック→キー)" : "減らすキーを割り当て(クリック→キー)";
  refreshKeyBtn(btn, dir, binds[rec.key] && binds[rec.key][dir]);
  btn.addEventListener("click", () => startCapture(rec, dir, btn));
  return btn;
}

function refreshKeyBtn(btn, dir, key) {
  const arrow = dir === "up" ? "▲" : "▼";
  btn.textContent = key ? `${arrow} ${displayKey(key)}` : `${arrow} —`;
}

function setRowEnabled(rec, on) {
  rec.range.disabled = !on || estopped;
  rec.range.parentElement.classList.toggle("disabled", !on);
  if (!on) {
    rec.range.value = 0;
    rec.val.textContent = "0";
  }
}

// ── GPIO ──
function buildGpio() {
  const container = document.querySelector("#grp-gpio .rows");
  if (!container) return;
  for (let bit = 0; bit < 8; bit++) {
    const lbl = document.createElement("label");
    lbl.className = "gpio-toggle";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) gpioBits |= 1 << bit;
      else gpioBits &= ~(1 << bit);
      updateGpioVal();
    });
    lbl.append(cb, document.createTextNode(` bit${bit}`));
    container.appendChild(lbl);
    gpioToggles.push({ bit, cb });
  }
}
function updateGpioVal() {
  const out = document.getElementById("gpio-val");
  if (out) out.textContent = "0x" + (gpioBits & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// ── キーボード ──
function startCapture(rec, dir, btn) {
  capturing = { rec, dir, btn };
  btn.textContent = "キーを押す…";
  btn.classList.add("capturing");
}

function onKeyDown(e) {
  // キャプチャ中: 押されたキーを割り当て(Escでキャンセル)
  if (capturing) {
    e.preventDefault();
    const { rec, dir, btn } = capturing;
    if (e.key !== "Escape") {
      const k = normKey(e.key);
      // 同じキーの他バインドを解除(重複防止)
      for (const id of Object.keys(binds)) {
        if (binds[id].up === k) delete binds[id].up;
        if (binds[id].down === k) delete binds[id].down;
      }
      binds[rec.key] = binds[rec.key] || {};
      binds[rec.key][dir] = k;
      saveBinds();
      refreshAllKeyBtns();
    }
    btn.classList.remove("capturing");
    refreshKeyBtn(btn, dir, binds[rec.key] && binds[rec.key][dir]);
    btn.blur();
    capturing = null;
    return;
  }

  // 入力欄にフォーカス中はキー操作を奪わない
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  if (estopped) return;

  const k = normKey(e.key);
  for (const rec of rows) {
    const b = binds[rec.key];
    if (!b) continue;
    if (b.up === k) {
      e.preventDefault();
      bump(rec, +rec.keyStep);
      return;
    }
    if (b.down === k) {
      e.preventDefault();
      bump(rec, -rec.keyStep);
      return;
    }
  }
}

function bump(rec, delta) {
  if (!rec.en.checked) {
    rec.en.checked = true;
    setRowEnabled(rec, true);
  }
  const cur = parseInt(rec.range.value, 10) || 0;
  const v = Math.max(rec.min, Math.min(rec.max, cur + delta));
  rec.range.value = v;
  rec.val.textContent = v;
}

function refreshAllKeyBtns() {
  for (const rec of rows) {
    refreshKeyBtn(rec.upBtn, "up", binds[rec.key] && binds[rec.key].up);
    refreshKeyBtn(rec.downBtn, "down", binds[rec.key] && binds[rec.key].down);
  }
}

function normKey(key) {
  if (key === " ") return " ";
  return key.length === 1 ? key.toLowerCase() : key;
}
function displayKey(k) {
  const map = { " ": "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };
  return map[k] || (k.length === 1 ? k.toUpperCase() : k);
}
function loadBinds() {
  try {
    return JSON.parse(localStorage.getItem(LS_BINDS) || "{}");
  } catch {
    return {};
  }
}
function saveBinds() {
  localStorage.setItem(LS_BINDS, JSON.stringify(binds));
}

// ── 全停止(記憶付き) ──
// on: スライダー/GPIOを0表示にし、元値を記憶。off: 復元。
export function setEstop(on) {
  estopped = on;
  if (on) {
    for (const rec of rows) {
      rec.saved = parseInt(rec.range.value, 10) || 0;
      rec.range.value = 0;
      rec.val.textContent = "0";
      rec.range.disabled = true;
    }
    savedGpio = gpioBits;
    gpioBits = 0;
    for (const g of gpioToggles) g.cb.disabled = true;
    updateGpioVal();
  } else {
    for (const rec of rows) {
      rec.range.value = rec.saved;
      rec.val.textContent = rec.saved;
      rec.range.disabled = !rec.en.checked;
    }
    gpioBits = savedGpio;
    for (const g of gpioToggles) {
      g.cb.disabled = false;
      g.cb.checked = !!(gpioBits & (1 << g.bit));
    }
    updateGpioVal();
  }
}

// ── 送信フレーム生成 ──
// forceZero=true で全出力0(全停止中)。GPIOは毎回現在値を送る(0で確実にOFF)。
export function buildManualFrame(forceZero = false) {
  const f = new Frame();
  for (const rec of rows) {
    if (!rec.en.checked) continue;
    const v = forceZero ? 0 : parseInt(rec.range.value, 10) || 0;
    if (rec.kind === "speed") f.driveSpeed(rec.id, v);
    else if (rec.kind === "gm6020") f.gm6020Speed(rec.id, v);
    else if (rec.kind === "brushed") f.brushed(rec.id, v);
    else if (rec.kind === "pwm") f.pwm(rec.id, config.pwmInvert ? 20000 - v : v);
  }
  f.gpio(forceZero ? 0 : gpioBits);
  return f;
}
