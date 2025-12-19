const sqlite3 = require(''sqlite3'').verbose();
const path = require(''path'');

const dbPath = path.join(__dirname, ''database.sqlite'');
const db = new sqlite3.Database(dbPath);

console.log(''Checking submissions table schema...\n'');

db.all(''PRAGMA table_info(submissions)'', [], (err, columns) => {
  if (err) {
    console.error(''Error:'', err);
    process.exit(1);
  }
  
  console.log(''Columns:'');
  columns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  console.log(''\nChecking submission records...\n'');
  
  db.all(''SELECT id, user_name, week_numbers, submission_date FROM submissions ORDER BY id DESC LIMIT 5'', [], (err, rows) => {
    if (err) {
      console.error(''Error:'', err);
      process.exit(1);
    }
    
    console.log(`Found ${rows.length} recent submissions:`);
    rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.user_name}, Week Numbers: ${row.week_numbers || ''NULL''}, Date: ${row.submission_date}`);
    });
    
    db.close();
    process.exit(0);
  });
});
