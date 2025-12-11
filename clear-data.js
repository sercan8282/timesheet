const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('Starting database cleanup...');

db.serialize(() => {
  // Clear timesheets
  db.run('DELETE FROM timesheets', (err) => {
    if (err) {
      console.error('Error clearing timesheets:', err);
    } else {
      console.log('✓ Timesheets cleared');
    }
  });

  // Clear submissions
  db.run('DELETE FROM submissions', (err) => {
    if (err) {
      console.error('Error clearing submissions:', err);
    } else {
      console.log('✓ Submissions cleared');
    }
  });

  // Clear planning schedules
  db.run('DELETE FROM planning_schedules', (err) => {
    if (err) {
      console.error('Error clearing planning schedules:', err);
    } else {
      console.log('✓ Planning schedules cleared');
    }
  });

  // Clear leave requests
  db.run('DELETE FROM leave_requests', (err) => {
    if (err) {
      console.error('Error clearing leave requests:', err);
    } else {
      console.log('✓ Leave requests cleared');
    }
  });

  // Reset leave balances to 0
  db.run('UPDATE leave_balances SET vacation_hours = 0, overtime_hours = 0', (err) => {
    if (err) {
      console.error('Error resetting leave balances:', err);
    } else {
      console.log('✓ Leave balances reset to 0');
    }
  });

  // Get counts to verify
  db.get('SELECT COUNT(*) as count FROM timesheets', (err, row) => {
    console.log(`\nVerification - Timesheets remaining: ${row ? row.count : 'error'}`);
  });

  db.get('SELECT COUNT(*) as count FROM submissions', (err, row) => {
    console.log(`Verification - Submissions remaining: ${row ? row.count : 'error'}`);
  });

  db.get('SELECT COUNT(*) as count FROM planning_schedules', (err, row) => {
    console.log(`Verification - Planning schedules remaining: ${row ? row.count : 'error'}`);
  });

  db.get('SELECT COUNT(*) as count FROM leave_requests', (err, row) => {
    console.log(`Verification - Leave requests remaining: ${row ? row.count : 'error'}`);
    console.log('\nDatabase cleanup complete!');
    db.close();
  });
});
