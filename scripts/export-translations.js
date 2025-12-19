const fs = require("fs");
const path = require("path");
const db = require("../config/database");

const out = path.resolve(process.cwd(), "translations-export.json");

console.log("Exporting translations to", out);

db.db.all(
  "SELECT namespace, key, locale, text FROM translations ORDER BY namespace, key, locale",
  [],
  (err, rows) => {
    if (err) {
      console.error("Error exporting translations:", err);
      process.exit(1);
    }
    fs.writeFileSync(out, JSON.stringify(rows, null, 2), "utf8");
    console.log("✓ Exported", rows.length, "translations");
  }
);
