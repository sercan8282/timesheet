const db = require('./config/database');

db.all("PRAGMA table_info(users)", (err, cols) => {
  if(err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
  console.log("Users table columns:");
  cols.forEach(c => console.log(`  - ${c.name} (${c.type})`));
  
  const hasMfa = cols.some(c => c.name === 'mfa_enabled');
  console.log(`\nmfa_enabled column exists: ${hasMfa}`);
  
  if (!hasMfa) {
    console.log("\nNeed to add mfa_enabled column...");
    db.run("ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0", (err) => {
      if(err) console.error("Error adding column:", err.message);
      else console.log("✓ Added mfa_enabled column");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
