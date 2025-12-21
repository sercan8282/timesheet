const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  setTimeout(() => {
    db.all(
      `SELECT s.id, s.user_id, s.timesheet_ids, u.username 
       FROM submissions s 
       LEFT JOIN users u ON u.id = s.user_id 
       ORDER BY s.submission_date DESC 
       LIMIT 10`,
      (err, rows) => {
        if (err) {
          console.error('Error:', err);
          process.exit(1);
        }
        console.log('\n=== SUBMISSIONS ===');
        if (!rows || rows.length === 0) {
          console.log('No submissions found');
        } else {
          rows.forEach(row => {
            console.log(`ID: ${row.id}, User: ${row.username} (${row.user_id}), Timesheets: ${row.timesheet_ids}`);
          });
        }
        db.close();
        process.exit(0);
      }
    );
  }, 100);
});
