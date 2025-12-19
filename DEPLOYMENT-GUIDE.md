# Deployment Guide - Fresh Installation

Deze handleiding beschrijft hoe je het timesheet systeem installeert bij een nieuw bedrijf met een schone database.

## Stap 1: Voorbereiding

### Vereisten

- Node.js (versie 14 of hoger)
- npm (Node Package Manager)
- Windows/Linux/Mac omgeving

### Bestanden Kopiëren

1. Kopieer de volledige projectmap naar de nieuwe server/computer
2. Verwijder de bestaande database (indien aanwezig):
   - `database.sqlite` (in de hoofdmap)
   - `timesheet.db` (indien aanwezig)

## Stap 2: Database Resetten

### Optie A: Handmatig Database Verwijderen

```powershell
# Windows PowerShell
Remove-Item database.sqlite -Force -ErrorAction SilentlyContinue
Remove-Item timesheet.db -Force -ErrorAction SilentlyContinue
```

```bash
# Linux/Mac
rm -f database.sqlite
rm -f timesheet.db
```

### Optie B: Gebruik Reset Script

```powershell
# Windows PowerShell
node scripts/reset-database.js
```

## Stap 3: Dependencies Installeren

```bash
npm install
```

## Stap 4: Environment Variabelen Configureren

Maak een `.env` bestand aan in de hoofdmap (of kopieer `.env.example`):

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Admin Account (wordt aangemaakt bij eerste init)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123456

# JWT Configuration
JWT_SECRET=verander-dit-naar-een-veilige-random-string

# SMTP Configuration (optioneel - kan later via UI)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=jouw-email@bedrijf.nl
SMTP_PASS=jouw-wachtwoord
EMAIL_FROM=jouw-email@bedrijf.nl
EMAIL_TO=admin@bedrijf.nl

# OAuth2 (optioneel, voor Microsoft 365)
SMTP_OAUTH_CLIENT_ID=
SMTP_OAUTH_CLIENT_SECRET=
SMTP_OAUTH_REFRESH_TOKEN=
```

**BELANGRIJK:** Verander `JWT_SECRET` naar een unieke random string!

## Stap 5: Database Initialiseren

```bash
npm run init-db
```

Dit script doet het volgende:

- ✓ Creëert alle tabellen (users, companies, timesheets, invoices, etc.)
- ✓ Maakt admin gebruiker aan (username/password uit .env)
- ✓ Initialiseert SMTP settings (uit .env)
- ✓ Maakt standaard branding settings aan

### Verwachte Output:

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

## Stap 6: Server Starten

### Development Mode:

```bash
npm run dev
```

### Production Mode:

```bash
npm start
```

De server draait nu op `http://localhost:3000`

## Stap 7: Eerste Login

1. Open browser: `http://localhost:3000`
2. Login met:

   - **Username:** `admin` (of wat je in .env hebt ingesteld)
   - **Password:** `Admin@123456` (of wat je in .env hebt ingesteld)

3. **BELANGRIJK:** Verander direct het admin wachtwoord:
   - Ga naar Instellingen → Gebruikersbeheer
   - Klik op admin gebruiker
   - Wijzig wachtwoord

## Stap 8: Systeem Configureren

### 1. Branding Instellen

- Ga naar **Instellingen → Branding**
- Vul in:
  - Bedrijfsnaam
  - Logo (upload)
  - Kleuren (primary/secondary)
  - Tagline (optioneel)

### 2. Bedrijven Toevoegen

- Ga naar **Instellingen → Bedrijven**
- Klik **+ Nieuw Bedrijf**
- Vul bedrijfsgegevens in

### 3. Gebruikers Aanmaken

- Ga naar **Instellingen → Gebruikersbeheer**
- Klik **+ Nieuwe Gebruiker**
- Vul gegevens in en wijs bedrijf(ven) toe
- Rollen: `admin`, `planner`, `user`

### 4. Factuur Templates (optioneel)

- Ga naar **Facturen → Templates**
- Maak templates aan met:
  - Uurtarief
  - KM tarief
  - DOT tarief (vast bedrag of percentage)

### 5. SMTP Settings (voor emails)

- Ga naar **Instellingen → SMTP**
- Configureer email server
- Test de verbinding

## Veelvoorkomende Scenario's

### Scenario 1: Systeem bij Klant Installeren

1. Kopieer project naar klant server
2. Verwijder `database.sqlite`
3. Pas `.env` aan met klant specifieke waarden:
   ```env
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=KlantWachtwoord2024!
   SMTP_USER=info@klantbedrijf.nl
   EMAIL_FROM=info@klantbedrijf.nl
   ```
4. Run `npm install`
5. Run `npm run init-db`
6. Start server met `npm start`
7. Login als admin en configureer branding + bedrijven

### Scenario 2: Development → Production

**Development (lokaal):**

- Database: `database.sqlite` (met testdata)

**Production (bij klant):**

1. **Niet** de development database kopiëren!
2. Start met verse database (stap 2-5)
3. Gebruik production `.env` waarden
4. Configureer alles via UI

### Scenario 3: Database Reset (all data wissen)

**WAARSCHUWING: Dit verwijdert ALLE data!**

```bash
# Stop de server eerst
# Verwijder database
rm database.sqlite

# Herinitialiseer
npm run init-db

# Start server
npm start
```

## Production Deployment Tips

### 1. Security

- Gebruik sterke `JWT_SECRET` (minimaal 32 tekens random)
- Verander admin wachtwoord direct na install
- Gebruik HTTPS (reverse proxy zoals nginx)
- Limiteer poort toegang (alleen localhost + reverse proxy)

### 2. Process Management

Gebruik PM2 voor automatische herstart:

```bash
# Installeer PM2 globally
npm install -g pm2

# Start applicatie
pm2 start server.js --name "timesheet"

# Auto-start bij server reboot
pm2 startup
pm2 save
```

### 3. Backup

Maak regelmatig backups van:

- `database.sqlite`
- `public/uploads/` (uploaded bestanden)
- `.env` (bewaar veilig!)

```bash
# Backup script
mkdir -p backups
cp database.sqlite backups/database-$(date +%Y%m%d-%H%M%S).sqlite
```

### 4. Updates

Bij updates van de applicatie:

1. Stop server
2. Backup database
3. Pull nieuwe code
4. Run `npm install` (voor nieuwe dependencies)
5. Restart server (migraties draaien automatisch)

## Troubleshooting

### "Admin user already exists"

- Database is niet leeg
- Verwijder `database.sqlite` en run `init-db` opnieuw

### "Port 3000 already in use"

- Verander `PORT=3001` in `.env`
- Of stop andere node processen:
  ```powershell
  # Windows
  Stop-Process -Name "node" -Force
  ```

### Database locked errors

- Zorg dat er maar 1 server instance draait
- Sluit database tools (DB Browser for SQLite)

### Login werkt niet

- Check of `init-db` succesvol was
- Controleer admin credentials in `.env`
- Check console logs voor errors

## Support & Documentatie

- **Project README:** `README.md`
- **SMTP Setup:** `SMTP-SETUP-GUIDE.md`
- **VS Code Guide:** `VSCODE-GUIDE.md`
- **Quick Start:** `QUICKSTART.md`

---

## Checklist: Nieuwe Installatie

- [ ] Dependencies geïnstalleerd (`npm install`)
- [ ] Oude database verwijderd
- [ ] `.env` bestand aangemaakt en ingevuld
- [ ] `JWT_SECRET` aangepast naar random string
- [ ] Database geïnitialiseerd (`npm run init-db`)
- [ ] Server gestart en bereikbaar
- [ ] Admin login werkt
- [ ] Admin wachtwoord gewijzigd
- [ ] Branding ingesteld
- [ ] Eerste bedrijf aangemaakt
- [ ] Eerste gebruiker aangemaakt
- [ ] SMTP geconfigureerd (indien nodig)
- [ ] Test timesheet ingediend
- [ ] Test factuur gegenereerd

**Succes met de installatie! 🚀**
