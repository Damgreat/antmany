# Verifies the IAM credentials in .env can reach S3 and Textract.
$ErrorActionPreference = "Stop"

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (-not (Test-Path $envFile)) {
  throw ".env not found at $envFile"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim()
    Set-Item -Path "env:$name" -Value $value
  }
}

$env:AWS_ACCESS_KEY_ID = $env:AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY = $env:AWS_SECRET_ACCESS_KEY
$env:AWS_DEFAULT_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-west-2" }

Write-Host "Checking caller identity..."
aws sts get-caller-identity

Write-Host ""
Write-Host "Listing recent uploads in bucket (max 5 pix-*.jpg)..."
aws s3 ls "s3://$($env:AWS_BUCKET_NAME)/" | Select-String "pix-" | Select-Object -Last 5

Write-Host ""
Write-Host "IAM checklist for direct Textract from the app:"
Write-Host "  - s3:PutObject on $($env:AWS_BUCKET_NAME)"
Write-Host "  - s3:GetObject on $($env:AWS_BUCKET_NAME)/*"
Write-Host "  - textract:AnalyzeDocument"
Write-Host ""
Write-Host "Async poll checklist:"
Write-Host "  - S3 event triggers textractScan Lambda on upload"
Write-Host "  - Lambda writes resps/{upload-stem}.json to the same bucket"
