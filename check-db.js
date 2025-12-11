const db = require('sqlite3').verbose();
const database = new db.Database('./database.sqlite');

database.all("PRAGMA table_info(submissions)", (err, rows) => {
  if(err) {
    console.error('Error:', err);
    database.close();
  } else {
    console.log('Submissions table columns:');
    rows.forEach(r => console.log(`  ${r.name} (${r.type})`));
    
    console.log('\n\nChecking submission records:');
    database.all("SELECT id, user_name, week_numbers, submission_date FROM submissions ORDER BY id DESC LIMIT 5", (err2, records) => {
      if(err2) {
        console.error('Error fetching records:', err2);
      } else {
        console.log(`\nFound ${records.length} recent submissions:`);
        records.forEach(rec => {
          console.log(`  ID ${rec.id}: ${rec.user_name}, Week Numbers: ${rec.week_numbers || 'NULL'}, Date: ${rec.submission_date}`);
        });
      }
      database.close();
    });
  }
});
