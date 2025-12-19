const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
console.log("Opening database at:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open database:", err.message);
    process.exit(1);
  }

  console.log("Database opened successfully");

  // Get tables first
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error("Error listing tables:", err);
      db.close();
      process.exit(1);
    }

    console.log(
      "Tables found:",
      tables.map((t) => t.name)
    );

    if (tables.some((t) => t.name === "invoice_line_items")) {
      db.all(
        `SELECT id, description, item_date, item_km, item_hours, item_rate FROM invoice_line_items LIMIT 3`,
        (err, rows) => {
          if (err) {
            console.error("Query error:", err);
          } else {
            console.log("First 3 line items:", JSON.stringify(rows, null, 2));
          }
          db.close();
          process.exit(0);
        }
      );
    } else {
      console.log("invoice_line_items table not found");
      db.close();
      process.exit(0);
    }
  });
});
