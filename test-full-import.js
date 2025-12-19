const fs = require("fs");
const pdfParse = require("pdf-parse");
const db = require("./config/database");

// Copy the parsing function from routes/invoice.js
function parseEuroAmount(str) {
  if (!str) return NaN;
  let s = String(str).trim().replace(/[\s€]/g, "");
  s = s.replace(/[\u00A0]/g, "");
  if (/[,]\d{2}\b/.test(s)) {
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (/[.]\d{2}\b/.test(s)) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(/[\.,]/g, "");
  }
  const val = parseFloat(s);
  return Number.isFinite(val) ? val : NaN;
}

function extractInvoiceDataFromText(text) {
  const normalized = String(text)
    .replace(/\/{2,}/g, "/")
    .replace(/\-{2,}/g, "-");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let line_items = [];
  let totalKmFromPdf = null;
  let totalHoursFromPdf = null;

  // Date
  const dateRegexes = [
    /(factuurdatum|datum|invoice date)\s*[:\-]?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i,
    /(\d{4}[\/-]\d{2}[\/-]\d{2})/,
  ];
  let invoice_date = null;
  for (const rx of dateRegexes) {
    const m = normalized.match(rx);
    if (m) {
      invoice_date = m[m.length - 1].replace(/\//g, "-");
      const parts = invoice_date.split("-");
      if (parts[0].length === 2) {
        invoice_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      break;
    }
  }

  // Customer
  let customer_name = null;
  const custDirect = normalized.match(
    /\bAAN:\s*(.+?)(?:\s*(Factuur|Factuurnummer|Week|\n))/i
  );
  if (custDirect && custDirect[1]) {
    customer_name = custDirect[1].trim();
  }

  // Invoice number
  let invoice_number = null;
  const invPatterns = [
    /\bFactuurnummer\s*[:\-]?\s*([A-Za-z0-9\/\.-]+)/i,
    /\bFactuur\s*nr\.?\s*[:\-]?\s*([A-Za-z0-9\/\.-]+)/i,
    /\bInvoice\s*(?:number|no\.?|nr\.?)[\s:\-]*([A-Za-z0-9\/\.-]+)/i,
  ];
  for (const rx of invPatterns) {
    const m = normalized.match(rx);
    if (m && m[1]) {
      invoice_number = m[1].trim();
      break;
    }
  }

  // Parse line items from table
  const tableStart = text.indexOf("Omschrijving");
  if (tableStart > -1) {
    const tableEnd = text.indexOf("Totaal uren", tableStart);
    const tableSection =
      tableEnd > -1
        ? text.substring(tableStart, tableEnd)
        : text.substring(tableStart);
    const tableLines = tableSection
      .split(/\n/)
      .slice(1)
      .filter((l) => l.trim());

    tableLines.forEach((line) => {
      if (/totaal|tarief|excl|btw|missende/i.test(line)) return;

      const match = line.match(/(\d{10})(\d{2})-(\d{2})-(\d{2})/);
      if (!match) return;

      const [, invoiceId, d, m, y] = match;

      const fullYear =
        parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y);
      const isoDate = `${fullYear}-${m}-${d}`;

      const euroParts = line.split("€");
      if (euroParts.length < 3) return;

      const rate = parseEuroAmount(euroParts[1]) || null;
      const bedrag = parseEuroAmount(euroParts[2]) || null;

      if (!Number.isFinite(bedrag) || !Number.isFinite(rate) || rate === 0)
        return;

      const hours = bedrag / rate;

      const datePortionLength = match[0].length;
      const afterDate = euroParts[0].substring(datePortionLength);
      const km = parseInt(afterDate.substring(0, 3)) || null;

      line_items.push({
        description: invoiceId,
        item_date: isoDate,
        item_km: km,
        item_hours: Number.isFinite(hours) ? hours : null,
        item_rate: rate,
        quantity: Number.isFinite(hours) ? hours : 1,
        unit_price: rate || 0,
        line_total: bedrag || 0,
      });
    });
  }

  const totalHoursLine = text.match(/Totaal\s*uren\s*([\d.,]+)/);
  if (totalHoursLine) {
    totalHoursFromPdf = parseFloat(totalHoursLine[1].replace(",", "."));
  }

  if (line_items.length > 0) {
    totalKmFromPdf = line_items.reduce((sum, item) => {
      return sum + (Number.isFinite(item.item_km) ? item.item_km : 0);
    }, 0);
  }

  return {
    invoice_date,
    customer_name,
    invoice_number,
    line_items,
    totals: {
      total_km: totalKmFromPdf,
      total_hours: totalHoursFromPdf,
    },
  };
}

(async () => {
  try {
    const filePath =
      process.argv[2] ||
      "C:\\Users\\Administrator\\Downloads\\Factuur EU Transport week 45_2025-75.pdf";
    const buf = fs.readFileSync(filePath);
    const parsed = await pdfParse(buf);
    const extracted = extractInvoiceDataFromText(parsed.text || "");

    console.log("Extracted data:");
    console.log("  Invoice:", extracted.invoice_number);
    console.log("  Customer:", extracted.customer_name);
    console.log("  Line items:", extracted.line_items.length);
    console.log("  Total KM:", extracted.totals.total_km);
    console.log("  Total Hours:", extracted.totals.total_hours);

    // Now simulate the import by creating an invoice and line items
    // Get or create default template
    let template_id = 1;
    const template = await db.get("SELECT id FROM invoice_templates LIMIT 1");
    if (template) {
      template_id = template.id;
    } else {
      const result = await db.run(
        "INSERT INTO invoice_templates (name, description, is_default) VALUES (?, ?, 1)",
        ["Imported PDF", "Autogenerated default template for imported invoices"]
      );
      template_id = result.id;
    }

    const result = await db.run(
      `INSERT INTO invoices (template_id, invoice_number, customer_name, invoice_date, subtotal, vat_amount, total_amount, status, notes)
       VALUES (?, ?, ?, ?, 2687.10, 564.29, 3251.39, 'draft', ?)`,
      [
        template_id,
        extracted.invoice_number,
        extracted.customer_name,
        extracted.invoice_date,
        "Imported for testing",
      ]
    );

    const invoiceId = result.id;
    console.log("\nCreated invoice ID:", invoiceId);

    // Save line items
    for (const item of extracted.line_items) {
      await db.run(
        `INSERT INTO invoice_line_items 
         (invoice_id, description, quantity, unit_price, line_total, item_date, item_km, item_hours, item_rate, is_total_row, total_row_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.unit_price,
          item.line_total,
          item.item_date,
          item.item_km,
          item.item_hours,
          item.item_rate,
        ]
      );
    }

    console.log("✓ Added", extracted.line_items.length, "line items");

    // Add total rows
    if (
      Number.isFinite(extracted.totals.total_km) &&
      extracted.totals.total_km > 0
    ) {
      await db.run(
        `INSERT INTO invoice_line_items 
         (invoice_id, description, quantity, unit_price, line_total, item_km, item_hours, is_total_row, total_row_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [invoiceId, "Totaal KM", 1, 0, 0, extracted.totals.total_km, null, "km"]
      );
      console.log("✓ Added total KM row:", extracted.totals.total_km);
    }

    if (
      Number.isFinite(extracted.totals.total_hours) &&
      extracted.totals.total_hours > 0
    ) {
      await db.run(
        `INSERT INTO invoice_line_items 
         (invoice_id, description, quantity, unit_price, line_total, item_km, item_hours, is_total_row, total_row_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          invoiceId,
          "Totaal Uren",
          1,
          0,
          0,
          null,
          extracted.totals.total_hours,
          "hours",
        ]
      );
      console.log("✓ Added total hours row:", extracted.totals.total_hours);
    }

    // Verify
    const lineItems = await db.all(
      "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY id",
      [invoiceId]
    );
    console.log("\nFinal line items in database:");
    lineItems.forEach((item) => {
      const type = item.is_total_row ? `[TOTAL-${item.total_row_type}]` : "";
      console.log(
        `  ${item.description} ${type} | km: ${item.item_km} | hours: ${item.item_hours}`
      );
    });

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
