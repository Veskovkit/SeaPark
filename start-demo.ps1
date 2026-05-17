# SeaPark one-command demo (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "🛥️  Starting SeaPark Demo..." -ForegroundColor Cyan
Write-Host ""

$jobs = @()

function Stop-DemoJobs {
  foreach ($j in $jobs) {
    if ($j -and $j.State -eq "Running") {
      Stop-Job $j -ErrorAction SilentlyContinue
      Remove-Job $j -Force -ErrorAction SilentlyContinue
    }
  }
}

try {
  Write-Host "Starting NMEA simulator (50x speed)..."
  $jobs += Start-Job -ScriptBlock {
    Set-Location $using:Root
    Set-Location simulator
    npm run demo
  }

  Start-Sleep -Seconds 2

  Write-Host "Starting Signal K server..."
  $jobs += Start-Job -ScriptBlock {
    Set-Location $using:Root
    Set-Location server
    signalk-server -c .
  }

  Start-Sleep -Seconds 3

  Write-Host "Starting helm dashboard..."
  $jobs += Start-Job -ScriptBlock {
    Set-Location $using:Root
    Set-Location dashboard
    npm run dev
  }

  Write-Host ""
  Write-Host "✅ SeaPark Demo Running" -ForegroundColor Green
  Write-Host "   Helm dashboard: http://localhost:5173"
  Write-Host "   Signal K admin: http://localhost:3000"
  Write-Host "   Press Ctrl+C to stop all"
  Write-Host ""
  Write-Host "Simulator / Signal K / Vite logs (Ctrl+C stops everything):"

  while ($true) {
    foreach ($j in $jobs) {
      Receive-Job $j -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
    Start-Sleep -Milliseconds 500
  }
}
finally {
  Stop-DemoJobs
}
