# Sets JAVA_HOME / Android SDK for this session, then runs react-native run-android.
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

$JdkHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if (Test-Path $JdkHome) {
  $env:JAVA_HOME = $JdkHome
  $javaBin = Join-Path $JdkHome "bin"
  if ($env:Path -notlike "*$javaBin*") {
    $env:Path = "$javaBin;$env:Path"
  }
  Write-Host "JAVA_HOME=$env:JAVA_HOME"
} else {
  Write-Error "JDK not found at $JdkHome. Run: winget install Microsoft.OpenJDK.17"
}

$resolveSdk = Join-Path $PSScriptRoot "resolve-android-sdk.ps1"
$SdkHome = & $resolveSdk
if (-not $SdkHome) {
  $defaultSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  Write-Warning "Android SDK not found."
  Write-Warning "Run: powershell -ExecutionPolicy Bypass -File scripts/install-android-sdk.ps1"
  if (-not (Test-Path (Join-Path $defaultSdk "platform-tools\adb.exe"))) {
    Write-Error "Missing SDK. Install it with scripts/install-android-sdk.ps1 first."
  }
  $SdkHome = $defaultSdk
}

$env:ANDROID_HOME = $SdkHome
$env:ANDROID_SDK_ROOT = $SdkHome
$env:Path = "$SdkHome\platform-tools;$SdkHome\emulator;$env:Path"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"

$localProps = Join-Path $ProjectRoot "android\local.properties"
$escaped = $SdkHome -replace '\\', '\\'
Set-Content -Path $localProps -Value "sdk.dir=$escaped" -Encoding ASCII
Write-Host "Updated android/local.properties"

$emulatorExe = Join-Path $SdkHome "emulator\emulator.exe"
if (Test-Path $emulatorExe) {
  $avds = & $emulatorExe -list-avds 2>$null
  if (-not $avds) {
    Write-Warning "No Android emulators (AVD). Create one in Android Studio -> Device Manager,"
    Write-Warning "or connect a phone with USB debugging enabled."
  }
}

& java -version
npx react-native run-android @args
