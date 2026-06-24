// Phase 0 検証: cobs.js / robomas.js が期待どおりのバイト列を生成するか。
// 実行: node tests/test.js  (Node 16+ / ESM)

import { cobsEncode, cobsDecode, toHex } from "../docs/cobs.js";
import { Frame } from "../docs/robomas.js";

let pass = 0;
let fail = 0;

function eq(name, actual, expected) {
  const a = toHex(actual);
  const e = typeof expected === "string" ? expected : toHex(expected);
  if (a === e) {
    pass++;
    console.log(`  ✓ ${name}: ${a}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}\n      期待: ${e}\n      実際: ${a}`);
  }
}

console.log("[COBS 基本]");
// データ中の 0x00 がコード値に置き換わり、末尾に 0x00 デリミタが付く
eq("encode [00 07 D0]", cobsEncode([0x00, 0x07, 0xd0]), "01 03 07 D0 00");
eq("encode [48 0D F4]", cobsEncode([0x48, 0x0d, 0xf4]), "04 48 0D F4 00");

console.log("[COBS ラウンドトリップ]");
for (const data of [[0x00, 0x07, 0xd0], [0x48, 0x0d, 0xf4], [0, 0, 0], [0xff, 0x00, 0x10]]) {
  const round = cobsDecode(cobsEncode(data));
  eq("decode(encode " + toHex(data) + ")", round, new Uint8Array(data));
}

console.log("[robomas コマンド生成]");
// driveSpeed(ID1, 2000rpm): cmd0, 値0x07D0 → COBS → 01 03 07 D0 00
eq("driveSpeed(1, 2000)", new Frame().driveSpeed(1, 2000).encode(), "01 03 07 D0 00");

// brushed(ID1, 500): cmd72(0x48), word=EN(1)|DIR正転(1)|500 = 0x0DF4
eq("brushed(1, 500)", new Frame().brushed(1, 500).encode(), "04 48 0D F4 00");

// brushed(ID2, -300): cmd73(0x49), word=EN(1)|DIR逆転(0)|300 = 0x092C
eq("brushed(2, -300)", new Frame().brushed(2, -300).encode(), "04 49 09 2C 00");

// brushed enable=false(フリー): cmd74(0x4A), word = 0 | DIR(1) | 0 = 0x0400 → buf [4A 04 00] → COBS 03 4A 04 01 00
eq("brushed(3, 0, free)", new Frame().brushed(3, 0, { enable: false }).encode(), "03 4A 04 01 00");

// 複数コマンド: driveSpeed(1,2000) + brushed(1,500)
eq(
  "driveSpeed(1,2000)+brushed(1,500)",
  new Frame().driveSpeed(1, 2000).brushed(1, 500).encode(),
  "01 06 07 D0 48 0D F4 00"
);

// PWM(ch1, 1100): cmd26(0x1A), 値0x044C
eq("pwm(1, 1100)", new Frame().pwm(1, 1100).encode(), "04 1A 04 4C 00");

// GPIO(0x0003): cmd254(0xFE), buf [FE 00 03] → COBS 02 FE 02 03 00
eq("gpio(0x0003)", new Frame().gpio(0x0003).encode(), "02 FE 02 03 00");

// フレーム長は 3n+2 (n=コマンド数)
const f = new Frame().driveSpeed(1, 100).driveSpeed(2, 200).brushed(1, 50);
const enc = f.encode();
if (enc.length === 3 * f.count + 2) {
  pass++;
  console.log(`  ✓ フレーム長 3n+2: n=${f.count}, len=${enc.length}`);
} else {
  fail++;
  console.error(`  ✗ フレーム長: n=${f.count}, len=${enc.length} (期待 ${3 * f.count + 2})`);
}

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
