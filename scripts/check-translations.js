const db = require("../config/database");

setTimeout(() => {
  db.db.get("SELECT COUNT(*) AS cnt FROM translations", [], (e, r) => {
    if (e) {
      console.error("Error:", e);
      process.exit(1);
    }
    console.log("translations count:", r.cnt);
    db.db.all(
      "SELECT namespace,key,locale,text FROM translations WHERE namespace='menu' ORDER BY key,locale",
      [],
      (err, rows) => {
        if (err) {
          console.error("Err fetch rows", err);
          process.exit(1);
        }
        console.log("menu translations sample:", rows.slice(0, 50));
        process.exit(0);
      }
    );
  });
}, 400);
