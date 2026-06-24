# ブリッジファームをコンパイルして .bin を生成する(制御班が一度だけ実行)。
#
# 前提: arduino-cli がインストール済み。
#   https://arduino.github.io/arduino-cli/latest/installation/
#   winget install ArduinoSA.CLI  などでも可。
#
# 使い方:  powershell -ExecutionPolicy Bypass -File build_firmware.ps1
#
# 生成物は firmware/build/ 以下に出力される:
#   bridge.ino.bootloader.bin   (offset 0x1000)
#   bridge.ino.partitions.bin   (offset 0x8000)
#   bridge.ino.bin              (offset 0x10000)
# ※ boot_app0.bin (offset 0xe000) はコア付属のものを使う。
# これらを esptool-js / esptool で各オフセットに書き込む。

$ErrorActionPreference = "Stop"
$FQBN = "esp32:esp32:esp32"
$SketchDir = Join-Path $PSScriptRoot "firmware\bridge"
$OutDir = Join-Path $PSScriptRoot "firmware\build"

Write-Host "[1/3] ESP32 コアを確認/インストール..."
arduino-cli core update-index
if (-not (arduino-cli core list | Select-String "esp32:esp32")) {
    arduino-cli core install esp32:esp32
}

Write-Host "[2/3] コンパイル..."
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
arduino-cli compile --fqbn $FQBN --output-dir $OutDir $SketchDir

Write-Host "[3/3] 完了。生成物:"
Get-ChildItem $OutDir -Filter *.bin | ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host ""
Write-Host "次の手順: firmware/build/*.bin を kurerobo-tester/firmware/ にコピーするか、"
Write-Host "          flasher.js(Phase 2)が参照するパスに配置してください。"
