require('dotenv').config();
const crypto = require('crypto');
const db = require('../config/database');

async function wait(ms){return new Promise(r=>setTimeout(r, ms));}

(async () => {
  try {
    // wait for DB init
    await wait(1000);
    // find an admin user
    const admin = await db.get("SELECT id, username FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
    if (!admin) {
      console.error('No admin user found. Create one first.');
      process.exit(2);
    }
    const label = process.argv[2] || 'CLI Generated';
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    await db.run("INSERT INTO api_keys (key_hash, label, created_by) VALUES (?, ?, ?)", [keyHash, label, admin.id]);
    console.log('\nAPI Key created for admin:', admin.username);
    console.log('Label:', label);
    console.log('Secret (save now):', rawKey);
    console.log('\nUse it via header: x-api-key: <secret>');
    process.exit(0);
  } catch (e) {
    console.error('Failed to create API key:', e.message);
    process.exit(1);
  }
})();
