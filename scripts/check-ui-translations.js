const db = require("../config/database");

setTimeout(() => {
  db.db.all(
    "SELECT namespace,key,locale,text FROM translations WHERE namespace='ui' ORDER BY key,locale",
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log("ui translations:", rows);
      process.exit(0);
    }
  );
}, 400);
