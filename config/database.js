const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    const dbPath = process.env.DB_PATH || './database.sqlite';
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initialize();
      }
    });
  }

  initialize() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL COLLATE NOCASE,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0,
          role TEXT DEFAULT 'user',
          is_blocked INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Timesheets table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS timesheets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          start_km REAL NOT NULL,
          end_km REAL NOT NULL,
          pause_time TEXT NOT NULL,
          total_hours REAL,
          total_km REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Submissions table (for tracking submitted forms)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          user_name TEXT,
          submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          timesheet_ids TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // SMTP Settings table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS smtp_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          smtp_host TEXT NOT NULL,
          smtp_port INTEGER NOT NULL,
          smtp_secure INTEGER DEFAULT 0,
          smtp_user TEXT NOT NULL,
          smtp_pass TEXT NOT NULL,
          email_from TEXT NOT NULL,
          email_to TEXT NOT NULL,
          auth_type TEXT DEFAULT 'basic',
          oauth_tenant_id TEXT,
          oauth_client_id TEXT,
          oauth_client_secret TEXT,
          oauth_scope TEXT DEFAULT 'https://outlook.office365.com/.default',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Branding Settings table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS branding_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT NOT NULL DEFAULT 'Timesheet System',
          logo_path TEXT,
          primary_color TEXT DEFAULT '#0066CC',
          tagline TEXT DEFAULT 'Please sign in to continue',
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  }

  // Generic query methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();
