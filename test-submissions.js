const db = require('./config/database');

// Query submissions
db.all(
  `SELECT s.id, s.user_id, s.timesheet_ids, s.submission_date, u.username 
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
    rows.forEach(row => {
      console.log(`ID: ${row.id}, User: ${row.username} (${row.user_id}), Timesheets: ${row.timesheet_ids}`);
    });
    process.exit(0);
  }
);
