const db = require("../config/database");

async function addRitnumberColumn() {
  try {
    console.log("Checking timesheets table for ritnumber column...");

    const columns = await db.all(`PRAGMA table_info(timesheets)`);
    const hasRitnumber = columns.some((c) => c.name === "ritnumber");

    if (!hasRitnumber) {
      console.log("Adding ritnumber column to timesheets table...");
      await db.run(`ALTER TABLE timesheets ADD COLUMN ritnumber TEXT`);
      console.log("✓ Successfully added ritnumber column to timesheets");
    } else {
      console.log("✓ ritnumber column already exists in timesheets");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

addRitnumberColumn();
