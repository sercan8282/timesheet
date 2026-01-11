/**
 * Reset MFA for admin user
 * Usage: node scripts/reset-admin-mfa.js
 */

require('dotenv').config();
const db = require('../config/database');

async function resetAdminMFA() {
  try {
    console.log('Resetting MFA for admin user...');

    // Find admin user
    const admin = await db.get(
      "SELECT id, username FROM users WHERE username = ?",
      ['admin']
    );

    if (!admin) {
      console.error('❌ Admin user not found');
      process.exit(1);
    }

    console.log(`Found admin user: ${admin.username} (ID: ${admin.id})`);

    // Reset MFA settings
    await db.run(
      `UPDATE users 
       SET mfa_enabled = 0, 
           mfa_secret = NULL, 
           mfa_backup_codes = NULL,
           mfa_skip_count = 0
       WHERE id = ?`,
      [admin.id]
    );

    console.log('✅ MFA reset successfully for admin user');
    console.log('Admin can now set up MFA again by logging in');

    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

resetAdminMFA();
