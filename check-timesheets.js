const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.DB_PATH || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to open database:", err.message);
    process.exit(1);
  }

  // Check if invoice 117 has any submission reference or we can re-derive data
  // First, see if we can find any timesheet data from the submission
  db.all(
    `SELECT ts.*, c.name as company_name FROM timesheets ts
     LEFT JOIN companies c ON ts.company_id = c.id
     WHERE ts.id IN (SELECT value FROM json_each('[1,2,3]')) LIMIT 5`,
    (err, rows) => {
      console.log(
        "Timesheets sample:",
        err ? err.message : JSON.stringify(rows, null, 2)
      );
      db.close();
      process.exit(0);
    }
  );
});
