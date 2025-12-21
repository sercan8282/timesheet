const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  setTimeout(() => {
    console.log('\n=== ALL SUBMISSIONS ===');
    db.all(
      `SELECT s.id, s.user_id, s.timesheet_ids, 
              COALESCE(u.full_name, u.username, 'Unknown') AS user_name
       FROM submissions s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.submission_date DESC`,
      (err, rows) => {
        if (err) {
          console.error('Error:', err);
          process.exit(1);
        }
        
        rows.forEach(row => {
          console.log(`Sub ${row.id}: user=${row.user_name} (ID ${row.user_id}), ts_ids=[${row.timesheet_ids}]`);
        });
        
        console.log('\n=== CHECKING: IF ADMIN FETCHES SUBMISSION 4\'S TIMESHEETS ===');
        
        const ids = [5, 6, 7, 8];
        const placeholders = ids.map(() => '?').join(',');
        
        db.all(
          `SELECT t.id, t.week_number, t.user_id, t.total_hours, t.total_km,
                  COALESCE(u.full_name, u.username, 'Unknown') AS user_name
           FROM timesheets t
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id IN (${placeholders})`,
          [...ids],
          (err, rows) => {
            if (err) {
              console.error('Error:', err);
              process.exit(1);
            }
            
            console.log(`Got ${rows.length} timesheets\n`);
            
            const groupedByWeekUser = {};
            rows.forEach(ts => {
              const key = `${ts.week_number}_${ts.user_id}`;
              if (!groupedByWeekUser[key]) {
                groupedByWeekUser[key] = {
                  week_number: ts.week_number,
                  user_id: ts.user_id,
                  user_name: ts.user_name,
                  timesheets: []
                };
              }
              groupedByWeekUser[key].timesheets.push(ts);
            });
            
            console.log('Groups:');
            Object.entries(groupedByWeekUser).forEach(([key, group]) => {
              const totalHours = group.timesheets.reduce((sum, ts) => sum + ts.total_hours, 0);
              const totalKm = group.timesheets.reduce((sum, ts) => sum + ts.total_km, 0);
              console.log(`  ${key}: user_name="${group.user_name}", count=${group.timesheets.length}, totalHours=${totalHours}, totalKm=${totalKm}`);
            });
            
            db.close();
            process.exit(0);
          }
        );
      }
    );
  }, 50);
});
