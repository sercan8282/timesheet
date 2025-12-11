const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.get(
  'SELECT id, username, full_name, can_fill_in, fill_in_company_id FROM users WHERE id = ?',
  [15],
  (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('User 15 data in database:');
      console.log(row);
    }
    db.close();
  }
);
