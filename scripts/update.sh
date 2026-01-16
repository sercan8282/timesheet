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

# 1) Backup DB
if [ -f "$PROJECT_DIR/database.sqlite" ]; then
  mkdir -p "$PROJECT_DIR/backups"
  TS="$(date +%Y%m%d-%H%M%S)"
  BK="$PROJECT_DIR/backups/database-$TS.sqlite"
  log "Backing up DB to: $BK"; run "cp '$PROJECT_DIR/database.sqlite' '$BK'"
else
  log "No database.sqlite found (fresh install?)"
fi

# 2) Git remote & branch
if git rev-parse --git-dir >/dev/null 2>&1; then
  log "Git repo detected"
else
  log "Initializing git repo and setting origin"
  run "git init"
fi

# Fix git safe.directory if needed
if ! git config --get safe.directory >/dev/null 2>&1; then
  log "Adding safe.directory exception for $PROJECT_DIR"
  run "git config --global --add safe.directory '$PROJECT_DIR'"
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

# 3) Dependencies
if [ -f "$PROJECT_DIR/package-lock.json" ]; then
  log "Installing deps via npm ci"; run "npm ci"
else
  log "Installing deps via npm install"; run "npm install"
fi

# 4) DB schema migration (SAFE - does not delete data)
log "Verifying database schema and initial settings..."
log "Running init-db (idempotent; only adds missing defaults)"
npm run init-db || {
  log "WARNING: Database initialization had issues, but continuing..."
}

# 5) Start/Restart app with proper wait and health check
if command -v pm2 >/dev/null 2>&1; then
  PM2_BIN="$(command -v pm2 2>/dev/null || which pm2 2>/dev/null || echo '')"
  if [ -n "$PM2_BIN" ]; then
    log "Stopping any existing PM2 process"
    "$PM2_BIN" stop "$APP_NAME" >/dev/null 2>&1 || true
    "$PM2_BIN" delete "$APP_NAME" >/dev/null 2>&1 || true
    
    # Pre-flight checks before starting
    log "Pre-flight checks:"
    log "  Node version: $(node --version 2>/dev/null || echo 'NOT FOUND')"
    log "  npm version: $(npm --version 2>/dev/null || echo 'NOT FOUND')"
    log "  Current user: $(whoami)"
    log "  Project dir: $PROJECT_DIR"
    
    # Check if .env exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
      log "WARNING: .env file not found - app may fail to start"
    else
      log "  .env file: exists"
      # Check critical env vars without exposing values
      if grep -q "^PORT=" "$PROJECT_DIR/.env" 2>/dev/null; then
        log "  PORT variable: set"
      else
        log "WARNING: PORT not set in .env"
      fi
    fi
    
    # Check database
    if [ -f "$PROJECT_DIR/database.sqlite" ]; then
      log "  Database: exists ($(du -h "$PROJECT_DIR/database.sqlite" | cut -f1))"
      # Check if writable
      if [ -w "$PROJECT_DIR/database.sqlite" ]; then
        log "  Database permissions: writable ✓"
      else
        log "ERROR: Database is not writable by current user"
        exit 1
      fi
    else
      log "WARNING: database.sqlite not found - will be created on first run"
    fi
    
    # Check if port 3000 is already in use
    if command -v ss >/dev/null 2>&1; then
      if ss -ltn | grep -q ":3000 "; then
        log "WARNING: Port 3000 already in use - killing existing process"
        fuser -k 3000/tcp 2>/dev/null || lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 2
      fi
    fi
    
    log "Starting fresh PM2 process"
    # Capture PM2 start output for debugging
    PM2_START_OUTPUT=$("$PM2_BIN" start npm --name "$APP_NAME" -- start 2>&1)
    PM2_START_EXIT=$?
    
    if [ $PM2_START_EXIT -eq 0 ]; then
      "$PM2_BIN" save
      log "PM2 start command succeeded"
    else
      log "ERROR: PM2 start failed with exit code $PM2_START_EXIT"
      log "PM2 output: $PM2_START_OUTPUT"
      log "Attempting direct diagnostic start..."
      
      # Try starting directly to see actual error
      log "Testing direct node start (will kill after 5 seconds):"
      timeout 5 node "$PROJECT_DIR/server.js" 2>&1 | head -n 50 || true
      
      exit 1
    fi
    
    # Wait for app to be online in PM2
    log "Waiting for app to reach 'online' status in PM2..."
    RETRY_COUNT=0
    MAX_RETRIES=30
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
      # More robust status check
      PM2_STATUS=$("$PM2_BIN" jlist 2>/dev/null | grep -A5 "\"name\":\"$APP_NAME\"" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
      
      if [ "$PM2_STATUS" = "online" ]; then
        log "PM2 status: online ✓"
        break
      elif [ "$PM2_STATUS" = "errored" ] || [ "$PM2_STATUS" = "stopped" ]; then
        log "ERROR: PM2 status is $PM2_STATUS"
        log "Checking PM2 logs for errors:"
        "$PM2_BIN" logs "$APP_NAME" --lines 100 --nostream 2>&1 || true
        log "Checking PM2 info:"
        "$PM2_BIN" info "$APP_NAME" 2>&1 || true
        exit 1
      fi
      RETRY_COUNT=$((RETRY_COUNT + 1))
      log "PM2 status: $PM2_STATUS (attempt $RETRY_COUNT/$MAX_RETRIES)"
      sleep 1
    done
    
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
      log "ERROR: App did not reach online status after ${MAX_RETRIES}s"
      log "PM2 logs:"
      "$PM2_BIN" logs "$APP_NAME" --lines 100 --nostream 2>&1 || true
      log "PM2 info:"
      "$PM2_BIN" info "$APP_NAME" 2>&1 || true
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

# 6) Final health checks
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