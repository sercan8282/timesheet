#requires -Version 5.1
$ErrorActionPreference = 'Stop'

function Say([string]$m) { Write-Output $m }

try {
  $TS_DIR = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  Set-Location $TS_DIR

  $DB_PATH     = Join-Path $TS_DIR 'database.sqlite'
  $BACKUP_DIR  = Join-Path $TS_DIR 'backups'
  $TIMESTAMP   = Get-Date -Format 'yyyyMMdd-HHmmss'
  $BACKUP_PATH = Join-Path $BACKUP_DIR ("database-$TIMESTAMP.sqlite")

  Say "Preparing update..."

  # Backup database
  Say "Backing up database..."
  if (-not (Test-Path $BACKUP_DIR)) { New-Item -Path $BACKUP_DIR -ItemType Directory | Out-Null }
  if (Test-Path $DB_PATH) {
    Copy-Item -Path $DB_PATH -Destination $BACKUP_PATH -Force
    Say "Database backup created: backups/$(Split-Path $BACKUP_PATH -Leaf)"
  } else {
    Say "No database file found, skipping backup"
  }

  # Git fetch & pull if repo
  if (Test-Path (Join-Path $TS_DIR '.git')) {
    Say "Fetching latest version..."
    git fetch --all | Out-Null
    Say "Applying updates..."
    git pull --ff-only | Out-Null
  } else {
    Say "Not a git repository; skipping pull"
  }

  # Install dependencies
  Say "Installing dependencies..."
  if (Test-Path (Join-Path $TS_DIR 'package-lock.json')) {
    npm ci | Write-Output
  } else {
    npm install --production | Write-Output
  }

  # Initialize database (idempotent)
  Say "Updating database..."
  npm run init-db | Write-Output

  # Restart application if pm2 exists (robust)
  Say "Restarting application..."
  $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
  if ($pm2) {
    try {
      $exists = (& pm2 describe timesheet) 2>$null
      if ($LASTEXITCODE -eq 0) {
        & pm2 restart timesheet | Write-Output
      } else {
        Say "PM2 app 'timesheet' not found; starting it"
        & pm2 start npm --name timesheet -- start | Write-Output
      }
      & pm2 save | Write-Output
    } catch {
      Say "PM2 restart/start/save failed: $($_.Exception.Message)"
    }
  } else {
    Say "PM2 not found; restart your app if needed"
  }

  Say "Update complete"
  exit 0
}
catch {
  Say ("Error: {0}" -f $_.Exception.Message)
  exit 1
}
