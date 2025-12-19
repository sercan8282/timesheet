const db = require('./config/database');

setTimeout(() => {
  // Remove admin submenu items from ui_menu (only keep main "admin" item)
  const adminItemsToRemove = [
    'admin-users',
    'admin-companies',
    'admin-submissions',
    'admin-hours-report',
    'admin-leave',
    'admin-fleet',
    'admin-planning',
    'admin-smtp',
    'admin-branding',
    'admin-menu',
    'admin-translations'
  ];

  // Delete from ui_menu
  const placeholders = adminItemsToRemove.map(() => '?').join(',');
  const deleteSql = `DELETE FROM ui_menu WHERE page_key IN (${placeholders})`;

  db.db.run(deleteSql, adminItemsToRemove, (err) => {
    if (err) {
      console.error('Error deleting admin items from ui_menu:', err);
    } else {
      console.log('✓ Removed admin submenu items from ui_menu');
      
      // Verify
      db.db.all('SELECT page_key, label, sort_order FROM ui_menu ORDER BY sort_order', [], (err2, rows) => {
        if (err2) {
          console.error('Error checking:', err2);
        } else {
          console.log('Remaining ui_menu items:');
          rows.forEach(r => {
            console.log(`  ${r.sort_order}: ${r.page_key} => ${r.label}`);
          });
        }
        
        // Check that translations are still there
        const adminKeysStr = adminItemsToRemove.map(() => '?').join(',');
        db.db.get(
          `SELECT COUNT(*) as cnt FROM translations WHERE namespace = 'menu' AND key IN (${adminKeysStr})`,
          adminItemsToRemove,
          (err3, row) => {
            if (err3) {
              console.error('Error checking translations:', err3);
            } else {
              console.log(`✓ Admin submenu translations still in database: ${row.cnt} rows`);
            }
            db.close();
            process.exit(0);
          }
        );
      });
    }
  });
}, 500);
