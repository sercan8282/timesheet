const db = require('./config/database');

setTimeout(() => {
  db.db.all('SELECT page_key, label, sort_order FROM ui_menu ORDER BY sort_order', [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Current ui_menu items:');
      rows.forEach(r => {
        console.log(`  ${r.sort_order}: ${r.page_key} => ${r.label}`);
      });
    }
    db.close();
    process.exit(0);
  });
}, 500);
