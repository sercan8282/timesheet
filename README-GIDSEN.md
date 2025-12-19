# 📚 VOLLEDIGE UBUNTU TIMESHEET INSTALLATIEDOCUMENTATIE

## 🎯 SAMENVATTING

Je hebt **7 gedetailleerde gidsen** ontvangen voor volledige Ubuntu setup:

| # | Bestand | Grootte | Doel | Lees dit voor |
|---|---------|---------|------|---|
| 1 | **START-HIER.md** ⭐ | 5 KB | Quick Start | Orientatie & volgende stap |
| 2 | **UBUNTU-INSTALL.md** | 24 KB | Volledige Setup | Alles van nul tot productie |
| 3 | **ENV-CONFIGURATION.md** | 11 KB | .env Gids | Instellingen configureren |
| 4 | **SSL-HTTPS-SETUP.md** | 13 KB | HTTPS/SSL | Certificaat & veiligheid |
| 5 | **DATABASE-UPDATE-SAFELY.md** | 11 KB | Updates | Veilig git pull & backups |
| 6 | **QUICK-REFERENCE.md** | 11 KB | Commando's | Snelle command reference |
| 7 | **DOCUMENTATIE-OVERZICHT.md** | 11 KB | Alles | Overzicht van alles |

**Totaal: ~86 KB professionele documentatie**

---

## 🗺️ LEESROUTE (Kies je pad)

### 👤 Ben je BEGINNER?
```
START-HIER.md
   ↓
UBUNTU-INSTALL.md (lees helemaal)
   ↓
ENV-CONFIGURATION.md (voor .env vragen)
   ↓
SSL-HTTPS-SETUP.md (voor HTTPS)
   ↓
DATABASE-UPDATE-SAFELY.md (voor updates later)
   ↓
QUICK-REFERENCE.md (bookmark for daily use)
```

### 👨‍💻 Ben je INTERMEDIATE?
```
UBUNTU-INSTALL.md (snel doornemen)
   ↓
ENV-CONFIGURATION.md (specifieke vragen?)
   ↓
SSL-HTTPS-SETUP.md (HTTPS setup)
   ↓
QUICK-REFERENCE.md (main reference)
```

### 🚀 Ben je EXPERT?
```
START-HIER.md (5 min orientatie)
   ↓
UBUNTU-INSTALL.md Quickstart section
   ↓
QUICK-REFERENCE.md (bookmark this)
```

---

## 📖 INHOUD VAN ELKE GIDS

### 1️⃣ START-HIER.md
**Wat:** Orientatie & quick start guide  
**Lees dit:** Nu!  
**Ziet:** Linkje naar juiste gids  
**Bevat:**
- Overzicht van alles
- Hoe lang duurt het?
- Wat je nodig hebt
- Leesroutes
- Quick checklist

**→ Volg de links naar andere gidsen**

---

### 2️⃣ UBUNTU-INSTALL.md (HOOFD GIDS)
**Wat:** Volledige stap-voor-stap installatiehandleiding  
**Lees dit:** Van begin tot einde als je beginner bent  
**Ziet:** 15 deelstukken met elk stap uitgelegd  
**Bevat:**

**Deel 1: VOORBEREIDING**
- SSH verbinding
- System updaten

**Deel 2: NODE.JS INSTALLEREN**
- NodeSource repository
- Node.js installeren
- npm checken

**Deel 3: PROJECT OPZETTEN**
- Project directory
- GitHub klonen
- Dependencies installeren

**Deel 4: ENVIRONMENT CONFIGURATIE**
- .env bestand aanmaken
- Elk veld uitgelegd
- JWT_SECRET genereren

**Deel 5: DATABASE INITIALISEREN**
- Eerste init
- Database checken

**Deel 6: SERVER STARTEN (TEST)**
- npm start
- Server testen
- Stoppen

**Deel 7: PM2 PROCESS MANAGER**
- PM2 installeren
- App starten met PM2
- Permanent maken
- Monitoring

**Deel 8: NGINX REVERSE PROXY**
- Nginx installeren
- Config aanmaken
- Testen

**Deel 9: SSL/HTTPS CERTIFICAAT**
- Certbot installeren
- Let's Encrypt certificaat
- Auto-renewal

**Deel 10: MONITORING & MAINTENANCE**
- Logs bekijken
- Backup script
- Cron jobs

**Deel 11: DATABASE BACKUP HERSTELLEN**
- Restore procedures
- Emergency recovery

**Deel 12: FIREWALL**
- UFW inschakelen
- Poorten toestaan
- Security rules

**Deel 13: TROUBLESHOOTING**
- App start niet
- Database problemen
- Email werkt niet
- SSL issues

**Deel 14: SECURITY CHECKLIST**
- Alles valideren

**Deel 15: SAMENVATTING**
- Alle stappen overzicht
- Handige commands

---

### 3️⃣ ENV-CONFIGURATION.md
**Wat:** Gedetailleerde .env configuratiegids  
**Lees dit:** Voor elke .env setting  
**Ziet:** Template + uitleg van ELKE setting  
**Bevat:**

**Template:**
- Copy-paste ready .env template

**Stap voor Stap Uitleg:**
- PORT = 3000 (waarom? wanneer veranderen?)
- NODE_ENV = production (development vs production)
- DB_PATH = ./database.sqlite (waar database staat)
- JWT_SECRET (KRITISCH! Hoe genereren?)
- JWT_EXPIRES_IN = 24h (token timeout)
- ADMIN_USERNAME = admin (eerste admin)
- ADMIN_PASSWORD = (DEFAULT! Wijzigen na login)
- SMTP_HOST = smtp.office365.com (voor Microsoft 365)
- SMTP_PORT = 587 (welke port?)
- SMTP_SECURE = false (SSL of TLS?)
- SMTP_USER = jouw-email (welk account?)
- SMTP_PASS = wachtwoord (hoe veilig?)
- EMAIL_FROM = (wie is afzender?)
- EMAIL_TO = info@eutransport.nl (waar gaat het heen?)

**Voor elke instelling:**
- Wat is het?
- Welke waarde?
- Waarom is het nodig?
- Wanneer veranderen?
- Voorbeelden
- Security tips

**Troubleshooting:**
- SMTP connection failed
- JWT token invalid
- Database not found

---

### 4️⃣ SSL-HTTPS-SETUP.md
**Wat:** HTTPS/SSL certificaat setup gids  
**Lees dit:** Wanneer je HTTPS wilt  
**Ziet:** Let's Encrypt + Nginx + Auto-renewal  
**Bevat:**

**Achtergrond:**
- HTTP vs HTTPS (verschil?)
- SSL vs TLS (wat is wat?)
- Certificaten (hoe werken ze?)

**LET'S ENCRYPT (Gratis & Aanbevolen):**
- DNS instellen
- Certbot installeren
- Certificaat aanvragen
- Certificaat locaties
- Nginx configureren
- HTTPS testen
- Auto-renewal inschakelen

**ALTERNATIEVEN:**
- Zelf-ondertekend (testing only)
- Commerciële certificaten

**Security:**
- Private key beveiligen
- Security headers
- Renewal checken

**Troubleshooting:**
- DNS niet werkend
- Firewall blokkeert
- SSL_ERROR_RX_RECORD_TOO_LONG
- Certificate not trusted
- Connection refused

---

### 5️⃣ DATABASE-UPDATE-SAFELY.md
**Wat:** Veilig updates maken zonder data te verliezen  
**Lees dit:** Elke keer dat je `git pull` doet  
**Ziet:** Backup → Pull → Update → Restart → Verify  
**Bevat:**

**Korte Versie (Voor experts):**
- 1-liner commands

**Lange Versie (Voor iedereen):**
- Stap 1: Naar project map
- Stap 2: Database backup
- Stap 3: Stop applicatie
- Stap 4: Git pull
- Stap 5: Dependencies bijwerken
- Stap 6: Database schema update
- Stap 7: Applicatie herstarten
- Stap 8: Logs controleren
- Stap 9: Test applicatie
- Stap 10: Database integriteit

**Als Iets Fout Gaat:**
- Applicatie start niet
- Database corrupt
- Git conflict
- Dependencies probleem

**Backup Beheer:**
- Backups tonen
- Backup herstellen
- Oude backups verwijderen

**Automation:**
- Backup script
- Cron jobs
- Automatische updates

---

### 6️⃣ QUICK-REFERENCE.md
**Wat:** Snelle command reference (copy-paste klaar)  
**Lees dit:** Voor dagelijks beheer  
**Ziet:** Alle commands georganiseerd in categorieën  
**Bevat:**

**Categorieën:**
- Daily Checks (is alles OK?)
- App Management (start, stop, restart)
- Database Management (backup, restore, query)
- Logs & Debugging (logs zien, errors vinden)
- Updates & Deployment (git pull, npm install)
- Firewall & Security (ufw, ports)
- SSL/TLS (certificaat checks)
- Nginx Management (reload, restart)
- System Information (versies, resources)
- Emergency Commands (crash recovery)
- Common Scenarios (updates, restore, migrate)

**Voordeel:**
- Copy-paste ready
- Geen lange uitleg
- Snel reference

---

### 7️⃣ DOCUMENTATIE-OVERZICHT.md
**Wat:** Overzicht van alles  
**Lees dit:** Voor context (je leest dit nu!)  
**Ziet:** Wat je hebt, waar voor, hoe begin je  
**Bevat:**

- Overzicht van alles
- Installatie fasen
- Welke gids voor welke situatie
- Kritische punten
- Waarschuwingen
- Folder structuur
- Quickstart (voor experts)
- Maintenance checklist
- Emergency help
- Summary

---

## ⏱️ INSTALLATIE TIMELINE

```
Voorbereiding          5 min    Server kopen, DNS
System & Node.js      10 min    Updates, Node.js
Project Setup         10 min    Git clone, npm install
Configuration          5 min    .env invullen
Database               5 min    npm run init-db
PM2 Setup              5 min    Process manager
Nginx                 10 min    Reverse proxy config
SSL/HTTPS             10 min    Let's Encrypt cert
Firewall               5 min    ufw setup
Testing                5 min    curl, browser
TOTAAL              ~70 min    (1,2 uur)
```

---

## 🔑 KRITISCHE PUNTEN

### 🔴 MOET JE DOEN:
```
1. JWT_SECRET genereren (niet default!)
2. Admin wachtwoord wijzigen (na eerste login)
3. Database backups maken (regelmatig)
4. SSL/HTTPS installeren (voor productie)
5. Firewall inschakelen (direct)
```

### ⚠️ NOOIT DOEN:
```
- .env in git committen
- Database.sqlite in git committen
- npm install terwijl app draait
- git pull terwijl database in gebruik is
- Production wijzigen zonder backup
- Default wachtwoorden laten staan
```

---

## 📊 GIDS USAGE STATISTICS

```
START-HIER.md
├─ Read by: Everyone
├─ Reading time: 5 min
└─ Importance: ⭐⭐⭐⭐⭐

UBUNTU-INSTALL.md
├─ Read by: Beginners & completionists
├─ Reading time: 30-60 min
└─ Importance: ⭐⭐⭐⭐⭐

ENV-CONFIGURATION.md
├─ Read by: During setup & troubleshooting
├─ Reading time: 15-20 min
└─ Importance: ⭐⭐⭐⭐⭐

SSL-HTTPS-SETUP.md
├─ Read by: After initial setup
├─ Reading time: 15-20 min
└─ Importance: ⭐⭐⭐⭐⭐

DATABASE-UPDATE-SAFELY.md
├─ Read by: During updates
├─ Reading time: 10-15 min
└─ Importance: ⭐⭐⭐⭐

QUICK-REFERENCE.md
├─ Read by: Daily (reference)
├─ Reading time: On-demand
└─ Importance: ⭐⭐⭐⭐

DOCUMENTATIE-OVERZICHT.md
├─ Read by: Planning phase
├─ Reading time: 10-15 min
└─ Importance: ⭐⭐⭐
```

---

## 🚀 VOLGENDE STAP

### AANRADER: Open START-HIER.md eerst!

Dat bestand bevat:
1. Wat je nodig hebt
2. Hoe lang duurt het
3. Leesroutes (beginner, intermediate, expert)
4. Volgende stap checklist

---

## 📞 HELP NODIG?

### Voor setup vragen:
→ Lees **UBUNTU-INSTALL.md**

### Voor .env vragen:
→ Lees **ENV-CONFIGURATION.md**

### Voor HTTPS vragen:
→ Lees **SSL-HTTPS-SETUP.md**

### Voor update vragen:
→ Lees **DATABASE-UPDATE-SAFELY.md**

### Voor snelle commando's:
→ Lees **QUICK-REFERENCE.md**

### Voor overzicht/planning:
→ Lees **DOCUMENTATIE-OVERZICHT.md**

---

## ✅ KLAAR VOOR PRODUCTIE?

Na alle stappen heb je:
- ✅ Ubuntu server setup
- ✅ Timesheet app draaiend
- ✅ HTTPS/SSL actief
- ✅ Firewall bescherming
- ✅ Database backups
- ✅ Auto-restart (PM2)
- ✅ Monitoring & logs
- ✅ Email werkend
- ✅ Updates veilig installeerbaar

**You're ready for production! 🎉**

---

**Versie:** 1.0  
**Datum:** December 19, 2024  
**Geschikt voor:** Ubuntu 20.04+ / Debian 10+  
**Niveau:** Beginner tot Intermediate  
**Totale documentatie:** ~86 KB  

**Veel succes! 🚀**
