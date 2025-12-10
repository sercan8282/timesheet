const db = require('../config/database');

async function run() {
  try {
    console.log('Clearing all submissions and resetting ID counter...');
    
    // Delete all submissions
    await db.run('DELETE FROM submissions');
    
    // Reset the auto-increment counter for SQLite
    await db.run('DELETE FROM sqlite_sequence WHERE name="submissions"');
    
    console.log('✓ All submissions cleared successfully');
    console.log('✓ Auto-increment counter reset');
    
    process.exit(0);
  } catch (err) {
    console.error('Clear failed:', err.message);
    process.exit(1);
  }
}

run();
