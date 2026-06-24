# Flash the bridge firmware reliably with arduino-cli (compile -> upload -> hash verify).
# Called by flash.bat. Auto-detects the ESP32 (CP2102) COM port.
# (All messages kept ASCII for Windows PowerShell 5.1 compatibility.)

$ErrorActionPreference = "Stop"

# Locate arduino-cli
$cli = "C:\Program Files\Arduino CLI\arduino-cli.exe"
if (-not (Test-Path $cli)) {
  $c = Get-Command arduino-cli -ErrorAction SilentlyContinue
  if ($c) {
    $cli = $c.Source
  } else {
    Write-Host "[ERROR] arduino-cli not found. Install: winget install ArduinoSA.CLI"
    exit 1
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sketch = Join-Path $root "firmware\bridge"

# Ensure ESP32 core is installed (first run on a fresh PC: large download)
$coreList = & $cli core list 2>$null
if (-not ($coreList -match 'esp32:esp32')) {
  Write-Host "Installing ESP32 core (first time, large download ~hundreds of MB)..."
  & $cli config init --overwrite | Out-Null
  & $cli config add board_manager.additional_urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  & $cli core update-index
  & $cli core install esp32:esp32
}

# Auto-detect ESP32 (CP2102 / Silicon Labs / CH340) COM port
$port = $null
$cand = Get-CimInstance Win32_PnPEntity | Where-Object {
  $_.Name -match 'COM\d+' -and $_.Name -match 'CP210|Silicon Labs|CH340|USB-SERIAL|USB Serial'
}
foreach ($d in $cand) {
  if ($d.Name -match '(COM\d+)') { $port = $Matches[1]; break }
}

if (-not $port) {
  Write-Host "ESP32 COM port not auto-detected. Available ports:"
  Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match 'COM\d+' } | ForEach-Object { Write-Host "  $($_.Name)" }
  $port = Read-Host "Enter COM port (e.g. COM4)"
}

Write-Host "Port  : $port"
Write-Host "Sketch: $sketch"
Write-Host "Compiling and uploading (with hash verify)..."
Write-Host ""

& $cli compile --upload -p $port --fqbn esp32:esp32:esp32 $sketch

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "==================================="
  Write-Host " OK! Flash complete (hash verified)."
  Write-Host " ESP32 is running the bridge firmware."
  Write-Host "==================================="
} else {
  Write-Host ""
  Write-Host "[FAILED] upload error. Replug USB and run again."
}
