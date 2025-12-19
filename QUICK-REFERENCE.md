# UBUNTU TIMESHEET - SNELLE REFERENTIE

Een snelle command-reference voor dagelijks beheer.

---

## 📋 INHOUDSTAFEL

1. [Daily Checks](#daily-checks)
2. [App Management](#app-management)
3. [Database Management](#database-management)
4. [Logs & Debugging](#logs--debugging)
5. [Updates & Deployment](#updates--deployment)
6. [Firewall & Security](#firewall--security)
7. [Backups & Recovery](#backups--recovery)
8. [SSL/HTTPS](#ssltls)
9. [Emergency Commands](#emergency-commands)

---

## Daily Checks

### Is App Running?

```bash
pm2 list
# Check "status" column = "online"
```

### Any Errors?

```bash
pm2 logs timesheet --lines 20 | grep -i error
# Zou niets moeten geven (geen errors)
```

### Database OK?

```bash
sqlite3 /opt/timesheet/database.sqlite "SELECT COUNT(*) FROM users;" | head -1
# Zou aantal users tonen
```

### Server Resources

```bash
# Memory & CPU
free -h
df -h

# Or interactive
htop
# Press 'q' to exit
```

### SSL Certificate Status

```bash
sudo certbot certificates
# Zou expiry date moeten tonen
```

---

## App Management

### Start App

```bash
cd /opt/timesheet
pm2 start npm --name "timesheet" -- start
```

### Stop App

```bash
pm2 stop timesheet
```

### Restart App

```bash
pm2 restart timesheet
```

### Delete from PM2

```bash
pm2 delete timesheet
```

### View App Details

```bash
pm2 info timesheet
# Shows PID, uptime, memory, CPU, etc.
```

### Save PM2 Config

```bash
pm2 save
# Saves current process list for auto-startup
```

---

## Database Management

### Backup Database

```bash
cd /opt/timesheet
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)
```

### List Backups

```bash
ls -lh /opt/timesheet/database.sqlite*
```

### Restore Backup

```bash
pm2 stop timesheet
cp /opt/timesheet/database.sqlite.backup.YYYYMMDD-HHMMSS /opt/timesheet/database.sqlite
pm2 start timesheet
```

### Check Database Health

```bash
sqlite3 /opt/timesheet/database.sqlite "PRAGMA integrity_check;"
# Should say "ok"
```

### Query Database

```bash
# Count users
sqlite3 /opt/timesheet/database.sqlite "SELECT COUNT(*) as users FROM users;"

# List all tables
sqlite3 /opt/timesheet/database.sqlite ".tables"

# Export to CSV
sqlite3 /opt/timesheet/database.sqlite ".mode csv" ".output data.csv" "SELECT * FROM users;"
```

### Initialize Database

```bash
cd /opt/timesheet
npm run init-db
```

### Reset Database (⚠️ DANGEROUS!)

```bash
# DELETES ALL DATA - CONFIRM FIRST!
cd /opt/timesheet
npm run reset-db
```

---

## Logs & Debugging

### Real-time Logs

```bash
pm2 logs timesheet
# Press Ctrl+C to exit
```

### Last 50 Lines

```bash
pm2 logs timesheet --lines 50
```

### Logs from Last 24 Hours

```bash
pm2 logs timesheet --since 24h
```

### Nginx Error Logs

```bash
sudo tail -f /var/log/nginx/timesheet_error.log
# Press Ctrl+C to exit
```

### Nginx Access Logs

```bash
sudo tail -f /var/log/nginx/timesheet_access.log
```

### System Journal Logs

```bash
sudo journalctl -u nginx -n 20
sudo journalctl -u certbot -n 20
```

### Test API Health

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

### Check Port 3000

```bash
netstat -tulpn | grep 3000
# or
lsof -i :3000
```

---

## Updates & Deployment

### Pull Latest Code

```bash
cd /opt/timesheet
git fetch origin
git pull origin main
```

### Check What Changed

```bash
cd /opt/timesheet
git log --oneline -10
```

### Install/Update Dependencies

```bash
cd /opt/timesheet
npm install
```

### Full Update Workflow

```bash
cd /opt/timesheet
pm2 stop timesheet                                    # Stop app
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)  # Backup
git pull origin main                                 # Get latest code
npm install                                          # Update dependencies
npm run init-db                                      # Update database schema
pm2 start timesheet                                  # Start app
pm2 logs timesheet | head -20                        # Check logs
```

### Rollback to Previous Version

```bash
cd /opt/timesheet
pm2 stop timesheet
git revert HEAD~1                                    # Undo last commit
npm install
pm2 start timesheet
```

---

## Firewall & Security

### Check Firewall Status

```bash
sudo ufw status
sudo ufw status verbose
```

### Allow Port

```bash
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
```

### Deny Port

```bash
sudo ufw deny 3000/tcp
```

### Delete Rule

```bash
sudo ufw delete allow 80/tcp
```

### Enable/Disable Firewall

```bash
sudo ufw enable      # Turn on
sudo ufw disable     # Turn off
```

### Check Open Ports

```bash
sudo netstat -tulpn
# or
sudo ss -tulpn
```

---

## Backups & Recovery

### List All Backups

```bash
ls -lh /opt/timesheet/database.sqlite*
```

### Create Manual Backup

```bash
cd /opt/timesheet
tar -czf database-backup-$(date +%Y%m%d-%H%M%S).tar.gz database.sqlite
```

### Download Backup (from local machine)

```bash
# On your local computer:
scp admin@YOUR-SERVER:/opt/timesheet/database.sqlite.backup.* ./backups/
```

### Clean Old Backups (older than 30 days)

```bash
find /opt/timesheet -name "database.sqlite.backup.*" -mtime +30 -delete
```

### Restore from Backup

```bash
pm2 stop timesheet
cp /opt/timesheet/database.sqlite.backup.20231219-103045 /opt/timesheet/database.sqlite
pm2 start timesheet
```

---

## SSL/TLS

### Check Certificate Status

```bash
sudo certbot certificates
```

### Check Expiry Date

```bash
openssl x509 -enddate -noout -in /etc/letsencrypt/live/YOUR-DOMAIN.COM/cert.pem
```

### Test SSL/TLS

```bash
openssl s_client -connect YOUR-DOMAIN.COM:443
```

### Manual Renewal

```bash
sudo certbot renew --force-renewal
```

### Dry-run Renewal

```bash
sudo certbot renew --dry-run
```

### Check Auto-renewal

```bash
sudo systemctl status certbot.timer
```

### View Renewal Logs

```bash
sudo journalctl -u certbot.timer --all
```

---

## Nginx Management

### Test Config

```bash
sudo nginx -t
# Should say "syntax is ok"
```

### Reload Config

```bash
sudo systemctl reload nginx
```

### Restart Nginx

```bash
sudo systemctl restart nginx
```

### Check Nginx Status

```bash
sudo systemctl status nginx
```

### View Nginx Error Log

```bash
sudo tail -f /var/log/nginx/error.log
```

### View Nginx Access Log

```bash
sudo tail -f /var/log/nginx/access.log
```

### Test HTTP/HTTPS

```bash
curl -I http://YOUR-DOMAIN.COM
curl -I https://YOUR-DOMAIN.COM
```

---

## Environment & Configuration

### View .env File

```bash
cat /opt/timesheet/.env
```

### Edit .env File

```bash
nano /opt/timesheet/.env
# Edit, then Ctrl+O, Enter, Ctrl+X
```

### Reload .env (restart app)

```bash
pm2 restart timesheet
```

### Check Database Path

```bash
grep DB_PATH /opt/timesheet/.env
```

### Check JWT_SECRET

```bash
grep JWT_SECRET /opt/timesheet/.env
```

---

## System Information

### Ubuntu Version

```bash
lsb_release -a
uname -a
```

### Node.js & npm Version

```bash
node --version
npm --version
```

### Disk Space

```bash
df -h
```

### Memory Usage

```bash
free -h
# or detailed
free -h --wide
```

### Running Processes

```bash
ps aux | grep node
ps aux | grep nginx
```

### Server Uptime

```bash
uptime
```

---

## Emergency Commands

### App Completely Crashed - Reset PM2

```bash
pm2 kill
pm2 start npm --name "timesheet" -- start
pm2 save
```

### Database Translation Error - UNIQUE Constraint Failed

```bash
# Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: translations.namespace, translations.key, translations.locale

# Quick fix:
pm2 stop timesheet
rm /opt/timesheet/database.sqlite
npm run init-db
pm2 start timesheet

# Or with backup:
pm2 stop timesheet
cp /opt/timesheet/database.sqlite /opt/timesheet/database.sqlite.backup.$(date +%Y%m%d)
rm /opt/timesheet/database.sqlite
npm run init-db
pm2 start timesheet
```

### Database Locked - Force Unlock

```bash
pm2 stop timesheet
rm /opt/timesheet/database.sqlite-*  # Remove lock files if any
pm2 start timesheet
```

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000
# or
netstat -tulpn | grep 3000

# Kill process (replace PID)
kill -9 <PID>
```

### Out of Disk Space

```bash
# Find large files
du -sh /opt/timesheet/*

# Check database size
ls -lh /opt/timesheet/database.sqlite

# Clean up old backups (⚠️ be careful!)
find /opt/timesheet -name "database.sqlite.backup.*" -delete
```

### Nginx Not Starting

```bash
# Check config
sudo nginx -t

# See errors
sudo journalctl -u nginx -n 50

# Try reload
sudo systemctl reload nginx
```

### SSL Certificate Renewal Stuck

```bash
# Check certbot
sudo certbot renew --force-renewal --dry-run

# View logs
sudo journalctl -u certbot.timer -n 50
```

### Memory Leak (App Using Too Much RAM)

```bash
# Check memory
pm2 monit

# Restart app
pm2 restart timesheet

# Monitor
pm2 logs timesheet
```


---

## Quick Copy-Paste Commands

### Full System Check

```bash
echo "=== System ===" && uname -a && echo "" && \
echo "=== Disk ===" && df -h && echo "" && \
echo "=== Memory ===" && free -h && echo "" && \
echo "=== App Status ===" && pm2 list && echo "" && \
echo "=== Certificate ===" && sudo certbot certificates
```

### Health Check URL (Test Everything)

```bash
YOUR_DOMAIN="your-domain.com"
echo "HTTP:" && curl -I http://$YOUR_DOMAIN && echo "" && \
echo "HTTPS:" && curl -I https://$YOUR_DOMAIN && echo "" && \
echo "API:" && curl https://$YOUR_DOMAIN/api/health
```

### Create Daily Backup

```bash
cd /opt/timesheet && \
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S) && \
echo "Backup created: $(ls -t database.sqlite.backup.* | head -1)"
```

### Monitor in Real-time

```bash
watch -n 5 'pm2 list && echo "" && echo "Memory: $(free -h | grep Mem)"'
```

---

## Common Scenarios

### "I want to update to latest code"

```bash
cd /opt/timesheet
pm2 stop timesheet
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)
git pull origin main
npm install
npm run init-db
pm2 start timesheet
pm2 logs timesheet | head -20
```

### "Something broke, restore backup"

```bash
cd /opt/timesheet
pm2 stop timesheet
cp database.sqlite.backup.LATEST database.sqlite
pm2 start timesheet
pm2 logs timesheet | head -20
```

### "Add new SSL domain"

```bash
sudo certbot certonly --nginx -d new-domain.com -d www.new-domain.com
# Update Nginx config with new domain
sudo nano /etc/nginx/sites-available/default
# Restart Nginx
sudo systemctl restart nginx
```

### "Migrate to new server"

```bash
# On new server:
cd /opt && git clone <your-repo> timesheet
cd timesheet
sudo chown -R $USER:$USER .
cp .env.example .env
nano .env  # Update settings
npm install
npm run init-db
pm2 start npm --name "timesheet" -- start

# Or restore from backup:
scp old-server:/opt/timesheet/database.sqlite ./
npm run init-db  # First create schema
# Then manually restore if needed
```

---

## Useful Links & Documentation

- **Node.js Docs**: https://nodejs.org/docs/
- **npm Docs**: https://docs.npmjs.com/
- **PM2 Docs**: https://pm2.keymetrics.io/docs/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/
- **SQLite Docs**: https://www.sqlite.org/cli.html
- **Git Docs**: https://git-scm.com/docs/

---

## Pro Tips

```bash
# Alias for quick commands
alias tsl-logs="pm2 logs timesheet"
alias tsl-status="pm2 list"
alias tsl-stop="pm2 stop timesheet"
alias tsl-start="pm2 start timesheet"
alias tsl-restart="pm2 restart timesheet"

# Add to ~/.bashrc to make permanent
echo 'alias tsl-logs="pm2 logs timesheet"' >> ~/.bashrc
source ~/.bashrc
```

---

**Version**: 1.0
**Last Updated**: December 2024
