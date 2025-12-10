const db = require('../config/database');

async function columnExists(table, column) {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

async function addColumnIfMissing(table, column, definition) {
  const exists = await columnExists(table, column);
  if (exists) return false;
  await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

async function run() {
  try {
    let changed = false;

    if (await addColumnIfMissing('timesheets', 'ritnumber', "TEXT")) {
      changed = true;
      console.log('✓ ritnumber column added to timesheets');
    }

    if (changed) {
      console.log('✓ Migration completed successfully');
    } else {
      console.log('✓ ritnumber column already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
