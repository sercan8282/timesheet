const db = require('./config/database');

async function deleteInvoice() {
  try {
    // Delete line items
    await db.run('DELETE FROM invoice_line_items WHERE invoice_id = ?', [56]);
    console.log('✓ Line items deleted');
    
    // Delete invoice
    await db.run('DELETE FROM invoices WHERE id = ?', [56]);
    console.log('✓ Invoice 56 deleted');
    
    // Show remaining
    db.all('SELECT id, invoice_number FROM invoices ORDER BY id DESC LIMIT 3', (err, rows) => {
      console.log('Remaining invoices:');
      rows.forEach(r => console.log(`  - ID ${r.id}: ${r.invoice_number}`));
      process.exit(0);
    });
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

deleteInvoice();
