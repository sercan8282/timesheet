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

# 6) Start/Restart app with proper wait and health check
if command -v pm2 >/dev/null 2>&1; then
  PM2_BIN="$(command -v pm2 2>/dev/null || which pm2 2>/dev/null || echo '')"
  if [ -n "$PM2_BIN" ]; then
    log "Stopping any existing PM2 process"
    "$PM2_BIN" stop "$APP_NAME" >/dev/null 2>&1 || true
    "$PM2_BIN" delete "$APP_NAME" >/dev/null 2>&1 || true
    
    log "Starting fresh PM2 process"
    if "$PM2_BIN" start npm --name "$APP_NAME" -- start; then
      "$PM2_BIN" save
      log "PM2 started successfully"
    else
      log "ERROR: PM2 start failed"
      exit 1
    fi
    
    # Wait for app to be online in PM2
    log "Waiting for app to reach 'online' status in PM2..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      PM2_STATUS=$("$PM2_BIN" jlist | grep -o '"pm2_env":{"status":"[^"]*"' | grep -o 'status":"[^"]*"' | cut -d'"' -f3 || echo "unknown")
      if [ "$PM2_STATUS" = "online" ]; then
        log "PM2 status: online ✓"
        break
      elif [ "$PM2_STATUS" = "errored" ] || [ "$PM2_STATUS" = "stopped" ]; then
        log "ERROR: PM2 status is $PM2_STATUS"
        log "Checking PM2 logs for errors:"
        "$PM2_BIN" logs "$APP_NAME" --lines 50 --nostream || true
        exit 1
      fi
      RETRY_COUNT=$((RETRY_COUNT + 1))
      log "PM2 status: $PM2_STATUS (attempt $RETRY_COUNT/$MAX_RETRIES)"
      sleep 1
    done
    
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      log "ERROR: App did not reach online status after ${MAX_RETRIES}s"
      "$PM2_BIN" logs "$APP_NAME" --lines 50 --nostream || true
      exit 1
    fi
    
    # Wait for HTTP health endpoint
    log "Waiting for HTTP health endpoint..."
    HEALTH_RETRY=0
    MAX_HEALTH_RETRIES=30
    while [ $HEALTH_RETRY -lt $MAX_HEALTH_RETRIES ]; do
      if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        log "Health endpoint responding ✓"
        break
      fi
      HEALTH_RETRY=$((HEALTH_RETRY + 1))
      log "Health check failed (attempt $HEALTH_RETRY/$MAX_HEALTH_RETRIES)"
      sleep 1
    done
    
    if [ $HEALTH_RETRY -ge $MAX_HEALTH_RETRIES ]; then
      log "ERROR: Health endpoint not responding after ${MAX_HEALTH_RETRIES}s"
      log "Checking app logs:"
      "$PM2_BIN" logs "$APP_NAME" --lines 50 --nostream || true
      log "Checking port 3000:"
      ss -ltn | grep 3000 || netstat -ltn | grep 3000 || echo "Port 3000 not listening"
      exit 1
    fi
    
    log "PM2 final status:"; "$PM2_BIN" status "$APP_NAME" || true
  else
    log "PM2 not found in PATH; skip restart (run 'pm2 restart $APP_NAME' manually)"
    exit 1
  fi
else
  log "PM2 not installed. Cannot proceed with automated update."
  exit 1
fi

# 7) Final health checks
log "Final health verification"
if command -v curl >/dev/null 2>&1; then
  if curl -sf "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    log "HTTPS health check: OK ✓"
  elif curl -sf "http://localhost:3000/api/health" >/dev/null 2>&1; then
    log "Local health check: OK ✓ (HTTPS may need Nginx reload)"
  else
    log "WARNING: Health checks failed, but PM2 shows online. Check Nginx config."
  fi
fi

# Hint about stash
if [ "$STASHED" -eq 1 ]; then
  log "Local changes were stashed. Review with: git stash list; apply via: git stash pop"
fi

log "Update completed successfully."