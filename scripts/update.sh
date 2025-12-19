#!/usr/bin/env bash
set -euo pipefail

# Safe update script for Timesheet (Ubuntu)
# - Backs up SQLite DB
# - Pulls latest code from GitHub
# - Installs dependencies
# - Applies DB init (idempotent)
# - Restarts PM2 app

REPO_URL="https://github.com/sercan8282/timesheet.git"
APP_NAME="timesheet"
DOMAIN="urenregistratie.site"

log() { echo -e "\n[update] $*"; }
run() { echo "> $*"; eval "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

log "Project dir: $PROJECT_DIR"

# 1) Stop app (if running)
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    log "Stopping PM2 app: $APP_NAME"; run "pm2 stop $APP_NAME" || true
  else
    log "PM2 app $APP_NAME not found (will start after update)"
  fi
else
  log "PM2 not found; skipping stop"
fi

# 2) Backup DB
if [ -f "$PROJECT_DIR/database.sqlite" ]; then
  mkdir -p "$PROJECT_DIR/backups"
  TS="$(date +%Y%m%d-%H%M%S)"
  BK="$PROJECT_DIR/backups/database-$TS.sqlite"
  log "Backing up DB to: $BK"; run "cp '$PROJECT_DIR/database.sqlite' '$BK'"
else
  log "No database.sqlite found (fresh install?)"
fi

# 3) Git remote & branch
if git rev-parse --git-dir >/dev/null 2>&1; then
  log "Git repo detected"
else
  log "Initializing git repo and setting origin"
  run "git init"
fi

# Ensure origin URL
if git remote get-url origin >/dev/null 2>&1; then
  CUR_URL="$(git remote get-url origin)"
  if [ "$CUR_URL" != "$REPO_URL" ]; then
    log "Setting origin to $REPO_URL (was $CUR_URL)"; run "git remote set-url origin '$REPO_URL'"
  else
    log "Origin already set to $REPO_URL"
  fi
else
  log "Adding origin $REPO_URL"; run "git remote add origin '$REPO_URL'"
fi

# Stash local changes if any
STASHED=0
if ! git diff --quiet || ! git diff --cached --quiet; then
  log "Uncommitted changes detected; stashing"
  run "git stash -u"
  STASHED=1
fi

# Fetch & determine default branch
log "Fetching origin"; run "git fetch origin"
DEFAULT_BRANCH=$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')
if [ -z "$DEFAULT_BRANCH" ]; then DEFAULT_BRANCH="main"; fi
log "Default branch detected: $DEFAULT_BRANCH"

# Checkout & pull
run "git checkout '$DEFAULT_BRANCH'" || true
log "Pulling latest code"; run "git pull --ff-only origin '$DEFAULT_BRANCH'"

# 4) Dependencies
if [ -f "$PROJECT_DIR/package-lock.json" ]; then
  log "Installing deps via npm ci"; run "npm ci"
else
  log "Installing deps via npm install"; run "npm install"
fi

# 5) DB init (idempotent; uses INSERT OR IGNORE)
log "Running init-db (idempotent)"; run "npm run init-db" || true

# 6) Start/Restart app
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    log "Restarting PM2 app"; run "pm2 restart '$APP_NAME'"
  else
    log "Starting PM2 app"
    run "pm2 start npm --name '$APP_NAME' -- start"
    run "pm2 save"
  fi
else
  log "PM2 not installed. Start app manually: npm start &"
fi

# 7) Health checks
log "Health check (HTTPS, then local)"
if command -v curl >/dev/null 2>&1; then
  curl -sf "https://$DOMAIN/api/health" || curl -sf "http://localhost:3000/api/health" || true
fi

# Hint about stash
if [ "$STASHED" -eq 1 ]; then
  log "Local changes were stashed. Review with: git stash list; apply via: git stash pop"
fi

log "Update completed successfully."