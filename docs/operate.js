// ③ 操縦タブ: DualSense(Gamepad API) + 編集可能な control() でロボットを動かす。

import { Frame, makeMotor } from "./robomas.js";
import { config } from "./config.js";
import { GamepadReader } from "./gamepad.js";
import * as editor from "./editor.js";

const pad = new GamepadReader();
let runner = null; // コンパイル済み control()
let lastError = null;

export function initOperate() {
  const srcEl = document.getElementById("control-src");
  const applyBtn = document.getElementById("control-apply");
  const statusEl = document.getElementById("control-status");
  const padBtn = document.getElementById("pad-btn");
  const padStatus = document.getElementById("pad-status");
  const profileSel = document.getElementById("profile-select");
  const saveBtn = document.getElementById("profile-save");
  const exportBtn = document.getElementById("profile-export");
  const importInput = document.getElementById("profile-import");

  // 初期ソース
  srcEl.value = editor.loadSrc();

  const setStatus = (msg, ok) => {
    statusEl.textContent = msg;
    statusEl.className = "status " + (ok ? "ok" : "err");
  };

  const apply = () => {
    const src = srcEl.value;
    try {
      runner = editor.compile(src);
      editor.saveSrc(src);
      lastError = null;
      setStatus("✓ 適用しました", true);
    } catch (e) {
      runner = null;
      setStatus("✗ エラー: " + e.message, false);
    }
  };

  applyBtn.addEventListener("click", apply);
  apply(); // 起動時にコンパイル

  // ── ゲームパッド接続 ──
  padBtn.addEventListener("click", () => {
    const id = pad.attachFirst();
    padStatus.textContent = id ? "接続: " + id : "見つかりません(ボタンを押してから再試行)";
  });
  window.addEventListener("gamepadconnected", (e) => {
    if (pad.index === null) {
      pad.attachFirst();
      padStatus.textContent = "接続: " + e.gamepad.id;
    }
  });

  // ── プロファイル ──
  const refreshProfiles = () => {
    const profiles = editor.getProfiles();
    const cur = editor.currentProfile();
    profileSel.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(未保存)";
    profileSel.appendChild(blank);
    for (const name of Object.keys(profiles)) {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      if (name === cur) o.selected = true;
      profileSel.appendChild(o);
    }
  };
  refreshProfiles();

  profileSel.addEventListener("change", () => {
    const profiles = editor.getProfiles();
    const name = profileSel.value;
    if (name && profiles[name] !== undefined) {
      srcEl.value = profiles[name];
      editor.setCurrentProfile(name);
      apply();
    }
  });

  saveBtn.addEventListener("click", () => {
    const name = prompt("プロファイル名を入力:", editor.currentProfile() || "新規プロファイル");
    if (!name) return;
    editor.saveProfile(name, srcEl.value);
    refreshProfiles();
    setStatus(`✓ 「${name}」を保存しました`, true);
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([srcEl.value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (editor.currentProfile() || "control") + ".js";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    srcEl.value = await file.text();
    apply();
    importInput.value = "";
  });

  // ライブ表示の定期更新
  setInterval(updateLive, 100);
}

function updateLive() {
  const live = document.getElementById("pad-live");
  if (!live) return;
  const p = pad.read();
  if (!p) {
    live.textContent = "コントローラ未接続";
    return;
  }
  const names = ["×", "○", "□", "△", "L1", "R1", "L2", "R2", "share", "options", "L3", "R3", "↑", "↓", "←", "→"];
  const pressed = names.filter((_, i) => (p.buttons >> i) & 1);
  live.textContent =
    `LX=${p.LX} LY=${p.LY} RX=${p.RX} RY=${p.RY}  ` +
    `押下: ${pressed.length ? pressed.join(" ") : "なし"}`;
}

/** 操縦フレームを組み立てる。未接続/未コンパイル/例外時は null */
export function buildOperateFrame(forceZero = false) {
  if (forceZero) return new Frame(); // 空=送らない→安全リセット
  const p = pad.read();
  if (!p || !runner) return null;
  const frame = new Frame();
  const motor = makeMotor(frame, config.pwmInvert);
  try {
    runner(p, motor);
    lastError = null;
  } catch (e) {
    if (lastError !== e.message) {
      lastError = e.message;
      const statusEl = document.getElementById("control-status");
      if (statusEl) {
        statusEl.textContent = "✗ 実行時エラー: " + e.message + "(送信停止)";
        statusEl.className = "status err";
      }
    }
    return null; // エラー時は送らない→モーター停止
  }
  return frame;
}
