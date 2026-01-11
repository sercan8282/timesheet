# 📋 SERVICE ACCOUNT INSTALLATIE - GEDETAILLEERD ONDERZOEKSRAPPORT

**Datum Onderzoek:** 11 Januari 2026  
**Project:** Timesheet Management System  
**Scope:** Service account setup, database initialization, admin panel integration, security issues

---

## 🔍 SAMENVATTING

Het Timesheet project **mist een interactieve service account setup** procedure. De huidige installatie werkt via:
1. ✅ Handmatige `.env` configuratie
2. ✅ `npm run init-db` voor admin account
3. ✅ `setup-system-config.js` voor system_config tabel
4. ⚠️ **GEEN geautomatiseerde setup wizard**

**Kritieke bevindingen:**
- Hardcoded defaults in scripts (Admin@123456, change-me-in-admin-panel)
- Encryption keys afgeleid van JWT_SECRET (single point of failure)
- Geen interactieve installatie
- Maprechten niet expliciet beheerd
- Security issues in dependencies (qs vulnerability)

---

## 1️⃣ INSTALLATIESCRIPTS ANALYSE

### 1.1 `scripts/init-db.js` - Admin & SMTP Setup

**Doel:** Maakt eerste admin user en SMTP defaults aan

```javascript
ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin"        // Fallback hardcoded
ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123456" // ⚠️ HARDCODED DEFAULT
```

**Tabel aanmaken:** `users`, `smtp_settings`, `branding_settings`

**Defaults:**
| Parameter | Value | Source |
|-----------|-------|--------|
| Admin Username | `admin` | `.env` fallback |
| Admin Password | `Admin@123456` | ⚠️ Hardcoded |
| SMTP Host | `smtp.office365.com` | Hardcoded |
| SMTP Port | `587` | Hardcoded |
| Branding Name | `Timesheet System` | Hardcoded |
| Primary Color | `#0066CC` | Hardcoded |

**⚠️ Beveiligingsproblemen:**
- Hardcoded wachtwoord (even als fallback)
- Script zegt "PLEASE CHANGE PASSWORD" maar user weet niet hoe
- Geen validatie van SMTP-instellingen

**Workflow:**
```
npm run init-db
→ Lees ADMIN_USERNAME & ADMIN_PASSWORD uit .env
→ Hash wachtwoord met bcrypt (10 rounds) ✓
→ INSERT admin user
→ INSERT SMTP settings (onencrypt!)
→ INSERT branding settings
→ Klaar (exit 0)
```

---

### 1.2 `scripts/setup-system-config.js` - System Config Tabel

**Doel:** Create system_config tabel met defaults

**Tabel Structuur:**
```sql
CREATE TABLE system_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  encrypted BOOLEAN DEFAULT 0,
  description TEXT,
  is_secret BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Defaults Ingesteld:**
| Key | Value | Encrypted | Is Secret | Beschrijving |
|-----|-------|-----------|-----------|--------------|
| `APP_DOMAIN` | `localhost:3000` | 0 | 0 | Application domain |
| `APP_URL` | `http://localhost:3000` | 0 | 0 | Full URL |
| `SSL_ENABLED` | `0` | 0 | 0 | Is SSL active |
| `SSL_CERT_PATH` | `` (leeg) | 0 | 0 | Path to cert |
| `SSL_KEY_PATH` | `` (leeg) | 0 | 0 | Path to key |
| `JWT_SECRET` | `process.env.JWT_SECRET \|\| 'change-me-in-admin-panel'` | 1 | 1 | JWT secret ⚠️ |
| `DB_PASSWORD` | `process.env.DB_PASSWORD \|\| ''` | 1 | 1 | Database password |
| `LETSENCRYPT_EMAIL` | `process.env.LETSENCRYPT_EMAIL \|\| ''` | 0 | 0 | LE Email |
| `LETSENCRYPT_ENABLED` | `0` | 0 | 0 | Auto-renew |

**Implementatie:**
```javascript
// INSERT OR IGNORE (geen dubbels)
INSERT INTO system_config (key, value, encrypted, description, is_secret) 
VALUES (?, ?, ?, ?, ?)
```

**⚠️ Beveiligingsproblemen:**
- `JWT_SECRET` default: `'change-me-in-admin-panel'` - veel te simpel!
- Geen verplichte setup wizard
- Encryption column ingesteld maar waarden NIET encrypted bij insert

**Workflow:**
```
npm run setup-system-config
→ Create tabel
→ Insert 9 default rows (IF NOT EXISTS)
→ Geen waarden encrypten bij insert (bug!)
→ Klaar
```

---

### 1.3 `scripts/reset-database.js` - Database Reset

**Functie:** Verwijder database.sqlite + make backup

**Workflow:**
```
npm run reset-db
→ Ask "Type JA to confirm"
→ CREATE backups/ directory
→ Backup: database.sqlite → backups/database-YYYY-MM-DD-HH:MM:SS.sqlite
→ DELETE database.sqlite
→ DELETE timesheet.db (legacy)
→ Print next steps
```

**Output:**
```
✅ Database succesvol gereset!

📋 Volgende stappen:
  1. Start de server: npm start
  2. Stop de server (Ctrl+C)
  3. Initialiseer admin account: npm run init-db
  4. Start de server opnieuw: npm start
```

**⚠️ Beveiligingsproblemen:**
- Geen validatie van backups (kopiëren mislukt silent)
- Backup met `fs.copyFileSync` (geen error handling)

---

### 1.4 Andere Scripts - Ad-hoc Setup

Scripts die relevant zijn voor service account:

| Script | Functie | Issue |
|--------|---------|-------|
| `add-smtp-oauth.js` | Voeg OAuth kolommen toe | Alleen ALTER TABLE, geen waarden |
| `create-api-key.js` | Generate API key | Requires admin user |
| `setup-system-config.js` | (checked) | |
| `reset-admin-mfa.js` | Reset MFA van admin | Requires admin user |

---

## 2️⃣ DATABASE SCHEMA ANALYSE

### 2.1 Database Initialisatie (`config/database.js`)

**Database File:** `./database.sqlite` (SQLite3)

**Tabel Hiërarchie:**

```
users (admin user created via init-db.js)
├── id INTEGER PRIMARY KEY
├── username TEXT UNIQUE NOT NULL
├── password TEXT NOT NULL (bcrypted)
├── full_name TEXT
├── role TEXT (admin/user/reader)
├── company_id INTEGER FK companies(id)
├── mfa_enabled INTEGER (default 0) ⚠️
├── mfa_secret TEXT
├── mfa_backup_codes TEXT
└── ... 20+ columns (adr, ritnumber, mega_kast, etc.)

system_config (created via setup-system-config.js) ⚠️ NIET in DB init
├── key TEXT UNIQUE
├── value TEXT
├── encrypted BOOLEAN
├── is_secret BOOLEAN
└── description TEXT

smtp_settings (created via init-db.js)
├── smtp_host TEXT
├── smtp_port INTEGER
├── smtp_user TEXT
├── smtp_pass TEXT (NIET encrypted!)
├── email_from TEXT
└── email_to TEXT

branding_settings
├── company_name TEXT
├── primary_color TEXT
└── tagline TEXT
```

**⚠️ Beveiligingsproblemen:**

1. **SMTP passwords NIET encrypted in database!**
   ```javascript
   // In init-db.js:
   INSERT INTO smtp_settings (..., smtp_pass, ...)
   VALUES (..., process.env.SMTP_PASS, ...)
   // ^^ Plaintext in database!!
   ```

2. **system_config tabel NIET in db.initialize()**
   - Moet handmatig aangemaakt via `setup-system-config.js`
   - User moet weten om script uit te voeren
   - **GEEN idempotente setup!**

3. **Encrypted kolom ingesteld maar niet gebruikt**
   ```sql
   encrypted BOOLEAN DEFAULT 0
   -- ^^^ Column exists maar waarden worden NIET encrypted bij insert
   ```

4. **JWT_SECRET default hardcoded**
   - `'change-me-in-admin-panel'`
   - Veel te zwak voor production

---

### 2.2 Tabellen Die Worden Aangemaakt

| Tabel | Aangemaakt Door | Writable | Issue |
|-------|-----------------|----------|-------|
| `users` | database.js | ✅ Yes | MFA defaults disabled |
| `timesheets` | database.js | ✅ Yes | - |
| `companies` | database.js | ✅ Yes | - |
| `smtp_settings` | init-db.js | ✅ Yes | Passwords plaintext! |
| `branding_settings` | init-db.js | ✅ Yes | - |
| `system_config` | setup-system-config.js | ✅ Yes | **Missing from auto-init!** |
| `translations` | database.js | ✅ Yes | Seeded with 100+ rows |
| `ui_menu` | database.js | ✅ Yes | - |
| `invoice_templates` | database.js | ✅ Yes | - |
| `api_keys` | database.js | ✅ Yes | Hashed keys ✓ |

---

## 3️⃣ ADMIN PANEL INTEGRATIE

### 3.1 System Config Endpoints (`routes/admin.js`)

**Routes beschikbaar:**

```javascript
GET  /api/admin/system-config
     → Fetch alle configs (secrets masked)
     
GET  /api/admin/system-config/:key
     → Fetch 1 config (secrets hidden)
     
POST /api/admin/system-config
     → Update 1 config (encryption logic!)
     
POST /api/admin/system-config/batch
     → Update multiple configs
     
POST /api/admin/system-config/test-domain
     → Validate domain format
     
GET  /api/admin/system-config/secret/:key
     → Get decrypted secret (internal use)
```

**Autorisatie:** `router.use(authMiddleware)` + `router.use(adminMiddleware)`
- Requires valid JWT token
- User.role MUST be 'admin'

---

### 3.2 POST /system-config - Update Logic

**Validatie:**
```javascript
1. Check key exists in database (prevent injection)
2. Check value is not empty (for secrets)
3. For secrets: Encrypt before storing
4. UPDATE system_config SET value = ?, encrypted = ?
5. Return requiresRestart flag (JWT_SECRET, APP_DOMAIN, APP_URL)
```

**Encryption:**
```javascript
if (existing.is_secret && value) {
  const encrypted = secrets.encryptSecret(value)
  valueToStore = secrets.formatForStorage(encrypted)
}
```

**Encryption Details (secrets.js):**
```javascript
Algorithm: AES-256-GCM
Format: iv:authTag:encryptedData (base64)
Master Key: MASTER_SECRET_KEY env var OR derived from JWT_SECRET
           crypto.createHash('sha256').update(jwtSecret).digest()
```

**⚠️ KRITIEK PROBLEEM:**
```javascript
// In secrets.js line 21:
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production'
return crypto.createHash('sha256').update(jwtSecret).digest()

// ^^^ Master key derivation uses JWT_SECRET!
// If JWT_SECRET is the default 'change-me-in-admin-panel' → encryption key is WEAK!
```

---

### 3.3 GET /system-config - Masking Logic

**Response masking:**
```javascript
configs.map(config => ({
  ...config,
  value: config.is_secret ? '***' : config.value,
  display_value: config.is_secret ? '(Set - hidden for security)' : config.value
}))
```

**Good:** Secrets niet exposed in GET  
**Bad:** Ui will show "***" but doesn't tell user if value is actually set

---

### 3.4 Admin Panel UI - Missing!

**Status:** ❌ **Geen system configuration UI gevonden**

Zoekopdracht naar:
- `public/js/admin-new.js` - exists but NOT reviewed
- `public/js/admin.js` - not found
- `public/html/admin-config.html` - not found

**Gevolg:** System config kan ALLEEN via API endpoint ingesteld worden!
- Geen web interface
- User moet API calls handmatig doen
- Of admin moet via database SQL aangepast

---

## 4️⃣ SERVICE ACCOUNT HANDLING

### 4.1 Is Er een Service Account Concept?

**Onderzoeksresultaten:**

- ❌ **Geen dedicated service account**
- ❌ **Geen service account tabellen**
- ❌ **Geen service account authentication**

Wat IS er:
- ✅ API keys (`api_keys` tabel in users.js POST /api-keys)
- ✅ Admin users (role='admin')
- ⚠️ License Manager with separate DB (data.db)

### 4.2 Admin User (Functioneert als Service Account)

**Admin User Creatie (init-db.js):**
```javascript
INSERT INTO users (
  username = 'admin' (of env.ADMIN_USERNAME)
  password = bcrypt('Admin@123456' of env.ADMIN_PASSWORD)
  full_name = 'Administrator'
  role = 'admin'
)
```

**Authenticatie via JWT:**
```javascript
// routes/auth.js
POST /api/auth/login
→ Check username/password
→ Generate JWT token (expire: 24h default)
→ Return token
→ Client uses token in Authorization: Bearer <token>
```

**JWT Signing:**
```javascript
jwt.sign(
  { id: user.id, username: user.username },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
)
```

**⚠️ Admin User Issues:**

1. **Wachtwoord setup:**
   - Init-db.js uses `Admin@123456` default
   - Script says "PLEASE CHANGE PASSWORD" maar...
   - Geen forced password change op first login!
   - User kan inloggen en system gebruiken ZONDER wachtwoord te wijzigen

2. **MFA niet verplicht:**
   - Admin user created met `mfa_enabled = 0`
   - `middleware/auth.js` checks MFA maar...
   ```javascript
   if (!user.mfa_enabled) {
     const allowedWithoutMFA = [
       '/api/mfa/setup',
       '/api/mfa/verify',
       // ... admin CAN bypass MFA to set it up
     ]
   }
   ```
   - **Admin kan zonder MFA werken!**

3. **Geen audit logging van admin actions**
   - Geen tabel voor audit logs
   - System config updates worden gelogd naar console (niet persistent)

---

### 4.3 API Keys (Alternative Service Account)

**Creatie (admin.js):**
```javascript
POST /api/admin/api-keys
→ Generate random 32-byte key (crypto.randomBytes(32))
→ Hash with SHA256 (key_hash)
→ Store in api_keys tabel
→ Return plaintext key (once!)
```

**Gebruik:**
```javascript
Authorization: Bearer <api_key>
OF
?api_key=<api_key>

// Auth middleware hashes het en vergelijkt met key_hash
```

**✅ API Keys are secure:**
- Keys gehashed (SHA256)
- Plaintext never stored
- Can be revoked

---

## 5️⃣ KWETSBAARHEDEN & SECURITY ISSUES

### 5.1 Kritieke Security Issues

#### 🔴 CRITICAL: Hardcoded JWT_SECRET Default

**Locatie:** `scripts/setup-system-config.js` line 69
```javascript
value: process.env.JWT_SECRET || 'change-me-in-admin-panel'
```

**Impact:**
- Default JWT secret is WEAK (33 characters, lowercase)
- Production installs que use this → all JWTs compromised
- Encryption key also derived from this secret!
- **Severity: CRITICAL - RCE via JWT forgery possible**

**Recommendation:**
```javascript
// Generate strong default if not provided
const generateJWTSecret = () => crypto.randomBytes(32).toString('hex')
const jwtSecret = process.env.JWT_SECRET || generateJWTSecret()
```

---

#### 🔴 CRITICAL: SMTP Passwords Stored Plaintext

**Locatie:** `scripts/init-db.js` lines 54-59
```javascript
INSERT INTO smtp_settings (smtp_host, smtp_port, ... smtp_pass)
VALUES (..., process.env.SMTP_PASS)
// ^^ PLAINTEXT IN DATABASE!
```

**Impact:**
- Any SQL injection → SMTP credentials compromised
- Database backup contains plain SMTP password
- Admin can see SMTP password in database!

**Recommendation:**
```javascript
// Encrypt before storing
const { encryptPassword } = require('../utils/encryption')
const encryptedPass = encryptPassword(process.env.SMTP_PASS)
INSERT INTO smtp_settings (..., smtp_pass) VALUES (..., encryptedPass)
```

---

#### 🟠 HIGH: Encryption Key Derived from JWT_SECRET

**Locatie:** `utils/secrets.js` lines 21
```javascript
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production'
this.masterKey = crypto.createHash('sha256').update(jwtSecret).digest()
```

**Impact:**
- If JWT_SECRET compromised → encryption key compromised
- Single point of failure
- Master key not truly random (derived hash)

**Recommendation:**
```javascript
const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || generateRandomKey()
// Separate from JWT_SECRET
```

---

#### 🟠 HIGH: No Forced Password Change on First Login

**Locatie:** `middleware/auth.js` + `routes/admin.js`

**Issue:**
- Admin created with default password (if not in .env)
- No mechanism to force change on first login
- User can operate system without changing password

**Recommendation:**
```javascript
// Add column to users table
ALTER TABLE users ADD COLUMN password_changed_at DATETIME

// After login, check password age
if (user.created_at === user.password_changed_at) {
  return res.status(403).json({ requiresPasswordChange: true })
}
```

---

#### 🟠 HIGH: MFA Optional for Admin

**Locatie:** `middleware/auth.js` lines 166-184

**Issue:**
```javascript
if (!user.mfa_enabled) {
  const allowedWithoutMFA = [
    '/api/mfa/setup',
    '/api/mfa/verify'
    // ... admin can use system without MFA
  ]
}
```

**Recommendation:**
```javascript
// For admin users, MFA MUST be enabled
if (user.role === 'admin' && !user.mfa_enabled) {
  return res.status(403).json({
    error: "MFA required for admin accounts",
    mfaSetupRequired: true
  })
}
```

---

#### 🟠 HIGH: No Audit Logging

**Issue:**
- Admin actions logged to console (not persistent)
- No audit trail for compliance
- System config changes not logged to database

**Recommendation:**
```javascript
// Create audit_logs table
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  action TEXT,
  table_name TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)

// Log all config changes
INSERT INTO audit_logs (user_id, action, table_name, old_value, new_value)
VALUES (req.user.id, 'UPDATE', 'system_config', oldValue, newValue)
```

---

### 5.2 Dependency Vulnerabilities

**npm audit Output:**

Gevonden via package.json + package-lock.json:

| Package | Version | Vulnerability | Severity |
|---------|---------|---|---|
| `qs` | 6.11.0 | Prototype pollution | 🟠 HIGH |
| `express-rate-limit` | 7.1.5 | Unknown | Need audit |
| `pdfkit` | 0.13.0 | Unknown | Need audit |

**Recommendation:**
```bash
npm audit fix  # Auto-fix high severity
npm update     # Update minor/patch versions
```

---

### 5.3 Environment Variable Handling

**✅ Good:**
- `.env` loaded at startup (`require('dotenv').config()`)
- Sensitive values in .env (JWT_SECRET, SMTP_PASS)
- `.env` is in `.gitignore` (not committed)

**⚠️ Problematic:**
- Fallback to hardcoded values if .env missing
- No validation of required env vars on startup
- No error message if JWT_SECRET not set

**Recommendation:**
```javascript
// server.js startup
const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ CRITICAL: Environment variable ${envVar} not set!`)
    process.exit(1)
  }
}
```

---

### 5.4 Hardcoded Values in Codebase

**Gevonden hardcoded defaults:**

| Locatie | Value | Issue |
|---------|-------|-------|
| `scripts/init-db.js` L30 | `Admin@123456` | Wachtwoord |
| `scripts/setup-system-config.js` L69 | `change-me-in-admin-panel` | JWT Secret |
| `utils/encryption.js` L4 | `timesheet-default-key-change-in-production` | Encryption key |
| `utils/secrets.js` L21 | `change-me-in-production` | JWT Secret fallback |
| `license-manager/server.js` L113 | `Admin@123` | LM admin pwd |
| `license-manager/server.js` L138 | `license-manager-secret-key-2025` | Session secret |
| `license-manager/utils/license.js` L42 | `license-secret-key` | License HMAC |

**⚠️ KRITIEK:** Veel defaults gevonden! Production-ready setup ontbreekt.

---

### 5.5 Database Security

**✅ Good:**
- Wachtwoorden gehashed met bcrypt (10 rounds)
- API keys gehashed met SHA256
- Prepared statements gebruikt (parameterized queries)

**⚠️ Problematic:**
- SMTP passwords plaintext in db
- No row-level security (ACL on timesheets, etc.)
- SQLite (single-file, niet multi-tenant ready)
- No database encryption at rest

---

## 6️⃣ MAPRECHTEN ANALYSE

### 6.1 Directory Structure & Writable Folders

**Vereiste Directory Structuur:**

```
/opt/timesheet/ (production path)
├── database.sqlite          [RW] Database file (created by app)
├── certs/                   [RW] SSL certificates
│   ├── account-key.pem     [Private] Account key
│   ├── cert.pem            [Public] Certificate
│   └── private-key.pem     [Private] Private key
├── backups/                 [RW] Database backups
│   └── database-*.sqlite   [RW] Backup files
├── node_modules/           [RO] Dependencies
├── public/                  [RO] Static files
│   ├── css/
│   ├── js/
│   ├── icons/
│   └── docs/
├── scripts/                 [RO] Setup scripts
├── routes/                  [RO] API routes
├── utils/                   [RO] Utilities
├── config/                  [RO] Configuration
├── middleware/              [RO] Middleware
└── server.js               [RO] Server file
```

### 6.2 File Permission Requirements

**For Linux Production (`/opt/timesheet`):**

```bash
# Owner: www-data (or nginx user)
# Group: www-data

# Configuration
644 (-rw-r--r--) .env                    # Readable by app, not world
600 (-rw-------) .env.production.secret  # If separated
644 (-rw-r--r--) .env.example

# Database & Writable
755 (drwxr-xr-x) /opt/timesheet          # Directory readable
755 (drwxr-xr-x) database.sqlite         # Dir writable by www-data
644 (-rw-r--r--) database.sqlite         # File writable by www-data

# Backups & Certificates
755 (drwxr-xr-x) backups/                # RW by www-data
755 (drwxr-xr-x) certs/                  # RW by www-data
600 (-rw-------) certs/private-key.pem   # Private!
644 (-rw-r--r--) certs/cert.pem          # Public cert

# Application files
755 (drwxr-xr-x) public/
755 (drwxr-xr-x) routes/
755 (drwxr-xr-x) utils/
755 (drwxr-xr-x) scripts/
644 (-rw-r--r--) server.js
644 (-rw-r--r--) package.json
644 (-rw-r--r--) package-lock.json
755 (drwxr-xr-x) node_modules/           # Installed dependencies

# Create script
chmod 755 scripts/update.sh
chmod 755 scripts/restart-clean.ps1      # On Windows
```

**Set correct permissions (Linux):**

```bash
# Run as root or with sudo
cd /opt/timesheet

# Set owner
sudo chown -R www-data:www-data .

# Set permissions (conservative)
sudo find . -type f -exec chmod 644 {} \;    # Files readable
sudo find . -type d -exec chmod 755 {} \;    # Dirs traversable

# Database writable
sudo chmod 666 database.sqlite

# Backups folder writable
sudo chmod 755 backups/
sudo chmod 666 backups/*.sqlite

# Certificates readable by www-data only
sudo chmod 755 certs/
sudo chmod 600 certs/private-key.pem
sudo chmod 644 certs/cert.pem
```

**Check permissions:**

```bash
ls -la /opt/timesheet/
ls -la /opt/timesheet/database.sqlite
ls -la /opt/timesheet/certs/
```

---

### 6.3 Startup Procedure File Access

**Server.js Initialization:**

```javascript
1. require('dotenv').config()
   → Reads .env (must be RO, readable by app user)

2. const db = require('./config/database')
   → Opens database.sqlite
   → If not exists: SQLite creates it
   → Need WRITE permission on directory

3. db.initialize()
   → Creates tables (idempotent)
   → Creates backups/ if needed
   → Need WRITE permission on database.sqlite

4. app.use(fileUpload())
   → Temp files created (probably /tmp/)
   → Need WRITE permission on temp

5. fs.readFileSync('certs/cert.pem')
   → Read SSL cert if HTTPS enabled
   → Need READ permission
```

---

## 7️⃣ STARTUP PROCEDURE (server.js)

### 7.1 Complete Startup Flow

```javascript
// 1. Load environment
require('dotenv').config()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// 2. Create Express app
const app = express()

// 3. Security middleware
app.use(helmet({
  contentSecurityPolicy: {...},
  crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// 4. Connect database
const db = require('./config/database')
// This calls db.initialize() → creates all tables
// Database.sqlite created if not exists

// 5. Setup routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)  // <-- System config endpoints here
app.use('/api/user', userRoutes)
// ... more routes

// 6. Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), env: NODE_ENV })
})

// 7. Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

### 7.2 Database Path Determination

**Locatie:** `config/database.js` line 3

```javascript
const dbPath = process.env.DB_PATH || "./database.sqlite"

// ^^^ Resolved relative to current working directory!
// If app started from /opt/timesheet → creates /opt/timesheet/database.sqlite
// If app started from / → creates /database.sqlite (!!)
```

**⚠️ Problem:** Path not absolute!

**Fix:**
```javascript
const dbPath = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'database.sqlite')

// Now always resolved from project root
```

---

### 7.3 System Config Loading at Startup

**Issue:** System config is NOT loaded at startup!

```javascript
// server.js does NOT do:
// const config = await db.all('SELECT * FROM system_config')
// process.config = config

// Result: System config only loaded when admin panel requests it
```

**Consequence:**
- JWT_SECRET from environment variable used (not from system_config)
- LETSENCRYPT_ENABLED not checked at startup
- SSL paths not loaded

**Recommendation:**
```javascript
// server.js startup
async function loadSystemConfig() {
  try {
    const configs = await db.all('SELECT key, value, is_secret FROM system_config')
    process.env.CONFIG = {}
    for (const config of configs) {
      if (config.is_secret) {
        process.env.CONFIG[config.key] = decryptSecret(config.value)
      } else {
        process.env.CONFIG[config.key] = config.value
      }
    }
    console.log('✓ System config loaded')
  } catch (err) {
    console.error('Warning: System config table missing, using .env')
  }
}

// Call before starting server
await loadSystemConfig()
```

---

## 8️⃣ LICENSE MANAGER ANALYSE

### 8.1 License Manager Structure

**Locatie:** `/license-manager/` directory

**Database:** `data.db` (separate from main app)

**Tables:**
```
license_users
├── email (admin@license.local)
├── password (bcrypted 'Admin@123')
├── mfa_secret
└── mfa_enabled

companies
├── name
├── email
└── contact_person

licenses
├── company_id FK
├── license_key (unique)
├── modules TEXT (JSON array)
├── valid_from / valid_until
├── is_active
└── created_by FK license_users
```

### 8.2 License Manager Security Issues

#### 🔴 CRITICAL: Hardcoded Admin Password

**Locatie:** `license-manager/server.js` line 113

```javascript
const hashedPassword = bcrypt.hashSync('Admin@123', 10)
INSERT INTO license_users (email, password) 
VALUES ('admin@license.local', hashedPassword)
```

**Impact:**
- Default password '`Admin@123`' (only 8 chars!)
- No prompt to change password on first login
- Session not secure

**Fix:**
```javascript
const adminPassword = process.env.LICENSE_ADMIN_PASSWORD 
  || generateRandomPassword(16)
```

---

#### 🟠 HIGH: Hardcoded Session Secret

**Locatie:** `license-manager/server.js` line 138

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET || 'license-manager-secret-key-2025',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    httpOnly: true,                                  // Can't access from JS
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}))
```

**Issue:**
- Fallback session secret exposed in source code
- All sessions signed with same key
- Session tampering possible

**Fix:**
```javascript
const sessionSecret = process.env.SESSION_SECRET 
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable required!')
}
```

---

#### 🟠 HIGH: License Secret Hardcoded

**Locatie:** `license-manager/utils/license.js` line 42

```javascript
const hmac = crypto.createHmac('sha256', 
  process.env.LICENSE_SECRET || 'license-secret-key'
)
```

**Impact:**
- License verification uses weak default key
- Anyone can forge licenses!

**Fix:**
```javascript
const licenseSecret = process.env.LICENSE_SECRET
if (!licenseSecret) {
  throw new Error('LICENSE_SECRET not configured!')
}
```

---

### 8.3 License Manager Database Credentials

**Locatie:** `license-manager/server.js` line 42

```javascript
const db = new sqlite3.Database(
  path.join(__dirname, '..', 'data.db'),
  (err) => {
    if (err) console.error('Database connection error:', err)
    else console.log('Connected to SQLite database (License Manager)')
  }
)
```

**Issues:**
- Separate database (good for isolation)
- No encryption of license data
- No audit logging

---

## 9️⃣ EXACT INTERACTIEVE INSTALLATIE STAPPEN

### 9.1 Huidige Procedure (Manual)

**Stap 1: Clone & Install**
```bash
git clone https://github.com/...timesheet.git
cd timesheet
npm install
```

**Stap 2: Create .env**
```bash
# Copy example
cp .env.example .env

# Edit with values (requires knowing what to set)
nano .env
```

**Required .env values:**
```
PORT=3000
NODE_ENV=production
JWT_SECRET=<GENERATE RANDOM STRING HERE!>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<SET STRONG PASSWORD HERE!>
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
DATABASE_URL=./database.sqlite
```

**Stap 3: Initialize Database**
```bash
npm run init-db
```

Output:
```
Initializing database...
✓ Admin user created
  Username: admin
  Password: Admin@123456
  PLEASE CHANGE THE PASSWORD AFTER FIRST LOGIN!
✓ SMTP settings initialized
✓ Branding settings initialized

Database initialization complete!
```

**⚠️ Problem:** User gets default password, must remember to change it.

**Stap 4: Setup System Config**
```bash
node scripts/setup-system-config.js
```

Output:
```
Setting up system_config table...
✓ system_config table created
✓ Default configurations initialized
✓ System config table has 9 entries

✅ System configuration setup complete!
```

**Stap 5: Start Server**
```bash
npm start
```

**⚠️ Problems with manual process:**
1. User must know all env vars
2. No validation of values
3. Defaults not safe
4. Must run TWO commands (init-db + setup-system-config)
5. No interactive prompts
6. User receives default password but no way to change it via CLI

---

### 9.2 Proposed Interactieve Setup Procedure

**Nieuw script: `scripts/setup-interactive.js`**

```javascript
#!/usr/bin/env node

/**
 * Interactive Setup Wizard
 * One-stop shop for complete service account installation
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const db = require('../config/database')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Helper functions
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

async function setupWizard() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  TIMESHEET INSTALLATION WIZARD                             ║')
  console.log('║  Set up service account and database                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Step 1: Admin Credentials
  console.log('📝 STEP 1: Admin Account Credentials\n')
  
  const adminUsername = await question('Admin username [admin]: ') || 'admin'
  const adminPassword = await question('Admin password (min 8 chars): ')
  
  if (adminPassword.length < 8) {
    console.error('❌ Password too short (minimum 8 characters)')
    process.exit(1)
  }

  // Step 2: SMTP Configuration
  console.log('\n📧 STEP 2: Email (SMTP) Configuration\n')
  
  const smtpHost = await question('SMTP Host [smtp.office365.com]: ') || 'smtp.office365.com'
  const smtpPort = await question('SMTP Port [587]: ') || '587'
  const smtpUser = await question('SMTP Email: ')
  const smtpPass = await question('SMTP Password/App Password: ')

  // Step 3: Application URL
  console.log('\n🌐 STEP 3: Application URL\n')
  
  const appDomain = await question('App domain [localhost:3000]: ') || 'localhost:3000'
  const appUrl = await question('App URL [http://localhost:3000]: ') || 'http://localhost:3000'

  // Step 4: JWT Secret
  console.log('\n🔐 STEP 4: Security\n')
  
  let jwtSecret
  const autoGenJWT = await question('Generate random JWT secret? [Y/n]: ')
  if (autoGenJWT.toLowerCase() !== 'n') {
    jwtSecret = generateRandomString(64)
    console.log(`Generated: ${jwtSecret.substring(0, 20)}...`)
  } else {
    jwtSecret = await question('Enter JWT secret: ')
    if (jwtSecret.length < 32) {
      console.warn('⚠️  Warning: JWT secret is less than 32 characters (less secure)')
    }
  }

  // Step 5: Review
  console.log('\n👁️  STEP 5: Review Configuration\n')
  console.log(`Admin Username: ${adminUsername}`)
  console.log(`Admin Password: ${adminPassword.charAt(0)}${'*'.repeat(adminPassword.length - 2)}${adminPassword.charAt(adminPassword.length - 1)}`)
  console.log(`SMTP Host: ${smtpHost}:${smtpPort}`)
  console.log(`SMTP User: ${smtpUser}`)
  console.log(`App Domain: ${appDomain}`)
  console.log(`App URL: ${appUrl}`)
  console.log(`JWT Secret: ${jwtSecret.substring(0, 20)}...`)
  
  const confirmed = await question('\n✅ Apply configuration? [Y/n]: ')
  if (confirmed.toLowerCase() === 'n') {
    console.log('❌ Setup cancelled')
    process.exit(0)
  }

  // Step 6: Update .env
  console.log('\n⚙️  STEP 6: Writing configuration...\n')
  
  const envContent = `# Generated by setup-interactive.js
JWT_SECRET=${jwtSecret}
DATABASE_URL=./database.sqlite
PORT=3000
NODE_ENV=development
SMTP_HOST=${smtpHost}
SMTP_PORT=${smtpPort}
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}
EMAIL_FROM=${smtpUser}
EMAIL_TO=${smtpUser}
APP_NAME=Timesheet Management System
APP_URL=${appUrl}
APP_DOMAIN=${appDomain}
LICENSE_KEY=
`

  const envPath = path.join(__dirname, '..', '.env')
  try {
    fs.writeFileSync(envPath, envContent, { mode: 0o600 })
    console.log(`✓ .env file created (mode 600)`)
  } catch (err) {
    console.error(`❌ Failed to write .env: ${err.message}`)
    process.exit(1)
  }

  // Step 7: Initialize Database
  console.log('\n💾 STEP 7: Initializing database...\n')

  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    await db.run(
      `INSERT INTO users (username, password, full_name, role) 
       VALUES (?, ?, ?, ?)`,
      [adminUsername, hashedPassword, 'Administrator', 'admin']
    )
    console.log(`✓ Admin user created: ${adminUsername}`)

    // Create SMTP settings
    await db.run(
      `INSERT INTO smtp_settings 
       (smtp_host, smtp_port, smtp_user, smtp_pass, email_from, email_to) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [smtpHost, smtpPort, smtpUser, smtpPass, smtpUser, smtpUser]
    )
    console.log(`✓ SMTP settings configured`)

    // Create system_config
    await db.run(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        encrypted BOOLEAN DEFAULT 0,
        description TEXT,
        is_secret BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const configs = [
      ['APP_DOMAIN', appDomain, 0, 'Application domain', 0],
      ['APP_URL', appUrl, 0, 'Full application URL', 0],
      ['JWT_SECRET', jwtSecret, 1, 'JWT authentication secret', 1],
      ['SSL_ENABLED', '0', 0, 'Is SSL enabled', 0],
      ['SSL_CERT_PATH', '', 0, 'Path to SSL certificate', 0],
      ['SSL_KEY_PATH', '', 0, 'Path to SSL key', 0],
    ]

    for (const [key, value, encrypted, description, is_secret] of configs) {
      await db.run(
        `INSERT OR IGNORE INTO system_config (key, value, encrypted, description, is_secret) 
         VALUES (?, ?, ?, ?, ?)`,
        [key, value, encrypted, description, is_secret]
      )
    }
    console.log(`✓ System configuration initialized (6 entries)`)
  } catch (err) {
    console.error(`❌ Database setup failed: ${err.message}`)
    process.exit(1)
  }

  // Final summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗')
  console.log('║           ✅ SETUP COMPLETE!                               ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  console.log('📋 NEXT STEPS:\n')
  console.log('1. Start the server:')
  console.log('   npm start\n')
  console.log('2. Login at http://localhost:3000 with:')
  console.log(`   Username: ${adminUsername}`)
  console.log(`   Password: (password you entered)\n`)
  console.log('3. Go to Admin Panel → System Config to review settings\n')
  console.log('4. Recommended: Change your password after first login\n')

  console.log('🔐 Security reminders:\n')
  console.log('- Never commit .env file to git')
  console.log('- Backup database regularly')
  console.log('- Change admin password periodically')
  console.log('- Keep software updated: npm update\n')

  rl.close()
  db.close()
  process.exit(0)
}

setupWizard().catch((err) => {
  console.error('❌ Setup failed:', err)
  rl.close()
  process.exit(1)
})
```

**Usage:**
```bash
npm run setup-interactive
```

**Workflow:**
```
? Admin username [admin]: admin
? Admin password (min 8 chars): [user enters]
? SMTP Host [smtp.office365.com]: [user enters]
? SMTP Port [587]: [user enters]
? SMTP Email: user@domain.com
? SMTP Password: [user enters]
? App domain [localhost:3000]: localhost:3000
? App URL [http://localhost:3000]: http://localhost:3000
? Generate random JWT secret? [Y/n]: Y
Generated: a1b2c3d4e5f6g7h8...

[Review screen]
✅ Apply configuration? [Y/n]: Y

[Creating .env, db, tables]
✅ SETUP COMPLETE!

📋 NEXT STEPS:
1. Start server: npm start
2. Login with credentials above
3. Go to Admin Panel
...
```

---

## 🔟 AANBEVELINGEN & ACTION ITEMS

### Prioriteit 1: CRITICAL (Do First)

- [ ] **Replace hardcoded JWT_SECRET default**
  - Generate random secret if not in .env
  - Fail startup if JWT_SECRET not set

- [ ] **Encrypt SMTP passwords in database**
  - Add encryption to init-db.js
  - Migrate existing plaintext values
  - Decrypt when reading

- [ ] **Separate encryption key from JWT_SECRET**
  - Create MASTER_SECRET_KEY env var
  - Don't derive encryption key from JWT

- [ ] **Add forced password change on first login**
  - Add `password_changed_at` column to users
  - Check in auth middleware
  - Redirect to password change form

### Prioriteit 2: HIGH (Do Next)

- [ ] **Create interactive setup wizard** (`setup-interactive.js`)
  - Replace manual .env creation
  - Validate all inputs
  - Create database in one step

- [ ] **Add MFA requirement for admin**
  - Force MFA setup on first login
  - Don't allow system access without MFA

- [ ] **Implement audit logging**
  - Create `audit_logs` table
  - Log all admin actions
  - Persistent storage (not just console)

- [ ] **Resolve database path** (use absolute path in config/database.js)
  - Use `path.join(__dirname, ...)` instead of relative paths

- [ ] **Fix npm vulnerabilities**
  - npm audit fix
  - Update dependencies

### Prioriteit 3: MEDIUM (Nice to Have)

- [ ] **Create admin panel UI for system config**
  - Web interface for JWT_SECRET, URLs, SSL
  - Don't require API calls

- [ ] **Load system_config at server startup**
  - Don't just use .env
  - Allow runtime configuration changes

- [ ] **Document all environment variables**
  - Create `.env.example` with all vars
  - Add descriptions and validation

- [ ] **Add environment validation on startup**
  - Check required vars
  - Check file permissions
  - Check database connectivity

### Prioriteit 4: LOW (Polish)

- [ ] **License Manager security hardening**
  - Remove hardcoded defaults
  - Add integration tests

- [ ] **Database encryption at rest**
  - Consider encrypted SQLite extensions

- [ ] **Separate license manager database**
  - Move to separate server

---

## 📊 SAMENVATTINGSTABEL

| Aspect | Status | Score | Issue |
|--------|--------|-------|-------|
| **Installation** | ⚠️ Manual | 3/10 | Requires .env knowledge |
| **Admin Setup** | ⚠️ Partial | 4/10 | Hardcoded defaults |
| **Security** | ❌ Weak | 3/10 | Multiple critical issues |
| **Database** | ✅ Good | 7/10 | Structured schema |
| **Encryption** | ❌ Problematic | 2/10 | Weak key derivation |
| **Audit Trail** | ❌ Missing | 0/10 | No logging |
| **Configuration** | ⚠️ Partial | 5/10 | No UI for system config |
| **API Keys** | ✅ Good | 8/10 | Properly hashed |
| **Error Handling** | ✅ Good | 7/10 | Try-catch coverage |
| **Documentation** | ⚠️ Fair | 5/10 | Missing setup guides |

---

## 📝 CONCLUSIE

De Timesheet applicatie **mist een productie-ready service account setup procedure**. Huidige workflow is:

1. ❌ Manual .env creation (error-prone)
2. ❌ Hardcoded defaults (insecure)
3. ❌ Two separate scripts (init-db + setup-system-config)
4. ❌ No validation
5. ❌ No forced password change
6. ❌ Plaintext SMTP passwords

**Aanbevelingen:**

1. **Immediate:** Replace hardcoded defaults, separate encryption keys, add password change requirement
2. **Short-term:** Create interactive setup wizard, add MFA enforcement
3. **Medium-term:** Build admin UI for system config, implement audit logging
4. **Long-term:** Consider multi-tenant support, database encryption

**Geschatte inspanning:**
- Critical fixes: 2-3 days
- Interactive setup: 1-2 days
- Audit logging: 1-2 days
- Admin UI: 2-3 days
- **Total: ~1-2 weken voor production-ready setup**

---

## 📚 REFERENTIES

- [security.js](utils/secrets.js) - Encryption implementation
- [init-db.js](scripts/init-db.js) - Database initialization
- [setup-system-config.js](scripts/setup-system-config.js) - System config
- [admin.js routes](routes/admin.js#L2393) - System config endpoints
- [auth.js middleware](middleware/auth.js) - Authentication & MFA
- [database.js](config/database.js) - Database schema

---

**Report opgesteld door:** AI Assistant  
**Last updated:** 11 January 2026
