# Installs Android Emulator Hypervisor Driver (AEHD) — requires Administrator.
$ErrorActionPreference = "Stop"

$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$AehdDir = Join-Path $SdkRoot "extras\google\Android_Emulator_Hypervisor_Driver"
$Installer = Join-Path $AehdDir "silent_install.bat"

if (-not (Test-Path $Installer)) {
  Write-Host "AEHD package missing. Installing via sdkmanager..."
  $sdkmanager = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
  if (-not (Test-Path $sdkmanager)) {
    throw "Run: npm run install-android-sdk"
  }
  $yesFile = Join-Path $env:TEMP "android-sdk-yes.txt"
  Set-Content -Path $yesFile -Value ("y`n" * 80) -NoNewline
  Get-Content $yesFile | & $sdkmanager --licenses 2>&1 | Out-Null
  Remove-Item $yesFile -Force -ErrorAction SilentlyContinue
  & $sdkmanager "extras;google;Android_Emulator_Hypervisor_Driver"
}

if (-not (Test-Path $Installer)) {
  throw "Installer not found at $Installer"
}

Write-Host "Launching AEHD fix (admin reinstall) — approve UAC..."
$fixScript = Join-Path $PSScriptRoot "fix-emulator-hypervisor.ps1"
Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$fixScript`"" `
  -Verb RunAs -Wait

Write-Host ""
Write-Host "If the banner remains, turn OFF Memory integrity:"
Write-Host "  Windows Security -> Device security -> Core isolation -> Memory integrity -> Off -> reboot"
