const db = require("sqlite3").verbose();
const database = new db.Database("./database.sqlite");

database.all("PRAGMA table_info(invoices)", (err, rows) => {
  if (err) {
    console.error("Error:", err);
    database.close();
  } else {
    console.log("Invoices table columns:");
    rows.forEach((r) => console.log(`  ${r.name} (${r.type})`));

    console.log("\n\nChecking invoice records:");
    database.all(
      "SELECT id, invoice_number, customer_name, invoice_type, total_amount, invoice_date FROM invoices ORDER BY id DESC LIMIT 10",
      (err2, records) => {
        if (err2) {
          console.error("Error fetching records:", err2);
        } else {
          console.log(`\nFound ${records.length} recent invoices:`);
          records.forEach((rec) => {
            console.log(
              `  ID ${rec.id}: ${rec.invoice_number} - ${rec.customer_name}, Type: ${rec.invoice_type || 'NULL'}, Amount: €${rec.total_amount}, Date: ${rec.invoice_date}`
            );
          });
        }
        database.close();
      }
    );
  }
});
