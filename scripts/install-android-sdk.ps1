# Downloads Android SDK command-line tools and installs packages required by this project.
$ErrorActionPreference = "Stop"

$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$CmdlineToolsZip = Join-Path $env:TEMP "commandlinetools-win.zip"
$CmdlineToolsUrl = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$LocalProperties = Join-Path $ProjectRoot "android\local.properties"

Write-Host "SDK root: $SdkRoot"
New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null

if (-not (Test-Path (Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"))) {
  Write-Host "Downloading Android command-line tools..."
  Invoke-WebRequest -Uri $CmdlineToolsUrl -OutFile $CmdlineToolsZip -UseBasicParsing

  $ExtractDir = Join-Path $env:TEMP "android-cmdline-tools"
  if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }
  Expand-Archive -Path $CmdlineToolsZip -DestinationPath $ExtractDir -Force

  $LatestDir = Join-Path $SdkRoot "cmdline-tools\latest"
  New-Item -ItemType Directory -Force -Path (Split-Path $LatestDir) | Out-Null
  if (Test-Path $LatestDir) { Remove-Item $LatestDir -Recurse -Force }
  Move-Item (Join-Path $ExtractDir "cmdline-tools") $LatestDir
  Remove-Item $CmdlineToolsZip -Force -ErrorAction SilentlyContinue
  Write-Host "Command-line tools installed."
}

$sdkmanager = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmanager)) {
  throw "sdkmanager not found at $sdkmanager"
}

$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

Write-Host "Accepting Android SDK licenses..."
$yesInput = ("y`n" * 80)
$yesFile = Join-Path $env:TEMP "android-sdk-yes.txt"
Set-Content -Path $yesFile -Value $yesInput -NoNewline
Get-Content $yesFile | & $sdkmanager --licenses 2>&1 | Out-Null
Remove-Item $yesFile -Force -ErrorAction SilentlyContinue

Write-Host "Installing SDK packages (platform 35, build-tools 35.0.0, platform-tools)..."
$packages = @(
  "platform-tools",
  "platforms;android-35",
  "build-tools;35.0.0",
  "extras;google;Android_Emulator_Hypervisor_Driver"
)

foreach ($pkg in $packages) {
  Write-Host "  -> $pkg"
  & $sdkmanager $pkg 2>&1 | ForEach-Object { Write-Host $_ }
}

$escapedSdk = $SdkRoot -replace '\\', '\\'
$sdkDirLine = "sdk.dir=$escapedSdk"
Set-Content -Path $LocalProperties -Value $sdkDirLine -Encoding ASCII
Write-Host "Wrote $LocalProperties"
Write-Host "sdk.dir=$SdkRoot"

[Environment]::SetEnvironmentVariable("ANDROID_HOME", $SdkRoot, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $SdkRoot, "User")

if (Test-Path (Join-Path $SdkRoot "platform-tools\adb.exe")) {
  Write-Host "Android SDK ready."
} else {
  Write-Warning "SDK install may be incomplete. Re-run this script or use Android Studio SDK Manager."
}
