# Builds release APK from C:\antmany-apk-build (no spaces in path).
$ErrorActionPreference = "Stop"

$SourceRoot = Split-Path $PSScriptRoot -Parent
$BuildRoot = "C:\antmany-apk-build"

Write-Host "Source: $SourceRoot"
Write-Host "Build at: $BuildRoot"

if (Test-Path $BuildRoot) {
  Remove-Item $BuildRoot -Recurse -Force
}

Write-Host "Copying project (excluding node_modules and build caches)..."
robocopy $SourceRoot $BuildRoot /MIR /XD node_modules android\.gradle android\app\build android\build .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

if (Test-Path "$SourceRoot\.env") {
  Copy-Item "$SourceRoot\.env" "$BuildRoot\.env" -Force
}

Push-Location $BuildRoot
try {
  Write-Host "npm install (fresh node_modules at clean path)..."
  npm install --legacy-peer-deps
} finally {
  Pop-Location
}

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Push-Location "$BuildRoot\android"
try {
  Write-Host "Building release APK (arm64)..."
  .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
  $apk = Get-ChildItem -Path "app\build\outputs\apk\release" -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($apk) {
    $out = Join-Path $SourceRoot "antibodycheck-release.apk"
    Copy-Item $apk.FullName $out -Force
    Write-Host ""
    Write-Host "SUCCESS. APK:" -ForegroundColor Green
    Write-Host $out
  } else {
    throw "APK not found under app\build\outputs\apk\release"
  }
} finally {
  Pop-Location
}
