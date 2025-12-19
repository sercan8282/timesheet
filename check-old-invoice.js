const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open database:", err.message);
    process.exit(1);
  }

  // Get invoice 2025-0001
  db.get(
    `SELECT id, invoice_number FROM invoices WHERE invoice_number = '2025-0001'`,
    (err, invoice) => {
      if (err || !invoice) {
        console.log("Invoice 2025-0001 not found");
        db.close();
        process.exit(0);
      }

      console.log(
        `Invoice found: ${invoice.invoice_number} (ID: ${invoice.id})`
      );

      // Get its line items
      db.all(
        `SELECT id, description, item_date, item_km, item_hours, item_rate FROM invoice_line_items WHERE invoice_id = ?`,
        [invoice.id],
        (err, rows) => {
          if (err) {
            console.error("Error:", err);
          } else {
            console.log(
              `Line items for invoice ${invoice.id}:`,
              JSON.stringify(rows, null, 2)
            );
          }
          db.close();
          process.exit(0);
        }
      );
    }
  );
});
