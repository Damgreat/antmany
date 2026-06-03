# One-time / per-session Android dev setup for Windows.
$JdkHome = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$SdkHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (Test-Path $JdkHome) {
  $env:JAVA_HOME = $JdkHome
  $javaBin = Join-Path $JdkHome "bin"
  if ($env:Path -notlike "*$javaBin*") {
    $env:Path = "$javaBin;$env:Path"
  }
  [Environment]::SetEnvironmentVariable("JAVA_HOME", $JdkHome, "User")
  Write-Host "JAVA_HOME set to $JdkHome"
} else {
  Write-Warning "JDK not found at $JdkHome. Install: winget install Microsoft.OpenJDK.17"
}

if (Test-Path $SdkHome) {
  $env:ANDROID_HOME = $SdkHome
  $env:ANDROID_SDK_ROOT = $SdkHome
  $platformTools = Join-Path $SdkHome "platform-tools"
  if ($env:Path -notlike "*$platformTools*") {
    $env:Path = "$platformTools;$env:Path"
  }
  [Environment]::SetEnvironmentVariable("ANDROID_HOME", $SdkHome, "User")
  Write-Host "ANDROID_HOME set to $SdkHome"
} else {
  Write-Warning "Android SDK not found at $SdkHome."
  Write-Warning "Install Android Studio, then SDK Manager -> install SDK Platform + Build-Tools."
}

Write-Host ""
Write-Host "Restart the terminal, then:"
Write-Host "  Terminal 1: npm start"
Write-Host "  Terminal 2: npm run android"
