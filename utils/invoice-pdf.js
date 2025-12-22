const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const db = require("../config/database");

// Generate a PDF for a given invoice id.
async function generateInvoicePDF(invoiceId) {
  // Invoice and related data
  const invoice = await db.get("SELECT * FROM invoices WHERE id = ?", [invoiceId]);
  if (!invoice) {
    throw new Error("Factuur niet gevonden");
  }

  const lineItems = await db.all(
    "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY position_order ASC",
    [invoiceId]
  );

  const template = await db.get("SELECT * FROM invoice_templates WHERE id = ?", [
    invoice.template_id,
  ]);
  const templateElements = await db.all(
    "SELECT * FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC",
    [invoice.template_id]
  );

  // Branding defaults
  let branding = {
    company_name: "",
    tagline: "",
    logo_path: null,
    primary_color: "#0080ff",
  };
  try {
    const settings = await db.get("SELECT * FROM branding_settings LIMIT 1");
    if (settings) branding = { ...branding, ...settings };
  } catch (err) {
    // keep defaults
  }

  // Output path
  const pdfDir = path.join(__dirname, "../public/uploads/invoices/pdfs");
  fs.mkdirSync(pdfDir, { recursive: true });
  const filename = `${invoice.invoice_number || "invoice"}-${Date.now()}.pdf`;
  const filepath = path.join(pdfDir, filename);
  const writeStream = fs.createWriteStream(filepath);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(writeStream);

  // Load and register custom fonts uploaded via admin
  const customFonts = {};
  try {
    const fonts = await db.all(
      "SELECT family, weight, file_path FROM invoice_fonts ORDER BY family, weight"
    );
    for (const f of fonts) {
      const family = (f.family || "").trim();
      if (!family || !f.file_path) continue;
      const absPath = path.join(
        __dirname,
        "../public",
        (f.file_path || "").replace(/^\/+/, "")
      );
      try {
        const regName = `${family}__${f.weight === "bold" ? "Bold" : "Normal"}`;
        doc.registerFont(regName, absPath);
        if (!customFonts[family]) customFonts[family] = {};
        if (f.weight === "bold") customFonts[family].bold = regName;
        else customFonts[family].normal = regName;
      } catch (e) {
        // ignore invalid font file
      }
    }
  } catch (e) {
    // ignore
  }

  // Helpers
  const defaultFont = (template && template.default_font_family) || "Helvetica";
  const getFontName = (family, weight) => {
    const fam = (family || "Helvetica").trim();
    const isBold = weight === "bold" || weight === 700 || weight === "700";
    if (customFonts[fam]) {
      // prefer exact weight, fallback to other available
      if (isBold && customFonts[fam].bold) return customFonts[fam].bold;
      if (!isBold && customFonts[fam].normal) return customFonts[fam].normal;
      return customFonts[fam].bold || customFonts[fam].normal;
    }
    if (fam === "Times-Roman" || fam.toLowerCase().includes("times")) {
      return isBold ? "Times-Bold" : "Times-Roman";
    }
    if (fam === "Courier" || fam.toLowerCase().includes("courier")) {
      return isBold ? "Courier-Bold" : "Courier";
    }
    return isBold ? "Helvetica-Bold" : "Helvetica";
  };
  const cleanContent = (text) =>
    (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();

  const renderTextBlock = (el, x, y, width) => {
    const content = cleanContent(el.content);
    const fontFamily = el.font_family && el.font_family !== "inherit" ? el.font_family : defaultFont;
    const fontName = getFontName(fontFamily, el.font_weight);
    const textAlignH = el.text_align_h || "left";
    const textAlignV = el.text_align_v || "top";
    
    doc
      .font(fontName)
      .fontSize(parseInt(el.font_size, 10) || 12)
      .fillColor(el.font_color || "#000000")
      .text(content, x, y, { width: width - 10, align: textAlignH });
    
    const textHeight = doc.heightOfString(content, { width: width - 10 });
    return y + textHeight + 10;
  };

  const renderImageBlock = (el, x, y, width) => {
    const relPath = (el.image_path || "").replace(/^\/+/, "");
    const imagePath = path.join(__dirname, "../public", relPath);
    if (el.image_path && fs.existsSync(imagePath)) {
      try {
        const imgWidth = Math.min(width - 10, parseInt(el.image_width, 10) || 150);
        const imgHeight = parseInt(el.image_height, 10) || 0;
        const options = { width: imgWidth };
        if (imgHeight > 0) options.height = imgHeight;
        doc.image(imagePath, x, y, options);
        const actualHeight = imgHeight > 0 ? imgHeight : imgWidth;
        return y + actualHeight + 10;
      } catch (err) {
        console.error("Error adding template image:", err);
      }
    }
    return y;
  };

  // Layout grouping
  const availableWidth = doc.page.width - 100;
  const colWidth = availableWidth / 3;
  const colX = [50, 50 + colWidth, 50 + colWidth * 2];
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

  // Auto insert branding logo if missing in top-left
  if (branding.logo_path && topCols[0].length === 0) {
    topCols[0].unshift({
      element_type: "image",
      image_path: branding.logo_path,
      image_width: 150,
      image_height: 0,
      image_align: "left",
    });
  }

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
  const renderColumn = (elements, x, yStart) => {
    let y = yStart;
    elements.forEach((el) => {
      if (el.image_path) y = renderImageBlock(el, x, y, colWidth);
      else if (el.content) y = renderTextBlock(el, x, y, colWidth);
    });
    return y;
  };

  const topStartY = 50;
  const topY = [topStartY, topStartY, topStartY];
  topY[0] = renderColumn(topCols[0], colX[0], topY[0]);
  topY[1] = renderColumn(topCols[1], colX[1], topY[1]);
  topY[2] = renderColumn(topCols[2], colX[2], topY[2]);
  const afterTopY = Math.max(...topY) + 20;

  // Address defaults
  if (
    addrCols[0].length === 0 &&
    (invoice.customer_name || invoice.customer_address)
  ) {
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
    const senderContent = [branding?.company_name, branding?.tagline]
      .filter(Boolean)
      .join("\n");
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

  const renderAddrCol = (elements, x, yStart) => {
    let y = yStart;
    elements.forEach((el) => {
      if (el.image_path) y = renderImageBlock(el, x, y, colWidth);
      else if (el.content) y = renderTextBlock(el, x, y, colWidth);
    });
    return y;
  };

  addrY[0] = renderAddrCol(addrCols[0], colX[0], addrY[0]);
  addrY[1] = renderAddrCol(addrCols[1], colX[1], addrY[1]);
  addrY[2] = renderAddrCol(addrCols[2], colX[2], addrY[2]);

  let yPosition = Math.max(...addrY) + 30;

  // Render remaining template elements
  templateElements.forEach((element) => {
    if (
      element.element_type === "title" ||
      element.element_type === "sender" ||
      element.element_type.startsWith("top_") ||
      element.element_type.startsWith("address_")
    ) {
      return;
    }

    if (element.element_type === "text" && element.content) {
      const fontFamily =
        element.font_family && element.font_family !== "inherit"
          ? element.font_family
          : defaultFont;
      const textAlignH = element.text_align_h || "left";
      const textAlignV = element.text_align_v || "top";
      doc
        .fontSize(parseInt(element.font_size, 10) || 12)
        .fillColor(element.font_color || "#000000")
        .font(getFontName(fontFamily, element.font_weight))
        .text(element.content, 50, yPosition, { width: doc.page.width - 100, align: textAlignH });
      yPosition += (parseInt(element.font_size, 10) || 12) + 10;
    } else if (element.element_type === "image" && element.image_path) {
      const relPath = (element.image_path || "").replace(/^\/+/, "");
      const imagePath = path.join(__dirname, "../public", relPath);
      if (fs.existsSync(imagePath)) {
        try {
          const imgWidth = parseInt(element.image_width, 10) || 150;
          const imgHeight = parseInt(element.image_height, 10) || 0;
          const margin = 50;
          const pageWidth = doc.page.width;
          let x = margin;

          if (element.image_align === "center") {
            x = Math.max(margin, (pageWidth - imgWidth) / 2);
          } else if (element.image_align === "right") {
            x = pageWidth - margin - imgWidth;
          }

          const options = { width: imgWidth };
          if (imgHeight > 0) options.height = imgHeight;
          doc.image(imagePath, x, yPosition, options);
          const actualHeight = imgHeight > 0 ? imgHeight : imgWidth;
          yPosition += actualHeight + 10;
        } catch (err) {
          console.error("Error adding template image:", err);
        }
      }
    }
  });

  // Line items table with branding styling (#0080ff)
  yPosition += 20;
  const tableTop = yPosition;
  const tableLeft = 50;
  const tableWidth = doc.page.width - 100;

  const tableColors = {
    headerBg: template?.table_header_bg || branding.primary_color || "#0080ff",
    headerText: template?.table_header_text || "#ffffff",
    rowBg1: template?.table_row_bg1 || "#f4f8ff",
    rowBg2: template?.table_row_bg2 || "#e7f2ff",
    text: template?.table_text_color || "#000000",
    border: template?.table_border_color || "#c7ddff",
  };

  const col1 = 0; // Omschrijving
  const col2 = 0.2; // Datum
  const col3 = 0.32; // KM
  const col4 = 0.42; // Uren
  const col5 = 0.52; // Tarief
  const col6 = 0.65; // Aantal
  const col7 = 0.75; // Prijs
  const col8 = 0.88; // Totaal

  const headerHeight = 18;
  doc
    .save()
    .rect(tableLeft, tableTop, tableWidth, headerHeight)
    .fill(tableColors.headerBg)
    .restore();

  doc.fontSize(9).fillColor(tableColors.headerText).font(getFontName(defaultFont, "bold"));
  const headerY = tableTop + 4;
  doc.text("Omschrijving", tableLeft + tableWidth * col1, headerY, {
    width: tableWidth * 0.18,
  });
  doc.text("Datum", tableLeft + tableWidth * col2, headerY, {
    width: tableWidth * 0.1,
    align: "center",
  });
  doc.text("KM", tableLeft + tableWidth * col3, headerY, {
    width: tableWidth * 0.08,
    align: "right",
  });
  doc.text("Uren", tableLeft + tableWidth * col4, headerY, {
    width: tableWidth * 0.08,
    align: "right",
  });
  doc.text("Tarief", tableLeft + tableWidth * col5, headerY, {
    width: tableWidth * 0.11,
    align: "right",
  });
  doc.text("Aantal", tableLeft + tableWidth * col6, headerY, {
    width: tableWidth * 0.08,
    align: "right",
  });
  doc.text("Prijs", tableLeft + tableWidth * col7, headerY, {
    width: tableWidth * 0.11,
    align: "right",
  });
  doc.text("Totaal", tableLeft + tableWidth * col8, headerY, {
    width: tableWidth * 0.12,
    align: "right",
  });

  yPosition = tableTop + headerHeight;
  doc
    .save()
    .moveTo(tableLeft, yPosition)
    .lineTo(tableLeft + tableWidth, yPosition)
    .lineWidth(0.5)
    .strokeColor(tableColors.border)
    .stroke()
    .restore();
  yPosition += 4;

  doc.font(getFontName(defaultFont, "normal")).fontSize(9).fillColor(tableColors.text);
  lineItems.forEach((item, idx) => {
    const itemHeight = Math.max(
      doc.heightOfString(item.description || "", { width: tableWidth * 0.18 }),
      15
    );
    const rowPadding = 4;
    const rowHeight = itemHeight + rowPadding * 2;
    const rowY = yPosition;

    const rowBg = idx % 2 === 0 ? tableColors.rowBg1 : tableColors.rowBg2;
    doc.save().rect(tableLeft, rowY, tableWidth, rowHeight).fill(rowBg).restore();

    if (item.is_total_row) {
      doc.font(getFontName(defaultFont, "bold"));
    } else {
      doc.font(getFontName(defaultFont, "normal"));
    }

    const textY = rowY + rowPadding;
    doc.text(item.description || "", tableLeft + tableWidth * col1, textY, {
      width: tableWidth * 0.18,
    });

    if (item.item_date) {
      const dateStr = new Date(item.item_date).toLocaleDateString("nl-NL");
      doc.text(dateStr, tableLeft + tableWidth * col2, textY, {
        width: tableWidth * 0.1,
        align: "center",
      });
    }

    if (item.item_km !== null && item.item_km !== undefined) {
      doc.text(Number(item.item_km).toFixed(2), tableLeft + tableWidth * col3, textY, {
        width: tableWidth * 0.08,
        align: "right",
      });
    }

    if (item.item_hours !== null && item.item_hours !== undefined) {
      doc.text(Number(item.item_hours).toFixed(2), tableLeft + tableWidth * col4, textY, {
        width: tableWidth * 0.08,
        align: "right",
      });
    }

    if (item.item_rate !== null && item.item_rate !== undefined) {
      const isDotPercent =
        item.total_row_type === "dot_total" &&
        (item.item_km === null || item.item_km === undefined);
      const rateLabel = isDotPercent
        ? `${parseFloat(item.item_rate).toFixed(2)}%`
        : Number(item.item_rate).toFixed(2);

      doc.text(rateLabel, tableLeft + tableWidth * col5, textY, {
        width: tableWidth * 0.11,
        align: "right",
      });
    }

    if (item.quantity !== null && item.quantity !== undefined) {
      doc.text(Number(item.quantity).toFixed(2), tableLeft + tableWidth * col6, textY, {
        width: tableWidth * 0.08,
        align: "right",
      });
    }

    if (item.unit_price !== null && item.unit_price !== undefined) {
      doc.text(Number(item.unit_price).toFixed(2), tableLeft + tableWidth * col7, textY, {
        width: tableWidth * 0.11,
        align: "right",
      });
    }

    if (item.line_total !== null && item.line_total !== undefined) {
      doc.text(Number(item.line_total).toFixed(2), tableLeft + tableWidth * col8, textY, {
        width: tableWidth * 0.12,
        align: "right",
      });
    }

    yPosition += rowHeight;
  });

  yPosition += 10;
  doc
    .moveTo(tableLeft, yPosition)
    .lineTo(tableLeft + tableWidth, yPosition)
    .strokeColor(tableColors.border)
    .stroke();
  yPosition += 15;

  // Totals
  const totalsLeft = tableLeft + tableWidth * 0.65;

  doc.font(getFontName(defaultFont, "normal")).fillColor("#000000");
  doc.text("Subtotaal:", totalsLeft, yPosition);
  doc.text(Number(invoice.subtotal).toFixed(2), tableLeft + tableWidth * 0.8, yPosition, {
    width: tableWidth * 0.2,
    align: "right",
  });
  yPosition += 20;

  doc.text("BTW (21%):", totalsLeft, yPosition);
  doc.text(Number(invoice.vat_amount).toFixed(2), tableLeft + tableWidth * 0.8, yPosition, {
    width: tableWidth * 0.2,
    align: "right",
  });
  yPosition += 20;

  doc.font(getFontName(defaultFont, "bold")).fontSize(12);
  doc.text("Totaal:", totalsLeft, yPosition);
  doc.text(Number(invoice.total_amount).toFixed(2), tableLeft + tableWidth * 0.8, yPosition, {
    width: tableWidth * 0.2,
    align: "right",
  });

  // Notes
  if (invoice.notes) {
    yPosition += 40;
    doc
      .font(getFontName(defaultFont, "normal"))
      .fontSize(10)
      .fillColor("#666666")
      .text("Opmerkingen:", 50, yPosition);
    yPosition += 15;
    doc.text(invoice.notes, 50, yPosition, { width: tableWidth });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  return {
    filename,
    path: `/uploads/invoices/pdfs/${filename}`,
    fullPath: filepath,
  };
}

module.exports = {
  generateInvoicePDF,
};
