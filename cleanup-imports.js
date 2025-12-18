const fs = require("fs");
const path = require("path");
const db = require("./config/database");

async function cleanupImports() {
  console.log("🧹 Starting import cleanup...\n");

  try {
    // 1. Find all invoices with original_pdf_path
    const importedInvoices = await db.all(
      "SELECT id, invoice_number, original_pdf_path FROM invoices WHERE original_pdf_path IS NOT NULL AND original_pdf_path != ''"
    );

    console.log(`Found ${importedInvoices.length} imported invoices in database\n`);

    // 2. Delete line items for each invoice
    for (const invoice of importedInvoices) {
      await db.run(
        "DELETE FROM invoice_line_items WHERE invoice_id = ?",
        [invoice.id]
      );
      console.log(`✓ Deleted line items for invoice ${invoice.invoice_number}`);
    }

    // 3. Delete invoices
    const deletedCount = await db.run(
      "DELETE FROM invoices WHERE original_pdf_path IS NOT NULL AND original_pdf_path != ''"
    );
    console.log(
      `\n✓ Deleted ${importedInvoices.length} invoices from database\n`
    );

    // 4. Delete PDF files from disk
    const importsDir = path.join(
      __dirname,
      "public/uploads/invoices/imports"
    );

    if (fs.existsSync(importsDir)) {
      const files = fs.readdirSync(importsDir);
      console.log(`Found ${files.length} PDF files in ${importsDir}\n`);

      for (const file of files) {
        const filePath = path.join(importsDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`✓ Deleted ${file}`);
        } catch (err) {
          console.error(`✗ Failed to delete ${file}:`, err.message);
        }
      }
    }

    console.log("\n✅ Cleanup complete!");
    console.log(`- Removed ${importedInvoices.length} invoices from database`);
    console.log(`- Deleted ${files?.length || 0} PDF files from disk`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}

cleanupImports();
