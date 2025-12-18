# Quick Start - Fresh Installation

Voor gedetailleerde instructies, zie: **DEPLOYMENT-GUIDE.md**

## TL;DR - Nieuwe Installatie in 5 Stappen

### 1️⃣ Database Resetten

```bash
npm run reset-db
# Type 'JA' om te bevestigen
```

### 2️⃣ Dependencies Installeren

```bash
npm install
```

### 3️⃣ Environment Variables

Kopieer `.env.example` naar `.env` en pas aan:

```bash
cp .env.example .env
```

**Belangrijkste wijzigingen:**

- `ADMIN_USERNAME` - Gewenste admin gebruikersnaam
- `ADMIN_PASSWORD` - Gewenst admin wachtwoord (VERANDER!)
- `JWT_SECRET` - Random string (genereer met: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

### 4️⃣ Database Initialiseren

```bash
# Start server eerst (maakt database aan)
npm start

# Stop server (Ctrl+C)

# Initialiseer admin account
npm run init-db
```

### 5️⃣ Systeem Starten

```bash
npm start
```

Login op `http://localhost:3000` met je admin credentials!

---

## Beschikbare Scripts

| Script             | Beschrijving                     |
| ------------------ | -------------------------------- |
| `npm start`        | Start de server (productie)      |
| `npm run dev`      | Start met nodemon (development)  |
| `npm run init-db`  | Maakt admin account aan          |
| `npm run reset-db` | Reset database (WIST ALLE DATA!) |

## Eerste Login

**URL:** `http://localhost:3000`

**Default Credentials:**

- Username: `admin`
- Password: `Admin@123456`

**⚠️ VERANDER DIRECT HET WACHTWOORD!**

## Na Installatie

1. **Branding:** Instellingen → Branding (logo, kleuren, bedrijfsnaam)
2. **Bedrijven:** Instellingen → Bedrijven (voeg eerste bedrijf toe)
3. **Gebruikers:** Instellingen → Gebruikersbeheer (maak eerste user aan)
4. **SMTP:** Instellingen → SMTP (configureer email)
5. **Templates:** Facturen → Templates (maak factuur templates)

## Hulp Nodig?

- 📖 Volledige installatie guide: `DEPLOYMENT-GUIDE.md`
- 📧 SMTP configuratie: `SMTP-SETUP-GUIDE.md`
- 🔧 Development tips: `VSCODE-GUIDE.md`
- 📋 Project info: `README.md`

## Troubleshooting

**"Admin user already exists"**
→ Database is niet leeg, run `npm run reset-db` eerst

**"Port 3000 already in use"**
→ Wijzig `PORT=3001` in `.env` of stop andere node processen

**Database locked**
→ Sluit DB Browser en zorg dat maar 1 server draait

**Login werkt niet**
→ Check of `npm run init-db` succesvol was en credentials in `.env`

---

**Succes! 🚀**
