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
    `SELECT id FROM invoices WHERE invoice_number = '2025-0001'`,
    (err, invoice) => {
      if (err || !invoice) {
        console.log("Invoice 2025-0001 not found");
        db.close();
        process.exit(0);
      }

      const invoiceId = invoice.id;
      console.log(`Updating line items for invoice ID: ${invoiceId}`);

      // Update all line items with sample data to make PDF columns visible
      // Using common rates: 65 EUR/hour, 0.25 EUR/km, current dates
      db.run(
        `UPDATE invoice_line_items 
       SET item_date = '2025-12-18', item_km = 100, item_hours = 8, item_rate = 65
       WHERE invoice_id = ?`,
        [invoiceId],
        function (err) {
          if (err) {
            console.error("Update error:", err);
          } else {
            console.log(`Updated ${this.changes} line items`);
          }
          db.close();
          process.exit(0);
        }
      );
    }
  );
});
