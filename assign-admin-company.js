const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  // Get companies
  db.all(
    "SELECT id, name, pause_time FROM companies LIMIT 5",
    (err, companies) => {
      if (err || !companies || companies.length === 0) {
        console.log("Error or no companies:", err);
        db.close();
        process.exit(1);
      }

      console.log("Found companies:", companies);

      // Assign admin to Dachser (first company)
      const companyId = companies[0].id;
      db.run(
        "UPDATE users SET company_id = ? WHERE username = ?",
        [companyId, "admin"],
        function (err) {
          if (err) {
            console.error("Update error:", err);
          } else {
            console.log(
              `✓ Admin user assigned to ${companies[0].name} (pause_time: ${companies[0].pause_time})`
            );
          }
          db.close();
          process.exit(0);
        }
      );
    }
  );
});
