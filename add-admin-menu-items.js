const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "timesheet.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
    process.exit(1);
  }
});

// Wait for tables to be created
setTimeout(() => {
  const adminItems = [
    { k: "admin-users", l: "Users" },
    { k: "admin-companies", l: "Companies" },
    { k: "admin-submissions", l: "Submissions" },
    { k: "admin-hours-report", l: "Hours Report" },
    { k: "admin-leave", l: "Leave Management" },
    { k: "admin-fleet", l: "Fleet" },
    { k: "admin-planning", l: "Planning" },
    { k: "admin-smtp", l: "SMTP" },
    { k: "admin-branding", l: "Branding" },
    { k: "admin-menu", l: "Menu" },
    { k: "admin-translations", l: "Translations" },
  ];

  // Get current max sort_order
  db.get("SELECT MAX(sort_order) as max_order FROM ui_menu", [], (err, row) => {
    if (err) {
      console.error("Error getting max sort_order:", err);
      db.close();
      process.exit(1);
    }

    const startOrder = row && row.max_order !== null ? row.max_order + 1 : 7;
    console.log("Starting at sort_order:", startOrder);

    const stmt = db.prepare(
      "INSERT OR REPLACE INTO ui_menu (page_key, label, sort_order, visible) VALUES (?, ?, ?, ?)"
    );

    adminItems.forEach((item, idx) => {
      stmt.run(item.k, item.l, startOrder + idx, 1);
      console.log("Added:", item.k);
    });

    stmt.finalize();

    // Add translations for admin items
    const adminMenuLabels = [
      ["menu", "admin-users", "en", "Users"],
      ["menu", "admin-users", "nl", "Gebruikers"],
      ["menu", "admin-users", "de", "Benutzer"],
      ["menu", "admin-companies", "en", "Companies"],
      ["menu", "admin-companies", "nl", "Bedrijven"],
      ["menu", "admin-companies", "de", "Unternehmen"],
      ["menu", "admin-submissions", "en", "Submissions"],
      ["menu", "admin-submissions", "nl", "Inzendingen"],
      ["menu", "admin-submissions", "de", "Einreichungen"],
      ["menu", "admin-hours-report", "en", "Hours Report"],
      ["menu", "admin-hours-report", "nl", "Uren rapport"],
      ["menu", "admin-hours-report", "de", "Stundenrapport"],
      ["menu", "admin-leave", "en", "Leave Management"],
      ["menu", "admin-leave", "nl", "Verlofsysteem"],
      ["menu", "admin-leave", "de", "Urlaubsverwaltung"],
      ["menu", "admin-fleet", "en", "Fleet"],
      ["menu", "admin-fleet", "nl", "Wagenpark"],
      ["menu", "admin-fleet", "de", "Fuhrpark"],
      ["menu", "admin-planning", "en", "Planning"],
      ["menu", "admin-planning", "nl", "Planning"],
      ["menu", "admin-planning", "de", "Planung"],
      ["menu", "admin-smtp", "en", "SMTP"],
      ["menu", "admin-smtp", "nl", "SMTP"],
      ["menu", "admin-smtp", "de", "SMTP"],
      ["menu", "admin-branding", "en", "Branding"],
      ["menu", "admin-branding", "nl", "Branding"],
      ["menu", "admin-branding", "de", "Branding"],
      ["menu", "admin-menu", "en", "Menu"],
      ["menu", "admin-menu", "nl", "Menu"],
      ["menu", "admin-menu", "de", "Menü"],
      ["menu", "admin-translations", "en", "Translations"],
      ["menu", "admin-translations", "nl", "Vertalingen"],
      ["menu", "admin-translations", "de", "Übersetzungen"],
    ];

    const transStmt = db.prepare(
      "INSERT OR REPLACE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)"
    );

    adminMenuLabels.forEach((item) => {
      transStmt.run(item[0], item[1], item[2], item[3]);
    });

    transStmt.finalize((err) => {
      if (err) {
        console.error("Error adding translations:", err);
      } else {
        console.log("✓ Added admin menu items and translations");
      }
      db.close();
      process.exit(0);
    });
  });
}, 3000);
