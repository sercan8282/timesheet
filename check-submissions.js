const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const sql = `SELECT id, user_id, user_name, timesheet_ids, status, submission_date FROM submissions ORDER BY submission_date DESC LIMIT 10`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(rows);
  }
  db.close();
});
