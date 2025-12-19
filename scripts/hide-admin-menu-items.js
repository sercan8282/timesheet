const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
console.log('[hide-admin-menu-items] Using DB:', dbPath);

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
    // Hide the admin-only menu editor entries from the main navbar
    const changes1 = await run(
      `UPDATE ui_menu SET visible = 0 WHERE page_key IN ('admin-menu','admin-translations')`
    );
    console.log(`Updated visibility (changes: ${changes1}).`);

    // Optionally, remove them entirely (comment out if you prefer to keep hidden records)
    // const changes2 = await run(
    //   `DELETE FROM ui_menu WHERE page_key IN ('admin-menu','admin-translations')`
    // );
    // console.log(`Deleted rows (changes: ${changes2}).`);

    console.log('✓ Menu items hidden. Reload the app to reflect changes.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
