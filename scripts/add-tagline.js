require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_PATH || './database.sqlite';
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Add tagline column
  db.run(`ALTER TABLE branding_settings ADD COLUMN tagline TEXT DEFAULT 'Please sign in to continue'`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ Tagline column already exists');
      } else {
        console.error('Error adding tagline column:', err.message);
      }
    } else {
      console.log('✓ Tagline column added successfully');
    }
    
    db.close();
  });
});
