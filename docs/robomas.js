// mawarudokusute(メインボード)向けコマンド生成。
// 1コマンド = 3バイト [command, 値上位8bit, 値下位8bit]。
// n個ためて COBS エンコードし、3n+2 バイトのフレームを作る。
//
// コマンド割り当て(メインボード仕様書 / 新モタドラ仕様書より):
//   0-7    M2006/M3508 速度制御 (ID1-8)       cmd = id-1
//   8-15   GM6020 速度制御 (ID1-7)            cmd = 7+id
//   16-31  PWM出力 (16ch)  ※旧drivePWM互換は cmd = 25+channel
//   32-35  どくすて操舵角度 (ID1-4)           cmd = 31+id
//   36-39  どくすて主輪速度 (ID1-4)           cmd = 35+id
//   40-47  シン位相制御 M2006/M3508 (ID1-8)   cmd = 39+id
//   48-55  シン位相 速度設定 M系 (ID1-8)      cmd = 47+id
//   56-63  シン位相制御 GM6020 (ID1-7)        cmd = 55+id
//   64-71  シン位相 速度設定 GM6020 (ID1-7)   cmd = 63+id
//   72-79  新モタドラ(CAN直結) (ID1-8)        cmd = 71+id  ← 今回追加
//   254    GPIO

import { cobsEncode } from "./cobs.js";

export class Frame {
  constructor() {
    /** @type {number[]} エンコード前データ(3バイト×n) */
    this.buf = [];
  }

  /** 生コマンド追加。value は int16/uint16 として上位・下位の順に格納 */
  raw(command, value) {
    const v = value & 0xffff;
    this.buf.push(command & 0xff, (v >> 8) & 0xff, v & 0xff);
    return this;
  }

  // ── ロボマス M2006/M3508 ──
  /** 速度制御 [rpm] (cmd 0-7)。-1(0xFFFF)で自由回転 */
  driveSpeed(id, rpm) {
    if (id >= 1 && id <= 8) this.raw(id - 1, rpm);
    return this;
  }
  /** シン位相制御 目標角 (cmd 40-47)。0xFFFFで無効(その場停止) */
  drivePhase(id, target) {
    if (id >= 1 && id <= 8) this.raw(39 + id, target);
    return this;
  }
  /** シン位相 回転速度設定 M系 (cmd 48-55) */
  drivePhaseSpeed(id, speed) {
    if (id >= 1 && id <= 8) this.raw(47 + id, speed);
    return this;
  }
  /** 旧 .ino の driveMotor 互換: phaseMode=true→位相, false→速度 */
  driveMotor(id, phaseMode, target) {
    return phaseMode ? this.drivePhase(id, target) : this.driveSpeed(id, target);
  }

  // ── GM6020 ──
  /** GM6020 速度制御 (cmd 8-15, ID1-7) */
  gm6020Speed(id, val) {
    if (id >= 1 && id <= 7) this.raw(7 + id, val);
    return this;
  }
  /** GM6020 シン位相制御 目標角[deg] (cmd 56-63, ID1-7) */
  gm6020Phase(id, deg) {
    if (id >= 1 && id <= 7) this.raw(55 + id, deg);
    return this;
  }
  /** GM6020 シン位相 速度設定 (cmd 64-71, ID1-7) */
  gm6020PhaseSpeed(id, speed) {
    if (id >= 1 && id <= 7) this.raw(63 + id, speed);
    return this;
  }

  // ── PWM (旧 drivePWM 互換: cmd = 25+channel) ──
  /** PWM出力。channel 1-16, pulse[us] 0-20000 */
  pwm(channel, pulse) {
    if (channel >= 1 && channel <= 16) {
      if (pulse > 20000) pulse = 20000;
      this.raw(25 + channel, pulse);
    }
    return this;
  }

  // ── 新モタドラ(CAN直結ブラシ付き) cmd 72-79 ──
  /**
   * 新モタドラ制御。
   * @param {number} id    モタドラID 1-8
   * @param {number} duty  -999〜+999 (符号=回転方向, 絶対値=デューティ, 0=ブレーキ)
   * @param {{enable?:boolean, resetEnc?:boolean}} [opts]
   *   enable=false でフリー(Hブリッジ全OFF)。resetEnc=true でロリコンカウンタリセット。
   */
  brushed(id, duty, opts = {}) {
    if (id < 1 || id > 8) return this;
    const enable = opts.enable !== false;
    const reverse = duty < 0;
    const d = Math.min(999, Math.abs(duty | 0));
    // bit15-12 コマンド(0x0A=リセット) / bit11 イネーブル / bit10 回転方向(1=正転) / bit9-0 デューティ
    let word = ((enable ? 1 : 0) << 11) | ((reverse ? 0 : 1) << 10) | d;
    if (opts.resetEnc) word |= 0x0a << 12;
    this.raw(71 + id, word);
    return this;
  }

  // ── GPIO (cmd 254) ──
  /** GPIO出力。state は下位ビットからGPIO4,5,...のビット列 */
  gpio(state) {
    this.raw(254, state);
    return this;
  }

  /** 1個もコマンドが無いか */
  isEmpty() {
    return this.buf.length === 0;
  }

  /** コマンド数 */
  get count() {
    return this.buf.length / 3;
  }

  /** COBSエンコードして送信バイト列(Uint8Array, 末尾0x00)を返す */
  encode() {
    return cobsEncode(this.buf);
  }
}

/**
 * control(pad, motor) に渡す motor。Frame を包み、ユーザに見せるAPIを絞る。
 * PWM は pwmInvert=true のとき自動で 20000 − 値 にする。
 * @param {Frame} frame
 * @param {boolean} pwmInvert
 */
export function makeMotor(frame, pwmInvert) {
  return {
    /** ロボマス速度 [rpm] (M2006/M3508) */
    speed: (id, rpm) => frame.driveSpeed(id, rpm),
    /**
     * M2006/M3508 速度指定付き位相制御。
     * @param {number} id
     * @param {number} target 目標(回転数)。0xFFFF(-1)で無効=その場停止
     * @param {number} [speed] 任意。指定すると接近速度も設定(未指定なら前回値/既定8000)
     */
    phase: (id, target, speed) => {
      if (speed !== undefined) frame.drivePhaseSpeed(id, speed);
      frame.drivePhase(id, target);
    },
    /** M2006/M3508 位相の接近速度のみ設定 */
    phaseSpeed: (id, speed) => frame.drivePhaseSpeed(id, speed),
    /** 旧API: drive(id, phaseMode, target) */
    drive: (id, phaseMode, target) => frame.driveMotor(id, phaseMode, target),
    /** GM6020 速度 */
    gm6020: (id, val) => frame.gm6020Speed(id, val),
    /**
     * GM6020 速度指定付き位相制御。
     * @param {number} id
     * @param {number} deg 目標角[deg](360で1回転)。0xFFFF(-1)で無効=その場停止
     * @param {number} [speed] 任意。指定すると接近速度も設定(未指定なら前回値/既定8000)
     */
    gm6020Phase: (id, deg, speed) => {
      if (speed !== undefined) frame.gm6020PhaseSpeed(id, speed);
      frame.gm6020Phase(id, deg);
    },
    /** GM6020 位相の接近速度のみ設定 */
    gm6020PhaseSpeed: (id, speed) => frame.gm6020PhaseSpeed(id, speed),
    /** PWM (絶縁反転を自動適用)。pulse=実際に出したいパルス幅[us] */
    pwm: (ch, pulse) => frame.pwm(ch, pwmInvert ? 20000 - pulse : pulse),
    /** 新モタドラ duty -999〜999 (0=ブレーキ) */
    brushed: (id, duty, opts) => frame.brushed(id, duty, opts),
    /** GPIO 出力ビット列 */
    gpio: (state) => frame.gpio(state),
  };
}
