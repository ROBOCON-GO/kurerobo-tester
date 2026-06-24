// KureRobo Tester ブリッジファーム(固定・以後書き換え不要)
//
// 役割: PC(ブラウザ)とメインボード(mawarudokusute)の間を素通しするだけ。
//   - Bluetooth(SPP) で受け取ったバイト列を、そのまま UART0 へ流す → メインボードへ
//   - UART0 で受け取ったバイト列を、そのまま Bluetooth へ流す → PCへ(GPIO割込フィードバック等)
//
// 制御ロジック・COBSエンコードはすべて PC 側(ブラウザJS)で行うため、
// このファームはロボットが変わっても一切変更しない。
//
// 書き込み: arduino-cli または ../build_firmware.ps1 で .bin を生成し、
//           ブラウザの「① 書き込み」タブ(esptool-js)から流す。

#include "BluetoothSerial.h"

BluetoothSerial SerialBT;

void setup() {
  Serial.begin(115200);          // UART0 = メインボードへ
  SerialBT.begin("ESP32_CTRL");  // PC と Bluetooth(従来と同じデバイス名)
}

void loop() {
  // PC → メインボード
  while (SerialBT.available()) {
    Serial.write(SerialBT.read());
  }
  // メインボード → PC
  while (Serial.available()) {
    SerialBT.write(Serial.read());
  }
}
