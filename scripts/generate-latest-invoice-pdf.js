const db = require("../config/database");
const { generateInvoicePDF } = require("../utils/invoice-pdf");

(async () => {
  try {
    const latest = await db.get(
      `SELECT id, invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1`
    );
    if (!latest) {
      console.error("No invoices found");
      process.exit(1);
    }
    console.log("Generating PDF for invoice:", latest.invoice_number);
    const result = await generateInvoicePDF(latest.id);
    console.log("PDF generated:", result);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
