const fs = require("fs");
const path = require("path");
const db = require("../config/database");

const inFile =
  process.argv[2] || path.resolve(process.cwd(), "translations-import.json");
if (!fs.existsSync(inFile)) {
  console.error("File not found:", inFile);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
if (!Array.isArray(data)) {
  console.error("Expected an array of translations in", inFile);
  process.exit(1);
}

console.log("Importing", data.length, "translations from", inFile);

const insertStmt = db.db.prepare(
  `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`
);
const updateStmt = db.db.prepare(
  `UPDATE translations SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE namespace = ? AND key = ? AND locale = ?`
);

let processed = 0;

data.forEach((t) => {
  if (!t.namespace || !t.key || !t.locale || typeof t.text === "undefined")
    return;
  insertStmt.run(t.namespace, t.key, t.locale, t.text, (err) => {
    if (err) console.error("Insert error", err);
    else {
      // Ensure value updated to imported text
      updateStmt.run(t.text, t.namespace, t.key, t.locale, (err2) => {
        if (err2) console.error("Update error", err2);
        processed++;
        if (processed === data.length) {
          insertStmt.finalize();
          updateStmt.finalize();
          console.log("✓ Imported", processed, "translations");
        }
      });
    }
  });
});
