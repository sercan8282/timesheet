#!/usr/bin/env bash
set -euo pipefail

# Timesheet Linux Installer
# - Installs to /var/www/timesheet
# - Clones code from https://github.com/sercan8282/timesheet
# - Creates a dedicated service account
# - Installs Node.js (NodeSource 24.x), git, sqlite3, nginx, certbot
# - Generates secure secrets and .env
# - Initializes the database
# - Configures Nginx (Let's Encrypt or custom certs)
# - Creates and starts a systemd service

########################################
# Preconditions
########################################
if [[ $(id -u) -ne 0 ]]; then
  echo "❌ Please run this installer as root (use sudo)."
  exit 1
fi

OS_ID="$(. /etc/os-release; echo "$ID")"
if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
  echo "⚠️ This script targets Debian/Ubuntu. Proceeding, but package steps may differ."
fi

########################################
# Prompts
########################################
echo "\n===== Timesheet Installer (Linux) =====\n"

INSTALL_DIR="/var/www/timesheet"
read -rp "Domain (e.g., example.com): " DOMAIN
DOMAIN=${DOMAIN// /}
if [[ -z "$DOMAIN" ]]; then
  echo "❌ Domain is required."; exit 1
fi

read -rp "Service account username [timesheetapp]: " SVC_USER
SVC_USER=${SVC_USER:-timesheetapp}

read -rp "Database filename [database.sqlite]: " DB_FILE
DB_FILE=${DB_FILE:-database.sqlite}
DB_PATH="$INSTALL_DIR/$DB_FILE"

read -rp "Use Let's Encrypt for SSL? [Y/n]: " USE_LE
USE_LE=${USE_LE:-Y}
USE_LE=$(echo "$USE_LE" | tr '[:upper:]' '[:lower:]')

CERT_PATH=""
KEY_PATH=""
if [[ "$USE_LE" != "y" && "$USE_LE" != "yes" ]]; then
  echo "Provide paths to existing certificate files (PEM):"
  read -rp "- Fullchain cert path [/etc/ssl/certs/$DOMAIN.fullchain.pem]: " CERT_PATH
  CERT_PATH=${CERT_PATH:-/etc/ssl/certs/$DOMAIN.fullchain.pem}
  read -rp "- Private key path [/etc/ssl/private/$DOMAIN.privkey.pem]: " KEY_PATH
  KEY_PATH=${KEY_PATH:-/etc/ssl/private/$DOMAIN.privkey.pem}
fi

read -rp "Admin username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
read -rp "Admin password (min 12 chars, no default shown): " ADMIN_PASSWORD
if [[ -z "$ADMIN_PASSWORD" || ${#ADMIN_PASSWORD} -lt 12 ]]; then
  echo "❌ Admin password must be at least 12 characters."; exit 1
fi

PORT=3000
NODE_ENV=production

########################################
# System dependencies
########################################
echo "\n📦 Installing system dependencies..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git build-essential sqlite3 nginx ufw

echo "\n⬇️ Installing Node.js 24.x (NodeSource)..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
else
  echo "Node.js already installed: $(node -v)"
fi

########################################
# Service account
########################################
echo "\n👤 Creating service account ($SVC_USER)..."
if ! id "$SVC_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$INSTALL_DIR" "$SVC_USER" || true
fi

########################################
# Clone repository
########################################
echo "\n📁 Preparing app directory at $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  echo "\n🔗 Cloning https://github.com/sercan8282/timesheet ..."
  git clone https://github.com/sercan8282/timesheet "$INSTALL_DIR"
else
  echo "Repo already cloned in $INSTALL_DIR; pulling latest changes..."
  (cd "$INSTALL_DIR" && git pull --ff-only)
fi

chown -R "$SVC_USER":"$SVC_USER" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"

########################################
# App dependencies
########################################
echo "\n📦 Installing npm dependencies..."
cd "$INSTALL_DIR"
npm install --only=prod

echo "\n🔍 Running npm audit..."
if ! npm audit --audit-level=high >/dev/null 2>&1; then
  echo "⚠️ npm audit reported issues. Attempting fix..."
  npm audit fix || true
fi

########################################
# Secrets and environment
########################################
echo "\n🔐 Generating secrets and writing .env ..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

SSL_ENABLED=0
APP_URL="http://$DOMAIN"
if [[ "$USE_LE" == "y" || "$USE_LE" == "yes" ]]; then
  SSL_ENABLED=1
  APP_URL="https://$DOMAIN"
elif [[ -n "$CERT_PATH" && -n "$KEY_PATH" ]]; then
  SSL_ENABLED=1
  APP_URL="https://$DOMAIN"
fi

cat > "$INSTALL_DIR/.env" <<EOF
# Runtime
PORT=$PORT
NODE_ENV=$NODE_ENV

# Database
DB_PATH=$DB_PATH

# Security
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

# App config
APP_DOMAIN=$DOMAIN
APP_URL=$APP_URL
SSL_ENABLED=$SSL_ENABLED
EOF

chown "$SVC_USER":"$SVC_USER" "$INSTALL_DIR/.env"
chmod 640 "$INSTALL_DIR/.env"

########################################
# Initialize database
########################################
echo "\n💾 Initializing database..."
sudo -u "$SVC_USER" -H bash -lc "cd '$INSTALL_DIR' && npm run init-db"

# Ensure DB file exists and has correct ownership
if [[ ! -f "$DB_PATH" ]]; then
  echo "❌ Database not created at $DB_PATH"; exit 1
fi

# Fix ownership and permissions (use sudo to ensure they stick)
sudo chown "$SVC_USER":"$SVC_USER" "$DB_PATH"
sudo chmod 640 "$DB_PATH"
echo "✅ Database ownership set: $SVC_USER"

# Optional: create system_config defaults in one pass if script exists
if [[ -f "$INSTALL_DIR/scripts/setup-system-config.js" ]]; then
  echo "\n⚙️ Setting up system_config defaults..."
  sudo -u "$SVC_USER" -H bash -lc "cd '$INSTALL_DIR' && node scripts/setup-system-config.js"
fi

########################################
# systemd service
########################################
echo "\n🛠️ Creating systemd service..."
SERVICE_FILE="/etc/systemd/system/timesheet.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Timesheet Node.js Service
After=network.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable timesheet.service
systemctl start timesheet.service

########################################
# Nginx reverse proxy
########################################
echo "\n🌐 Configuring Nginx reverse proxy..."
NGINX_SITE="/etc/nginx/sites-available/$DOMAIN.conf"
NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN.conf"

cat > "$NGINX_SITE" <<'EOF'
server {
    listen 80;
    server_name DOMAIN_REPLACE;

  # Basic hardening for HTTP (still redirecting to HTTPS)
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header X-XSS-Protection "1; mode=block" always;

  client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sed -i "s/DOMAIN_REPLACE/$DOMAIN/g" "$NGINX_SITE"

ln -sf "$NGINX_SITE" "$NGINX_LINK"

if [[ "$USE_LE" == "y" || "$USE_LE" == "yes" ]]; then
  echo "\n🔒 Installing certbot and obtaining certificates via Let's Encrypt..."
  apt-get install -y certbot python3-certbot-nginx
  systemctl reload nginx || systemctl restart nginx
  # Interactive issuance (certbot will prompt for email and terms)
  certbot --nginx -d "$DOMAIN" --redirect || true

  # Harden the generated HTTPS server block with security headers
  if [[ -f "$NGINX_SITE" ]]; then
    # Insert headers and proxy/body settings if missing
    perl -0777 -i -pe '
      s/(server\s*\{[^}]*?ssl_ciphers[^;]*;\s*)/
$1    ssl_prefer_server_ciphers on;\n    ssl_session_cache shared:SSL:10m;\n    ssl_session_timeout 10m;\n\n    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n    add_header X-Content-Type-Options "nosniff" always;\n    add_header X-Frame-Options "SAMEORIGIN" always;\n    add_header Referrer-Policy "no-referrer" always;\n    add_header X-XSS-Protection "1; mode=block" always;\n    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;\n\n    client_max_body_size 20m;\n\n/si;
      s/(location\s+\/\s*\{\s*\n\s*proxy_pass[^\n]*\n\s*proxy_http_version[^\n]*\n\s*proxy_set_header\s+Upgrade[^\n]*\n\s*proxy_set_header\s+Connection[^\n]*\n\s*proxy_set_header\s+Host[^\n]*\n)/
$1        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n/si;
    ' "$NGINX_SITE"
  fi
else
  echo "\n🔐 Configuring custom SSL certificates..."
  if [[ ! -f "$CERT_PATH" || ! -f "$KEY_PATH" ]]; then
    echo "❌ Cert or key file not found: $CERT_PATH / $KEY_PATH"; exit 1
  fi
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "no-referrer" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

  client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
  ln -sf "$NGINX_SITE" "$NGINX_LINK"
fi

nginx -t
systemctl reload nginx

########################################
# Firewall
########################################
if command -v ufw >/dev/null 2>&1; then
  echo "\n🧱 Configuring firewall (UFW): OpenSSH, 80, 443 and enabling..."
  # Ensure SSH remains accessible
  ufw allow OpenSSH || true
  # Allow web traffic
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  # Enable firewall non-interactively
  ufw --force enable || true
  echo "\nUFW status:"
  ufw status verbose || true
fi

########################################
# Final checks
########################################
echo "\n✅ Installation complete! Summary:\n"
echo "- Domain:            $DOMAIN"
echo "- Install dir:       $INSTALL_DIR"
echo "- Service account:   $SVC_USER"
echo "- Database path:     $DB_PATH"
echo "- Node service:      timesheet.service (running)"
echo "- Nginx site:        $NGINX_SITE"
echo "- SSL:               $( [[ "$USE_LE" == "y" || "$USE_LE" == "yes" ]] && echo "Let's Encrypt" || echo "Custom certs" )"

echo "\nTry:"
echo " - curl -I http://$DOMAIN"
echo " - curl -I https://$DOMAIN"
echo "\nIf HTTPS not yet active, wait a minute and:"
echo " - systemctl status timesheet.service"
echo " - journalctl -u timesheet.service -e"
echo " - tail -n 200 /var/log/nginx/error.log"

exit 0
