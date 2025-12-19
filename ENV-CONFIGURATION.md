# .env CONFIGURATIE GIDS

Deze file beschrijft EXACT wat je in je .env bestand moet zetten en waarom.

## TEMPLATE - Copy & Paste This

```env
# ============================================
# SERVER CONFIGURATIE
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# DATABASE
# ============================================
DB_PATH=./database.sqlite

# ============================================
# JWT SECURITY (VERANDEREN!)
# ============================================
# Genereer veilige random key met:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=a3f8e2b1c9d4f6e7a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f
JWT_EXPIRES_IN=24h

# ============================================
# ADMIN ACCOUNT (WIJZIG NA EERSTE LOGIN!)
# ============================================
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123456

# ============================================
# EMAIL - MICROSOFT EXCHANGE ONLINE (SMTP)
# ============================================
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=jouw-email@bedrijf.nl
SMTP_PASS=jouw-email-wachtwoord
EMAIL_FROM=jouw-email@bedrijf.nl
EMAIL_TO=info@eutransport.nl
```

---

## STAP VOOR STAP UITLEG

### 1. PORT=3000

**Wat:** De poort waarop de interne Node.js server draait

**Waarde:** `3000` (standaard)

**Waarom:** 
- Port 3000 is niet gereserveerd voor andere services
- In productie use je Nginx reverse proxy die port 80 (HTTP) en 443 (HTTPS) gebruikt
- Nginx forward traffic naar port 3000

**Wanneer veranderen:** Alleen als port 3000 al in gebruik is
- `netstat -tulpn | grep 3000` checken
- Of `sudo lsof -i :3000` op Linux

---

### 2. NODE_ENV=production

**Wat:** Environment mode

**Waarde:** 
- `development` - Voor lokale development (lots van logging, slower)
- `production` - Voor servers (geoptimaliseerd, minder logging)

**Waarom:** 
- Production mode = betere performance
- Security headers ingeschakeld
- Error messages niet in frontend zichtbaar
- Caching beter

**Voorkeur:** Altijd `production` op je server

---

### 3. DB_PATH=./database.sqlite

**Wat:** Waar de database wordt opgeslagen

**Waarde:** `./database.sqlite` (huidige map)

**Alternatieven:**
- `/var/lib/timesheet/database.sqlite` (absolute path)
- `/opt/timesheet/database.sqlite`

**Waarom:** 
- `.` = relatieve path (altijd werkt)
- Zorg dat je folder write permissions hebt

**Controleer:**
```bash
ls -l /opt/timesheet/database.sqlite
# -rw-r--r-- 1 user user 256000 Dec 19 10:30
```

---

### 4. JWT_SECRET (KRITISCH!)

**Wat:** Encryption key voor JWT tokens (login sessions)

**Waarde:** Random hexadecimal string (64 karakters)

**GENEREER JE OWN:**

```bash
# Op Linux/Mac/Windows Terminal met Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Output: a3f8e2b1c9d4f6e7a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f
# Plak deze waarde in .env
```

**WAAROM NIEUW?**

```javascript
// JWT tokens worden ONDERTEKEND met JWT_SECRET
// Iemand die de secret kent kan VALSE tokens maken!
// Dus NOOIT hetzelfde als iemand ander

// Default secret = iedereen weet het = UNSECURE
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production  // 🚫 NOOIT!

// Jouw eigen secret = alleen jij weet het = SECURE
JWT_SECRET=a3f8e2b1c9d4f6e7a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f  // ✅ GOED!
```

**GEVOLGEN van NIET veranderen:**
- Hackers kunnen nep-tokens maken
- Iedereen kan fake admin accounts creëren
- Alle data is unsecured

---

### 5. JWT_EXPIRES_IN=24h

**Wat:** Hoe lang een login-token geldig is

**Waarde:** `24h` (24 uur)

**Alternatieven:**
- `12h` - Korter (meer veilig, maar moeilijker)
- `7d` - Langer (minder veilig)
- `6h` - Standaard op veel systemen

**Waarom 24h:** 
- Balans tussen veiligheid en gebruikerservaring
- Users hoeven niet elke 6 uur opnieuw inloggen
- Tokens zijn niet voor altijd geldig

**Hoe werkt:**
```javascript
// User logt in -> token geldig tot 24h later
// Na 24h moet user opnieuw inloggen
// Dit forceren security refresh
```

---

### 6. ADMIN_USERNAME=admin

**Wat:** Gebruikersnaam van het eerste admin account

**Waarde:** `admin` (of iets anders)

**Kan je veranderen naar:**
- `admin`
- `administrator`
- `beheerder`
- `jouw-naam`

**BELANGRIJK:** 
- Dit account wordt gemaakt bij `npm run init-db`
- Na eerste login MOET je het wachtwoord veranderen
- Dit is NIET veilig om default te laten

**Commando check:**
```bash
# Controleer of je nog default admin hebt
sqlite3 /opt/timesheet/database.sqlite "SELECT username, password FROM users WHERE role='admin';"

# Zou iets als dit moeten geven:
# admin|$2a$10$... (encrypted wachtwoord)
```

---

### 7. ADMIN_PASSWORD=Admin@123456

**Wat:** Wachtwoord voor het eerste admin account

**WAARSCHUWING:** Dit is TIJDELIJK!

**STAPPEN:**
1. Vul hier een wachtwoord in
2. Start applicatie: `npm run init-db`
3. Login met admin / dit wachtwoord
4. **DIRECT DAARNA: Wijzig het wachtwoord in UI**
5. Onthoud het NIEUW wachtwoord

**Vereisten:**
- Minimaal 8 karakters
- Mix van groot/kleine letters
- Minstens 1 getal
- Minstens 1 speciaal karakter

**Goede voorbeelden:**
```
✅ Admin@123456
✅ MyCompany#2024Secure
✅ T1me$heet!Admin
✅ Pw#News2024!
```

**Slechte voorbeelden:**
```
❌ admin123
❌ password
❌ 12345678
❌ AAAAAAA
```

**Hoe wijzigen na login:**
1. Inloggen met admin / Admin@123456
2. Rechtsboven op username klikken
3. "Settings" of "Instellingen"
4. "Change Password" of "Wachtwoord Wijzigen"
5. Voer oud wachtwoord in
6. Voer nieuw wachtwoord 2x in
7. Save

---

### 8. SMTP_HOST=smtp.office365.com

**Wat:** SMTP server voor email verzending

**Voor Microsoft 365 / Outlook:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Voor Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Voor anderen:**
- Vraag je email provider
- Meestal staat het op hun support website

**Waarom deze?** SMTP = Simple Mail Transfer Protocol (standaard voor email versturen)

---

### 9. SMTP_PORT=587

**Wat:** Port nummer voor email server

**Standaard opties:**
- `587` - STARTTLS (meeste providers)
- `465` - SSL/TLS (ook veel gebruikt)
- `25` - Oud, niet aanbevolen

**Voor Office365 / Gmail:**
```
✅ Port 587 met SMTP_SECURE=false (TLS)
```

**Controleer wat jouw provider zegt:**

```bash
# Test connectie
telnet smtp.office365.com 587

# Zou moeten werken en "220 ... ESMTP" tonen
```

---

### 10. SMTP_SECURE=false

**Wat:** SSL/TLS encryptie voor email

**Waarde:**
- `false` - Gebruik STARTTLS op port 587
- `true` - Gebruik SSL op port 465

**Verschil:**

```
STARTTLS (SMTP_SECURE=false):
- Connecteer onversleuteld op 587
- Zeg daarna "STARTTLS"
- Server upgrade naar encryptie

SSL (SMTP_SECURE=true):
- Connecteer direkt versleuteld op 465
```

**Voor Office365/Gmail:**
```env
✅ SMTP_SECURE=false
SMTP_PORT=587
```

---

### 11. SMTP_USER=jouw-email@bedrijf.nl

**Wat:** Email account waarmee je verstuurt

**Waarde:** Jouw full email adres

**Voorbeelden:**
```env
SMTP_USER=admin@eutransport.nl
SMTP_USER=notifications@bedrijf.nl
SMTP_USER=timesheet@mijnbedrijf.com
```

**BELANGRIJK:**
- Dit moet een ECHT email account zijn
- Het account moet SMTP mag gebruiken (not all providers allow it)
- Dit is de account die de emails verstuurt

---

### 12. SMTP_PASS=jouw-email-wachtwoord

**Wat:** Wachtwoord van het email account

**Waarde:** Het wachtwoord van SMTP_USER

**WAARSCHUWING:**
- Dit staat in plaintext in .env
- .env mag NOOIT in git committed worden
- Zet .env in .gitignore

**Controleer:**
```bash
cat .gitignore
# Zou .env moeten bevatten
```

**Voor Microsoft 365:**
- Gebruik je normale email wachtwoord
- OF maak "App Password" aan (beter!)

**App Password maken (Microsoft 365):**
1. Ga naar https://myaccount.microsoft.com
2. Security
3. Two-step verification (zet aan als nodig)
4. App passwords
5. Generate
6. Kopeer de code
7. Plak in SMTP_PASS

```env
SMTP_USER=admin@eutransport.nl
SMTP_PASS=pqsx btfb cxcd qwer  # App password van Microsoft
```

---

### 13. EMAIL_FROM=jouw-email@bedrijf.nl

**Wat:** "Afzender" adres in emails

**Waarde:** Meestal hetzelfde als SMTP_USER

```env
SMTP_USER=admin@eutransport.nl
EMAIL_FROM=admin@eutransport.nl  # ✅ Meestal hetzelfde
```

**Kan ook anders zijn:**
```env
SMTP_USER=admin@eutransport.nl
EMAIL_FROM=noreply@eutransport.nl  # ✅ Ook oké
EMAIL_FROM=Timesheet System <admin@eutransport.nl>  # ✅ Met display name
```

**Bij verzending zien users:**
```
Van: admin@eutransport.nl
```

---

### 14. EMAIL_TO=info@eutransport.nl

**Wat:** Standaard ontvanger voor emails

**Waarde:** Email adres waar timesheets naartoe gaan

```env
EMAIL_TO=info@eutransport.nl
```

**Dit is de DEFAULT.**
Kan per user aangepast worden in de applicatie.

---

## .ENV CHECKLIST

Voor je live gaat:

```bash
# ✓ JWT_SECRET is gegenereerd (niet default)
grep "JWT_SECRET" .env | grep -v "your-super-secret"

# ✓ Admin password is gewijzigd (in applicatie!)
# Login en check in settings

# ✓ SMTP settings zijn correct
# Admin → SMTP Settings, test connection

# ✓ .env is in .gitignore
grep ".env" .gitignore

# ✓ Database path is correct
ls -l $(grep "DB_PATH" .env | cut -d= -f2)

# ✓ NODE_ENV is production
grep "NODE_ENV=production" .env
```

---

## VEILIGHEID BEST PRACTICES

```bash
# 1. Maak .env ONZICHTBAAR voor anderen
chmod 600 .env
# Alleen jij mag lezen/schrijven

# 2. Backup .env op veilige plek
# (niet in git, niet op server alleen)

# 3. Verander JWT_SECRET bij elke new deployment
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Use different SMTP account dan admin account
ADMIN account: admin@bedrijf.nl
SMTP account: noreply@bedrijf.nl (ander account!)

# 5. Zet .env permissions op read-only na setup
chmod 400 .env
```

---

## TROUBLESHOOTING

### "SMTP Connection Failed"

```env
# Controleer:
1. SMTP_HOST - Juist?
2. SMTP_PORT - Juist? (587 is standaard)
3. SMTP_USER - Klopt email adres?
4. SMTP_PASS - Klopt wachtwoord?
5. SMTP_SECURE - false voor 587, true voor 465

# Test met Node:
node -e "
const nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@domain.com',
    pass: 'your-password'
  }
});
transporter.verify((error) => {
  if (error) console.log('ERROR:', error);
  else console.log('SMTP OK!');
});
"
```

### "JWT Token Invalid"

```env
# Controleer:
JWT_SECRET=...

# Zorg dat:
# - JWT_SECRET niet leeg is
# - JWT_SECRET niet standaard/default is
# - JWT_SECRET hetzelfde is op alle servers (als meerdere)
```

### "Database Not Found"

```env
# Controleer:
DB_PATH=./database.sqlite

# Controleer dat:
# - Path accessible is
# - Je write permissions hebt
# - Database exists: ls -l database.sqlite
```

---

**Klaar? Start je applicatie:**

```bash
npm run init-db
npm start
```

**Ga naar:** `http://localhost:3000`
**Login met:** admin / Admin@123456
**Wijzig direct het wachtwoord!**
