$fontUrls = @(
    "https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.woff2", # Poppins-Regular
    "https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2", # Poppins-Bold
    "https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2", # Poppins-SemiBold
    "https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLDz8Z1xlFQ.woff2", # Poppins-Light
    "https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLDD4Z1xlFQ.woff2"  # Poppins-Medium
)

$fontNames = @(
    "Poppins-Regular.ttf",
    "Poppins-Bold.ttf",
    "Poppins-SemiBold.ttf",
    "Poppins-Light.ttf",
    "Poppins-Medium.ttf"
)

$outputFolder = "assets/fonts"

for ($i = 0; $i -lt $fontUrls.Count; $i++) {
    $url = $fontUrls[$i]
    $outputFile = Join-Path $outputFolder $fontNames[$i]
    
    Write-Host "Downloading $($fontNames[$i])..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $outputFile
        Write-Host "Downloaded to $outputFile"
    } catch {
        Write-Host "Failed to download $($fontNames[$i]): $_"
    }
}

Write-Host "Font download process completed!" 