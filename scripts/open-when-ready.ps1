# Opens the app in the browser once both servers answer. Run by the IntelliJ "App" compound alongside Backend and Frontend.
param([int]$TimeoutMinutes = 5)

$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
Write-Host "Waiting for the backend (:8080) and frontend (:3000)..."
while ((Get-Date) -lt $deadline) {
    try {
        Invoke-WebRequest "http://localhost:8080/actuator/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        # favicon.ico skips proxy.ts; a page URL would loop on the auto-login redirect for a cookie-less check.
        Invoke-WebRequest "http://localhost:3000/favicon.ico" -UseBasicParsing -TimeoutSec 10 | Out-Null
        Start-Process "http://localhost:3000"
        Write-Host "Opened http://localhost:3000"
        exit 0
    } catch {
        Start-Sleep -Seconds 2
    }
}
Write-Host "Servers didn't respond within $TimeoutMinutes minutes - check the Backend and Frontend run tabs for errors."
exit 1
