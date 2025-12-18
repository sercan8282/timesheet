const db = require("./config/database");

(async () => {
  try {
    // Get invoices with their line items
    const invoices = await db.all("SELECT * FROM invoices LIMIT 5");
    console.log("Recent Invoices:");
    console.log(JSON.stringify(invoices, null, 2));

    // Get line items for invoice 24
    console.log("\nLine items for invoice 24:");
    const lineItems = await db.all(`
      SELECT * FROM invoice_line_items WHERE invoice_id = 24 ORDER BY id ASC
    `);
    console.log(JSON.stringify(lineItems, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
