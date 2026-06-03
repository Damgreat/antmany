# Run this script as Administrator (right-click PowerShell -> Run as administrator).
#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$AehdDir = Join-Path $SdkRoot "extras\google\Android_Emulator_Hypervisor_Driver"
$Installer = Join-Path $AehdDir "silent_install.bat"
$Emulator = Join-Path $SdkRoot "emulator\emulator.exe"

function Test-AehdRunning {
  $q = sc.exe query aehd 2>&1 | Out-String
  return $q -match "RUNNING"
}

Write-Host "=== Android Emulator hypervisor fix ===" -ForegroundColor Cyan

if (-not (Test-Path $Installer)) {
  Write-Host "Installing AEHD SDK package..."
  $sdkmanager = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
  if (-not (Test-Path $sdkmanager)) {
    throw "SDK cmdline-tools missing. Run: npm run install-android-sdk"
  }
  $yes = ("y`n" * 80)
  $yes | & $sdkmanager --licenses 2>&1 | Out-Null
  & $sdkmanager "extras;google;Android_Emulator_Hypervisor_Driver"
}

Write-Host "Reinstalling AEHD kernel driver..."
Push-Location $AehdDir
cmd /c "silent_install.bat -u" 2>&1 | Out-Null
$installResult = cmd /c "silent_install.bat" 2>&1
Pop-Location
Write-Host $installResult

Start-Sleep -Seconds 2
sc.exe start aehd 2>&1 | ForEach-Object { Write-Host $_ }

if (Test-AehdRunning) {
  Write-Host "AEHD service is RUNNING." -ForegroundColor Green
} else {
  Write-Host "AEHD service did not start. Common blockers:" -ForegroundColor Yellow
  Write-Host "  1. BIOS: enable Intel VT-x / AMD-V (virtualization)"
  Write-Host "  2. Windows Security -> Device security -> Core isolation"
  Write-Host "     -> turn OFF Memory integrity, then reboot"
  Write-Host "  3. Other hypervisors (old VirtualBox/HAXM) — uninstall HAXM if present"
  sc.exe query aehd 2>&1 | ForEach-Object { Write-Host $_ }
}

if (Test-Path $Emulator) {
  Write-Host ""
  Write-Host "Emulator acceleration check:"
  & $Emulator -accel-check 2>&1 | ForEach-Object { Write-Host $_ }
}

Write-Host ""
Write-Host "Restart Android Studio, then start the Pixel emulator again."
