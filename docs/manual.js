// ② 手動テストタブ: スライダー/トグルで各モーター・PWM・GPIOを直接操作(ノーコード)。

import { Frame } from "./robomas.js";
import { config } from "./config.js";

// kind: speed=ロボマス速度 / gm6020=GM6020速度 / brushed=新モタドラ / pwm=PWM
const SECTIONS = [
  { grp: "grp-robomas", kind: "speed", ids: [1, 2, 3, 4, 5, 6, 7, 8], min: -8000, max: 8000, step: 100 },
  { grp: "grp-gm6020", kind: "gm6020", ids: [1, 2, 3, 4, 5, 6, 7], min: -1000, max: 1000, step: 50 },
  { grp: "grp-brushed", kind: "brushed", ids: [1, 2, 3, 4, 5, 6, 7, 8], min: -999, max: 999, step: 10, hasReset: true },
  { grp: "grp-pwm", kind: "pwm", ids: [1, 2, 3, 4, 5, 6], min: 0, max: 20000, step: 100 },
];

const rows = [];
let gpioBits = 0; // GPIO 出力ビット列

export function initManual() {
  for (const sec of SECTIONS) {
    const container = document.querySelector(`#${sec.grp} .rows`);
    if (!container) continue;
    for (const id of sec.ids) {
      container.appendChild(buildRow(sec, id));
    }
  }
  buildGpio();

  // PWM 絶縁反転チェックボックス → config に反映
  const inv = document.getElementById("pwm-invert");
  if (inv) {
    inv.checked = config.pwmInvert;
    inv.addEventListener("change", () => (config.pwmInvert = inv.checked));
  }
}

function buildRow(sec, id) {
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
  let resetBtn = null;
  if (sec.hasReset) {
    resetBtn = document.createElement("button");
    resetBtn.className = "mini";
    resetBtn.textContent = "原点リセット";
    resetBtn.disabled = true;
    resetBtn.addEventListener("click", () => (rec.resetPending = true));
    tail.appendChild(resetBtn);
  }

  row.append(en, label, range, val, tail);

  const rec = { kind: sec.kind, id, en, range, val, resetBtn, resetPending: false };

  en.addEventListener("change", () => {
    const on = en.checked;
    range.disabled = !on;
    if (resetBtn) resetBtn.disabled = !on;
    row.classList.toggle("disabled", !on);
    if (!on) {
      range.value = 0;
      val.textContent = "0";
    }
  });
  range.addEventListener("input", () => (val.textContent = range.value));

  rows.push(rec);
  return row;
}

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
      const out = document.getElementById("gpio-val");
      if (out) out.textContent = "0x" + (gpioBits & 0xffff).toString(16).toUpperCase().padStart(4, "0");
    });
    lbl.append(cb, document.createTextNode(` bit${bit}`));
    container.appendChild(lbl);
  }
}

/** 現在のUI状態から送信フレームを組み立てる(全停止時は値0で構築) */
export function buildManualFrame(forceZero = false) {
  const f = new Frame();
  for (const rec of rows) {
    if (!rec.en.checked) continue;
    const v = forceZero ? 0 : parseInt(rec.range.value, 10) || 0;
    if (rec.kind === "speed") f.driveSpeed(rec.id, v);
    else if (rec.kind === "gm6020") f.gm6020Speed(rec.id, v);
    else if (rec.kind === "brushed") {
      f.brushed(rec.id, v, { resetEnc: rec.resetPending });
      rec.resetPending = false;
    } else if (rec.kind === "pwm") {
      f.pwm(rec.id, config.pwmInvert ? 20000 - v : v);
    }
  }
  if (gpioBits) f.gpio(gpioBits);
  return f;
}

/** 全停止: スライダーを0に戻す(GPIOは保持) */
export function zeroManual() {
  for (const rec of rows) {
    rec.range.value = 0;
    rec.val.textContent = "0";
  }
}
