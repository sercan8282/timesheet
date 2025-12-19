const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use same DB path strategy as app
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('[add-system-update-menu] Using DB:', dbPath);

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

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

(async function main() {
  try {
    // Ensure tables exist (minimal schema)
    await run(`CREATE TABLE IF NOT EXISTS ui_menu (
      page_key TEXT PRIMARY KEY,
      label TEXT,
      sort_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    )`);

    await run(`CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      namespace TEXT NOT NULL,
      key TEXT NOT NULL,
      locale TEXT NOT NULL,
      text TEXT,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(namespace, key, locale)
    )`);

    // Compute next sort order
    const row = await get(`SELECT MAX(sort_order) AS max_order FROM ui_menu`);
    const startOrder = row && row.max_order != null ? row.max_order + 1 : 50;

    // Insert/replace menu item
    const changes = await run(
      `INSERT OR REPLACE INTO ui_menu (page_key, label, sort_order, visible)
       VALUES (?, ?, ?, ?)`,
      ['system-update', 'System Update', startOrder, 1]
    );
    console.log(`Menu item 'system-update' upserted (changes: ${changes}).`);

    // Menu label translations
    const menuTranslations = [
      ['menu','system-update','en','System Update'],
      ['menu','system-update','nl','Systeemupdate'],
      ['menu','system-update','de','System Update'],
    ];

    for (const [ns, key, locale, text] of menuTranslations) {
      await run(
        `INSERT OR REPLACE INTO translations (namespace, key, locale, text)
         VALUES (?, ?, ?, ?)`,
        [ns, key, locale, text]
      );
    }
    console.log('✓ Menu translations inserted.');

    // UI strings used by the page
    const uiTranslations = [
      ['ui','system_update.title','en','System Update'],
      ['ui','system_update.title','nl','Systeemupdate'],
      ['ui','system_update.description','en','Fetch latest code, install dependencies, update DB, then restart.'],
      ['ui','system_update.description','nl','Haalt laatste code op, installeert dependencies, werkt DB bij en herstart.'],
      ['ui','system_update.start','en','Start Update'],
      ['ui','system_update.start','nl','Start update'],
      ['ui','system_update.clear_log','en','Clear Log'],
      ['ui','system_update.clear_log','nl','Log wissen'],
      ['ui','system_update.idle','en','No update in progress.'],
      ['ui','system_update.idle','nl','Geen update actief.'],
    ];

    for (const [ns, key, locale, text] of uiTranslations) {
      await run(
        `INSERT OR REPLACE INTO translations (namespace, key, locale, text)
         VALUES (?, ?, ?, ?)`,
        [ns, key, locale, text]
      );
    }
    console.log('✓ UI translations inserted.');

    console.log('All done. You may need to reload the page.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
