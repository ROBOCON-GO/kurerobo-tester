# Portable ESP32 bridge-firmware flasher (no install needed).
# Uses the bundled esptool.exe + prebuilt bins. Called by flash.bat.
# (All messages ASCII for Windows PowerShell 5.1 compatibility.)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$esptool = Join-Path $root "esptool.exe"
if (-not (Test-Path $esptool)) {
  Write-Host "[ERROR] esptool.exe not found next to this script."
  exit 1
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

Write-Host "Port: $port"
Write-Host "Writing bridge firmware (with hash verify)... do not unplug USB."
Write-Host ""

& $esptool --chip esp32 --port $port --baud 921600 write_flash `
  0x1000 "bridge.ino.bootloader.bin" `
  0x8000 "bridge.ino.partitions.bin" `
  0xe000 "boot_app0.bin" `
  0x10000 "bridge.ino.bin"

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "==================================="
  Write-Host " OK! Flash complete (hash verified)."
  Write-Host " ESP32 is running the bridge firmware."
  Write-Host "==================================="
} else {
  Write-Host ""
  Write-Host "[FAILED] error. Replug USB and run again."
}
