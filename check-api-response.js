const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  setTimeout(() => {
    const ids = [5, 6, 7, 8];
    const placeholders = ids.map(() => "?").join(",");
    
    let query = `SELECT t.id, t.week_number, t.date, t.start_time, t.end_time, t.start_km, t.end_km, t.pause_time, t.ritnumber, t.user_id, t.company_id,
                        COALESCE(c.name, 'Unknown') AS company_name,
                        COALESCE(u.full_name, u.username, 'Unknown') AS user_name,
                        t.total_hours, t.total_km
                 FROM timesheets t
                 LEFT JOIN companies c ON t.company_id = c.id
                 LEFT JOIN users u ON u.id = t.user_id
                 WHERE t.id IN (${placeholders})`;
    
    const params = [...ids];
    query += ` ORDER BY t.week_number, t.date`;
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error:', err);
        process.exit(1);
      }
      console.log('\n=== TIMESHEETS DETAILS API RESPONSE ===');
      if (!rows || rows.length === 0) {
        console.log('No timesheets found');
      } else {
        console.log(JSON.stringify(rows, null, 2));
      }
      db.close();
      process.exit(0);
    });
  }, 100);
});
