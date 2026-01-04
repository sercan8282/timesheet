const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('=== CHECKING ACTUAL DATABASE VALUES ===\n');

// Check what's actually in the planning_schedules table
db.all(`
  SELECT 
    ps.id,
    ps.route_number,
    ps.mega_kast,
    typeof(ps.mega_kast) as mega_kast_type,
    length(ps.mega_kast) as mega_kast_length,
    u.full_name,
    u.mega_kast as driver_mega_kast
  FROM planning_schedules ps
  LEFT JOIN users u ON u.id = ps.driver_id
  WHERE ps.week_number = 1
  ORDER BY ps.id
  LIMIT 20
`, [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  
  console.log('RAW DATABASE VALUES:');
  console.log('ID  | Route | ps.mega_kast (raw value) | Type | Length | Driver | driver.mega_kast');
  console.log('-'.repeat(100));
  
  const uniqueValues = new Set();
  
  rows.forEach(row => {
    uniqueValues.add(row.mega_kast);
    console.log(
      `${String(row.id).padEnd(4)}| ${String(row.route_number || '').padEnd(6)}| ${String(row.mega_kast).padEnd(24)} | ${String(row.mega_kast_type).padEnd(4)} | ${String(row.mega_kast_length).padEnd(6)} | ${String(row.full_name).padEnd(20)} | ${row.driver_mega_kast}`
    );
  });
  
  console.log('\n=== UNIQUE VALUES IN ps.mega_kast ===');
  uniqueValues.forEach(val => {
    console.log(`- "${val}" (type: ${typeof val}, length: ${val ? val.length : 0})`);
  });
  
  db.close();
  process.exit(0);
});
