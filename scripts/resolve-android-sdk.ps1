# Returns the first valid Android SDK path on this machine.
$candidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
  (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"),
  "C:\Android\Sdk"
)

foreach ($path in $candidates) {
  if (-not $path) { continue }
  $adb = Join-Path $path "platform-tools\adb.exe"
  if (Test-Path $adb) {
    return $path
  }
}

return $null
