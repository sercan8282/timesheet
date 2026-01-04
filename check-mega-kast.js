const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all(`
  SELECT 
    ps.id,
    ps.route_number,
    ps.mega_kast as planning_truck,
    u.full_name,
    u.mega_kast as driver_truck
  FROM planning_schedules ps
  LEFT JOIN users u ON u.id = ps.driver_id
  WHERE ps.week_number = 1
  LIMIT 10
`, [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log('Planning entries for week 1:');
  console.log('ID | Route | Planning Truck Type | Driver | Driver Default Truck');
  console.log('----------------------------------------------------------------');
  rows.forEach(row => {
    console.log(`${row.id} | ${row.route_number} | ${row.planning_truck} | ${row.full_name} | ${row.driver_truck}`);
  });
  
  db.close();
  process.exit(0);
});
