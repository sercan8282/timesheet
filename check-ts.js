const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  setTimeout(() => {
    // Check timesheets schema
    db.all(`PRAGMA table_info(timesheets)`, (err, rows) => {
      if (err) {
        console.error('Error:', err);
        process.exit(1);
      }
      console.log('\n=== TIMESHEETS SCHEMA ===');
      rows.forEach(row => {
        console.log(`${row.name}: ${row.type}`);
      });
      
      // Now check actual data
      db.all(
        `SELECT t.id, t.user_id, t.week_number, t.total_hours, t.total_km, u.username
         FROM timesheets t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.id IN (5,6,7,8)
         ORDER BY t.id`,
        (err, rows) => {
          if (err) {
            console.error('Error:', err);
            process.exit(1);
          }
          console.log('\n=== TIMESHEETS 5,6,7,8 DATA ===');
          if (!rows || rows.length === 0) {
            console.log('No timesheets found');
          } else {
            rows.forEach(row => {
              console.log(`ID: ${row.id}, User: ${row.username} (${row.user_id}), Week: ${row.week_number}, Hours: ${row.total_hours}, KM: ${row.total_km}`);
            });
          }
          db.close();
          process.exit(0);
        }
      );
    });
  }, 100);
});
