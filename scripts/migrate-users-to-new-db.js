#!/usr/bin/env node

/**
 * Migrate Users Script
 * 
 * This script exports all users from the current database and generates INSERT statements
 * that can be used to populate a new database.
 * 
 * Usage:
 *   node scripts/migrate-users-to-new-db.js
 *   node scripts/migrate-users-to-new-db.js > users-migration.sql
 * 
 * The output can be piped to a SQL file or directly executed against a new database.
 */

require("dotenv").config();
const Database = require("../config/database");

const db = new Database();

async function migrateUsers() {
  try {
    console.log(
      "-- ========== USER MIGRATION SCRIPT ========== --\n"
    );
    console.log("-- Generated on:", new Date().toISOString());
    console.log("-- Source: Current Timesheet Database\n");

    // Fetch all users
    const users = await new Promise((resolve, reject) => {
      db.db.all("SELECT * FROM users ORDER BY id", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    if (users.length === 0) {
      console.log("-- No users found in database");
      process.exit(0);
    }

    console.log(`-- Found ${users.length} user(s)\n`);
    console.log("BEGIN TRANSACTION;\n");

    // Generate INSERT statements for users
    users.forEach((user) => {
      const values = [
        user.username,
        user.password,
        user.full_name,
        user.phone,
        user.role,
        user.company_id,
        user.adr,
        user.can_fill_in,
        user.fill_in_company_id,
        user.mega_kast,
        user.ritnumber,
        user.is_blocked,
        user.mfa_enabled,
        user.mfa_secret,
        user.mfa_backup_codes,
        user.mfa_skip_count,
        user.mfa_prompted_at,
        user.created_at,
        user.updated_at,
      ]
        .map((v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`))
        .join(", ");

      console.log(`INSERT INTO users (
  username,
  password,
  full_name,
  phone,
  role,
  company_id,
  adr,
  can_fill_in,
  fill_in_company_id,
  mega_kast,
  ritnumber,
  is_blocked,
  mfa_enabled,
  mfa_secret,
  mfa_backup_codes,
  mfa_skip_count,
  mfa_prompted_at,
  created_at,
  updated_at
) VALUES (${values});\n`);
    });

    // Also fetch and insert user_companies junction records
    console.log("-- ========== USER COMPANIES JUNCTION ========== --\n");
    const userCompanies = await new Promise((resolve, reject) => {
      db.db.all(
        "SELECT * FROM user_companies ORDER BY user_id, company_id",
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (userCompanies.length > 0) {
      console.log(`-- Found ${userCompanies.length} user-company relationship(s)\n`);
      userCompanies.forEach((uc) => {
        console.log(
          `INSERT INTO user_companies (user_id, company_id) VALUES (${uc.user_id}, ${uc.company_id});\n`
        );
      });
    }

    console.log("COMMIT;");
    console.log(
      "\n-- Migration complete! All users and relationships have been exported."
    );
    console.log("-- You can now import this to a new database using: sqlite3 new_database.sqlite < users-migration.sql");

    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error.message);
    process.exit(1);
  }
}

migrateUsers();
