const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.sqlite");

const DEFAULT_VACATION = 216; // 27 days * 8 hours

console.log(
  "Setting default vacation hours for all users to",
  DEFAULT_VACATION
);

db.serialize(() => {
  // Ensure every user has a leave balance row
  db.run(
    `INSERT INTO leave_balances (user_id, vacation_hours, overtime_hours)
     SELECT u.id, ${DEFAULT_VACATION}, 0
     FROM users u
     WHERE NOT EXISTS (SELECT 1 FROM leave_balances lb WHERE lb.user_id = u.id)`,
    (err) => {
      if (err)
        console.error("Insert missing leave_balances rows:", err.message);
      else console.log("✓ Added missing leave_balances rows");
    }
  );

  // Set all vacation_hours to default, keep overtime_hours untouched
  db.run(
    `UPDATE leave_balances SET vacation_hours = ${DEFAULT_VACATION}, updated_at = CURRENT_TIMESTAMP`,
    (err) => {
      if (err) console.error("Update vacation_hours:", err.message);
      else console.log("✓ Updated vacation_hours to default for all users");
    }
  );

  // Verify
  db.all(
    `SELECT u.id, u.username, lb.vacation_hours, lb.overtime_hours
     FROM users u
     LEFT JOIN leave_balances lb ON lb.user_id = u.id
     ORDER BY u.id LIMIT 20`,
    (err, rows) => {
      if (err) console.error("Verification query error:", err.message);
      else {
        console.log("\nSample leave balances:");
        console.table(rows);
      }
      db.close();
    }
  );
});
