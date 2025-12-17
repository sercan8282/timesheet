const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");

/**
 * Generate PDF for an invoice
 */
async function generateInvoicePDF(invoiceId) {
  try {
    // Fetch invoice data
    const invoice = await db.get(
      `SELECT i.*, t.name as template_name
       FROM invoices i
       LEFT JOIN invoice_templates t ON i.template_id = t.id
       WHERE i.id = ?`,
      [invoiceId]
    );

    if (!invoice) {
      throw new Error("Factuur niet gevonden");
    }

    // Fetch line items
    const lineItems = await db.all(
      "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY position_order ASC",
      [invoiceId]
    );

    // Fetch template elements
    const templateElements = await db.all(
      "SELECT * FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC",
      [invoice.template_id]
    );

    // Fetch branding settings
    const branding = await db.get("SELECT * FROM branding_settings LIMIT 1");

    // Create PDF
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    // Setup output path
    const outputDir = path.join(__dirname, "../public/uploads/invoices/pdfs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `invoice-${invoice.invoice_number.replace(
      /\//g,
      "-"
    )}.pdf`;
    const filepath = path.join(outputDir, filename);
    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    let yPosition = 50;

    // Layout helpers
    const availableWidth = doc.page.width - 100; // left 50, right 50
    const colWidth = availableWidth / 3;
    const colX = [50, 50 + colWidth, 50 + colWidth * 2];

    const cleanContent = (text) =>
      (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();

    const renderTextBlock = (el, x, y, width) => {
      const content = cleanContent(el.content);
      const fontName = el.font_weight === "bold" ? "Helvetica-Bold" : "Helvetica";

      doc
        .font(fontName)
        .fontSize(parseInt(el.font_size) || 12)
        .fillColor(el.font_color || "#000000")
        .text(content, x, y, { width: width - 10 });
      const textHeight = doc.heightOfString(content, { width: width - 10 });
      return y + textHeight + 10;
    };

    const renderImageBlock = (el, x, y, width) => {
      const imagePath = path.join(__dirname, "../public", el.image_path);
      if (fs.existsSync(imagePath)) {
        try {
          const imgWidth = Math.min(width - 10, 150);
          doc.image(imagePath, x, y, { width: imgWidth });
          return y + imgWidth + 10;
        } catch (err) {
          console.error("Error adding template image:", err);
        }
      }
      return y;
    };

    const renderColumn = (elements, x, yStart) => {
      let y = yStart;
      for (const el of elements) {
        if (el.image_path) {
          y = renderImageBlock(el, x, y, colWidth);
        } else if (el.content) {
          y = renderTextBlock(el, x, y, colWidth);
        }
      }
      return y;
    };

    // Group elements by new layout types, skip title elements entirely
    const topCols = [[], [], []];
    const addrCols = [[], [], []];

    templateElements.forEach((el) => {
      if (el.element_type === "title") return;
      if (el.element_type === "top_left") topCols[0].push(el);
      else if (el.element_type === "top_center") topCols[1].push(el);
      else if (el.element_type === "top_right") topCols[2].push(el);
      else if (el.element_type === "address_left") addrCols[0].push(el);
      else if (el.element_type === "address_center") addrCols[1].push(el);
      else if (el.element_type === "address_right") addrCols[2].push(el);
    });

    // Logo default in top-left if present
    if (branding && branding.logo_path) {
      const logoPath = path.join(__dirname, "../public", branding.logo_path);
      if (fs.existsSync(logoPath)) {
        topCols[0].unshift({
          element_type: "image",
          image_path: branding.logo_path,
          font_size: 12,
          font_color: "#000000",
          font_weight: "normal",
          content: null,
        });
      }
    }

    // Do not auto-insert a title; if a "title" element exists we ignore it for rendering

    // Invoice meta default in top-right
    const metaLines = [
      `Factuurnummer: ${invoice.invoice_number}`,
      `Factuurdatum: ${invoice.invoice_date}`,
    ];
    if (invoice.due_date) metaLines.push(`Vervaldatum: ${invoice.due_date}`);
    if (topCols[2].length === 0) {
      topCols[2].push({
        element_type: "text",
        content: metaLines.join("\n"),
        font_size: 10,
        font_color: "#000000",
        font_weight: "normal",
      });
    }

    // Render top section
    const topStartY = 50;
    const topY = [topStartY, topStartY, topStartY];
    topY[0] = renderColumn(topCols[0], colX[0], topY[0]);
    topY[1] = renderColumn(topCols[1], colX[1], topY[1]);
    topY[2] = renderColumn(topCols[2], colX[2], topY[2]);
    const afterTopY = Math.max(...topY) + 20;

    // Address defaults
    if (addrCols[0].length === 0 && (invoice.customer_name || invoice.customer_address)) {
      let addr = invoice.customer_name ? `${invoice.customer_name}\n` : "";
      if (invoice.customer_address) addr += invoice.customer_address;
      addrCols[0].push({
        element_type: "text",
        content: addr.trim(),
        font_size: 10,
        font_color: "#000000",
        font_weight: "normal",
        label: "Factuuradres",
      });
    }

    if (addrCols[2].length === 0) {
      // Fallback to branding as sender
      const senderContent = [branding?.company_name, branding?.tagline].filter(Boolean).join("\n");
      if (senderContent) {
        addrCols[2].push({
          element_type: "text",
          content: senderContent,
          font_size: 10,
          font_color: "#000000",
          font_weight: "normal",
          label: "Afzender",
        });
      }
    }

    const addrStartY = afterTopY;
    const addrY = [addrStartY, addrStartY, addrStartY];

    // Add labels if present
    const renderAddrCol = (elements, x, yStart) => {
      let y = yStart;
      for (const el of elements) {
        if (el.image_path) {
          y = renderImageBlock(el, x, y, colWidth);
        } else if (el.content) {
          y = renderTextBlock(el, x, y, colWidth);
        }
      }
      return y;
    };

    addrY[0] = renderAddrCol(addrCols[0], colX[0], addrY[0]);
    addrY[1] = renderAddrCol(addrCols[1], colX[1], addrY[1]);
    addrY[2] = renderAddrCol(addrCols[2], colX[2], addrY[2]);

    yPosition = Math.max(...addrY) + 30;

    // Render remaining template elements (exclude layout-specific ones)
    for (const element of templateElements) {
      if (
        element.element_type === "title" ||
        element.element_type === "sender" ||
        element.element_type.startsWith("top_") ||
        element.element_type.startsWith("address_")
      ) {
        continue;
      }

      if (element.element_type === "text" && element.content) {
        doc
          .fontSize(parseInt(element.font_size) || 12)
          .fillColor(element.font_color || "#000000")
          .font(element.font_weight === "bold" ? "Helvetica-Bold" : "Helvetica")
          .text(element.content, 50, yPosition);
        yPosition += (parseInt(element.font_size) || 12) + 10;
      } else if (element.element_type === "image" && element.image_path) {
        const imagePath = path.join(__dirname, "../public", element.image_path);
        if (fs.existsSync(imagePath)) {
          try {
            doc.image(imagePath, 50, yPosition, { width: 150 });
            yPosition += 160;
          } catch (err) {
            console.error("Error adding template image:", err);
          }
        }
      }
    }

    // Line items table
    yPosition += 20;
    const tableTop = yPosition;
    const tableLeft = 50;
    const tableWidth = doc.page.width - 100;

    // Table header
    doc.fontSize(10).fillColor("#000000").font("Helvetica-Bold");

    doc.text("Omschrijving", tableLeft, tableTop, { width: tableWidth * 0.5 });
    doc.text("Aantal", tableLeft + tableWidth * 0.5, tableTop, {
      width: tableWidth * 0.15,
      align: "right",
    });
    doc.text("Prijs", tableLeft + tableWidth * 0.65, tableTop, {
      width: tableWidth * 0.15,
      align: "right",
    });
    doc.text("Totaal", tableLeft + tableWidth * 0.8, tableTop, {
      width: tableWidth * 0.2,
      align: "right",
    });

    yPosition += 20;
    doc
      .moveTo(tableLeft, yPosition)
      .lineTo(tableLeft + tableWidth, yPosition)
      .stroke();
    yPosition += 10;

    // Table rows
    doc.font("Helvetica");
    lineItems.forEach((item) => {
      const itemHeight = Math.max(
        doc.heightOfString(item.description, { width: tableWidth * 0.5 }),
        15
      );

      doc.text(item.description, tableLeft, yPosition, {
        width: tableWidth * 0.5,
      });
      doc.text(
        item.quantity.toString(),
        tableLeft + tableWidth * 0.5,
        yPosition,
        {
          width: tableWidth * 0.15,
          align: "right",
        }
      );
      doc.text(
        `€ ${parseFloat(item.unit_price).toFixed(2)}`,
        tableLeft + tableWidth * 0.65,
        yPosition,
        {
          width: tableWidth * 0.15,
          align: "right",
        }
      );
      doc.text(
        `€ ${parseFloat(item.line_total).toFixed(2)}`,
        tableLeft + tableWidth * 0.8,
        yPosition,
        {
          width: tableWidth * 0.2,
          align: "right",
        }
      );

      yPosition += itemHeight + 5;
    });

    yPosition += 10;
    doc
      .moveTo(tableLeft, yPosition)
      .lineTo(tableLeft + tableWidth, yPosition)
      .stroke();
    yPosition += 15;

    // Totals
    const totalsLeft = tableLeft + tableWidth * 0.65;

    doc.font("Helvetica");
    doc.text("Subtotaal:", totalsLeft, yPosition);
    doc.text(
      `€ ${parseFloat(invoice.subtotal).toFixed(2)}`,
      tableLeft + tableWidth * 0.8,
      yPosition,
      {
        width: tableWidth * 0.2,
        align: "right",
      }
    );
    yPosition += 20;

    doc.text("BTW (21%):", totalsLeft, yPosition);
    doc.text(
      `€ ${parseFloat(invoice.vat_amount).toFixed(2)}`,
      tableLeft + tableWidth * 0.8,
      yPosition,
      {
        width: tableWidth * 0.2,
        align: "right",
      }
    );
    yPosition += 20;

    doc.font("Helvetica-Bold").fontSize(12);
    doc.text("Totaal:", totalsLeft, yPosition);
    doc.text(
      `€ ${parseFloat(invoice.total_amount).toFixed(2)}`,
      tableLeft + tableWidth * 0.8,
      yPosition,
      {
        width: tableWidth * 0.2,
        align: "right",
      }
    );

    // Notes at bottom
    if (invoice.notes) {
      yPosition += 40;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#666666")
        .text("Opmerkingen:", 50, yPosition);
      yPosition += 15;
      doc.text(invoice.notes, 50, yPosition, { width: tableWidth });
    }

    // Finalize PDF
    doc.end();

    // Wait for file to be written
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return {
      filename: filename,
      path: `/uploads/invoices/pdfs/${filename}`,
      fullPath: filepath,
    };
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw error;
  }
}

module.exports = {
  generateInvoicePDF,
};
