const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('=== CHECKING FLEET DATA WITH TRUCK TYPES ===\n');

db.all(`
  SELECT rit_number, license_plate, truck_type, company_id
  FROM fleet_vehicles 
  WHERE rit_number IS NOT NULL 
  ORDER BY rit_number
  LIMIT 20
`, [], (err, fleet) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('FLEET_VEHICLES data (with truck types):');
  console.log('Rit# | License Plate | Truck Type        | Company');
  console.log('-'.repeat(70));
  fleet.forEach(v => {
    console.log(`${String(v.rit_number || '').padEnd(5)}| ${String(v.license_plate || '').padEnd(14)}| ${String(v.truck_type || '').padEnd(18)}| ${v.company_id}`);
  });
  
  // Now check a planning entry with its route number
  db.all(`
    SELECT 
      ps.id, 
      ps.route_number,
      ps.mega_kast as planning_mega_kast,
      u.full_name,
      fv.truck_type as fleet_truck_type,
      fv.license_plate
    FROM planning_schedules ps
    LEFT JOIN users u ON u.id = ps.driver_id
    LEFT JOIN fleet_vehicles fv ON fv.rit_number = ps.route_number
    WHERE ps.week_number = 1
    LIMIT 10
  `, [], (err2, planning) => {
    if (err2) {
      console.error('Error:', err2);
    } else {
      console.log('\n\nPLANNING with FLEET TRUCK TYPE (joined on rit_number = route_number):');
      console.log('ID  | Route | Driver               | Planning Type | Fleet Type         | License');
      console.log('-'.repeat(100));
      planning.forEach(p => {
        console.log(
          `${String(p.id).padEnd(4)}| ${String(p.route_number || '').padEnd(6)}| ${String(p.full_name || '').padEnd(21)}| ${String(p.planning_mega_kast || '').padEnd(14)}| ${String(p.fleet_truck_type || 'NULL').padEnd(19)}| ${p.license_plate || ''}`
        );
      });
    }
    
    db.close();
    process.exit(0);
  });
});
