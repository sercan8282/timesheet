# 🔒 SECURITY RECOMMENDATIONS & ACTION ITEMS

**Priority-based implementation guide for hardening Timesheet service account setup**

---

## 🔴 CRITICAL - IMPLEMENT IMMEDIATELY

### 1. Replace Hardcoded JWT_SECRET Default

**Files to fix:**
- `scripts/setup-system-config.js` line 69
- `utils/secrets.js` line 21

**Current code:**
```javascript
value: process.env.JWT_SECRET || 'change-me-in-admin-panel'
```

**Fix:**
```javascript
// utils/secrets.js
const crypto = require('crypto')

const generateRandomSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex')
}

const JWT_SECRET = process.env.JWT_SECRET || generateRandomSecret()

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set - using generated random value')
  console.warn('⚠️  Set JWT_SECRET in .env for production!')
}
```

**Severity:** CRITICAL - Allows JWT forgery if default used  
**Effort:** 30 minutes  
**Impact:** Prevents RCE via compromised JWTs

---

### 2. Encrypt SMTP Passwords in Database

**Files to fix:**
- `scripts/init-db.js` lines 54-59
- Create migration script for existing data

**Current code:**
```javascript
INSERT INTO smtp_settings (..., smtp_pass)
VALUES (..., process.env.SMTP_PASS)  // ❌ PLAINTEXT
```

**Fix:**
```javascript
// scripts/init-db.js
const { encryptPassword } = require('../utils/encryption')

const encryptedPassword = encryptPassword(process.env.SMTP_PASS || '')

await db.run(
  `INSERT INTO smtp_settings (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, email_to)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [
    process.env.SMTP_HOST || 'smtp.office365.com',
    parseInt(process.env.SMTP_PORT) || 587,
    process.env.SMTP_SECURE === 'true' ? 1 : 0,
    process.env.SMTP_USER || '',
    encryptedPassword,  // ✅ ENCRYPTED
    process.env.EMAIL_FROM || '',
    process.env.EMAIL_TO || 'info@eutransport.nl'
  ]
)
```

**Migration for existing data:**
```bash
# Script: scripts/encrypt-smtp-passwords.js
node scripts/encrypt-smtp-passwords.js
```

**Severity:** CRITICAL - Exposes credentials to any SQL injection  
**Effort:** 1-2 hours (including migration)  
**Impact:** Prevents credential theft via database access

---

### 3. Separate Encryption Key from JWT_SECRET

**Files to fix:**
- `utils/secrets.js` lines 12-21
- `utils/encryption.js` line 4

**Current vulnerability:**
```javascript
// If JWT_SECRET is compromised → encryption key is compromised!
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production'
this.masterKey = crypto.createHash('sha256').update(jwtSecret).digest()
```

**Fix:**
```javascript
// utils/secrets.js
class SecretsManager {
  constructor() {
    // Use separate master key (NOT derived from JWT_SECRET)
    this.masterKey = process.env.MASTER_SECRET_KEY 
      ? Buffer.from(process.env.MASTER_SECRET_KEY, 'hex')
      : this.generateDefaultMasterKey()

    if (!process.env.MASTER_SECRET_KEY) {
      console.warn('⚠️  MASTER_SECRET_KEY not set - using generated value')
      console.warn('⚠️  Set MASTER_SECRET_KEY in .env for consistency!')
    }
  }

  generateDefaultMasterKey() {
    // Generate random key (not derived from anything)
    return crypto.randomBytes(32)
  }
}
```

**Update `.env`:**
```env
# Before:
JWT_SECRET=<secret>
# MASTER_SECRET_KEY not set

# After:
JWT_SECRET=<secret1>
MASTER_SECRET_KEY=<secret2>  # Different secret!
```

**Severity:** CRITICAL - Single point of failure  
**Effort:** 1-2 hours  
**Impact:** Defense in depth - encryption key independent of JWT

---

### 4. Add Forced Password Change on First Login

**Files to modify:**
- `config/database.js` - Add column
- `middleware/auth.js` - Check column
- `routes/auth.js` - Add endpoint

**Step 1: Database migration**
```javascript
// scripts/add-forced-password-change.js
const db = require('../config/database')

async function addForcedPasswordChange() {
  try {
    // Add column if not exists
    await db.run(`
      ALTER TABLE users ADD COLUMN password_changed_at DATETIME
    `)
    
    // Set for existing users (they've already "changed" it)
    await db.run(`
      UPDATE users SET password_changed_at = created_at 
      WHERE password_changed_at IS NULL
    `)
    
    console.log('✓ Forced password change column added')
  } catch (err) {
    if (err.message.includes('duplicate column')) {
      console.log('✓ Column already exists')
    } else {
      throw err
    }
  }
}

addForcedPasswordChange()
```

**Step 2: Auth middleware check**
```javascript
// middleware/auth.js
if (user.role === 'admin' && !user.password_changed_at) {
  return res.status(403).json({
    error: 'Password change required',
    requiresPasswordChange: true,
    redirectTo: '/admin/change-password'
  })
}
```

**Step 3: Password change endpoint**
```javascript
// routes/auth.js
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body

  // Validate new password
  if (newPassword.length < 8 || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Invalid password' })
  }

  // Verify current password
  const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id])
  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) {
    return res.status(401).json({ error: 'Current password incorrect' })
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await db.run(
    `UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [hashedPassword, req.user.id]
  )

  res.json({ success: true, message: 'Password changed successfully' })
})
```

**Severity:** CRITICAL - Default passwords expose system  
**Effort:** 2-3 hours  
**Impact:** Prevents exploitation of default credentials

---

### 5. Require MFA for Admin Users

**Files to modify:**
- `middleware/auth.js` - Force MFA for admins
- `routes/mfa.js` - Already implements MFA setup

**Fix:**
```javascript
// middleware/auth.js
if (user.role === 'admin' && !user.mfa_enabled) {
  // Allow access to MFA setup endpoints only
  const allowedWithoutMFA = [
    '/api/mfa/setup',
    '/api/mfa/verify',
    '/api/mfa/backup-codes',
    '/api/auth/logout'
  ]
  
  const isAllowedEndpoint = allowedWithoutMFA.some(ep => 
    req.path === ep || req.path.startsWith(ep + '/')
  )
  
  if (!isAllowedEndpoint) {
    return res.status(403).json({
      error: 'MFA setup required for admin access',
      mfaSetupRequired: true,
      redirectTo: '/mfa-setup'
    })
  }
}
```

**Severity:** CRITICAL - Admin account most important  
**Effort:** 1-2 hours (MFA already implemented)  
**Impact:** Protects against credential theft

---

## 🟠 HIGH - DO WITHIN 1 WEEK

### 6. Create Interactive Setup Wizard

**Status:** ✅ **ALREADY CREATED** - See `scripts/setup-interactive.js`

**Features implemented:**
- ✅ Username/password validation
- ✅ Email format validation  
- ✅ Domain validation
- ✅ Automatic JWT/Master Key generation
- ✅ Configuration review step
- ✅ Database initialization
- ✅ Security checklist on completion

**To enable:**
```json
{
  "scripts": {
    "setup-interactive": "node scripts/setup-interactive.js"
  }
}
```

**Usage:**
```bash
npm run setup-interactive
```

---

### 7. Implement Audit Logging

**Files to create:**
- `scripts/add-audit-logging.js` - Database migration
- `utils/audit.js` - Audit logging utilities

**Step 1: Create audit_logs table**
```javascript
// scripts/add-audit-logging.js
await db.run(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

// Create index for fast queries
await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user_time 
  ON audit_logs(user_id, created_at DESC)`)
```

**Step 2: Create audit utility**
```javascript
// utils/audit.js
async function logAudit(req, action, entityType, entityId, oldValue, newValue) {
  try {
    const db = require('../config/database')
    await db.run(
      `INSERT INTO audit_logs 
       (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user?.id || null,
        action,
        entityType,
        entityId,
        JSON.stringify(oldValue),
        JSON.stringify(newValue),
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent']
      ]
    )
  } catch (err) {
    console.error('Audit log error:', err)
    // Don't throw - logging should not break application
  }
}

module.exports = { logAudit }
```

**Step 3: Use in system-config updates**
```javascript
// routes/admin.js
router.post('/system-config', async (req, res) => {
  const { key, value } = req.body
  
  const existing = await db.get(
    'SELECT * FROM system_config WHERE key = ?',
    [key]
  )

  const oldValue = existing?.value
  
  // ... update logic ...
  
  // Log the change
  const { logAudit } = require('../utils/audit')
  await logAudit(req, 'UPDATE', 'system_config', existing.id, oldValue, value)

  res.json({ success: true })
})
```

**Severity:** HIGH - Compliance & forensics  
**Effort:** 2-3 hours  
**Impact:** Full audit trail for admin actions

---

### 8. Implement Configuration Validation at Startup

**Files to create/modify:**
- `scripts/validate-config.js` - Validation script
- `server.js` - Call during startup

**Implementation:**
```javascript
// scripts/validate-config.js
async function validateConfiguration() {
  const checks = {
    requiredEnvVars: [
      'JWT_SECRET',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD',
      'SMTP_HOST',
      'SMTP_USER'
    ],
    envVarLengths: {
      JWT_SECRET: { min: 32, name: 'JWT Secret' },
      ADMIN_PASSWORD: { min: 8, name: 'Admin Password' },
      MASTER_SECRET_KEY: { min: 32, name: 'Master Secret Key' }
    },
    filePermissions: {
      '.env': { mode: '0600', desc: '.env file (readable by owner only)' },
      'database.sqlite': { writable: true, desc: 'Database file (must be writable)' }
    },
    directories: {
      'backups': { writable: true, desc: 'Backups directory (must be writable)' },
      'certs': { writable: true, desc: 'Certificates directory (must be writable)' }
    }
  }

  let issues = []

  // Check required env vars
  for (const envVar of checks.requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`❌ CRITICAL: ${envVar} not set in .env`)
    }
  }

  // Check env var lengths
  for (const [envVar, { min, name }] of Object.entries(checks.envVarLengths)) {
    if (process.env[envVar] && process.env[envVar].length < min) {
      issues.push(`⚠️  WARNING: ${name} is less than ${min} characters (security risk)`)
    }
  }

  // Check file permissions (Unix only)
  if (process.platform !== 'win32') {
    const fs = require('fs')
    const path = require('path')
    
    try {
      const stat = fs.statSync('.env')
      const octal = (stat.mode & parseInt('777', 8)).toString(8)
      if (octal !== '600') {
        issues.push(`⚠️  WARNING: .env has permissions ${octal} (should be 600)`)
      }
    } catch (err) {
      issues.push(`❌ ERROR: .env file not found`)
    }
  }

  return issues
}

// Run at startup
async function runValidation() {
  const issues = await validateConfiguration()
  
  if (issues.length === 0) {
    console.log('✓ All configuration checks passed')
    return true
  }

  console.error('\n⚠️  Configuration Issues:\n')
  issues.forEach(issue => console.error('  ' + issue))

  // Fail on critical issues
  const critical = issues.filter(i => i.startsWith('❌'))
  if (critical.length > 0) {
    console.error('\n❌ CRITICAL issues found. Cannot start server.')
    process.exit(1)
  }

  return false
}
```

**Add to server.js:**
```javascript
// server.js - at startup
const validateConfig = require('./scripts/validate-config')

async function startServer() {
  console.log('Validating configuration...')
  await validateConfig.runValidation()
  
  // Continue with server startup
}

startServer()
```

**Severity:** HIGH - Prevents misconfiguration  
**Effort:** 2-3 hours  
**Impact:** Clear error messages on startup

---

### 9. Add Admin Panel UI for System Config

**Files to create:**
- `public/js/admin-system-config.js` - Frontend logic
- `public/html/admin-system-config.html` - UI template

**Simple implementation:**
```html
<!-- public/html/admin-system-config.html -->
<div id="system-config-panel">
  <h2>System Configuration</h2>
  
  <div id="config-list" class="config-list">
    <!-- Loaded dynamically -->
  </div>
</div>

<script src="../js/admin-system-config.js"></script>
```

```javascript
// public/js/admin-system-config.js
async function loadSystemConfig() {
  const response = await fetch('/api/admin/system-config', {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  })
  const configs = await response.json()

  const html = configs.map(config => `
    <div class="config-item">
      <label>${config.description || config.key}</label>
      <div class="config-value">
        ${config.is_secret ? 
          `<input type="password" data-key="${config.key}" value="${config.value || ''}" />` :
          `<input type="text" data-key="${config.key}" value="${config.value || ''}" />`
        }
        <button onclick="updateConfig('${config.key}')">Save</button>
      </div>
    </div>
  `).join('')

  document.getElementById('config-list').innerHTML = html
}

async function updateConfig(key) {
  const input = document.querySelector(`input[data-key="${key}"]`)
  const value = input.value

  const response = await fetch('/api/admin/system-config', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ key, value })
  })

  if (response.ok) {
    alert('Configuration updated successfully')
    if (response.requiresRestart) {
      alert('Application restart required')
    }
  } else {
    alert('Failed to update configuration')
  }
}

// Load on page load
document.addEventListener('DOMContentLoaded', loadSystemConfig)
```

**Severity:** HIGH - Reduces need for API calls  
**Effort:** 2-3 hours  
**Impact:** User-friendly configuration management

---

## 🟡 MEDIUM - DO WITHIN 1 MONTH

### 10. Separate License Manager Defaults

**Files to fix:**
- `license-manager/server.js` - Remove hardcoded passwords
- `license-manager/utils/license.js` - Remove hardcoded secrets

**Changes:**
```javascript
// Before:
secret: process.env.SESSION_SECRET || 'license-manager-secret-key-2025'

// After:
secret: (() => {
  if (!process.env.SESSION_SECRET) {
    console.error('CRITICAL: SESSION_SECRET not set')
    process.exit(1)
  }
  return process.env.SESSION_SECRET
})()
```

**Update .env:**
```env
LICENSE_ADMIN_PASSWORD=<random-generated>
SESSION_SECRET=<random-generated>
LICENSE_SECRET=<random-generated>
```

---

### 11. Implement Database Encryption at Rest (SQLite)

**Options:**
1. SQLCipher (most secure) - requires compiled extension
2. Backup encryption - simpler to implement

**Simpler approach:**
```bash
# Install sqlite-async with encryption support
npm install sqlcipher

# Modify config/database.js to use sqlcipher
const Database = require('sqlcipher').Database
db.run("PRAGMA key = 'encryption-key-here'")
```

---

### 12. Load system_config at Server Startup

**Files to modify:**
- `server.js` - Add startup configuration loading
- `config/database.js` - Add system config cache

**Implementation:**
```javascript
// server.js - Startup
async function loadSystemConfig() {
  try {
    const configs = await db.all('SELECT key, value, is_secret FROM system_config')
    
    // Decrypt secrets if needed
    for (const config of configs) {
      if (config.is_secret) {
        const { secrets } = require('./utils/secrets')
        config.value = secrets.decryptSecret(config.value)
      }
    }

    // Cache in memory
    global.systemConfig = {}
    configs.forEach(c => {
      global.systemConfig[c.key] = c.value
    })

    console.log('✓ System configuration loaded')
  } catch (err) {
    console.warn('⚠️  Could not load system config, using .env:', err.message)
  }
}

// Use in code:
const appUrl = global.systemConfig?.APP_URL || process.env.APP_URL
```

---

## 📊 IMPLEMENTATION TIMELINE

| Priority | Tasks | Effort | Timeline |
|----------|-------|--------|----------|
| 🔴 CRITICAL | 1-5 | 8-10h | Week 1 |
| 🟠 HIGH | 6-9 | 10-14h | Week 1-2 |
| 🟡 MEDIUM | 10-12 | 8-10h | Week 2-4 |

**Total:** ~26-34 hours (~5-7 working days)

---

## ✅ QUICK WINS (Do First)

1. **Use new `setup-interactive.js` script** (✅ Done)
   - Replace manual .env setup
   - Time: 0 (already implemented)

2. **Add `.gitignore` update**
   ```
   .env
   .env.production
   .env.local
   database.sqlite
   certs/
   backups/
   ```

3. **Create `.env.example`** with descriptions
   ```env
   # JWT Configuration
   JWT_SECRET=<generate 64-character random string>
   # Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Master Secret Key (for encryption)
   MASTER_SECRET_KEY=<generate separate 64-character random string>
   ```

4. **Update `package.json` scripts**
   ```json
   {
     "scripts": {
       "setup": "node scripts/setup-interactive.js",
       "setup-windows": "node scripts/setup-interactive.js",
       "validate": "node scripts/validate-config.js"
     }
   }
   ```

---

## 📚 REFERENCES

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Node.js Security: https://nodejs.org/en/docs/guides/security/
- Database Security: https://www.sqlite.org/security.html
- Encryption Best Practices: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html

---

**Report Date:** 11 January 2026  
**Status:** Ready for Implementation  
**Next Review:** After implementing CRITICAL items
