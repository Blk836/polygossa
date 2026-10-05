# Starts the app's backend (:8080) and frontend (:3000) in their own windows and opens the browser.
# Run via start.bat. Pass -Check to only report which Java/Node would be used.
param([switch]$Check)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
# The app name in window titles; both servers inherit BRAND_NAME from this environment.
$brand = if ($env:BRAND_NAME -and $env:BRAND_NAME.Trim()) { $env:BRAND_NAME.Trim() } else { "Polygossa" }

function Get-JavaMajor([string]$javaHome) {
    $release = Join-Path $javaHome "release"
    if (-not (Test-Path $release)) { return 0 }
    $line = Select-String -Path $release -Pattern '^JAVA_VERSION="([^"]+)"' | Select-Object -First 1
    if (-not $line) { return 0 }
    $version = $line.Matches[0].Groups[1].Value
    if ($version.StartsWith("1.")) { return 8 }
    return [int]($version.Split(".")[0])
}

# Gradle and Spring Boot need JDK 21+: use JAVA_HOME if suitable, else the newest JDK in IntelliJ's ~/.jdks.
$javaHome = $null
if ($env:JAVA_HOME -and (Get-JavaMajor $env:JAVA_HOME) -ge 21) {
    $javaHome = $env:JAVA_HOME
} else {
    $candidates = @()
    foreach ($dir in @("$env:USERPROFILE\.jdks", "$env:ProgramFiles\Java", "$env:ProgramFiles\Eclipse Adoptium")) {
        if (Test-Path $dir) { $candidates += Get-ChildItem $dir -Directory }
    }
    $javaHome = $candidates |
        Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
        ForEach-Object { [pscustomobject]@{ Path = $_.FullName; Major = (Get-JavaMajor $_.FullName) } } |
        Where-Object { $_.Major -ge 21 } |
        Sort-Object Major -Descending |
        Select-Object -First 1 -ExpandProperty Path
}
if (-not $javaHome) {
    throw "No JDK 21 or newer found. Install one (e.g. from IntelliJ: File > Project Structure > SDKs) or set JAVA_HOME."
}

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) {
    $npm = @("$env:ProgramFiles\nodejs\npm.cmd", "$env:NVM_SYMLINK\npm.cmd", "$env:APPDATA\npm\npm.cmd") |
        Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if (-not $npm) { throw "Node.js/npm not found. Install Node.js 20+ from https://nodejs.org" }
$nodeDir = Split-Path -Parent $npm

Write-Host "Java: $javaHome"
Write-Host "npm:  $npm"
if ($Check) { return }

if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Installing frontend dependencies (first run only)..."
    Push-Location (Join-Path $root "frontend")
    try { & $npm install } finally { Pop-Location }
}

# Each server gets its own window; close the window to stop that server.
$backendCmd = "title $brand backend && set `"JAVA_HOME=$javaHome`" && cd /d `"$root`" && gradlew.bat :backend:bootRun"
Start-Process $env:ComSpec -ArgumentList "/k", $backendCmd
$frontendCmd = "title $brand frontend && set `"PATH=$nodeDir;%PATH%`" && cd /d `"$root\frontend`" && npm run dev"
Start-Process $env:ComSpec -ArgumentList "/k", $frontendCmd

Write-Host "Waiting for the servers to start (the first run can take a couple of minutes)..."
$deadline = (Get-Date).AddMinutes(5)
$ready = $false
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest "http://localhost:8080/actuator/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 10 | Out-Null
        $ready = $true
        break
    } catch { }
}
if ($ready) {
    Start-Process "http://localhost:3000"
    Write-Host "$brand is running at http://localhost:3000"
} else {
    Write-Host "Servers didn't respond within 5 minutes - check the '$brand backend' and '$brand frontend' windows for errors."
}
