/**
 * Setup System Configuration Table
 * Run this once to create the system_config table for storing application settings
 */

require('dotenv').config();
const db = require('../config/database');
const crypto = require('crypto');

async function setupSystemConfig() {
  try {
    console.log('Setting up system_config table...');

    // Create the system_config table
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
    `);

    console.log('✓ system_config table created');

    // Initialize default configuration keys
    const defaultConfigs = [
      {
        key: 'APP_DOMAIN',
        value: 'localhost:3000',
        encrypted: 0,
        description: 'Application domain/URL',
        is_secret: 0
      },
      {
        key: 'APP_URL',
        value: 'http://localhost:3000',
        encrypted: 0,
        description: 'Full application URL',
        is_secret: 0
      },
      {
        key: 'SSL_ENABLED',
        value: '0',
        encrypted: 0,
        description: 'Is SSL/HTTPS enabled',
        is_secret: 0
      },
      {
        key: 'SSL_CERT_PATH',
        value: '',
        encrypted: 0,
        description: 'Path to SSL certificate file',
        is_secret: 0
      },
      {
        key: 'SSL_KEY_PATH',
        value: '',
        encrypted: 0,
        description: 'Path to SSL key file',
        is_secret: 0
      },
      {
        key: 'JWT_SECRET',
        value: process.env.JWT_SECRET || 'change-me-in-admin-panel',
        encrypted: 1,
        description: 'JWT authentication secret',
        is_secret: 1
      },
      {
        key: 'DB_PASSWORD',
        value: process.env.DB_PASSWORD || '',
        encrypted: 1,
        description: 'Database password (if applicable)',
        is_secret: 1
      },
      {
        key: 'LETSENCRYPT_EMAIL',
        value: process.env.LETSENCRYPT_EMAIL || '',
        encrypted: 0,
        description: 'Email for Let\'s Encrypt certificate',
        is_secret: 0
      },
      {
        key: 'LETSENCRYPT_ENABLED',
        value: '0',
        encrypted: 0,
        description: 'Auto-renew Let\'s Encrypt certificate',
        is_secret: 0
      }
    ];

    // Insert default configs (ignore duplicates)
    for (const config of defaultConfigs) {
      await db.run(
        `INSERT OR IGNORE INTO system_config (key, value, encrypted, description, is_secret)
         VALUES (?, ?, ?, ?, ?)`,
        [config.key, config.value, config.encrypted, config.description, config.is_secret]
      );
    }

    console.log('✓ Default configurations initialized');

    // Verify
    const count = await db.get('SELECT COUNT(*) as count FROM system_config');
    console.log(`✓ System config table has ${count.count} entries`);

    console.log('\n✅ System configuration setup complete!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

setupSystemConfig();
