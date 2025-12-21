const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  setTimeout(() => {
    // Simulate admin viewing submissions
    // Admin is user_id 1
    
    console.log('\n=== ADMIN VIEWING SUBMISSIONS ===');
    db.all(
      `SELECT s.id, s.user_id, s.timesheet_ids, s.submission_date, 
              COALESCE(u.full_name, u.username, s.user_name, 'Unknown') AS user_name
       FROM submissions s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.submission_date DESC`,
      (err, submissions) => {
        if (err) {
          console.error('Error:', err);
          process.exit(1);
        }
        
        submissions.forEach(s => {
          console.log(`\nSubmission ${s.id}: user_id=${s.user_id}, user_name=${s.user_name}, timesheet_ids=${s.timesheet_ids}`);
          
          if (s.timesheet_ids) {
            const ids = s.timesheet_ids.split(',').map(id => parseInt(id.trim()));
            
            // Simulate /user/timesheets/details for admin
            const placeholders = ids.map(() => '?').join(',');
            
            db.all(
              `SELECT t.id, t.week_number, t.user_id, t.total_hours, t.total_km,
                      COALESCE(u.full_name, u.username, 'Unknown') AS user_name
               FROM timesheets t
               LEFT JOIN users u ON u.id = t.user_id
               WHERE t.id IN (${placeholders})
               ORDER BY t.week_number, t.date`,
              [...ids],
              (err, timesheets) => {
                if (err) {
                  console.error('Error:', err);
                  return;
                }
                
                if (timesheets.length > 0) {
                  console.log(`  Timesheets count: ${timesheets.length}`);
                  const groupKey = `${timesheets[0].week_number}_${timesheets[0].user_id}`;
                  const totalHours = timesheets.reduce((sum, ts) => sum + ts.total_hours, 0);
                  const totalKm = timesheets.reduce((sum, ts) => sum + ts.total_km, 0);
                  console.log(`  GroupKey: ${groupKey}`);
                  console.log(`  Total Hours: ${totalHours}, Total KM: ${totalKm}`);
                  timesheets.forEach(ts => {
                    console.log(`    - TS ${ts.id}: week ${ts.week_number}, user ${ts.user_id} (${ts.user_name}), ${ts.total_hours}h, ${ts.total_km}km`);
                  });
                }
                
                // Check if this is the last submission
                if (submissions[submissions.length - 1].id === s.id) {
                  db.close();
                  process.exit(0);
                }
              }
            );
          }
        });
      }
    );
  }, 100);
});
