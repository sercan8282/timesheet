const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err);
    process.exit(1);
  }
  console.log("Database opened");

  // First check what columns exist
  db.all(`PRAGMA table_info(timesheets)`, [], (err, columns) => {
    if (err) {
      console.error("Error checking columns:", err);
      process.exit(1);
    }

    console.log("Current timesheets columns:");
    columns.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    const hasRitnumber = columns.some((c) => c.name === "ritnumber");

    if (!hasRitnumber) {
      console.log("\nAdding ritnumber column...");
      db.run(`ALTER TABLE timesheets ADD COLUMN ritnumber TEXT`, (err) => {
        if (err) {
          console.error("Error adding column:", err.message);
          process.exit(1);
        }
        console.log("✓ Successfully added ritnumber column");
        process.exit(0);
      });
    } else {
      console.log("\n✓ ritnumber column already exists");
      process.exit(0);
    }
  });
});
