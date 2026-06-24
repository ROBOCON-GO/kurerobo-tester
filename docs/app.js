// オーケストレータ: 接続管理 / タブ / 50msハートビート(手動・操縦を切替送信) / 全停止。

import { SerialTransport } from "./transport.js";
import { toHex } from "./cobs.js";
import { initManual, buildManualFrame, zeroManual } from "./manual.js";
import { initOperate, buildOperateFrame } from "./operate.js";

const transport = new SerialTransport();
let estop = false;

// ── 接続 ──
const connectBtn = document.getElementById("connect-btn");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

function setConnectedUI(on) {
  statusDot.classList.toggle("on", on);
  statusDot.classList.toggle("off", !on);
  statusText.textContent = on ? "接続中" : "未接続";
  connectBtn.textContent = on ? "切断" : "接続";
}

connectBtn.addEventListener("click", async () => {
  if (transport.connected) {
    stopHeartbeat();
    await transport.disconnect();
    return;
  }
  try {
    await transport.connect();
    setConnectedUI(true);
    startHeartbeat();
  } catch (e) {
    alert("接続に失敗しました:\n" + e.message);
  }
});

transport.onDisconnect = () => {
  stopHeartbeat();
  setConnectedUI(false);
};
// 受信(メインボードからのGPIO割込フィードバック等)。今は未使用。
// 大量受信時のconsole.log氾濫を避けるため既定では何もしない。
transport.onData = () => {};

// ── 全停止(トグル) ──
const stopBtn = document.getElementById("stop-btn");
stopBtn.addEventListener("click", () => {
  estop = !estop;
  if (estop) {
    zeroManual(); // 手動はスライダーを0へ
    stopBtn.textContent = "▶ 停止中(クリックで再開)";
    stopBtn.classList.add("active");
  } else {
    stopBtn.textContent = "■ 全停止";
    stopBtn.classList.remove("active");
  }
});

// ── ハートビート送信(自己スケジュール方式:1回送り終えてから次を予約=絶対に重ならない) ──
const SEND_PERIOD_MS = 50;
let running = false; // 送信ループ稼働中
let sentInWindow = 0;
let lastRateAt = 0;
let writeFails = 0; // 連続送信失敗カウント

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startHeartbeat() {
  if (running) return;
  running = true;
  sentInWindow = 0;
  lastRateAt = performance.now();
  writeFails = 0;
  loop();
}
function stopHeartbeat() {
  running = false;
}

async function loop() {
  while (running) {
    const t0 = performance.now();
    if (transport.connected && !estop) {
      try {
        await sendOnce();
      } catch (e) {
        console.error(e);
      }
    }
    // 1回分の処理時間を差し引いて待つ(処理が長引いても次が重ならない)
    const elapsed = performance.now() - t0;
    await sleep(Math.max(0, SEND_PERIOD_MS - elapsed));
  }
}

function activeTab() {
  const t = document.querySelector(".tab.active");
  return t ? t.dataset.tab : "manual";
}

// write が固まっても ms で諦める。タイマーは必ず後始末する(孤児タイマー防止)。
function writeWithTimeout(bytes, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("write timeout")), ms);
  });
  return Promise.race([transport.write(bytes), timeout]).finally(() => clearTimeout(timer));
}

async function sendOnce() {
  const tab = activeTab();
  let frame = null;
  if (tab === "manual") frame = buildManualFrame();
  else if (tab === "operate") frame = buildOperateFrame();
  // flash タブでは送信しない

  if (tab === "manual") {
    document.getElementById("cmdcount").textContent = frame ? frame.count : 0;
  }
  if (!frame || frame.isEmpty()) return;

  const bytes = frame.encode();
  try {
    await writeWithTimeout(bytes, 1000);
    writeFails = 0;
    sentInWindow++;
    const lf = document.getElementById("lastframe");
    if (lf && tab === "manual") lf.textContent = toHex(bytes);
  } catch (e) {
    writeFails++;
    // 連続失敗 = 接続が切れたとみなして自動切断(送信の積み上がりを止める)
    if (writeFails >= 10) {
      console.warn("送信が連続失敗したため切断します:", e?.message || e);
      stopHeartbeat();
      transport.disconnect();
      return;
    }
  }

  const now = performance.now();
  if (now - lastRateAt >= 1000) {
    const rate = document.getElementById("rate");
    if (rate) rate.textContent = Math.round((sentInWindow * 1000) / (now - lastRateAt));
    sentInWindow = 0;
    lastRateAt = now;
  }
}

// ── タブ切り替え ──
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ── 起動 ──
if (!SerialTransport.supported) {
  connectBtn.disabled = true;
  statusText.textContent = "Web Serial 非対応ブラウザ";
  alert("このブラウザは Web Serial に非対応です。Chrome または Edge で開いてください。");
}

console.log("KureRobo Tester build: heartbeat-v2 (self-scheduling send loop)");
initManual();
initOperate();
setConnectedUI(false);

// タブ離脱(ウィンドウ非アクティブ)時は送信停止(安全)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopHeartbeat();
  else if (transport.connected) startHeartbeat();
});
