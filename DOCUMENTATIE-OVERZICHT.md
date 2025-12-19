# 📚 TIMESHEET UBUNTU DOCUMENTATIE - COMPLEET OVERZICHT

Welkom! Ik heb een volledige stap-voor-stap installatiegids voor Ubuntu gemaakt.

---

## 🎯 WAT JE HEBT GEKREGEN

Je hebt nu **5 gedetailleerde gidsen** met alle informatie die je nodig hebt:

### 1️⃣ **UBUNTU-INSTALL.md** - HOOFD INSTALLATIEGIDS
   - **Voor wie:** Iedereen die Timesheet op Ubuntu wil installeren
   - **Wat:** Compleet stappenplan van nul tot draaiende productie server
   - **Bevat:** 15 hoofdstukken met elke commando uitgelegd
   - **Tijd:** ~2-3 uur volledige setup
   
   **Onderwerpen:**
   - Voorbereiding & SSH
   - Node.js installeren
   - Project opzetten
   - Environment configuratie
   - Database initialiseren
   - PM2 process manager
   - Nginx reverse proxy
   - SSL/HTTPS certificaat
   - Firewall
   - Monitoring
   - Troubleshooting
   
   **→ START HIER als je niets hebt!**

---

### 2️⃣ **ENV-CONFIGURATION.md** - .env GIDS
   - **Voor wie:** Iedereen die .env moet configureren
   - **Wat:** Gedetailleerde uitleg van ELKE .env setting
   - **Bevat:** Wat, waarom, voorbeelden en security tips
   
   **Onderwerpen:**
   - PORT configuratie
   - NODE_ENV
   - Database path
   - JWT_SECRET (security!)
   - Admin account
   - SMTP email settings
   - Security best practices
   
   **→ Gebruik dit wanneer je .env invult**

---

### 3️⃣ **SSL-HTTPS-SETUP.md** - CERTIFICAAT GIDS  
   - **Voor wie:** Iedereen die HTTPS wil activeren
   - **Wat:** Hoe je SSL/HTTPS certificaat installeert
   - **Bevat:** Let's Encrypt (GRATIS), Nginx config, auto-renewal
   
   **Onderwerpen:**
   - HTTP vs HTTPS verschil
   - DNS instellen
   - Let's Encrypt certificaat aanvragen
   - Nginx HTTPS configuratie
   - Auto-renewal inschakelen
   - SSL security headers
   - Troubleshooting
   
   **→ Volg dit NADAT je server draait**

---

### 4️⃣ **DATABASE-UPDATE-SAFELY.md** - DATABASE BEHEER
   - **Voor wie:** Wanneer je updates wil installeren van GitHub
   - **Wat:** Hoe je veilig updates haalt terwijl database intact blijft
   - **Bevat:** Backup strategie, git pull veilig doen
   
   **Onderwerpen:**
   - Database backup voor updates
   - Code updates van GitHub
   - Dependencies bijwerken
   - Database schema updates (veilig!)
   - Herstellen uit backup
   - Cron jobs voor automatische backups
   - Full workflow
   
   **→ Volg dit ELKE KEER dat je `git pull` doet**

---

### 5️⃣ **QUICK-REFERENCE.md** - SNELLE COMMANDO GIDS
   - **Voor wie:** Voor dagelijks beheer en troubleshooting
   - **Wat:** Een snelle command reference (copy-paste ready!)
   - **Bevat:** Alle nuttige commando's kategorisch georganiseerd
   
   **Categorieën:**
   - Daily checks
   - App management
   - Database management
   - Logs & debugging
   - Updates & deployment
   - Firewall
   - SSL/TLS
   - Emergency commands
   
   **→ Gebruik dit voor dagelijks beheer**

---

## 📋 STAP-VOOR-STAP INSTALLATIE

### **Fase 1: Voorbereiding (5 minuten)**
```
1. Koop een Ubuntu server (DigitalOcean, Linode, AWS, etc.)
2. SSH naar je server
3. Zet DNS van je domein correct
4. Lees: UBUNTU-INSTALL.md Deel 1
```

### **Fase 2: Installatie (30 minuten)**
```
1. System updaten
2. Node.js installeren
3. Project klonen van GitHub
4. Dependencies installeren
5. Lees: UBUNTU-INSTALL.md Deel 2-3
```

### **Fase 3: Configuratie (15 minuten)**
```
1. .env bestand aanvullen
2. Database initialiseren
3. PM2 instellen
4. Lees: ENV-CONFIGURATION.md + UBUNTU-INSTALL.md Deel 4-5
```

### **Fase 4: Nginx & SSL (30 minuten)**
```
1. Nginx installeren & configureren
2. SSL certificaat aanvragen (Let's Encrypt)
3. HTTPS testen
4. Lees: SSL-HTTPS-SETUP.md + UBUNTU-INSTALL.md Deel 8-9
```

### **Fase 5: Veiligheid (10 minuten)**
```
1. Firewall inschakelen
2. Admin wachtwoord wijzigen
3. Backups instellen
4. Lees: UBUNTU-INSTALL.md Deel 13-15
```

**Totaal: ~2-3 uur**

---

## ❓ WELKE GIDS VOOR WELKE SITUATIE?

### "Ik ben helemaal nieuw, van nul"
→ **Lees UBUNTU-INSTALL.md van begin tot einde**

### "Ik heb vragen over .env instellingen"
→ **Lees ENV-CONFIGURATION.md**

### "Ik wil HTTPS/SSL inschakelen"
→ **Lees SSL-HTTPS-SETUP.md**

### "Ik wil updates van GitHub pullen"
→ **Lees DATABASE-UPDATE-SAFELY.md**

### "Ik weet al wat te doen, ik wil just commands"
→ **Lees QUICK-REFERENCE.md**

### "Er is iets fout!"
→ **Zoek in QUICK-REFERENCE.md onder "Emergency Commands"**

---

## 🔑 KRITISCHE PUNTEN OM TE ONTHOUDEN

### 🔴 ABSOLUUT BELANGRIJK (Zorg hiervoor!)

```
1. JWT_SECRET genereren (niet default gebruiken!)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

2. Admin wachtwoord WIJZIGEN na eerste login
   DEFAULT is: admin / Admin@123456
   Dit is NIET veilig om zo te laten!

3. DATABASE BACKUPS
   Maak ALTIJD backup voor:
   - Updates (`git pull`)
   - .env wijzigingen
   - Major changes
   
   cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)

4. SSL/HTTPS
   Niet online zonder HTTPS!
   Volg SSL-HTTPS-SETUP.md stap voor stap

5. FIREWALL
   Zet altijd firewall aan
   sudo ufw enable
```

### ⚠️ WAARSCHUWINGEN

```
❌ NOOIT:
   - .env in git committen (private data!)
   - Database.sqlite in git (staat in .gitignore, want privé)
   - npm install doen terwijl app draait
   - `git pull` terwijl database in gebruik is
   - Production wijzigen zonder backup
   - Default wachtwoorden laten staan

✅ ALTIJD:
   - Backup maken voor major changes
   - Git pull starten door app te stoppen
   - Test updates op development EERST
   - Firewall inschakelen
   - Admin wachtwoord wijzigen
   - Logs checken na restart
```

---

## 📁 WAAR VIND JE ALLES

```
/opt/timesheet/                    # Project root
├── database.sqlite                # Je database (KRITISCH!)
├── database.sqlite.backup.*       # Backups
├── .env                           # Instellingen (GEHEIM!)
├── server.js                      # Main app
├── package.json                   # Dependencies
├── config/
│   └── database.js               # Database config
├── routes/                        # API routes
├── public/                        # Webpagina's
│   ├── index.html
│   ├── js/
│   ├── css/
│   └── uploads/
├── scripts/
│   ├── init-db.js               # Database init
│   └── reset-database.js        # Database reset
├── utils/                        # Utility functions
└── DOCUMENTATIE/
    ├── UBUNTU-INSTALL.md         # Main gids
    ├── ENV-CONFIGURATION.md      # .env gids
    ├── SSL-HTTPS-SETUP.md        # SSL gids
    ├── DATABASE-UPDATE-SAFELY.md # Update gids
    └── QUICK-REFERENCE.md        # Command reference

/etc/nginx/sites-available/default     # Nginx config
/etc/letsencrypt/live/YOUR-DOMAIN.COM/ # SSL certs
/var/log/nginx/                        # Nginx logs
```

---

## 🚀 QUICKSTART VOOR EXPERTS

```bash
# Setup (30 min)
ssh admin@YOUR-SERVER
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs certbot python3-certbot-nginx nginx git
mkdir -p /opt/timesheet && cd /opt/timesheet && sudo chown -R $USER:$USER .
git clone https://github.com/YOUR-REPO/timesheet.git .
npm install
cp .env.example .env
nano .env  # Update: JWT_SECRET, SMTP settings, ADMIN_PASSWORD

# Database & PM2 (10 min)
npm run init-db
sudo npm install -g pm2
pm2 start npm --name "timesheet" -- start
pm2 save

# Nginx & SSL (10 min)
sudo nano /etc/nginx/sites-available/default  # Configure proxy
sudo nginx -t && sudo systemctl restart nginx
sudo certbot certonly --nginx -d YOUR-DOMAIN.COM
sudo systemctl restart nginx
sudo certbot renew --dry-run

# Security (5 min)
sudo ufw enable
sudo ufw allow 22,80,443/tcp

# Test
curl -I https://YOUR-DOMAIN.COM
# Groen slotje!
```

---

## 📊 MAINTENANCE CHECKLIST

### Dagelijks (2 min)
```bash
pm2 list                              # Check app draait
curl https://YOUR-DOMAIN.COM/api/health  # Check API works
```

### Wekelijks (5 min)
```bash
pm2 logs timesheet --lines 100 | grep -i error  # Check errors
sqlite3 database.sqlite "SELECT COUNT(*) FROM users;"  # Check database
```

### Maandelijks (15 min)
```bash
# Backup
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)

# Check logs
sudo tail -f /var/log/nginx/error.log

# Certificate status
sudo certbot certificates
```

### Quarterly (30 min - als updates beschikbaar)
```bash
# Update code from GitHub
cd /opt/timesheet
pm2 stop timesheet
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d)
git pull origin main
npm install
npm run init-db
pm2 start timesheet
pm2 logs timesheet | head -20
```

---

## 🆘 HELP NODIG?

### "App start niet"
1. Zie QUICK-REFERENCE.md → "Emergency Commands"
2. Check: `pm2 logs timesheet`
3. Check: `sudo nginx -t`

### "Database corrupt"
1. Restore backup: `cp database.sqlite.backup.LATEST database.sqlite`
2. Restart: `pm2 restart timesheet`

### "SSL certificaat probleem"
1. Zie SSL-HTTPS-SETUP.md → "Troubleshooting"
2. Check: `sudo certbot certificates`

### "Iets anders"
1. Zie QUICK-REFERENCE.md (search problem)
2. Check logs: `pm2 logs timesheet`
3. Google de error message

---

## 📖 HANDLEIDING STRUCTUUR

Elke gids volgt hetzelfde patroon:

```
1. Korte samenvatting (wat is het?)
2. Stap-voor-stap instructies (wat moet ik doen?)
3. Gedetailleerde uitleg (waarom werkt het?)
4. Output voorbeelden (wat zie ik?)
5. Troubleshooting (wat als het fout gaat?)
6. Best practices (hoe doe ik het goed?)
```

---

## 🎓 LEER PYTHON VAN UBUNTU

Tijdens installatie leer je:
- **Linux/Ubuntu**: Command line, users, permissions, packages
- **Node.js**: Server programming, npm, package management  
- **Git**: Version control, cloning, pulling updates
- **Nginx**: Reverse proxy, web server, HTTP/HTTPS
- **SSL/TLS**: Certificates, HTTPS, Let's Encrypt
- **SQLite**: Database, backups, queries
- **PM2**: Process management, auto-restart, monitoring
- **Firewall**: ufw, ports, security
- **SSH**: Remote access, key-based auth

**Je wordt een Linux/Node.js expert! 🚀**

---

## ✅ JE BENT KLAAR VOOR:

Na volgen van deze gidsen kun je:

- ✅ Ubuntu server volledig setup
- ✅ Timesheet app installeren & configureren
- ✅ Database beheren en backups maken
- ✅ HTTPS/SSL certificaat installeren
- ✅ Firewall & security inschakelen
- ✅ App monitoren en logs controleren
- ✅ Updates van GitHub veilig installeren
- ✅ Troubleshooten bij problemen
- ✅ Dagelijks beheren en onderhouden
- ✅ Emergency recovery uitvoeren

---

## 📞 SUMMARY

```
WELKOM! 🎉

Je hebt nu 5 professionele gidsen:

1. UBUNTU-INSTALL.md          → Start hier! (volledige setup)
2. ENV-CONFIGURATION.md       → Voor .env instellingen
3. SSL-HTTPS-SETUP.md         → Voor HTTPS/SSL
4. DATABASE-UPDATE-SAFELY.md  → Voor updates van GitHub
5. QUICK-REFERENCE.md         → Voor dagelijks beheer

Deze gidsen zijn:
✓ Compleet (van nul tot productie)
✓ Gedetailleerd (elke stap uitgelegd)
✓ Praktisch (copy-paste commando's)
✓ Veilig (best practices ingebouwd)
✓ Professioneel (production-ready)

VOLGENDE STAPPEN:
1. Lees UBUNTU-INSTALL.md Deel 1 (Voorbereiding)
2. Zet een Ubuntu server op
3. Volg alle stappen stap-voor-stap
4. Gebruik andere gidsen als nodig

Veel succes! 🚀
```

---

**Versie**: 1.0
**Gemaakt voor**: Ubuntu Timesheet Installation
**Geschikt voor**: Linux/Ubuntu/Debian
**Niveau**: Beginner tot Intermediate
