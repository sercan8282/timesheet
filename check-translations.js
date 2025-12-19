const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

db.all(
  "SELECT namespace, key, locale, text FROM translations WHERE namespace='ui' AND key LIKE 'leave.%' ORDER BY key, locale",
  (err, rows) => {
    if (err) {
      console.error("Error:", err);
      process.exit(1);
    }

    console.log("Leave Translations in Database:");
    console.log("===============================");
    rows.forEach((row) => {
      console.log(`${row.namespace}:${row.key} [${row.locale}] = "${row.text}"`);
    });

    db.close();
  }
);
