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

    if (await addColumnIfMissing('smtp_settings', 'auth_type', "TEXT DEFAULT 'basic'")) changed = true;
    if (await addColumnIfMissing('smtp_settings', 'oauth_tenant_id', 'TEXT')) changed = true;
    if (await addColumnIfMissing('smtp_settings', 'oauth_client_id', 'TEXT')) changed = true;
    if (await addColumnIfMissing('smtp_settings', 'oauth_client_secret', 'TEXT')) changed = true;
    if (await addColumnIfMissing('smtp_settings', 'oauth_scope', "TEXT DEFAULT 'https://outlook.office365.com/.default'")) changed = true;

    if (await addColumnIfMissing('branding_settings', 'tagline', "TEXT DEFAULT 'Please sign in to continue'")) changed = true;

    if (changed) {
      console.log('✓ Columns added/verified for SMTP OAuth and branding tagline');
    } else {
      console.log('✓ Columns already present; no changes needed');
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
