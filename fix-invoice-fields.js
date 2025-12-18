const db = require('./config/database');

db.all(
  `SELECT id, description, item_date, item_km, item_hours, item_rate 
   FROM invoice_line_items WHERE invoice_id IN (1, 2)`,
  [],
  (err, rows) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }
    console.log('Current line items:');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  }
);
