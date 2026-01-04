const db = require('./config/database');

db.db.all("SELECT id, invoice_number, invoice_date FROM invoices WHERE invoice_date LIKE '%-%-____'", (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('Facturen met DD-MM-YYYY format:', rows.length);
  rows.forEach(r => {
    const parts = r.invoice_date.split('-');
    if (parts[0].length === 2 && parts[1].length <= 2 && parts[2].length === 4) {
      console.log(`  ID ${r.id}: ${r.invoice_number} - ${r.invoice_date}`);
    }
  });
  
  process.exit(0);
});
