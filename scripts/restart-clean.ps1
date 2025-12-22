Param(
  [int]$Port = 3000,
  [int]$TimeoutSeconds = 30
)

Write-Host "[Restart] Freeing port $Port..."
$owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

if ($owners) {
  foreach ($p in $owners) {
    try {
      Stop-Process -Id $p -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 300
      Write-Host "[Restart] Stopped PID $p on port $Port"
    } catch {
      Write-Warning ("[Restart] Could not stop PID {0}: {1}" -f $p, $_.Exception.Message)
    }
  }
} else {
  Write-Host "[Restart] No listeners on port $Port"
}

Write-Host "[Restart] Starting server in background..."
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory (Get-Location).Path -WindowStyle Hidden | Out-Null

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$healthy = $false
while([DateTime]::UtcNow -lt $deadline) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing http://localhost:$Port/api/health -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $healthy = $true; break }
  } catch { }
  Start-Sleep -Milliseconds 500
}

if ($healthy) {
  Write-Host "[Restart] Server is healthy (200)"
  exit 0
} else {
  Write-Error "[Restart] Health check failed"
  exit 1
}
