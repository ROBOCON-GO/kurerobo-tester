// control() 編集まわり。ユーザが編集できるのは control(pad, motor) 関数だけ。
// localStorage にソースとプロファイルを保存。new Function でサンドボックス実行。

const LS_SRC = "kurerobo_control_src";
const LS_PROFILES = "kurerobo_profiles";
const LS_CURRENT = "kurerobo_current_profile";

export const DEFAULT_SRC = `// ▼▼▼ ここだけ編集できます（毎フレーム呼ばれる）▼▼▼
// 入力 pad:
//   pad.LX / pad.LY / pad.RX / pad.RY   左右スティック (-3000〜3000, デッドゾーン適用済)
//   pad.pressed("△")  ボタン判定 ("×","○","□","△","L1","R1","L2","R2","up","down"...)
//   pad.buttons       押下ビット列
// 出力 motor:
//   motor.speed(id, rpm)              ロボマス速度 (M2006/M3508)
//   motor.phase(id, 目標, 速度?)       M2006/M3508 速度指定付き位相制御(目標=回転数, -1で停止)
//   motor.gm6020(id, val)             GM6020 速度
//   motor.gm6020Phase(id, deg, 速度?)  GM6020 速度指定付き位相制御(deg=角度, -1で停止)
//   motor.brushed(id, duty)           新モタドラ -999〜999 (0=ブレーキ)
//   motor.pwm(ch, pulse)              PWM (絶縁反転は自動)
//   motor.gpio(state)                 GPIO ビット列
function control(pad, motor) {
  // 例: 4輪オムニ(右スティック全方向 + 左スティックX旋回)
  const o1 = pad.RX - pad.RY + pad.LX;
  const o2 = pad.RX + pad.RY + pad.LX;
  const o3 = -pad.RX + pad.RY + pad.LX;
  const o4 = -pad.RX - pad.RY + pad.LX;
  motor.speed(1, o1);
  motor.speed(2, o2);
  motor.speed(3, o3);
  motor.speed(4, o4);

  // 例: △ボタンで新モタドラID1を回す
  if (pad.pressed("△")) motor.brushed(1, 500);
  else                  motor.brushed(1, 0);

  // 例: ○を押している間 ID5を「5回転」位置へ速度4000で移動(離すと停止)
  if (pad.pressed("○")) motor.phase(5, 5, 4000);
  else                  motor.phase(5, -1);   // -1 = 無効(その場で止める)

  // 例: ×を押している間 GM6020 ID1を90度へ速度500で(離すと停止)
  if (pad.pressed("×")) motor.gm6020Phase(1, 90, 500);
  else                  motor.gm6020Phase(1, -1);
}
// ▲▲▲ ここまで ▲▲▲`;

export function loadSrc() {
  return localStorage.getItem(LS_SRC) ?? DEFAULT_SRC;
}
export function saveSrc(src) {
  localStorage.setItem(LS_SRC, src);
}

/**
 * ソースをコンパイルして runner(pad, motor) を返す。
 * 構文エラー時は例外を投げる。
 */
export function compile(src) {
  // src 内で function control(pad, motor){...} を定義 → それを呼ぶ
  const factory = new Function(
    "pad",
    "motor",
    `"use strict";\n${src}\n;return control(pad, motor);`
  );
  // 軽く検証(ダミー入力で1回実行)
  const dummyPad = {
    LX: 0, LY: 0, RX: 0, RY: 0, buttons: 0, axes: [], raw: null,
    pressed: () => false,
  };
  const noop = {
    speed() {}, phase() {}, drive() {}, gm6020() {}, gm6020Phase() {},
    pwm() {}, brushed() {}, gpio() {},
  };
  factory(dummyPad, noop); // 例外が出ればここで投げる
  return factory;
}

// ── プロファイル(名前付きソース)管理 ──
export function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem(LS_PROFILES) || "{}");
  } catch {
    return {};
  }
}
export function saveProfile(name, src) {
  const p = getProfiles();
  p[name] = src;
  localStorage.setItem(LS_PROFILES, JSON.stringify(p));
  localStorage.setItem(LS_CURRENT, name);
}
export function deleteProfile(name) {
  const p = getProfiles();
  delete p[name];
  localStorage.setItem(LS_PROFILES, JSON.stringify(p));
}
export function currentProfile() {
  return localStorage.getItem(LS_CURRENT) || "";
}
export function setCurrentProfile(name) {
  localStorage.setItem(LS_CURRENT, name);
}
