# DATABASE VEILIG BIJWERKEN VAN GITHUB

Dit document beschrijft hoe je veilig updates van GitHub haalt terwijl je database intact blijft.

---

## KORTE VERSIE (Voor Experts)

```bash
cd /opt/timesheet
pm2 stop timesheet
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)
git pull origin main
npm install
npm run init-db
pm2 start timesheet
```

---

## LANGE VERSIE (Stap voor Stap)

### Voordat je begint

**Zorg dat je begrijpt:**
- Git pull haalt code updates
- Database.sqlite staat in .gitignore (niet in git)
- npm install installeert nieuwe dependencies
- npm run init-db voegt NEW tabellen toe (bestaande data blijft!)

---

## STAP 1: Naar Project Map

```bash
# Connecteer via SSH naar je server
ssh admin@YOUR-SERVER-IP

# Ga naar project map
cd /opt/timesheet

# Controleer je bent op juiste plek
pwd
# Zou dit tonen: /opt/timesheet

# Controleer database bestaat
ls -lh database.sqlite
# Zou iets moeten tonen met grootte
```

---

## STAP 2: Backup Database

```bash
# Maak backup van huidige database
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)

# Dit creëert bestand als: database.sqlite.backup.20231219-103045

# Controleer backup
ls -lh database.sqlite*

# Je zou nu meerdere files moeten zien:
# database.sqlite                        (hutig)
# database.sqlite.backup.20231219-103045 (backup)
# database.sqlite.backup.20231218-202301 (oude backup)
```

**Wat gebeurt hier:**
- `cp` = kopieer bestand
- `database.sqlite.backup.` = prefix
- `$(date +%Y%m%d-%H%M%S)` = timestamp (20231219-103045)
- Dit maakt unieke naam zodat backups elkaar niet overwrite

---

## STAP 3: Stop Applicatie

```bash
# Stop Node.js app
pm2 stop timesheet

# Controleer status
pm2 list

# Zou dit moeten tonen:
# ┌─────┬────────────┬──────────────┬─────────┐
# │ id  │ name       │ status       │ uptime  │
# ├─────┼────────────┼──────────────┼─────────┤
# │ 0   │ timesheet  │ stopped      │ 0s      │
# └─────┴────────────┴──────────────┴─────────┘

# BELANGRIJK: Zorg dat "status" = "stopped"
```

**Waarom:**
- We willen niet dat database.sqlite in gebruik is terwijl we updates doen
- SQLite kan locked worden als app blijft schrijven

---

## STAP 4: Git Pull (Download Code Updates)

```bash
# Haal updates van GitHub
git pull origin main

# Zou dit soort output geven:
# From github.com:your-repo/timesheet
#  * branch            main       -> FETCH_HEAD
# Already up to date.
# (of)
# Updating a3f8e2b..f6e7a2b
# Fast-forward
#  server.js       | 10 +++++++---
#  routes/auth.js  |  5 +++++
#  2 files changed, 15 insertions(+)

# Controleer wat er gewijzigd is
git log --oneline -5

# Zou tonen welke commits gepulled zijn
```

**Wat gebeurt hier:**
- `git pull origin main` = download updates van GitHub
- Database.sqlite word NOT gewijzigd (staat in .gitignore)
- Alleen CODE bestanden worden geupdate

---

## STAP 5: Dependencies Bijwerken

```bash
# Installeer nieuwe npm packages (als die zijn toegevoegd)
npm install

# Dit kan 1-2 minuten duren

# Output zou iets als dit moeten zijn:
# added 5 packages, removed 2 packages, and changed 10 packages in 1.23s

# Controleer op fouten
npm audit

# Zou dit kunnen tonen:
# found 0 vulnerabilities
```

**Wat gebeurt hier:**
- `npm install` leest package.json
- Download alle afhankelijkheden
- Update node_modules folder

---

## STAP 6: Database Schema Bijwerken

```bash
# Voer init script uit (veilig!)
npm run init-db

# Dit voegt NIEUWE tabellen toe (bestaande blijft intact!)

# Output zou iets als dit moeten tonen:
# Initializing database...
# Connected to SQLite database
# ✓ Admin user exists, skipping...
# ✓ New tables added (if any)
# ✓ Database up to date

# BELANGRIJK VOORDEEL:
# - Init script controleert "IF NOT EXISTS"
# - Bestaande data wordt NIET verwijderd
# - Alleen NEW tables/columns worden added
```

**Hoe het veilig werkt:**

```javascript
// In het init script ziet het er zo uit:
CREATE TABLE IF NOT EXISTS users (
  // ...columns...
);

// "IF NOT EXISTS" betekent:
// - Als table al bestaat -> niets doen
// - Als table niet bestaat -> maak aan
// - Dus bestaande data blijft intact!
```

---

## STAP 7: Applicatie Herstarten

```bash
# Start applicatie
pm2 start timesheet

# Controleer status
pm2 list

# Zou dit moeten tonen:
# ┌─────┬────────────┬──────────────┬─────────┐
# │ id  │ name       │ status       │ uptime  │
# ├─────┼────────────┼──────────────┼─────────┤
# │ 0   │ timesheet  │ online       │ 2s      │
# └─────┴────────────┴──────────────┴─────────┘

# Status moet "online" zijn!
```

---

## STAP 8: Controleer Logs

```bash
# Zie real-time logs
pm2 logs timesheet

# Zou iets als dit moeten tonen:
# [PM2] [Cluster MODE] running on 4 forks
# [ONLINE] timesheet
# Server running on http://localhost:3000
# Database connected

# Controleer op ERRORS (rood)
# Zou geen errors moeten zijn

# Exit logs met: Ctrl + C
```

---

## STAP 9: Test Applicatie

```bash
# Test met curl
curl -I http://localhost:3000

# Zou dit geven:
# HTTP/1.1 200 OK
# Server: Express

# Test API
curl http://localhost:3000/api/health

# Zou dit geven:
# {"status":"ok"}

# Alles OK? Goed!
```

---

## STAP 10: Controleer Database Integriteit

```bash
# Controleer database is niet corrupt
sqlite3 /opt/timesheet/database.sqlite "PRAGMA integrity_check;"

# Zou "ok" geven

# Controleer data nog aanwezig
sqlite3 /opt/timesheet/database.sqlite "SELECT COUNT(*) as user_count FROM users;"

# Zou aantal users tonen (bv: 15)

# Controleer alle tabellen
sqlite3 /opt/timesheet/database.sqlite ".tables"

# Zou alle tabellen tonen:
# companies invoices mfa_settings users ...
```

---

## VOLLEDIGE WORKFLOW

```bash
# 1. SSH naar server
ssh admin@YOUR-SERVER-IP

# 2. Ga naar project map
cd /opt/timesheet

# 3. Maak backup
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)
echo "Backup gemaakt"

# 4. Stop app
pm2 stop timesheet
echo "App gestopt"

# 5. Pull updates
git pull origin main
echo "Code geupdate"

# 6. Install dependencies
npm install
echo "Dependencies installed"

# 7. Update database schema
npm run init-db
echo "Database schema updated"

# 8. Start app
pm2 start timesheet
echo "App gestart"

# 9. Zie logs
pm2 logs timesheet

# 10. Test
sleep 3
curl http://localhost:3000/api/health
echo "Test voltooid!"
```

---

## ALS IETS FOUT GAAT

### Applicatie Start Niet

```bash
# Stop app
pm2 stop timesheet

# Zie errors
pm2 logs timesheet

# Mogelijke fouten:
# - npm install mislukt → npm install opnieuw
# - database corrupt → restore backup
# - git conflict → git status en fix
```

### Database Corrupt / Foutmelding

```bash
# Herstel backup
pm2 stop timesheet
cp /opt/timesheet/database.sqlite.backup.LATEST /opt/timesheet/database.sqlite
pm2 start timesheet

# Controleer
pm2 logs timesheet
```

### Git Conflict (Merge Error)

```bash
# Zie conflict
git status

# Reset naar origineel
git reset --hard origin/main

# Pull opnieuw
git pull origin main
```

### Dependencies Probleem

```bash
# Clear cache
npm cache clean --force

# Verwijder node_modules
rm -rf node_modules package-lock.json

# Installeer opnieuw
npm install
```

---

## BACKUPS BEHEREN

### Backups Tonen

```bash
# Zie alle backups
ls -lh /opt/timesheet/database.sqlite*

# Output:
# -rw-r--r-- database.sqlite               (hutig)
# -rw-r--r-- database.sqlite.backup.20231219-103045
# -rw-r--r-- database.sqlite.backup.20231218-143022
# -rw-r--r-- database.sqlite.backup.20231217-082100
```

### Backup Herstellen

```bash
# Stop app
pm2 stop timesheet

# Restore backup
cp /opt/timesheet/database.sqlite.backup.20231219-103045 /opt/timesheet/database.sqlite

# Start app
pm2 start timesheet
```

### Oude Backups Verwijderen

```bash
# Houd alleen backups ouder dan 30 dagen
find /opt/timesheet -name "database.sqlite.backup.*" -type f -mtime +30 -delete

# Of handmatig
rm /opt/timesheet/database.sqlite.backup.20231101-*
```

---

## AUTOMATION MET CRON

### Automatische Backup voor Update

```bash
# Maak update script
nano /opt/timesheet/update.sh
```

```bash
#!/bin/bash

set -e  # Stop bij first error

LOGFILE="/opt/timesheet/update.log"
echo "=== Update started at $(date) ===" >> $LOGFILE

cd /opt/timesheet

# Backup
echo "Backing up database..." >> $LOGFILE
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)

# Stop app
echo "Stopping app..." >> $LOGFILE
pm2 stop timesheet

# Pull updates
echo "Pulling updates..." >> $LOGFILE
git pull origin main

# Install dependencies
echo "Installing dependencies..." >> $LOGFILE
npm install

# Update database
echo "Updating database..." >> $LOGFILE
npm run init-db

# Start app
echo "Starting app..." >> $LOGFILE
pm2 start timesheet

echo "=== Update completed at $(date) ===" >> $LOGFILE
```

```bash
# Maak executable
chmod +x /opt/timesheet/update.sh

# Test
/opt/timesheet/update.sh

# Zie logs
tail -f /opt/timesheet/update.log
```

---

## TROUBLESHOOTING CHECKLIST

```bash
# ✓ App draait
pm2 list | grep timesheet

# ✓ Database intact
sqlite3 /opt/timesheet/database.sqlite "SELECT COUNT(*) FROM users;"

# ✓ Geen errors in logs
pm2 logs timesheet | tail -20 | grep -i error

# ✓ API werkt
curl http://localhost:3000/api/health

# ✓ Database schema compleet
sqlite3 /opt/timesheet/database.sqlite ".schema" | wc -l

# ✓ Backup bestaat
ls -lh /opt/timesheet/database.sqlite.backup.* | head -1

# ✓ Geen uncommitted changes
git status | grep "working tree clean"
```

---

## BEST PRACTICES

### ✅ DO

- [ ] Altijd backup maken VOOR update
- [ ] Stop app VOOR database changes
- [ ] Test API na update
- [ ] Check logs na restart
- [ ] Houd 30 days backups
- [ ] Test updates op development EERST

### ❌ DON'T

- [ ] Niet git pull terwijl app draait
- [ ] Niet database wijzigen zonder backup
- [ ] Niet npm install in production zonder test
- [ ] Niet alle backups verwijderen
- [ ] Niet production wijzigen zonder development test

---

## SAMENVATTING COMMANDS

```bash
# Preparation
cd /opt/timesheet
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)

# Stop & Update
pm2 stop timesheet
git pull origin main
npm install

# Database & Start
npm run init-db
pm2 start timesheet

# Verify
pm2 logs timesheet
curl http://localhost:3000/api/health

# Restore (if needed)
pm2 stop timesheet
cp database.sqlite.backup.LATEST database.sqlite
pm2 start timesheet
```

---

**DATABASE IS NU VEILIG BIJGEWERKT! 🎉**
