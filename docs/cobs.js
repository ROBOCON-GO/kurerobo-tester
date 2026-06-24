// COBS (Consistent Overhead Byte Stuffing) エンコード/デコード
// ESP32 ブリッジ(旧 mawarudokusute 用 .ino)の cobsEncode を忠実に JS 移植。
// 末尾に 0x00 デリミタを付けて返す(=メインボードが期待するフレーム形式)。

/**
 * @param {Uint8Array | number[]} input  COBSエンコード前のデータ(コマンド3バイト×n)
 * @returns {Uint8Array}  エンコード後バイト列(末尾0x00を含む)。データ長3nに対し 3n+2 になる。
 */
export function cobsEncode(input) {
  const length = input.length;
  // 最大出力サイズ: 元データ + 254バイトごとのオーバーヘッド + 先頭コード + 末尾0x00
  const output = new Uint8Array(length + Math.ceil((length + 1) / 254) + 2);

  let readIndex = 0;
  let writeIndex = 1;
  let codeIndex = 0;
  let code = 1;

  while (readIndex < length) {
    if (input[readIndex] === 0) {
      output[codeIndex] = code;
      code = 1;
      codeIndex = writeIndex++;
      readIndex++;
    } else {
      output[writeIndex++] = input[readIndex++];
      code++;
      if (code === 0xff) {
        output[codeIndex] = code;
        code = 1;
        codeIndex = writeIndex++;
      }
    }
  }

  output[codeIndex] = code;
  output[writeIndex++] = 0x00; // デリミタ

  return output.subarray(0, writeIndex);
}

/**
 * COBSデコード(メインボードからの戻り — GPIO割込フィードバック等の解析用)。
 * 0x00 デリミタ手前までを 1 フレームとしてデコードする。
 * @param {Uint8Array | number[]} input  0x00デリミタを含む/含まないフレーム
 * @returns {Uint8Array}  デコード後データ
 */
export function cobsDecode(input) {
  // 末尾の 0x00 デリミタは除いて処理
  let end = input.length;
  if (end > 0 && input[end - 1] === 0x00) end--;

  const output = [];
  let i = 0;
  while (i < end) {
    const code = input[i++];
    for (let j = 1; j < code && i < end; j++) {
      output.push(input[i++]);
    }
    if (code < 0xff && i < end) {
      output.push(0x00);
    }
  }
  return new Uint8Array(output);
}

/** デバッグ用: バイト列を "AA 00 07 D0" 形式の16進文字列に変換 */
export function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}
