const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }

  console.log('Updating leave balances from 212 to 216 hours...');

  db.run(
    'UPDATE leave_balances SET vacation_hours = 216 WHERE vacation_hours = 212',
    function(err) {
      if (err) {
        console.error('Error updating leave balances:', err);
        db.close();
        process.exit(1);
      }

      console.log(`✓ Updated ${this.changes} leave balance records from 212 to 216 hours`);

      // Show summary
      db.all(
        'SELECT user_id, vacation_hours, overtime_hours FROM leave_balances ORDER BY user_id',
        [],
        (err, rows) => {
          if (err) {
            console.error('Error fetching leave balances:', err);
          } else {
            console.log('\nLeave balances after update:');
            console.table(rows);
          }

          db.close();
          process.exit(0);
        }
      );
    }
  );
});
