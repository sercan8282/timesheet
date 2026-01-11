# 🔧 PRACTICAL INSTALLATION GUIDE - Service Account Setup

**Doel:** Stap-voor-stap gids voor veilige installatie van timesheet service account

---

## 📋 INHOUDSOPGAVE

1. [System Requirements](#system-requirements)
2. [Pre-Installation Checklist](#pre-installation-checklist)
3. [Installation Steps](#installation-steps)
4. [Service Account Setup](#service-account-setup)
5. [Configuration Management](#configuration-management)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## 🖥️ System Requirements

### Windows Server
- **OS:** Windows Server 2019/2022 or Windows 10 Pro
- **Node.js:** v20 LTS or higher
- **npm:** 11.0 or higher
- **Disk Space:** 500 MB minimum
- **RAM:** 1 GB minimum (2 GB recommended)
- **Database:** SQLite3 (included)
- **Permissions:** Administrator access

### Linux Server
- **OS:** Ubuntu 20.04 LTS / CentOS 8+
- **Node.js:** v20 LTS
- **npm:** 11.0 or higher
- **Disk Space:** 500 MB
- **Permissions:** sudo access

---

## ✅ Pre-Installation Verification

```bash
# Check Node.js version
node --version              # Should be v20+

# Check npm version
npm --version               # Should be 11+

# Check available disk space
df -h / /home               # Linux
dir C: D:                   # Windows PowerShell

# Check ports availability
netstat -ano | findstr 3000  # Windows
lsof -i :3000                # Linux/Mac
```

---

## 🚀 Installation Steps (Interactive)

### Step 1: Install Dependencies
```bash
npm install
# Result: ~247 packages, 0 vulnerabilities
```

### Step 2: Run Interactive Setup
```bash
npm run setup-interactive
```

This runs: `node scripts/setup-interactive.js`

**Workflow:**
1. Domain configuration
2. Admin credentials
3. JWT secret generation
4. Database initialization
5. Configuration review

### Step 3: Verify Setup
```bash
# Check if .env created
cat .env

# Check database exists
ls -la database.sqlite

# Check startup
npm start
```

---

## 🔐 Service Account Setup (Windows - Interactive)

### PowerShell Script - Safe Setup

Create `scripts/setup-service-account.ps1`:

```powershell
# Run as Administrator
param(
    [string]$ServiceAccountName = "timesheet_svc",
    [string]$AppPath = "C:\Apps\Timesheet"
)

Write-Host "🔐 Timesheet Service Account Setup (Interactive)" -ForegroundColor Cyan

# Step 1: Service Account Creation
Write-Host "`n1️⃣ Creating Service Account..." -ForegroundColor Yellow
$password = Read-Host "Enter password for service account" -AsSecureString
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password))

try {
    New-LocalUser -Name $ServiceAccountName -Password $password -FullName "Timesheet Service Account" -Description "Service account for timesheet application" -ErrorAction Stop
    Write-Host "✅ Service account created: $ServiceAccountName" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "⚠️ Service account already exists" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
}

# Step 2: File Permissions
Write-Host "`n2️⃣ Setting file permissions..." -ForegroundColor Yellow
if (!(Test-Path $AppPath)) {
    Write-Host "❌ App path not found: $AppPath" -ForegroundColor Red
    exit 1
}

try {
    $acl = Get-Acl $AppPath
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        "$env:COMPUTERNAME\$ServiceAccountName",
        "Modify",
        "ContainerInherit,ObjectInherit",
        "None",
        "Allow"
    )
    $acl.SetAccessRule($rule)
    Set-Acl $AppPath $acl
    Write-Host "✅ File permissions configured" -ForegroundColor Green
} catch {
    Write-Host "❌ Error setting permissions: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Service Installation
Write-Host "`n3️⃣ Installing Windows Service..." -ForegroundColor Yellow
$serviceExists = Get-Service -Name "TimesheetApp" -ErrorAction SilentlyContinue
if ($serviceExists) {
    Write-Host "⚠️ Service already exists. Stop it first:" -ForegroundColor Yellow
    Write-Host "  nssm stop TimesheetApp" -ForegroundColor Cyan
    exit 0
}

Write-Host "Use NSSM to install service:" -ForegroundColor Yellow
Write-Host "  nssm install TimesheetApp 'C:\Program Files\nodejs\node.exe' 'C:\Apps\Timesheet\server.js'" -ForegroundColor Cyan
Write-Host "  nssm set TimesheetApp ObjectName '$env:COMPUTERNAME\$ServiceAccountName' '$plainPassword'" -ForegroundColor Cyan
Write-Host "  nssm start TimesheetApp" -ForegroundColor Cyan

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "Next: Install NSSM and run commands above to create Windows Service" -ForegroundColor Yellow
```

### Usage (Windows PowerShell as Administrator)
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\scripts\setup-service-account.ps1
```

---

## 🔐 Service Account Setup (Linux - Interactive)

### Bash Script - Safe Setup

Create `scripts/setup-service-account.sh`:

```bash
#!/bin/bash

set -e

echo "🔐 Timesheet Service Account Setup (Interactive)"

SERVICE_ACCOUNT="timesheetapp"
APP_PATH="/var/www/timesheet"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (sudo)"
   exit 1
fi

# Step 1: Create service account
echo ""
echo "1️⃣ Creating Service Account..."
if id "$SERVICE_ACCOUNT" &>/dev/null; then
    echo "⚠️ Service account '$SERVICE_ACCOUNT' already exists"
else
    useradd -r -s /bin/bash -m -d /home/$SERVICE_ACCOUNT $SERVICE_ACCOUNT
    echo "✅ Service account created: $SERVICE_ACCOUNT"
fi

# Step 2: Set file permissions
echo ""
echo "2️⃣ Setting file permissions..."
chown -R $SERVICE_ACCOUNT:$SERVICE_ACCOUNT $APP_PATH
chmod 750 $APP_PATH
chmod 640 $APP_PATH/.env
chmod 755 $APP_PATH/public/uploads
echo "✅ File permissions configured"

# Step 3: Create systemd service
echo ""
echo "3️⃣ Creating systemd service..."

cat > /etc/systemd/system/timesheet.service <<EOF
[Unit]
Description=Timesheet Application
After=network.target

[Service]
Type=simple
User=$SERVICE_ACCOUNT
WorkingDirectory=$APP_PATH
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10s
StandardOutput=append:/var/log/timesheet/stdout.log
StandardError=append:/var/log/timesheet/stderr.log
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

# Step 4: Create logs directory
echo ""
echo "4️⃣ Creating logs directory..."
mkdir -p /var/log/timesheet
chown $SERVICE_ACCOUNT:$SERVICE_ACCOUNT /var/log/timesheet
chmod 755 /var/log/timesheet
echo "✅ Logs directory created"

# Step 5: Enable service
echo ""
echo "5️⃣ Enabling service..."
systemctl daemon-reload
systemctl enable timesheet
echo "✅ Service enabled"

# Summary
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Start service: sudo systemctl start timesheet"
echo "  2. Check status: sudo systemctl status timesheet"
echo "  3. View logs: journalctl -u timesheet -f"
echo ""
```

### Usage (Linux with sudo)
```bash
sudo chmod +x scripts/setup-service-account.sh
sudo scripts/setup-service-account.sh
```

---

## ⚙️ Configuration via Admin Panel

**Access:** http://localhost:3000/admin → Configuration tab

**Settings to Configure:**
1. APP_DOMAIN - Your domain
2. APP_URL - Full URL with protocol
3. SSL_ENABLED - Set to true if using HTTPS
4. SSL_CERT_PATH - Path to certificate
5. LETSENCRYPT_EMAIL - For auto-renewal
6. JWT_SECRET - Keep secure, don't share

---

## ✅ Verification Checklist

After installation, verify:

```bash
# 1. Server running
curl http://localhost:3000/

# 2. Database exists
ls -la database.sqlite

# 3. Admin can login (browser)
# Visit http://localhost:3000
# Login: admin@example.com / (password from setup)

# 4. Configuration saved
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:3000/api/admin/system-config

# 5. Service account has permissions
# File should be writable
touch database.sqlite-test
rm database.sqlite-test
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Issue 2: Database Permissions
```bash
# Fix permissions
sudo chown nodeuser:nodegroup database.sqlite
sudo chmod 644 database.sqlite
```

### Issue 3: .env Not Found
```bash
# Check if .env exists
ls -la .env

# If missing, run setup again
npm run setup-interactive
```

### Issue 4: Admin Can't Login
```bash
# Reset admin password
node scripts/reset-admin-mfa.js

# Then change in admin panel
```

---

## 🔒 Security Best Practices

✅ **Do:**
- Change default admin password immediately
- Enable MFA for all admin users
- Use HTTPS/SSL in production
- Keep database backed up
- Monitor logs regularly
- Update Node.js and packages

❌ **Don't:**
- Share JWT_SECRET
- Use weak passwords
- Run as root (Linux)
- Disable security headers
- Expose .env file
- Skip security updates

---

**Last Updated:** 11 January 2026  
**Status:** Production Ready ✅
