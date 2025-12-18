# Security & Password Management

## 🔐 Wachtwoord Beveiliging

### Hoe worden wachtwoorden opgeslagen?

Wachtwoorden worden **NOOIT in plain text** opgeslagen. Het systeem gebruikt **bcrypt hashing** voor maximale beveiliging.

#### Technische Details:

**Hashing Algoritme:** `bcryptjs`

- **Salt Rounds:** 10 (standaard, kan verhoogd worden voor extra beveiliging)
- **One-way hashing:** Het is cryptografisch onmogelijk om het originele wachtwoord terug te halen
- **Salt:** Elke hash heeft een unieke salt, beschermt tegen rainbow table attacks

**Voorbeeld:**

```javascript
// Plain text wachtwoord
const password = "Admin@123456";

// Opgeslagen in database (gehashed met bcrypt)
const hashedPassword =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
```

### Waar worden wachtwoorden opgeslagen?

**Database:** `database.sqlite`
**Tabel:** `users`
**Kolom:** `password` (TEXT)

**Schema:**

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- ← Bcrypt hash opgeslagen hier
  full_name TEXT,
  role TEXT DEFAULT 'user',
  ...
)
```

**Fysieke Locatie:**

- Development: `c:\Users\Administrator\Documents\GitHub\timesheet\database.sqlite`
- Production: `<project-root>/database.sqlite`

## 🔒 Wachtwoord Operaties

### 1. Wachtwoord Hash bij Aanmaken (User Creation)

**Bestand:** `routes/admin.js` (regel 97)

```javascript
// Hash password met bcrypt (10 salt rounds)
const hashedPassword = await bcrypt.hash(password, 10);

// Opslaan in database
await db.run(
  `INSERT INTO users (username, password, full_name, role, ...)
   VALUES (?, ?, ?, ?, ...)`,
  [username, hashedPassword, fullName, role, ...]
);
```

**Salt rounds betekenis:**

- `10` = 2^10 = 1024 iterations
- Elke round verdubbelt de berekeningstijd
- Balans tussen beveiliging en performance

### 2. Wachtwoord Verificatie bij Login

**Bestand:** `routes/auth.js` (regel 46)

```javascript
// Haal user op uit database (met gehashte wachtwoord)
const user = await db.get(
  "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
  [username]
);

// Vergelijk plain text input met gehashte wachtwoord
const isValidPassword = await bcrypt.compare(password, user.password);

if (!isValidPassword) {
  return res.status(401).json({ error: "Invalid credentials" });
}
```

**Hoe werkt `bcrypt.compare()`:**

1. Extraheert de salt uit de opgeslagen hash
2. Past dezelfde salt + rounds toe op input wachtwoord
3. Vergelijkt resultaat met opgeslagen hash
4. Returns `true` of `false` (zonder origineel wachtwoord bloot te geven)

### 3. Wachtwoord Wijzigen (Change Password)

**Bestand:** `routes/user.js` (regel 66-109)

```javascript
// Verificeer huidig wachtwoord eerst
const isValid = await bcrypt.compare(currentPassword, user.password);

if (!isValid) {
  return res.status(401).json({ error: "Current password is incorrect" });
}

// Hash nieuw wachtwoord
const hashedPassword = await bcrypt.hash(newPassword, 10);

// Update in database
await db.run(
  "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  [hashedPassword, req.user.id]
);
```

### 4. Wachtwoord Update door Admin

**Bestand:** `routes/admin.js` (regel 244)

```javascript
// Admin kan wachtwoord wijzigen zonder huidig wachtwoord
if (password !== undefined) {
  const hashedPassword = await bcrypt.hash(password, 10);
  updates.push("password = ?");
  values.push(hashedPassword);
}
```

**Belangrijk:** Admin kan wachtwoord resetten zonder het oude te kennen!

## 🛡️ Security Best Practices (Huidig Systeem)

### ✅ Wat is al goed:

1. **Bcrypt Hashing**

   - Industry-standard algoritme
   - Automatische salt generatie
   - Configureerbare cost factor (salt rounds)

2. **No Plain Text**

   - Wachtwoorden worden NOOIT onversleuteld opgeslagen
   - Zelfs in logs/console verschijnen geen wachtwoorden

3. **One-Way Encryption**

   - Onmogelijk om origineel wachtwoord terug te halen
   - Zelfs database administrator kan wachtwoorden niet zien

4. **JWT Tokens**

   - Wachtwoorden worden niet in tokens opgeslagen
   - Tokens vervallen na 24 uur (configureerbaar)

5. **SQL Injection Bescherming**

   - Prepared statements gebruikt overal
   - Parameters ge-escaped door sqlite3 library

6. **Case-Insensitive Username**
   - Voorkomt duplicate accounts (Admin vs admin)

## ⚠️ Security Aanbevelingen

### Huidige Configuratie:

```javascript
// Salt rounds = 10 (1024 iterations)
const hashedPassword = await bcrypt.hash(password, 10);
```

### Mogelijke Verbeteringen:

#### 1. Verhoog Salt Rounds (Optioneel)

Voor extra beveiliging (langzamer maar veiliger):

```javascript
// routes/admin.js, routes/user.js, scripts/init-db.js
const BCRYPT_ROUNDS = 12; // 4096 iterations (4x langzamer)
const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
```

**Trade-off:**

- Rounds 10: ~100ms per hash
- Rounds 12: ~400ms per hash
- Rounds 14: ~1600ms per hash

**Aanbeveling:** 10 is voldoende voor meeste toepassingen.

#### 2. Wachtwoord Complexity (Nog niet geïmplementeerd)

Voeg validatie toe in `routes/admin.js` en `routes/user.js`:

```javascript
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return "Wachtwoord moet minimaal 8 tekens bevatten";
  }
  if (!hasUpperCase || !hasLowerCase) {
    return "Wachtwoord moet hoofdletters en kleine letters bevatten";
  }
  if (!hasNumbers) {
    return "Wachtwoord moet minimaal 1 cijfer bevatten";
  }
  if (!hasSpecialChar) {
    return "Wachtwoord moet minimaal 1 speciaal teken bevatten";
  }
  return null; // Valid
}
```

#### 3. Rate Limiting voor Login (Al geïmplementeerd)

**Bestand:** `server.js`

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per IP
});

app.use("/api/", limiter);
```

**Beschermt tegen:**

- Brute force attacks
- Dictionary attacks
- Automated login attempts

#### 4. Password History (Niet geïmplementeerd)

Voorkom hergebruik van oude wachtwoorden:

```sql
CREATE TABLE password_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

#### 5. Two-Factor Authentication (Niet geïmplementeerd)

Voor extra beveiliging: TOTP (Time-based One-Time Password)

Zou vereisen:

- QR code generatie
- OTP verificatie bij login
- Backup codes

## 🔍 Database Toegang

### Wie heeft toegang tot de database?

**Fysieke toegang:**

- Server administrator (heeft toegang tot `database.sqlite` bestand)
- Backup systemen

**Applicatie toegang:**

- Node.js proces (server.js)
- SQLite3 library

### Kan iemand wachtwoorden uit database halen?

**Technisch: Ja, maar...**

1. **Hashes kunnen worden gekopieerd:**

   ```bash
   sqlite3 database.sqlite "SELECT username, password FROM users"
   ```

   Output:

   ```
   admin|$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
   ```

2. **Maar hashes zijn ONBRUIKBAAR zonder:**
   - Brute force attack (met bcrypt kost dit jaren CPU tijd)
   - Rainbow tables (werken niet door unieke salts)
   - Dictionary attacks (zeer traag door bcrypt cost factor)

**Conclusie:** Zelfs met database toegang zijn wachtwoorden veilig.

### Best Practice: Bescherm Database Toegang

1. **File Permissions:**

   ```bash
   # Linux/Mac - alleen owner kan lezen/schrijven
   chmod 600 database.sqlite
   ```

2. **Backup Encryptie:**

   ```bash
   # Encrypt database backups
   gpg --encrypt database.sqlite
   ```

3. **Geen Public Exposure:**
   - Database mag NOOIT via web toegankelijk zijn
   - Gebruik `.gitignore` om uit version control te houden

## 📊 Vergelijking met Andere Systemen

| Aspect          | Dit Systeem  | Alternatief (Slecht) | Alternatief (Goed) |
| --------------- | ------------ | -------------------- | ------------------ |
| **Storage**     | Bcrypt hash  | Plain text ❌        | Argon2 hash ✅     |
| **Salt**        | Auto (uniek) | Geen ❌              | Auto (uniek) ✅    |
| **Algoritme**   | Bcrypt       | MD5/SHA1 ❌          | Argon2/Scrypt ✅   |
| **Cost Factor** | 10 rounds    | Fixed ❌             | Configurabel ✅    |
| **Reversible**  | Nee ✅       | Ja (encryption) ❌   | Nee ✅             |

**Conclusie:** Dit systeem gebruikt industry-standard beveiliging. Bcrypt is een van de meest vertrouwde wachtwoord hashing algoritmes.

## 🚨 Wat NIET te doen

### ❌ Fout 1: Plain Text Logging

```javascript
// NOOIT doen!
console.log("User password:", password);
```

### ❌ Fout 2: Wachtwoord in URL

```javascript
// NOOIT doen!
fetch(`/api/login?username=john&password=secret123`);
```

### ❌ Fout 3: Wachtwoord in JWT Token

```javascript
// NOOIT doen!
const token = jwt.sign({ username, password }, JWT_SECRET);
```

### ❌ Fout 4: Eigen Encryption Algoritme

```javascript
// NOOIT doen! Gebruik bewezen libraries
const hash = btoa(password); // Base64 is GEEN encryptie!
```

## 📋 Checklist: Is Mijn Wachtwoord Veilig?

- ✅ Bcrypt gebruikt (niet MD5/SHA1)
- ✅ Unieke salt per wachtwoord
- ✅ Minimaal 10 salt rounds
- ✅ Geen plain text opslag
- ✅ Prepared statements (SQL injection proof)
- ✅ HTTPS voor transport (in productie)
- ✅ JWT tokens voor sessies (niet cookies)
- ✅ Rate limiting tegen brute force
- ⚠️ Password complexity regels (aanbevolen)
- ⚠️ Password expiration (optioneel)
- ⚠️ Two-factor auth (optioneel)

## 🔐 Conclusie

**Het systeem gebruikt sterke wachtwoord beveiliging:**

1. ✅ **Bcrypt hashing** - Industry standard
2. ✅ **Automatische salting** - Unieke salt per wachtwoord
3. ✅ **One-way encryption** - Onmogelijk te reverteren
4. ✅ **10 salt rounds** - Voldoende bescherming
5. ✅ **SQLite database** - Lokaal opgeslagen (niet in cloud)
6. ✅ **Geen plain text** - Nergens in het systeem

**Zelfs als een aanvaller:**

- ✅ Toegang krijgt tot de database
- ✅ Alle hashes kopieert
- ✅ Moderne hardware gebruikt

**Kan het JAREN duren** om één wachtwoord te kraken (afhankelijk van complexiteit).

**Voor 99% van de use cases is dit meer dan voldoende beveiliging.**

---

**Vragen? Check de broncode:**

- Wachtwoord hashing: `routes/admin.js`, `routes/user.js`
- Login verificatie: `routes/auth.js`
- Database schema: `config/database.js`
- Initialisatie: `scripts/init-db.js`
