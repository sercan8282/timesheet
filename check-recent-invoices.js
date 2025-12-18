const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open database:", err.message);
    process.exit(1);
  }

  // Get the most recent invoices
  db.all(
    `
    SELECT i.id, i.invoice_number, 
           COUNT(il.id) as line_count,
           GROUP_CONCAT(il.item_date) as dates,
           GROUP_CONCAT(il.item_km) as kms,
           GROUP_CONCAT(il.item_hours) as hours,
           GROUP_CONCAT(il.item_rate) as rates
    FROM invoices i
    LEFT JOIN invoice_line_items il ON i.id = il.invoice_id
    GROUP BY i.id
    ORDER BY i.id DESC
    LIMIT 5
  `,
    (err, rows) => {
      if (err) {
        console.error("Error:", err);
      } else {
        console.log("Recent invoices:");
        rows.forEach((row) => {
          console.log(
            `  ${row.invoice_number} (ID: ${row.id}): ${row.line_count} lines`
          );
          console.log(`    Dates: ${row.dates}`);
          console.log(`    KMs: ${row.kms}`);
          console.log(`    Hours: ${row.hours}`);
          console.log(`    Rates: ${row.rates}`);
        });
      }
      db.close();
      process.exit(0);
    }
  );
});
