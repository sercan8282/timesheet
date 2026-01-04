const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

// This is the exact query from planning-pdf.js
db.all(`
  SELECT 
    ps.*,
    u.full_name AS driver_name,
    u.phone AS driver_phone,
    u.adr AS driver_adr,
    u.mega_kast AS driver_mega_kast,
    u.note AS driver_note,
    COALESCE(v.license_plate, fv.license_plate) AS license_plate,
    c.name AS company_name
  FROM planning_schedules ps
  LEFT JOIN users u ON u.id = ps.driver_id
  LEFT JOIN vehicles v ON v.id = ps.vehicle_id
  LEFT JOIN fleet_vehicles fv ON fv.id = ps.vehicle_id
  LEFT JOIN companies c ON c.id = ps.company_id
  WHERE ps.week_number = 1 AND ps.is_active = 1
  ORDER BY ps.company_id, ps.day_of_week, ps.route_number
  LIMIT 5
`, [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log('Results from PDF query:');
  rows.forEach((row, index) => {
    console.log(`\nEntry ${index + 1}:`);
    console.log(`  Route: ${row.route_number}`);
    console.log(`  Driver: ${row.driver_name}`);
    console.log(`  mega_kast (from ps.*): ${row.mega_kast}`);
    console.log(`  driver_mega_kast: ${row.driver_mega_kast}`);
    console.log(`  All keys:`, Object.keys(row));
  });
  
  db.close();
  process.exit(0);
});
