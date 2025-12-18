const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class Database {
  constructor() {
    const dbPath = process.env.DB_PATH || "./database.sqlite";
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
      } else {
        console.log("Connected to SQLite database");
        this.initialize();
      }
    });
  }

  initialize() {
    this.db.serialize(() => {
      // Users
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT,
          phone TEXT,
          role TEXT DEFAULT 'user',
          company_id INTEGER,
          adr INTEGER DEFAULT 0,
          can_fill_in INTEGER DEFAULT 0,
          fill_in_company_id INTEGER,
          mega_kast TEXT DEFAULT 'only_mega',
          ritnumber TEXT,
          is_blocked INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
          FOREIGN KEY (fill_in_company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(`PRAGMA table_info(users)`, [], (err, columns) => {
              if (!err && columns) {
                const ensure = (name, sql) => {
                  if (!columns.some((c) => c.name === name)) {
                    this.db.run(sql);
                  }
                };
                ensure(
                  "adr",
                  "ALTER TABLE users ADD COLUMN adr INTEGER DEFAULT 0"
                );
                ensure(
                  "can_fill_in",
                  "ALTER TABLE users ADD COLUMN can_fill_in INTEGER DEFAULT 0"
                );
                ensure(
                  "fill_in_company_id",
                  "ALTER TABLE users ADD COLUMN fill_in_company_id INTEGER"
                );
                ensure(
                  "mega_kast",
                  "ALTER TABLE users ADD COLUMN mega_kast TEXT DEFAULT 'only_mega'"
                );
                ensure(
                  "ritnumber",
                  "ALTER TABLE users ADD COLUMN ritnumber TEXT"
                );
                ensure(
                  "is_blocked",
                  "ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0"
                );
                // MFA columns
                ensure(
                  "mfa_enabled",
                  "ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0"
                );
                ensure(
                  "mfa_secret",
                  "ALTER TABLE users ADD COLUMN mfa_secret TEXT"
                );
                ensure(
                  "mfa_backup_codes",
                  "ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT"
                );
                ensure(
                  "mfa_skip_count",
                  "ALTER TABLE users ADD COLUMN mfa_skip_count INTEGER DEFAULT 0"
                );
                ensure(
                  "mfa_prompted_at",
                  "ALTER TABLE users ADD COLUMN mfa_prompted_at DATETIME"
                );
              }
            });
          }
        }
      );

      // Timesheets
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
          ritnumber TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Ensure ritnumber column exists in timesheets table
      this.db.all(`PRAGMA table_info(timesheets)`, [], (err, columns) => {
        if (!err && columns) {
          const hasRitnumber = columns.some((c) => c.name === "ritnumber");
          const hasCompanyId = columns.some((c) => c.name === "company_id");
          if (!hasRitnumber) {
            this.db.run(
              `ALTER TABLE timesheets ADD COLUMN ritnumber TEXT`,
              (err) => {
                if (err) {
                  console.error(
                    "Error adding ritnumber column to timesheets:",
                    err
                  );
                } else {
                  console.log("✓ Added ritnumber column to timesheets");
                }
              }
            );
          }
          if (!hasCompanyId) {
            this.db.run(
              `ALTER TABLE timesheets ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
              (err) => {
                if (err) {
                  console.error(
                    "Error adding company_id column to timesheets:",
                    err
                  );
                } else {
                  console.log("✓ Added company_id column to timesheets");
                }
              }
            );
          }
        }
      });

      // Submissions
      this.db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          user_name TEXT,
          submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          timesheet_ids TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          week_numbers TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Ensure week_numbers column exists (for existing tables)
      this.db.serialize(() => {
        this.db.all(`PRAGMA table_info(submissions)`, [], (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("week_numbers")) {
              console.log("Adding week_numbers column to submissions table");
              this.db.run(
                `ALTER TABLE submissions ADD COLUMN week_numbers TEXT`,
                (err) => {
                  if (err && !err.message.includes("duplicate column"))
                    console.error("Error adding week_numbers:", err);
                }
              );
            }
            // Remove old period columns if they exist
            if (columnNames.includes("period")) {
              console.log("Removing old period column from submissions table");
            }
            if (columnNames.includes("period_start")) {
              console.log(
                "Removing old period_start column from submissions table"
              );
            }
            if (columnNames.includes("period_end")) {
              console.log(
                "Removing old period_end column from submissions table"
              );
            }
          }
        });
      });

      // Leave balances
      this.db.run(`
        CREATE TABLE IF NOT EXISTS leave_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          vacation_hours REAL DEFAULT 0,
          overtime_hours REAL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Companies
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          address TEXT,
          postal_code TEXT,
          city TEXT,
          kvk_number TEXT,
          bank_account TEXT,
          vat_number TEXT,
          pause_time TEXT DEFAULT '00:30',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(`PRAGMA table_info(companies)`, [], (err, columns) => {
              if (!err && columns) {
                const hasPause = columns.some((c) => c.name === "pause_time");
                if (!hasPause) {
                  this.db.run(
                    `ALTER TABLE companies ADD COLUMN pause_time TEXT DEFAULT '00:30'`
                  );
                }
              }
            });
          }
        }
      );

      // Leave requests
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS leave_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          hours_requested REAL NOT NULL,
          balance_type TEXT NOT NULL CHECK(balance_type IN ('vacation','overtime')),
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          admin_note TEXT,
          approved_by INTEGER,
          decision_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(
              `PRAGMA table_info(leave_requests)`,
              [],
              (err, columns) => {
                if (!err && columns) {
                  const hasStart = columns.some((c) => c.name === "start_time");
                  const hasEnd = columns.some((c) => c.name === "end_time");
                  if (!hasStart)
                    this.db.run(
                      `ALTER TABLE leave_requests ADD COLUMN start_time TEXT`
                    );
                  if (!hasEnd)
                    this.db.run(
                      `ALTER TABLE leave_requests ADD COLUMN end_time TEXT`
                    );
                }
              }
            );
          }
        }
      );

      // Fleet vehicles
      this.db.run(`
        CREATE TABLE IF NOT EXISTS fleet_vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_plate TEXT NOT NULL,
          truck_type TEXT,
          km REAL DEFAULT 0,
          apk_due_date TEXT,
          rit_number TEXT,
          company_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `);

      // Ensure truck_type column exists on older DBs
      this.db.all(`PRAGMA table_info(fleet_vehicles)`, [], (err, columns) => {
        if (!err && columns) {
          const hasTruckType = columns.some((c) => c.name === "truck_type");
          if (!hasTruckType) {
            this.db.run(
              `ALTER TABLE fleet_vehicles ADD COLUMN truck_type TEXT`,
              (err) => {
                if (err) console.error("Error adding truck_type to fleet_vehicles:", err.message);
                else console.log("✓ Added truck_type column to fleet_vehicles");
              }
            );
          }
        }
      });

      // Fleet maintenance
      this.db.run(`
        CREATE TABLE IF NOT EXISTS fleet_maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          maintenance_date TEXT NOT NULL,
          km REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE
        )
      `);

      // User Companies junction
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS user_companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          is_primary INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, company_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(
              `SELECT id, company_id FROM users WHERE company_id IS NOT NULL AND company_id > 0`,
              [],
              (err, rows) => {
                if (!err && rows && rows.length > 0) {
                  rows.forEach((user) => {
                    this.db.run(
                      `INSERT OR IGNORE INTO user_companies (user_id, company_id, is_primary) VALUES (?, ?, 1)`,
                      [user.id, user.company_id],
                      (err) => {
                        if (!err) {
                          console.log(
                            `✓ Migrated user ${user.id} company assignment to user_companies`
                          );
                        }
                      }
                    );
                  });
                }
              }
            );
          }
        }
      );

      // Vehicles (used by planning and vehicles routes)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_plate TEXT NOT NULL UNIQUE,
          route_number TEXT,
          company_id INTEGER,
          current_km REAL DEFAULT 0,
          apk_date TEXT,
          chassis_number TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicle_maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          maintenance_date TEXT NOT NULL,
          km_at_maintenance REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicle_apk_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL UNIQUE,
          alert_one_month INTEGER DEFAULT 1,
          alert_two_weeks INTEGER DEFAULT 1,
          alert_email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
      `);

      // Planning schedules
      this.db.run(`
        CREATE TABLE IF NOT EXISTS planning_schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_number INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL,
          route_number TEXT NOT NULL,
          driver_id INTEGER NOT NULL,
          vehicle_id INTEGER,
          company_id INTEGER NOT NULL,
          adr INTEGER DEFAULT 0,
          mega_kast TEXT DEFAULT 'only_mega',
          phone_number TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        )
      `);

      // SMTP settings
      this.db.run(`
        CREATE TABLE IF NOT EXISTS smtp_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          smtp_host TEXT,
          smtp_port INTEGER,
          smtp_secure INTEGER DEFAULT 0,
          smtp_user TEXT,
          smtp_pass TEXT,
          email_from TEXT,
          email_to TEXT,
          auth_type TEXT DEFAULT 'basic',
          oauth_tenant_id TEXT,
          oauth_client_id TEXT,
          oauth_client_secret TEXT,
          oauth_scope TEXT DEFAULT 'https://outlook.office365.com/.default',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Branding settings (used by public branding endpoint and PDFs)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS branding_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT,
          primary_color TEXT,
          logo_path TEXT,
          tagline TEXT,
          custom_css TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (!err) {
            // Check if tagline column exists, if not add it
            this.db.all(
              `PRAGMA table_info(branding_settings)`,
              [],
              (err, columns) => {
                if (!err && columns) {
                  const ensure = (name, sql) => {
                    if (!columns.some((c) => c.name === name)) {
                      this.db.run(sql);
                    }
                  };
                  ensure("tagline", "ALTER TABLE branding_settings ADD COLUMN tagline TEXT");
                  ensure(
                    "custom_css",
                    "ALTER TABLE branding_settings ADD COLUMN custom_css TEXT"
                  );
                }
              }
            );
          }
        }
      );

      // Invoice templates
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          hourly_rate REAL DEFAULT 0,
          km_rate REAL DEFAULT 0,
          dot_rate REAL DEFAULT 0,
          dot_rate_is_percent INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add hourly_rate and km_rate columns if they don't exist
      this.db.all(
        `PRAGMA table_info(invoice_templates)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("hourly_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN hourly_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding hourly_rate:", err);
                  } else {
                    console.log(
                      "✓ Added hourly_rate column to invoice_templates"
                    );
                  }
                }
              );
            }
            if (!columnNames.includes("km_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN km_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding km_rate:", err);
                  } else {
                    console.log("✓ Added km_rate column to invoice_templates");
                  }
                }
              );
            }
            if (!columnNames.includes("dot_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN dot_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding dot_rate:", err);
                  } else {
                    console.log("✓ Added dot_rate column to invoice_templates");
                  }
                }
              );
            }
            if (!columnNames.includes("dot_rate_is_percent")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN dot_rate_is_percent INTEGER DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding dot_rate_is_percent:", err);
                  } else {
                    console.log(
                      "✓ Added dot_rate_is_percent column to invoice_templates"
                    );
                  }
                }
              );
            }
          }
        }
      );

      // Invoice template elements (text fields, images, calculated fields)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_template_elements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          element_type TEXT NOT NULL,
          label TEXT,
          content TEXT,
          image_path TEXT,
          position_order INTEGER DEFAULT 0,
          font_size INTEGER DEFAULT 14,
          font_color TEXT DEFAULT '#000000',
          font_weight TEXT DEFAULT 'normal',
          calculation_formula TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE CASCADE
        )
      `);

      // Import templates (for PDF extraction parsers)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS import_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          parser_type TEXT NOT NULL,
          config TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Invoices (generated invoices from templates)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          invoice_number TEXT NOT NULL UNIQUE,
          customer_name TEXT,
          customer_address TEXT,
          invoice_date TEXT NOT NULL,
          due_date TEXT,
          subtotal REAL DEFAULT 0,
          vat_amount REAL DEFAULT 0,
          total_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','cancelled')),
          notes TEXT,
          original_pdf_path TEXT,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE RESTRICT,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            // Check if original_pdf_path column exists, add if not
            this.db.all("PRAGMA table_info(invoices)", [], (err, columns) => {
              if (!err && columns) {
                const hasPdfPath = columns.some(
                  (c) => c.name === "original_pdf_path"
                );
                if (!hasPdfPath) {
                  this.db.run(
                    "ALTER TABLE invoices ADD COLUMN original_pdf_path TEXT",
                    (err) => {
                      if (err)
                        console.error(
                          "Error adding original_pdf_path column:",
                          err
                        );
                      else
                        console.log(
                          "✓ Added original_pdf_path column to invoices"
                        );
                    }
                  );
                }
              }
            });
          }
        }
      );

      // Invoice line items (individual lines in an invoice)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_line_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          line_total REAL DEFAULT 0,
          position_order INTEGER DEFAULT 0,
          item_date TEXT,
          item_km REAL,
          item_hours REAL,
          item_rate REAL,
          is_total_row INTEGER DEFAULT 0,
          total_row_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )
      `);

      // Ensure new columns exist on existing invoice_line_items
      this.db.all(
        `PRAGMA table_info(invoice_line_items)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("item_date")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_date TEXT`
              );
            }
            if (!columnNames.includes("item_km")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_km REAL`
              );
            }
            if (!columnNames.includes("item_hours")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_hours REAL`
              );
            }
            if (!columnNames.includes("item_rate")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_rate REAL`
              );
            }
            if (!columnNames.includes("is_total_row")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN is_total_row INTEGER DEFAULT 0`
              );
            }
            if (!columnNames.includes("total_row_type")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN total_row_type TEXT`
              );
            }
          }
        }
      );

      // Invoice template line item field configuration
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_template_line_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          field_label TEXT,
          is_visible INTEGER DEFAULT 1,
          position_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(template_id, field_name),
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE CASCADE
        )
      `);
    });
  }

  // Generic query methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
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
