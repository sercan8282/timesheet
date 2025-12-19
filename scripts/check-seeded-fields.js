const db = require("../config/database");

setTimeout(() => {
  db.db.all(
    "SELECT namespace,key,locale,text FROM translations WHERE namespace='field' ORDER BY key,locale",
    [],
    (err, rows) => {
      if (err) {
        console.error("Err", err);
        process.exit(1);
      }
      console.log("field translations sample:", rows);
      process.exit(0);
    }
  );
}, 300);
