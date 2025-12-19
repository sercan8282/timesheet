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

    if (await addColumnIfMissing('users', 'role', "TEXT DEFAULT 'user'")) {
      changed = true;
      console.log('✓ role column added to users');
    }

    if (await addColumnIfMissing('submissions', 'user_name', 'TEXT')) {
      changed = true;
      console.log('✓ user_name column added to submissions');
    }

    if (changed) {
      console.log('✓ Migration completed successfully');
    } else {
      console.log('✓ Columns already exist');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
