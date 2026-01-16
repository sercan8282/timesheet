#!/usr/bin/env node

/**
 * SMTP Encryption Diagnostic Tool
 * 
 * This script helps diagnose SMTP password encryption issues by:
 * 1. Checking if ENCRYPTION_KEY exists in environment
 * 2. Showing the current ENCRYPTION_KEY (first 10 chars only for security)
 * 3. Checking database for smtp_pass_encrypted
 * 4. Testing if decryption works with current key
 * 
 * Usage: node scripts/diagnose-smtp-encryption.js
 */

require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const { decryptPassword } = require("../utils/encryption");
const crypto = require("crypto");

// Get database path
const dbPath = process.env.DB_PATH || "./database.sqlite";

console.log("=".repeat(70));
console.log("SMTP ENCRYPTION DIAGNOSTIC TOOL");
console.log("=".repeat(70));
console.log();

// 1. Check ENCRYPTION_KEY in environment
console.log("1. ENCRYPTION_KEY Check:");
console.log("-".repeat(70));
const hasEnvKey = !!process.env.ENCRYPTION_KEY;
console.log("   In .env file:", hasEnvKey ? "YES ✓" : "NO ✗ (using default)");

if (hasEnvKey) {
  const keyPreview = process.env.ENCRYPTION_KEY.substring(0, 10) + "...";
  console.log("   Key preview:", keyPreview);
  console.log("   Key length:", process.env.ENCRYPTION_KEY.length, "chars");
} else {
  console.log("   ⚠️  WARNING: Using default hardcoded key!");
  console.log("   ⚠️  Passwords encrypted on different machines won't work!");
  console.log("   ⚠️  Add ENCRYPTION_KEY to .env file for security.");
}
console.log();

// 2. Check database
console.log("2. Database Check:");
console.log("-".repeat(70));
console.log("   Database path:", dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("   ✗ ERROR: Cannot open database:", err.message);
    process.exit(1);
  }
  console.log("   ✓ Database opened successfully");
  console.log();

  // 3. Check SMTP settings
  console.log("3. SMTP Settings in Database:");
  console.log("-".repeat(70));

  db.get("SELECT * FROM smtp_settings LIMIT 1", [], (err, row) => {
    if (err) {
      console.error("   ✗ ERROR querying smtp_settings:", err.message);
      db.close();
      process.exit(1);
    }

    if (!row) {
      console.log("   ✗ No SMTP settings found in database");
      console.log("   → Go to Admin → SMTP Settings and save your configuration");
      db.close();
      process.exit(0);
    }

    console.log("   SMTP Host:", row.smtp_host || "(empty)");
    console.log("   SMTP Port:", row.smtp_port || "(empty)");
    console.log("   SMTP User:", row.smtp_user || "(empty)");
    console.log("   Auth Type:", row.auth_type || "basic");
    console.log();

    // Check password fields
    console.log("   Password Fields:");
    const hasSmtpPass = !!row.smtp_pass;
    const hasEncrypted = !!row.smtp_pass_encrypted;
    
    console.log("   - smtp_pass (plaintext):", hasSmtpPass ? "YES (legacy)" : "NO");
    console.log("   - smtp_pass_encrypted:", hasEncrypted ? "YES ✓" : "NO ✗");
    
    if (!hasSmtpPass && !hasEncrypted) {
      console.log();
      console.log("   ✗ NO PASSWORD FOUND IN DATABASE!");
      console.log("   → Go to Admin → SMTP Settings");
      console.log("   → Enter your SMTP password");
      console.log("   → Click 'Instellingen opslaan'");
      db.close();
      process.exit(0);
    }
    
    console.log();

    // 4. Test decryption
    if (hasEncrypted) {
      console.log("4. Decryption Test:");
      console.log("-".repeat(70));
      console.log("   Encrypted value:", row.smtp_pass_encrypted);
      console.log("   Format check:", row.smtp_pass_encrypted.includes(":") ? "✓ Valid (iv:data)" : "✗ Invalid format");
      console.log();
      
      console.log("   Attempting decryption...");
      const decrypted = decryptPassword(row.smtp_pass_encrypted);
      
      if (decrypted) {
        console.log("   ✓ DECRYPTION SUCCESS!");
        console.log("   → Password length:", decrypted.length, "characters");
        console.log("   → SMTP should work correctly");
      } else {
        console.log("   ✗ DECRYPTION FAILED!");
        console.log();
        console.log("   PROBLEM IDENTIFIED:");
        console.log("   The password was encrypted with a different ENCRYPTION_KEY");
        console.log("   than the one currently in use.");
        console.log();
        console.log("   SOLUTIONS:");
        console.log("   A) If you have the original ENCRYPTION_KEY:");
        console.log("      1. Add it to your .env file on this server");
        console.log("      2. Restart the application");
        console.log();
        console.log("   B) If you don't have the original key:");
        console.log("      1. Go to Admin → SMTP Settings");
        console.log("      2. Re-enter your SMTP password");
        console.log("      3. Click 'Instellingen opslaan'");
        console.log("      4. The password will be encrypted with current key");
        console.log();
        console.log("   C) For new installations:");
        console.log("      Add to .env on ALL servers (Windows + Linux):");
        console.log("      ENCRYPTION_KEY=" + crypto.randomBytes(32).toString("hex"));
      }
    } else if (hasSmtpPass) {
      console.log("4. Legacy Password Check:");
      console.log("-".repeat(70));
      console.log("   ✓ Using plaintext password (legacy mode)");
      console.log("   → Password length:", row.smtp_pass.length, "characters");
      console.log();
      console.log("   RECOMMENDATION:");
      console.log("   Re-save SMTP settings to encrypt the password");
    }

    console.log();
    console.log("=".repeat(70));
    console.log("Diagnostic complete");
    console.log("=".repeat(70));

    db.close();
  });
});
