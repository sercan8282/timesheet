# Ubuntu Timesheet Installatie Gids - Stap voor Stap

Dit document beschrijft hoe je de Timesheet applicatie volledig installeert op Ubuntu, inclusief database beheer, SSL/HTTPS certificaten en updates van GitHub.

---

## DEEL 1: VOORBEREIDING

### 1.1 SSH Verbinding naar Server

```bash
# Verbind met je Ubuntu server via SSH
ssh username@your-server-ip

# Bijvoorbeeld:
ssh admin@192.168.1.100

# Of als je een SSH key gebruikt:
ssh -i /path/to/key.pem admin@192.168.1.100
```

**Wat gebeurt hier?**
- Je maakt een veilige verbinding naar je Ubuntu server via SSH (Secure Shell)
- SSH is zoals een veilige terminal op je server

---

### 1.2 System Updaten

```bash
# Update de package manager
sudo apt update

# Upgrade alle geïnstalleerde packages
sudo apt upgrade -y

# Verwijder ongebruikte packages
sudo apt autoremove -y
```

**Wat gebeurt hier?**
- `sudo` = voer uit als administrator (root)
- `apt update` = controleer welke updates beschikbaar zijn
- `apt upgrade -y` = installeer updates automatisch (ja zeggen)
- Dit zorgt dat je systeem veilig en up-to-date is

**Verwachte output:**
```
Reading package lists... Done
Building dependency tree... Done
```

---

## DEEL 2: NODE.JS EN NPM INSTALLEREN

### 2.1 Node.js Repository Toevoegen

```bash
# Download NodeSource setup script voor Node.js 18 (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Of voor de nieuwere Node.js 20 (LTS):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

**Wat gebeurt hier?**
- `curl` = download bestand van internet
- Dit voegt de NodeSource repository toe aan je systeem
- Dit zorgt dat je een recente versie van Node.js kunt installeren

---

### 2.2 Node.js Installeren

```bash
# Installeer Node.js (npm wordt automatisch meegeïnstalleerd)
sudo apt install -y nodejs

# Verifieer de installatie
node --version
npm --version
```

**Verwachte output:**
```
v18.18.0
9.8.1
```

---

## DEEL 3: PROJECT OPZETTEN

### 3.1 Project Directory Aanmaken

```bash
# Maak een map voor de applicatie
mkdir -p /opt/timesheet

# Ga naar die map
cd /opt/timesheet

# Zet juiste permissies (zodat je user het mag eigenaar zijn)
sudo chown -R $USER:$USER /opt/timesheet
```

**Wat gebeurt hier?**
- Maak een map aan in `/opt` (standaardplek voor toepassingen op Linux)
- `$USER` = je huidige gebruikersnaam
- Dit zorgt dat je rechten hebt om in deze map bestanden te wijzigen

---

### 3.2 Project van GitHub Klonen

```bash
# Ga naar de project map
cd /opt/timesheet

# Clone de GitHub repository
git clone https://github.com/your-username/timesheet.git .

# Of als je SSH key gebruikt:
git clone git@github.com:your-username/timesheet.git .
```

**Wat gebeurt hier?**
- Download het complete project van GitHub
- De punt (.) betekent: zet alles in huidige map (niet in submapje)

**Verwachte output:**
```
Cloning into '.'...
remote: Enumerating objects: 1234, done.
Receiving objects: 100% (1234/1234), done.
```

---

### 3.3 Dependencies Installeren

```bash
# Zorg dat je in de project map bent
cd /opt/timesheet

# Installeer alle benodigde packages
npm install

# Dit kan 3-5 minuten duren...
```

**Wat gebeurt hier?**
- `npm install` leest het `package.json` bestand
- Download alle afhankelijkheden (express, sqlite3, bcryptjs, etc.)
- Installeert alles in de `node_modules` map

**Verwachte output:**
```
up to date, audited 125 packages in 2.34s
```

---

## DEEL 4: ENVIRONMENT CONFIGURATIE

### 4.1 .env Bestand Aanmaken

```bash
# Ga naar project map
cd /opt/timesheet

# Kopieer het example bestand
cp .env.example .env

# Open het bestand in een teksteditor
nano .env
```

**Wat gebeurt hier?**
- `nano` = eenvoudige teksteditor in terminal
- Dit maakt een kopie van de voorbeeldinstellingen
- Je kunt nu je eigen instellingen invoeren

---

### 4.2 .env Bestand Invullen

**Wat je MOET wijzigen:**

```env
# SERVER CONFIGURATIE
PORT=3000
NODE_ENV=production

# DATABASE (standaard is prima)
DB_PATH=./database.sqlite

# JWT SECURITY (VERANDEREN!)
# Genereer een veilige random string:
# Open terminal en voer dit uit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=jouw-gegenereerde-random-string-hier
JWT_EXPIRES_IN=24h

# ADMIN ACCOUNT (standaard inloggegevens)
# Deze kun je na eerste login wijzigen!
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123456

# EMAIL CONFIGURATIE (Microsoft Exchange Online)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=jouw-email@bedrijf.nl
SMTP_PASS=jouw-email-wachtwoord
EMAIL_FROM=jouw-email@bedrijf.nl
EMAIL_TO=info@eutransport.nl
```

**Gedetailleerde uitleg van elk veld:**

| Veld | Waarde | Uitleg |
|------|--------|--------|
| `PORT` | `3000` | Poort waarop de server luistert. Voor productie via reverse proxy kan dit blijven |
| `NODE_ENV` | `production` | Production modus = betere performance & veiligheid |
| `DB_PATH` | `./database.sqlite` | Locatie van de database. Dit wordt automatisch aangemaakt |
| `JWT_SECRET` | random string | KRITISCH: veilige random string voor token encryptie. Genereer met: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `24h` | JWT tokens verlopen na 24 uur (veiligheid) |
| `ADMIN_USERNAME` | `admin` | Gebruikersnaam voor eerste admin account |
| `ADMIN_PASSWORD` | `Admin@123456` | Wachtwoord voor eerste admin account (WIJZIG NA EERSTE LOGIN!) |
| `SMTP_HOST` | `smtp.office365.com` | SMTP server voor email verzending (Microsoft 365) |
| `SMTP_PORT` | `587` | Port 587 = TLS/STARTTLS (veilig) |
| `SMTP_SECURE` | `false` | false = STARTTLS gebruiken. true = SSL gebruiken |
| `SMTP_USER` | jouw-email | Email adres waarmee je verstuurt |
| `SMTP_PASS` | wachtwoord | Wachtwoord van je email account |
| `EMAIL_FROM` | jouw-email | Wie staat als afzender in emails? |
| `EMAIL_TO` | info@eutransport.nl | Standaard ontvanger (kan per email aangepast) |

**Hoe JWT_SECRET genereren:**

```bash
# Methode 1: In terminal op Ubuntu
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Dit geeft iets terug zoals:
# a3f8e2b1c9d4f6e7a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f

# Plak deze waarde in de JWT_SECRET in je .env bestand
```

### 4.3 .env Bestand Opslaan

```bash
# In nano editor:
# Druk op: Ctrl + O (opslaan)
# Druk op: Enter (bevestig)
# Druk op: Ctrl + X (afsluiten)
```

**Controleer dat het goed is opgeslagen:**

```bash
# Lees het bestand
cat .env

# Je zou je instellingen moeten zien
```

---

## DEEL 5: DATABASE INITIALISEREN

### 5.1 Eerste Initialisatie

```bash
# Ga naar project map
cd /opt/timesheet

# Voer het init script uit
npm run init-db
```

**Wat gebeurt hier?**
- Het script creëert alle database tabellen (users, timesheets, invoices, etc.)
- Maakt de admin gebruiker aan
- Initialiseert default instellingen

**Verwachte output:**
```
Initializing database...
Connected to SQLite database
✓ Admin user created
  Username: admin
  Password: Admin@123456
  PLEASE CHANGE THE PASSWORD AFTER FIRST LOGIN!
✓ SMTP settings initialized
✓ Branding settings initialized

Database initialization complete!
```

**BELANGRIJK:** Na eerste login moet je het admin wachtwoord wijzigen!

---

### 5.2 Controleer Database

```bash
# Controleer dat het database bestand is aangemaakt
ls -lh /opt/timesheet/database.sqlite

# Je zou iets als dit moeten zien:
# -rw-r--r-- 1 admin admin 256K Dec 19 10:30 /opt/timesheet/database.sqlite
```

---

## DEEL 6: SERVER STARTEN (Eerste Test)

### 6.1 Test Run

```bash
# Start de server
npm start

# Je zou dit moeten zien:
# Server running on http://localhost:3000
```

**Let op:** Dit is alleen voor testen. Voor producatie moet je een process manager gebruiken (zie deel 7).

### 6.2 Server Testen

**In een ander terminal venster:**

```bash
# Test of de server draait
curl http://localhost:3000

# Of test de API
curl http://localhost:3000/api/health

# Zou iets teruggeven als: {"status":"ok"}
```

### 6.3 Server Stoppen

```bash
# Terug naar het originele terminal waar je 'npm start' draaide
# Druk op: Ctrl + C

# Server stopt nu
```

---

## DEEL 7: PM2 PROCESS MANAGER INSTALLEREN

PM2 zorgt dat je applicatie automatisch start na server reboot en restart bij crashes.

### 7.1 PM2 Globaal Installeren

```bash
# Installeer PM2 globaal
sudo npm install -g pm2

# Controleer installatie
pm2 --version
```

**Wat gebeurt hier?**
- `-g` = globaal installeren (beschikbaar overal op systeem)
- PM2 beheerd Node.js processen en start ze automatisch

---

### 7.2 Applicatie met PM2 Starten

```bash
# Ga naar project map
cd /opt/timesheet

# Start de app met PM2
pm2 start npm --name "timesheet" -- start

# Controleer of het draait
pm2 list

# Je zou iets als dit moeten zien:
# ┌─────┬────────────┬─────────────┬─────────┐
# │ id  │ name       │ status      │ uptime  │
# ├─────┼────────────┼─────────────┼─────────┤
# │ 0   │ timesheet  │ online      │ 2s      │
# └─────┴────────────┴─────────────┴─────────┘
```

---

### 7.3 PM2 Configuratie Permanent Maken

```bash
# Zorg dat PM2 processen surviven bij reboot
pm2 startup

# Sla de huidige PM2 configuratie op
pm2 save

# Start server opnieuw op om te testen
sudo reboot

# Na herstart, controleer of app nog draait:
pm2 list
```

**Wat gebeurt hier?**
- `pm2 startup` = maak PM2 startup script
- `pm2 save` = sla huidge processen op
- Na server reboot starten deze automatisch

---

### 7.4 PM2 Monitoring

```bash
# Zie real-time logs
pm2 logs timesheet

# Of zie logs van alle apps
pm2 logs

# Zie gedetailleerde info
pm2 info timesheet

# Monitor CPU & geheugen
pm2 monit
```

---

## DEEL 8: NGINX REVERSE PROXY INSTELLEN

Een reverse proxy zet het op port 80/443 en stuurt door naar port 3000.

### 8.1 Nginx Installeren

```bash
# Installeer Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx

# Zet Nginx aan bij boot
sudo systemctl enable nginx

# Controleer status
sudo systemctl status nginx
```

---

### 8.2 Nginx Configuratie

```bash
# Backup originele config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Maak nieuwe config
sudo nano /etc/nginx/sites-available/default
```

**Vul dit in (vervang YOUR-DOMAIN.COM):**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR-DOMAIN.COM www.YOUR-DOMAIN.COM;

    # Redirect HTTP naar HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name YOUR-DOMAIN.COM www.YOUR-DOMAIN.COM;

    # SSL Certificaat paden (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem;

    # SSL Instellingen
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logs
    access_log /var/log/nginx/timesheet_access.log;
    error_log /var/log/nginx/timesheet_error.log;

    # Proxy naar Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support (als nodig)
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

**Sla op: Ctrl + O, Enter, Ctrl + X**

---

### 8.3 Nginx Testen en Herstarten

```bash
# Test config
sudo nginx -t

# Zou dit moeten geven:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Herstart Nginx
sudo systemctl restart nginx

# Controleer status
sudo systemctl status nginx
```

---

## DEEL 9: SSL/HTTPS CERTIFICAAT (Let's Encrypt)

### 9.1 Certbot Installeren

```bash
# Installeer Certbot (Let's Encrypt client)
sudo apt install -y certbot python3-certbot-nginx

# Controleer installatie
certbot --version
```

---

### 9.2 Certificaat Aanvragen

```bash
# Vraag certificaat aan voor je domein
sudo certbot certonly --nginx -d YOUR-DOMAIN.COM -d www.YOUR-DOMAIN.COM

# Of als je Nginx config nog niet klaar is:
sudo certbot certonly --standalone -d YOUR-DOMAIN.COM -d www.YOUR-DOMAIN.COM
```

**Stappen die volgen:**

1. Voer je email in (voor certificaat alerts)
2. Accepteer de terms
3. Kies of je info gedeeld mag worden met Electronic Frontier Foundation

**Verwachte output:**
```
Congratulations! Your certificate has been issued.
Certificate is saved at: /etc/letsencrypt/live/YOUR-DOMAIN.COM/fullchain.pem
Key is saved at: /etc/letsencrypt/live/YOUR-DOMAIN.COM/privkey.pem
```

---

### 9.3 Auto-Renewal Instellen

```bash
# Test auto-renewal (dry run)
sudo certbot renew --dry-run

# Enable auto-renewal (maandelijks)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Controleer status
sudo systemctl status certbot.timer
```

**Wat gebeurt hier?**
- Let's Encrypt certificaten gelden 90 dagen
- Certbot verlengt deze automatisch maandelijks
- Je hoeft hierover niet meer na te denken

---

## DEEL 10: DATABASE BIJWERKEN VAN GITHUB

Dit is BELANGRIJK: hoe je updates haalt terwijl je database intact blijft.

### 10.1 Voorbereiding voor Update

```bash
# Ga naar project map
cd /opt/timesheet

# Stop de applicatie
pm2 stop timesheet

# Backup database (KRITISCH!)
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d-%H%M%S)

# Controleer backup
ls -lh database.sqlite*

# Je zou nu minimaal 2 files zien:
# database.sqlite
# database.sqlite.backup.20231219-103000
```

---

### 10.2 Code Update van GitHub

```bash
# Ga naar project map
cd /opt/timesheet

# Fetch latest code
git fetch origin

# Checkout main branch (of je branch)
git checkout main

# Pull updates
git pull origin main

# Controlleer dat het goed is gegaan
git log --oneline -5
```

**Wat gebeurt hier?**
- `git fetch` = download info over nieuwe commits
- `git pull` = download en merge de updates
- Database.sqlite wordt NIET gewijzigd (staat niet in git)

---

### 10.3 Dependencies Bijwerken

```bash
# Zorg dat je in project map bent
cd /opt/timesheet

# Installeer nieuwe dependencies (als die zijn toegevoegd)
npm install

# Controleer op fouten
npm audit
```

---

### 10.4 Database Schema Aanpassingen

```bash
# Controleer of init script nieuwe tabellen maakt
npm run init-db

# Dit is veilig - het voegt alleen TON toe die nog niet bestaan
# Bestaande data blijft intact
```

---

### 10.5 Applicatie Herstarten

```bash
# Start applicatie opnieuw
pm2 start timesheet

# Controleer logs
pm2 logs timesheet

# Controleer status
pm2 list
```

**Je database is intact gebleven, maar de code is bijgewerkt!**

---

## DEEL 11: MONITORING & MAINTENANCE

### 11.1 Logs Bekijken

```bash
# Real-time logs
pm2 logs timesheet

# Logs van vandaag
pm2 logs timesheet --since 24h

# Nginx access logs
sudo tail -f /var/log/nginx/timesheet_access.log

# Nginx error logs
sudo tail -f /var/log/nginx/timesheet_error.log
```

---

### 11.2 Backup Script Aanmaken

```bash
# Maak backup script
nano /opt/timesheet/backup.sh
```

**Vul dit in:**

```bash
#!/bin/bash

# Backup Directory
BACKUP_DIR="/opt/timesheet/backups"
mkdir -p $BACKUP_DIR

# Datum
DATE=$(date +%Y%m%d-%H%M%S)

# Database backup
cp /opt/timesheet/database.sqlite $BACKUP_DIR/database-$DATE.sqlite

# Komprimeer backup
tar -czf $BACKUP_DIR/database-$DATE.tar.gz -C $BACKUP_DIR database-$DATE.sqlite

# Verwijder onkomprimeerde versie
rm $BACKUP_DIR/database-$DATE.sqlite

# Houd alleen laatste 30 backups
find $BACKUP_DIR -name "database-*.tar.gz" -type f -mtime +30 -delete

echo "Backup gemaakt: $BACKUP_DIR/database-$DATE.tar.gz"
```

---

### 11.3 Cron Job voor Dagelijkse Backup

```bash
# Maak script executable
chmod +x /opt/timesheet/backup.sh

# Open crontab
crontab -e

# Voeg dit toe (backup elke dag om 02:00)
0 2 * * * /opt/timesheet/backup.sh

# Controleer cron jobs
crontab -l
```

**Wat gebeurt hier?**
- Elke dag om 02:00 uur maakt het script een backup
- Backups ouder dan 30 dagen worden verwijderd
- Dus je hebt altijd de laatste 30 dagen backups

---

## DEEL 12: DATABASE BACK-UP HERSTELLEN

**Als iets fout gaat:**

```bash
# Stop applicatie
pm2 stop timesheet

# Herstel backup
cp /opt/timesheet/database.sqlite.backup.20231219-103000 /opt/timesheet/database.sqlite

# Start applicatie
pm2 start timesheet

# Controleer logs
pm2 logs timesheet
```

---

## DEEL 13: FIREWALL CONFIGURATIE

### 13.1 UFW Firewall Inschakelen

```bash
# Enable UFW
sudo ufw enable

# Controleer status
sudo ufw status

# Voeg SSH toe (zodat je niet buitengesloten raakt!)
sudo ufw allow 22/tcp

# Voeg HTTP/HTTPS toe
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Controleer regels
sudo ufw status verbose
```

---

## DEEL 14: TROUBLESHOOTING

### 14.1 Applicatie Start Niet

```bash
# Controleer PM2 status
pm2 list

# Zie uitgebreide logs
pm2 logs timesheet --lines 100

# Herstart
pm2 restart timesheet

# Of reset
pm2 kill
pm2 start npm --name "timesheet" -- start
```

---

### 14.2 Database Lock / Corruption

```bash
# Controleer database
sqlite3 /opt/timesheet/database.sqlite "PRAGMA integrity_check;"

# Zou "ok" moeten geven

# Als probleem: herstel backup
cp /opt/timesheet/database.sqlite.backup.LATEST /opt/timesheet/database.sqlite
```

---

### 14.3 Email Werkt Niet

```bash
# Test SMTP settings in de browser
# Ga naar Admin → SMTP Settings
# Controleer alle instellingen

# Check logs
pm2 logs timesheet | grep -i email

# Test handmatig
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@domain.com',
    pass: 'your-password'
  }
});
transporter.verify((error) => {
  if (error) console.log('Error:', error);
  else console.log('SMTP OK');
});
"
```

---

### 14.4 SSL Certificaat Problemen

```bash
# Controleer certificaat vervaldatum
sudo certbot certificates

# Vernieuw handmatig
sudo certbot renew --force-renewal

# Test SSL
ssl-test https://YOUR-DOMAIN.COM

# Of via openssl
openssl s_client -connect YOUR-DOMAIN.COM:443
```

---

### 14.5 Database Translation Error (UNIQUE constraint failed)

**Error:** `SQLITE_CONSTRAINT: UNIQUE constraint failed: translations.namespace, translations.key, translations.locale`

**Oorzaak:** Als je `npm start` doet nadat je eerder al init-db hebt gedaan, probeert de database dezelfde translations opnieuw in te voegen. Dit veroorzaakt een UNIQUE constraint error.

**Oplossing (Automatisch):**

Deze fout is al verholpen in de nieuwste versie! De code gebruikt nu `INSERT OR IGNORE` wat automatisch duplicaten neggeert.

**Als je toch deze error krijgt:**

```bash
# Stop de app
pm2 stop timesheet

# Verwijder de database (als je deze kan missen)
rm /opt/timesheet/database.sqlite

# Of backup en verwijder
cp /opt/timesheet/database.sqlite /opt/timesheet/database.sqlite.backup.$(date +%Y%m%d)
rm /opt/timesheet/database.sqlite

# Re-initialize
npm run init-db

# Start opnieuw
pm2 start timesheet
```

**Voorkomen:**

- Roep `npm run init-db` maar 1x aan
- `npm start` hoeft niet opnieuw init-db te doen
- Als je init-db opnieuw wilt, eerst database backuppen

---

## DEEL 15: VEILIGHEID CHECKLIST

```bash
# ✓ Firewall ingeschakeld
sudo ufw status

# ✓ SSH poort beveiligd
sudo ufw show added | grep 22

# ✓ Admin wachtwoord veranderd (in web interface)

# ✓ JWT_SECRET uniek (niet default)
grep JWT_SECRET /opt/timesheet/.env

# ✓ SSL/HTTPS werkt
curl -I https://YOUR-DOMAIN.COM

# ✓ Database backup plan
ls -lh /opt/timesheet/backups/

# ✓ PM2 startup ingesteld
pm2 list

# ✓ Certbot auto-renewal
sudo systemctl status certbot.timer
```

---

## SAMENVATTING - STAPPEN 1-15

| Stap | Wat | Commando |
|------|-----|----------|
| 1 | System update | `sudo apt update && sudo apt upgrade -y` |
| 2 | Node.js installeren | `curl ... \| sudo bash - && sudo apt install -y nodejs` |
| 3 | Project klonen | `git clone ... && cd /opt/timesheet` |
| 4 | Dependencies | `npm install` |
| 5 | .env configureren | `cp .env.example .env && nano .env` |
| 6 | Database init | `npm run init-db` |
| 7 | PM2 installeren | `sudo npm install -g pm2` |
| 8 | PM2 starten | `pm2 start npm --name "timesheet" -- start` |
| 9 | Nginx setup | `sudo apt install -y nginx && sudo nano /etc/nginx/sites-available/default` |
| 10 | Let's Encrypt | `sudo certbot certonly --nginx -d YOUR-DOMAIN.COM` |
| 11 | Test | `curl https://YOUR-DOMAIN.COM` |
| 12 | Update later | `cd /opt/timesheet && git pull && npm install && npm run init-db` |
| 13 | Backup | `cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)` |
| 14 | Firewall | `sudo ufw enable && sudo ufw allow 22,80,443/tcp` |
| 15 | Monitoring | `pm2 logs timesheet` |

---

## HANDIGE COMMANDS OVERZICHT

```bash
# ===== STATUS CHECKEN =====
pm2 list                              # App status
pm2 logs timesheet                    # Zie logs
sudo systemctl status nginx           # Nginx status
sudo ufw status                       # Firewall status

# ===== APP BEHEREN =====
pm2 stop timesheet                    # Stop app
pm2 restart timesheet                 # Herstart app
pm2 delete timesheet                  # Verwijder uit PM2

# ===== DATABASE =====
cp database.sqlite database.sqlite.backup  # Backup maken
sqlite3 database.sqlite "SELECT COUNT(*) FROM users;"  # Query uitvoeren

# ===== NGINX =====
sudo systemctl restart nginx          # Nginx herstarten
sudo nginx -t                         # Nginx config controleren
sudo tail -f /var/log/nginx/error.log # Nginx logs

# ===== CERTIFICAAT =====
sudo certbot certificates             # Toon certificaten
sudo certbot renew --dry-run           # Test verlenging
sudo certbot renew --force-renewal    # Forceer verlenging

# ===== FIREWALL =====
sudo ufw allow 80/tcp                 # HTTP toestaan
sudo ufw deny 80/tcp                  # HTTP weigeren
sudo ufw delete allow 80/tcp          # Regel verwijderen

# ===== GITHUB UPDATE =====
git fetch origin                      # Download updates
git pull origin main                  # Merge updates
npm install                           # Update dependencies
npm run init-db                       # Update database schema
pm2 restart timesheet                 # Restart app
```

---

## KRITISCHE AANTEKENINGEN

### 🔴 KRITISCH - Dit moet je doen:

1. **JWT_SECRET Veranderen** - Niet de default gebruiken!
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Admin Wachtwoord Veranderen** - Direct na eerste login!
   - Login met admin/Admin@123456
   - Ga naar Instellingen → Wachtwoord wijzigen

3. **Database Backups** - Regelmatig backup maken
   ```bash
   cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)
   ```

4. **SSL Certificaat** - HTTPS is verplicht voor productie
   ```bash
   sudo certbot certonly --nginx -d YOUR-DOMAIN.COM
   ```

### ⚠️ WAARSCHUWINGEN:

- **Git pull moet buiten production draait** - Stop pm2 eerst!
- **Database.sqlite nooit in git committen** - Staat in .gitignore
- **Nooit admin wachtwoord in git commit** - Dit is in .env welke niet in git hoort
- **Backups op verschillende server** - Niet alleen op dezelfde server!

---

## HULP NODIG?

```bash
# Check Node.js versie
node --version

# Check npm versie
npm --version

# Check Git status
git status

# Check process errors
pm2 logs timesheet --err

# Check nginx errors
sudo journalctl -u nginx -n 20

# Check system resources
free -h
df -h
htop  # (installeer eerst: sudo apt install htop)
```

---

**Vragen of problemen?**
- Check logs: `pm2 logs timesheet`
- Check Nginx: `sudo tail -f /var/log/nginx/timesheet_error.log`
- Herstellen uit backup: `cp database.sqlite.backup database.sqlite`

**Succes met je installatie! 🚀**
