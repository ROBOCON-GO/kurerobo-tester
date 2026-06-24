// Gamepad API で DualSense を読み取り、control() に渡す pad オブジェクトに正規化する。
// スティックは -3000〜3000、正方形デッドゾーン ±500、Y軸は上が正(従来仕様に合わせる)。

const RANGE = 3000;
const DEADZONE = 500;

// 標準ゲームパッドマッピングのボタン番号 → 名前(DualSense)
const BUTTON_NAMES = {
  0: ["×", "cross", "x"],
  1: ["○", "circle", "maru"],
  2: ["□", "square", "shikaku"],
  3: ["△", "triangle", "sankaku"],
  4: ["L1"],
  5: ["R1"],
  6: ["L2"],
  7: ["R2"],
  8: ["share", "create"],
  9: ["options"],
  10: ["L3"],
  11: ["R3"],
  12: ["up", "上"],
  13: ["down", "下"],
  14: ["left", "左"],
  15: ["right", "右"],
  16: ["PS"],
};

// 名前 → ボタン番号 の逆引き
const NAME_TO_INDEX = {};
for (const [idx, names] of Object.entries(BUTTON_NAMES)) {
  for (const n of names) NAME_TO_INDEX[n.toLowerCase()] = Number(idx);
}

function scale(axis) {
  const v = Math.round(axis * RANGE);
  return Math.abs(v) < DEADZONE ? 0 : v;
}

export class GamepadReader {
  constructor() {
    this.index = null;
  }

  /** 接続済みの最初のゲームパッドを掴む。掴めたら名前を返す */
  attachFirst() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) {
        this.index = i;
        return pads[i].id;
      }
    }
    this.index = null;
    return null;
  }

  get connected() {
    if (this.index === null) return false;
    const gp = navigator.getGamepads()[this.index];
    return !!(gp && gp.connected);
  }

  /** 現在の入力を pad オブジェクトとして返す。未接続なら null */
  read() {
    if (this.index === null) return null;
    const gp = navigator.getGamepads()[this.index];
    if (!gp) return null;

    const ax = gp.axes;
    const LX = scale(ax[0] ?? 0);
    const LY = scale(-(ax[1] ?? 0)); // 上を正に
    const RX = scale(ax[2] ?? 0);
    const RY = scale(-(ax[3] ?? 0));

    let buttons = 0;
    const pressedArr = gp.buttons.map((b) => b.pressed);
    pressedArr.forEach((p, i) => {
      if (p) buttons |= 1 << i;
    });

    return {
      LX, LY, RX, RY,
      buttons,
      axes: ax,
      raw: gp,
      /** ボタンが押されているか。名前("△","R1"…)か番号で指定 */
      pressed(nameOrIndex) {
        const idx =
          typeof nameOrIndex === "number"
            ? nameOrIndex
            : NAME_TO_INDEX[String(nameOrIndex).toLowerCase()];
        if (idx === undefined) return false;
        return !!pressedArr[idx];
      },
    };
  }
}
