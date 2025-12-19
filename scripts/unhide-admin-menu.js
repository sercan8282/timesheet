const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use same default DB path as the app
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');

console.log('[unhide-admin-menu] Using DB:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this.changes || 0);
    });
  });
}

(async function main() {
  try {
    // Ensure table exists (no-op if already)
    await run(`CREATE TABLE IF NOT EXISTS ui_menu (
      page_key TEXT PRIMARY KEY,
      label TEXT,
      sort_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    )`);

    // Unhide Menu Management entry
    const changes = await run(
      `UPDATE ui_menu SET visible = 1 WHERE page_key IN ('admin-menu')`
    );

    console.log(`Unhid admin-menu (changes: ${changes}).`);

    // Optional: also ensure translations page visible if needed
    const changes2 = await run(
      `UPDATE ui_menu SET visible = 1 WHERE page_key IN ('admin-translations')`
    );
    console.log(`Unhid admin-translations (changes: ${changes2}).`);

    // If item missing entirely, insert a sane default
    await run(
      `INSERT OR IGNORE INTO ui_menu (page_key, label, sort_order, visible) VALUES ('admin-menu', 'Menu', 98, 1)`
    );
    await run(
      `INSERT OR IGNORE INTO ui_menu (page_key, label, sort_order, visible) VALUES ('admin-translations', 'Translations', 99, 1)`
    );

    console.log('✓ Menu items ensured visible.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
