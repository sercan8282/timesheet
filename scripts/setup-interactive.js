#!/usr/bin/env node

/**
 * Timesheet Interactive Setup Wizard
 * 
 * One-stop installation for complete service account setup
 * Validates all inputs and creates .env + database configuration
 * 
 * Usage: npm run setup-interactive
 */

require('dotenv').config()
const readline = require('readline')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

// Delay to ensure database is ready
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})

// Helper to ask questions
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })
}

// Helper to ask for passwords (hidden input)
function askPassword(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt)
    
    const stdin = process.stdin
    stdin.resume()
    stdin.setRawMode(true)
    
    let password = ''
    stdin.on('data', (char) => {
      char = String.fromCharCode(char)
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false)
        stdin.pause()
        process.stdout.write('\n')
        resolve(password)
      } else if (char === '\u0003') {
        process.exit()
      } else if (char === '\u007f' || char === '\b') {
        password = password.slice(0, -1)
      } else {
        password += char
      }
    })
  })
}

// Generate random string
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

// Validation functions
function validateUsername(username) {
  return username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(username)
}

function validatePassword(password) {
  return password.length >= 8
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateDomain(domain) {
  const patterns = [
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d{1,5})?$/,  // example.com or example.com:3000
    /^localhost(:\d{1,5})?$/,                       // localhost or localhost:3000
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d{1,5})?$/ // IP address
  ]
  return patterns.some(p => p.test(domain))
}

// Main setup wizard
async function setupWizard() {
  console.clear && console.clear()
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║       TIMESHEET INSTALLATION WIZARD                        ║')
  console.log('║       Set up service account and configuration             ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // ========== STEP 1: Admin Credentials ==========
  console.log('📝 STEP 1: Admin Account Credentials\n')
  
  let adminUsername = ''
  while (!adminUsername || !validateUsername(adminUsername)) {
    adminUsername = await question('Admin username (3+ chars, alphanumeric/underscore) [admin]: ') || 'admin'
    if (!validateUsername(adminUsername)) {
      console.error('❌ Invalid username. Use only letters, numbers, underscore, dash.')
    }
  }

  let adminPassword = ''
  while (!adminPassword || !validatePassword(adminPassword)) {
    adminPassword = await askPassword('Admin password (min 8 chars): ')
    if (!validatePassword(adminPassword)) {
      console.error('❌ Password too short (minimum 8 characters)')
    }
  }

  let adminPasswordConfirm = ''
  while (adminPasswordConfirm !== adminPassword) {
    adminPasswordConfirm = await askPassword('Confirm password: ')
    if (adminPasswordConfirm !== adminPassword) {
      console.error('❌ Passwords do not match')
    }
  }

  // ========== STEP 2: SMTP Configuration ==========
  console.log('\n📧 STEP 2: Email (SMTP) Configuration\n')
  
  const smtpHost = await question('SMTP Host [smtp.office365.com]: ') || 'smtp.office365.com'
  const smtpPortStr = await question('SMTP Port [587]: ') || '587'
  const smtpPort = parseInt(smtpPortStr)
  
  if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    console.error('❌ Invalid port number')
    process.exit(1)
  }

  let smtpUser = ''
  while (!smtpUser || !validateEmail(smtpUser)) {
    smtpUser = await question('SMTP Email (username): ')
    if (!validateEmail(smtpUser)) {
      console.error('❌ Invalid email format')
    }
  }

  const smtpPass = await askPassword('SMTP Password/App Password: ')
  
  if (!smtpPass) {
    console.warn('⚠️  Warning: SMTP password is empty. Email notifications may not work.')
  }

  // ========== STEP 3: Application URL ==========
  console.log('\n🌐 STEP 3: Application URL\n')
  
  let appDomain = ''
  while (!appDomain || !validateDomain(appDomain)) {
    appDomain = await question('App domain [localhost:3000]: ') || 'localhost:3000'
    if (!validateDomain(appDomain)) {
      console.error('❌ Invalid domain format (e.g., example.com, localhost:3000, 192.168.1.1:3000)')
    }
  }

  const isHttps = appDomain.includes('https') || appDomain.startsWith('https://')
  let appUrl = await question(`App URL [http${isHttps ? 's' : ''}://${appDomain}]: `) || `http${isHttps ? 's' : ''}://${appDomain}`

  // ========== STEP 4: JWT Secret ==========
  console.log('\n🔐 STEP 4: Security Configuration\n')
  
  let jwtSecret = ''
  const autoGenJWT = await question('Generate random JWT secret? [Y/n]: ')
  
  if (autoGenJWT.toLowerCase() !== 'n') {
    jwtSecret = generateRandomString(64)
    console.log(`✓ Generated JWT secret: ${jwtSecret.substring(0, 20)}...`)
  } else {
    while (!jwtSecret || jwtSecret.length < 32) {
      jwtSecret = await question('Enter JWT secret (min 32 chars): ')
      if (jwtSecret.length < 32) {
        console.warn('⚠️  Warning: JWT secret is less than 32 characters (less secure)')
      }
    }
  }

  // ========== STEP 5: Encryption Master Key ==========
  let masterSecret = ''
  const autoGenMaster = await question('Generate random Master Secret Key? [Y/n]: ')
  
  if (autoGenMaster.toLowerCase() !== 'n') {
    masterSecret = generateRandomString(64)
    console.log(`✓ Generated Master Secret Key: ${masterSecret.substring(0, 20)}...`)
  } else {
    while (!masterSecret || masterSecret.length < 32) {
      masterSecret = await question('Enter Master Secret Key (min 32 chars): ')
      if (masterSecret.length < 32) {
        console.warn('⚠️  Warning: Master key is less than 32 characters')
      }
    }
  }

  // ========== STEP 6: Database Configuration ==========
  console.log('\n💾 STEP 6: Database Configuration\n')
  
  const dbPath = await question('Database path [./database.sqlite]: ') || './database.sqlite'

  // ========== STEP 7: Review ==========
  console.log('\n👁️  STEP 7: Configuration Review\n')
  
  console.log('Admin Account:')
  console.log(`  Username: ${adminUsername}`)
  console.log(`  Password: ${adminPassword.charAt(0)}${'*'.repeat(Math.max(0, adminPassword.length - 2))}${adminPassword.charAt(adminPassword.length - 1)}`)
  
  console.log('\nSMTP Configuration:')
  console.log(`  Host: ${smtpHost}:${smtpPort}`)
  console.log(`  Email: ${smtpUser}`)
  console.log(`  Password: ${smtpPass ? '[SET]' : '[EMPTY - warnings will be sent to logs]'}`)
  
  console.log('\nApplication URLs:')
  console.log(`  Domain: ${appDomain}`)
  console.log(`  Full URL: ${appUrl}`)
  
  console.log('\nSecurity:')
  console.log(`  JWT Secret: ${jwtSecret.substring(0, 20)}...`)
  console.log(`  Master Key: ${masterSecret.substring(0, 20)}...`)
  
  console.log('\nDatabase:')
  console.log(`  Path: ${dbPath}`)
  
  const confirmed = await question('\n✅ Apply this configuration? [Y/n]: ')
  if (confirmed.toLowerCase() === 'n') {
    console.log('\n❌ Setup cancelled. No changes made.\n')
    rl.close()
    process.exit(0)
  }

  // ========== STEP 8: Write Configuration ==========
  console.log('\n⚙️  STEP 8: Writing configuration files...\n')
  
  const envContent = `# Timesheet Configuration - Generated by setup-interactive.js
# Generated: ${new Date().toISOString()}

# JWT Authentication
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h

# Master Secret Key (for encrypting sensitive config values)
MASTER_SECRET_KEY=${masterSecret}

# Database Configuration
DATABASE_URL=${dbPath}
DB_PATH=${dbPath}

# Server Configuration
PORT=3000
NODE_ENV=production

# SMTP Configuration (Email)
SMTP_HOST=${smtpHost}
SMTP_PORT=${smtpPort}
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}
EMAIL_FROM=${smtpUser}
EMAIL_TO=${smtpUser}

# Application Configuration
APP_NAME=Timesheet Management System
APP_URL=${appUrl}
APP_DOMAIN=${appDomain}

# Admin Account (used for initialization)
ADMIN_USERNAME=${adminUsername}
ADMIN_PASSWORD=${adminPassword}

# License Configuration (optional)
LICENSE_KEY=

# License Manager Configuration
LICENSE_ADMIN_PASSWORD=

# Let's Encrypt Configuration (optional)
LETSENCRYPT_EMAIL=
LETSENCRYPT_ENABLED=false

# Session Configuration
SESSION_SECRET=${generateRandomString(32)}
`

  const envPath = path.join(__dirname, '..', '.env')
  
  try {
    // Write .env with restricted permissions (Unix: 600)
    fs.writeFileSync(envPath, envContent, { mode: 0o600 })
    console.log(`✓ .env file created at ${envPath}`)
    console.log(`  Permissions: 0600 (readable only by owner)\n`)
  } catch (err) {
    console.error(`\n❌ Failed to write .env file: ${err.message}`)
    rl.close()
    process.exit(1)
  }

  // ========== STEP 9: Initialize Database ==========
  console.log('💾 STEP 9: Initializing database...\n')

  try {
    // Wait for database to be available
    const db = require('../config/database')
    
    // Wait for database initialization
    await wait(2000)

    // Create admin user
    console.log('  Creating admin user...')
    const hashedPassword = await bcrypt.hash(adminPassword, 10)
    await db.run(
      `INSERT INTO users (username, password, full_name, role, created_at, updated_at) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [adminUsername, hashedPassword, 'Administrator', 'admin']
    )
    console.log(`  ✓ Admin user created: ${adminUsername}`)

    // Create SMTP settings
    console.log('  Creating SMTP settings...')
    await db.run(
      `INSERT OR REPLACE INTO smtp_settings 
       (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, email_to, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [smtpHost, smtpPort, 0, smtpUser, smtpPass || '', smtpUser, smtpUser]
    )
    console.log(`  ✓ SMTP settings configured`)

    // Create system_config table if not exists
    console.log('  Setting up system configuration...')
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

    // Insert system config defaults
    const configs = [
      ['APP_DOMAIN', appDomain, 0, 'Application domain', 0],
      ['APP_URL', appUrl, 0, 'Full application URL', 0],
      ['SSL_ENABLED', '0', 0, 'Is SSL/HTTPS enabled', 0],
      ['SSL_CERT_PATH', '', 0, 'Path to SSL certificate file', 0],
      ['SSL_KEY_PATH', '', 0, 'Path to SSL key file', 0],
      ['JWT_SECRET', jwtSecret, 1, 'JWT authentication secret', 1],
      ['LETSENCRYPT_EMAIL', '', 0, 'Email for Let\'s Encrypt', 0],
      ['LETSENCRYPT_ENABLED', '0', 0, 'Enable Let\'s Encrypt auto-renewal', 0],
    ]

    for (const [key, value, encrypted, description, is_secret] of configs) {
      await db.run(
        `INSERT OR IGNORE INTO system_config (key, value, encrypted, description, is_secret) 
         VALUES (?, ?, ?, ?, ?)`,
        [key, value, encrypted, description, is_secret]
      )
    }
    console.log(`  ✓ System configuration initialized`)

    // Close database
    db.close()

  } catch (err) {
    console.error(`\n❌ Database setup failed: ${err.message}`)
    console.error(err.stack)
    rl.close()
    process.exit(1)
  }

  // ========== Final Summary ==========
  rl.close()

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║           ✅ SETUP COMPLETED SUCCESSFULLY!               ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  console.log('📋 NEXT STEPS:\n')
  console.log('1. Start the server:')
  console.log('   npm start\n')
  console.log('2. Access the application at:')
  console.log(`   ${appUrl}\n`)
  console.log('3. Login with credentials:')
  console.log(`   Username: ${adminUsername}`)
  console.log(`   Password: (password you entered)\n`)
  console.log('4. After login, go to Admin Panel → System Settings to review configuration\n')

  console.log('🔒 Security Recommendations:\n')
  console.log('- NEVER commit .env file to version control')
  console.log('- Backup your database regularly: cp database.sqlite backups/database-$(date +%Y%m%d).sqlite')
  console.log('- Change admin password periodically via the admin panel')
  console.log('- Keep all dependencies updated: npm update')
  console.log('- Review logs regularly for suspicious activity')
  console.log('- Use HTTPS in production (enable SSL in System Settings)\n')

  console.log('📚 Documentation:\n')
  console.log('- README.md - Project overview')
  console.log('- INSTALLATION-GUIDE.md - Detailed installation steps')
  console.log('- UPDATE-TIMESHEET.md - Update and maintenance procedures\n')

  console.log('💡 First Login Checklist:\n')
  console.log('- [ ] Login with admin credentials')
  console.log('- [ ] Change admin password')
  console.log('- [ ] Enable Multi-Factor Authentication (MFA)')
  console.log('- [ ] Review and update System Settings')
  console.log('- [ ] Test email notifications (Admin Panel → SMTP Settings → Test Connection)\n')

  process.exit(0)
}

// Run the wizard
setupWizard().catch((err) => {
  console.error('\n❌ Setup failed with error:')
  console.error(err.message)
  if (err.stack) {
    console.error('\nStack trace:')
    console.error(err.stack)
  }
  rl.close()
  process.exit(1)
})

// Handle interruption
process.on('SIGINT', () => {
  console.log('\n\n❌ Setup interrupted by user.')
  rl.close()
  process.exit(1)
})
