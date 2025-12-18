const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

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

  // Debug: show keyword lines
  const dbgTotal = lines.filter((l) => /totaal|total/i.test(l));
  const dbgVat = lines.filter((l) => /btw|vat/i.test(l));
  console.log("DBG TOTAL LINES:", dbgTotal);
  console.log("DBG VAT LINES:", dbgVat);

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
  if (!customer_name) {
    const custPatterns = [
      /(klant|customer|factuur aan|debiteur|relatie|klantnaam)\s*[:\-]?\s*(.+)/i,
    ];
    for (const rx of custPatterns) {
      const m = normalized.match(rx);
      if (m) {
        customer_name = m[2]
          .split(/\n|\r|Factuur|Factuurnummer|Week/i)[0]
          .trim();
        break;
      }
    }
  }

  // Amounts
  let total_amount = NaN;
  let vat_amount = NaN;
  let subtotal = NaN;

  const totalLine = [...lines]
    .reverse()
    .find((l) =>
      /(totaal\s*incl\.?\s*btw|totaal\b|grand total|total)/i.test(l)
    );
  console.log("DBG totalLine:", totalLine);
  if (totalLine) {
    const ms = [...totalLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) total_amount = parseEuroAmount(pick);
  }

  const vatLine =
    [...lines].reverse().find((l) => /btw/i.test(l) && /%/.test(l)) ||
    [...lines]
      .reverse()
      .find(
        (l) =>
          /btw|vat/i.test(l) &&
          !/btw\s*\-?nummer|btwnummer/i.test(l) &&
          !/totaal/i.test(l) &&
          /€|eur|euro/i.test(l)
      );
  console.log("DBG vatLine:", vatLine);
  if (vatLine) {
    const ms = [...vatLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) vat_amount = parseEuroAmount(pick);
  }

  const subLine = [...lines]
    .reverse()
    .find((l) => /(subtotaal|netto|excl\.?\s*btw)/i.test(l));
  if (subLine) {
    const ms = [...subLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) subtotal = parseEuroAmount(pick);
  }

  if (
    !Number.isFinite(subtotal) &&
    Number.isFinite(total_amount) &&
    Number.isFinite(vat_amount)
  ) {
    subtotal = total_amount - vat_amount;
  }

  // Parse line items from table
  let totalHoursFromPdf = null;
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

    console.log("DBG tableLines count:", tableLines.length);
    tableLines.forEach((line, idx) => {
      console.log(`DBG line ${idx}:`, line);
      // Skip summary rows and lines with keywords (not header since we already skipped it with .slice(1))
      if (/totaal|tarief|excl|btw|missende/i.test(line)) {
        console.log("  → Skipped (summary)");
        return;
      }

      // Mainfreight format: [10-digit-ID][DD]-[MM]-[YY][KM (3-4 digits)][HOURS with decimals]€ [rate]€ [bedrag]
      // Example: 1115464760 01-12-25 377 12.75€ 65.00€ 828.75
      const match = line.match(/(\d{10})(\d{2})-(\d{2})-(\d{2})/);
      if (!match) {
        console.log("  → No date match");
        return;
      }

      const [, invoiceId, d, m, y] = match;

      // Convert dates: DD-MM-YY -> YYYY-MM-DD
      const fullYear =
        parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y);
      const isoDate = `${fullYear}-${m}-${d}`;

      // Extract bedrag (line total) and rate from the € signs
      const euroParts = line.split("€");
      if (euroParts.length < 3) {
        console.log("  → Not enough € signs");
        return;
      }

      const rate = parseEuroAmount(euroParts[1]) || null;
      const bedrag = parseEuroAmount(euroParts[2]) || null;

      if (!Number.isFinite(bedrag) || !Number.isFinite(rate) || rate === 0) {
        console.log("  → Invalid bedrag or rate");
        return;
      }

      // Calculate hours from bedrag: hours = bedrag / rate
      const hours = bedrag / rate;

      // Extract KM: it's exactly 3 digits after the date [DD][MM][YY] = 6 chars
      // Format: [10-digit-ID][DD][MM][YY][KM-3-digits][hours...]
      const datePortionLength = match[0].length; // e.g., "111546068210-11-25" = 18 chars
      const afterDate = euroParts[0].substring(datePortionLength); // "35510.00"
      const km = parseInt(afterDate.substring(0, 3)) || null; // Take first 3 chars: "355"

      const item = {
        description: invoiceId,
        item_date: isoDate,
        item_km: km,
        item_hours: Number.isFinite(hours) ? hours : null,
        item_rate: rate,
        quantity: Number.isFinite(hours) ? hours : 1,
        unit_price: rate || 0,
        line_total: bedrag || 0,
      };
      console.log("  → Parsed item:", item);
      line_items.push(item);
    });
    console.log("DBG Final line_items count:", line_items.length);
  }

  // Extract totals from PDF footer ("Totaal uren39.75€ 2,583.75")
  const totalHoursLine = text.match(/Totaal\s*uren\s*([\d.,]+)/);
  if (totalHoursLine) {
    totalHoursFromPdf = parseFloat(totalHoursLine[1].replace(",", "."));
  }

  // Calculate total KM from line items (sum all item_km values)
  let totalKmFromPdf = null;
  if (line_items.length > 0) {
    totalKmFromPdf = line_items.reduce((sum, item) => {
      return sum + (Number.isFinite(item.item_km) ? item.item_km : 0);
    }, 0);
  }

  return {
    invoice_date: invoice_date || new Date().toISOString().slice(0, 10),
    customer_name: customer_name || null,
    subtotal: Number.isFinite(subtotal) ? Number(subtotal.toFixed(2)) : null,
    vat_amount: Number.isFinite(vat_amount)
      ? Number(vat_amount.toFixed(2))
      : null,
    total_amount: Number.isFinite(total_amount)
      ? Number(total_amount.toFixed(2))
      : null,
    invoice_number: invoice_number || null,
    line_items: line_items,
    totals: {
      total_km: totalKmFromPdf,
      total_hours: totalHoursFromPdf,
    },
  };
}

(async () => {
  try {
    const pdfPath =
      process.argv[2] ||
      "C:\\Users\\Administrator\\Downloads\\Factuur EU Transport week 48_2025-86.pdf";
    const buf = fs.readFileSync(pdfPath);
    const res = await pdfParse(buf);
    const out = extractInvoiceDataFromText(res.text || "");
    console.log("Parsed fields:", JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
