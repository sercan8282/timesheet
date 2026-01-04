const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('=== CHECKING VEHICLES/FLEET STRUCTURE ===\n');

// Check vehicles table
db.all(`PRAGMA table_info(vehicles)`, [], (err, vehiclesCols) => {
  if (err) {
    console.error('Error getting vehicles columns:', err);
  } else {
    console.log('VEHICLES table columns:');
    vehiclesCols.forEach(col => {
      console.log(`  - ${col.name} (${col.type})`);
    });
  }
  
  // Check fleet_vehicles table
  db.all(`PRAGMA table_info(fleet_vehicles)`, [], (err2, fleetCols) => {
    if (err2) {
      console.error('Error getting fleet_vehicles columns:', err2);
    } else {
      console.log('\nFLEET_VEHICLES table columns:');
      fleetCols.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
    }
    
    // Get some sample data
    db.all(`
      SELECT route_number, license_plate, truck_type, mega_kast 
      FROM vehicles 
      WHERE route_number IS NOT NULL 
      LIMIT 10
    `, [], (err3, vehicles) => {
      if (err3) {
        console.error('Error:', err3);
      } else {
        console.log('\nSample VEHICLES data:');
        console.log('Route | License Plate | truck_type | mega_kast');
        console.log('-'.repeat(60));
        vehicles.forEach(v => {
          console.log(`${String(v.route_number).padEnd(6)}| ${String(v.license_plate || '').padEnd(14)}| ${String(v.truck_type || '').padEnd(11)}| ${v.mega_kast || ''}`);
        });
      }
      
      db.all(`
        SELECT route_number, license_plate, truck_type 
        FROM fleet_vehicles 
        WHERE route_number IS NOT NULL 
        LIMIT 10
      `, [], (err4, fleet) => {
        if (err4) {
          console.error('Error:', err4);
        } else {
          console.log('\nSample FLEET_VEHICLES data:');
          console.log('Route | License Plate | truck_type');
          console.log('-'.repeat(50));
          fleet.forEach(v => {
            console.log(`${String(v.route_number).padEnd(6)}| ${String(v.license_plate || '').padEnd(14)}| ${v.truck_type || ''}`);
          });
        }
        
        db.close();
        process.exit(0);
      });
    });
  });
});
