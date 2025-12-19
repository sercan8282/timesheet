const db = require("./config/database");

(async () => {
  try {
    const invoiceCount = await db.get("SELECT COUNT(*) as count FROM invoices");
    const lineItemCount = await db.get(
      "SELECT COUNT(*) as count FROM invoice_line_items"
    );
    console.log("Total Invoices:", invoiceCount.count);
    console.log("Total Line Items:", lineItemCount.count);

    // Show recent invoices
    const recentInvoices = await db.all(
      "SELECT id, invoice_number, customer_name, created_at FROM invoices ORDER BY created_at DESC LIMIT 5"
    );
    console.log("\nRecent Invoices:");
    console.log(recentInvoices);

    // Show recent line items
    const recentLineItems = await db.all(`
      SELECT ili.id, ili.invoice_id, ili.description, ili.item_date, ili.item_km, ili.item_hours, ili.item_rate
      FROM invoice_line_items ili
      ORDER BY ili.created_at DESC LIMIT 10
    `);
    console.log("\nRecent Line Items:");
    console.log(recentLineItems);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
