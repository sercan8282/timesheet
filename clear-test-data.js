const db = require("./config/database");

(async () => {
  try {
    // Clear all existing invoices and line items (for testing only!)
    await db.run("DELETE FROM invoice_line_items");
    await db.run("DELETE FROM invoices");
    console.log("✓ Cleared all test data");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
