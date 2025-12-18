const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authMiddleware: auth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { generateInvoicePDF } = require("../utils/invoice-pdf");
const { sendInvoiceEmail } = require("../utils/email");
const pdfParse = require("pdf-parse");

// Configure multer for invoice image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../public/uploads/invoices");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "invoice-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error("Alleen afbeeldingen zijn toegestaan (jpeg, jpg, png, gif)")
      );
    }
  },
});

// Separate storage for PDF imports
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(
      __dirname,
      "../public/uploads/invoices/imports"
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "import-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const isPdf =
      path.extname(file.originalname).toLowerCase() === ".pdf" ||
      file.mimetype === "application/pdf";
    if (isPdf) cb(null, true);
    else cb(new Error("Alleen PDF-bestanden zijn toegestaan"));
  },
});

// ============================================
// IMPORT TEMPLATES (PDF Parser Templates)
// ============================================

// Get all import templates
router.get("/import-templates", auth, async (req, res) => {
  try {
    const templates = await db.all(
      "SELECT * FROM import_templates WHERE is_active = 1 ORDER BY name ASC"
    );
    res.json(templates);
  } catch (error) {
    console.error("Error fetching import templates:", error);
    res.status(500).json({ error: "Fout bij ophalen van import templates" });
  }
});

// Create import template
router.post("/import-templates", auth, async (req, res) => {
  try {
    const { name, description, parser_type, config } = req.body;

    if (!name || !parser_type) {
      return res
        .status(400)
        .json({ error: "Naam en parser type zijn verplicht" });
    }

    const result = await db.run(
      `INSERT INTO import_templates (name, description, parser_type, config) VALUES (?, ?, ?, ?)`,
      [name, description || null, parser_type, JSON.stringify(config || {})]
    );

    const newTemplate = await db.get(
      "SELECT * FROM import_templates WHERE id = ?",
      [result.id]
    );

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating import template:", error);
    res.status(500).json({ error: "Fout bij aanmaken import template" });
  }
});

// ============================================
// INVOICE TEMPLATES
// ============================================

// Get all invoice templates
router.get("/templates", auth, async (req, res) => {
  try {
    const templates = await db.all(
      "SELECT * FROM invoice_templates ORDER BY is_default DESC, name ASC"
    );
    res.json(templates);
  } catch (error) {
    console.error("Error fetching invoice templates:", error);
    res.status(500).json({ error: "Fout bij ophalen van factuur templates" });
  }
});

// Get single template with elements
router.get("/templates/:id", auth, async (req, res) => {
  try {
    const template = await db.get(
      "SELECT * FROM invoice_templates WHERE id = ?",
      [req.params.id]
    );

    if (!template) {
      return res.status(404).json({ error: "Template niet gevonden" });
    }

    const elements = await db.all(
      "SELECT * FROM invoice_template_elements WHERE template_id = ? ORDER BY position_order ASC",
      [req.params.id]
    );

    res.json({ ...template, elements });
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Fout bij ophalen van template" });
  }
});

// Create new template
router.post("/templates", auth, async (req, res) => {
  try {
    const { name, description, is_default, hourly_rate, km_rate, dot_rate, dot_rate_is_percent } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await db.run("UPDATE invoice_templates SET is_default = 0");
    }

    const result = await db.run(
      "INSERT INTO invoice_templates (name, description, is_default, hourly_rate, km_rate, dot_rate, dot_rate_is_percent) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        description || null,
        is_default ? 1 : 0,
        hourly_rate || 0,
        km_rate || 0,
        dot_rate || 0,
        dot_rate_is_percent ? 1 : 0,
      ]
    );

    const newTemplate = await db.get(
      "SELECT * FROM invoice_templates WHERE id = ?",
      [result.id]
    );

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Fout bij aanmaken van template" });
  }
});

// Update template
router.put("/templates/:id", auth, async (req, res) => {
  try {
    const { name, description, is_default, hourly_rate, km_rate, dot_rate, dot_rate_is_percent } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await db.run(
        "UPDATE invoice_templates SET is_default = 0 WHERE id != ?",
        [req.params.id]
      );
    }

    await db.run(
      "UPDATE invoice_templates SET name = ?, description = ?, is_default = ?, hourly_rate = ?, km_rate = ?, dot_rate = ?, dot_rate_is_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [
        name,
        description || null,
        is_default ? 1 : 0,
        hourly_rate || 0,
        km_rate || 0,
        dot_rate || 0,
        dot_rate_is_percent ? 1 : 0,
        req.params.id,
      ]
    );

    const updated = await db.get(
      "SELECT * FROM invoice_templates WHERE id = ?",
      [req.params.id]
    );

    res.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Fout bij bijwerken van template" });
  }
});

// Delete template
router.delete("/templates/:id", auth, async (req, res) => {
  try {
    // Check if template has invoices
    const invoiceCount = await db.get(
      "SELECT COUNT(*) as count FROM invoices WHERE template_id = ?",
      [req.params.id]
    );

    if (invoiceCount.count > 0) {
      return res.status(400).json({
        error:
          "Template kan niet worden verwijderd omdat er facturen aan gekoppeld zijn",
      });
    }

    // Delete associated images
    const elements = await db.all(
      'SELECT image_path FROM invoice_template_elements WHERE template_id = ? AND element_type = "image"',
      [req.params.id]
    );

    elements.forEach((el) => {
      if (el.image_path) {
        const imagePath = path.join(__dirname, "../public", el.image_path);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    });

    await db.run("DELETE FROM invoice_templates WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Template verwijderd" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Fout bij verwijderen van template" });
  }
});

// ============================================
// TEMPLATE ELEMENTS
// ============================================

// Add element to template
router.post(
  "/templates/:templateId/elements",
  auth,
  upload.single("image"),
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const {
        element_type,
        label,
        content,
        position_order,
        font_size,
        font_color,
        font_weight,
        calculation_formula,
      } = req.body;

      let image_path = null;
      if (req.file) {
        image_path = "/uploads/invoices/" + req.file.filename;
      }

      const result = await db.run(
        `INSERT INTO invoice_template_elements 
       (template_id, element_type, label, content, image_path, position_order, 
        font_size, font_color, font_weight, calculation_formula) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          templateId,
          element_type,
          label || null,
          content || null,
          image_path,
          position_order || 0,
          font_size || 14,
          font_color || "#000000",
          font_weight || "normal",
          calculation_formula || null,
        ]
      );

      const newElement = await db.get(
        "SELECT * FROM invoice_template_elements WHERE id = ?",
        [result.id]
      );

      res.status(201).json(newElement);
    } catch (error) {
      console.error("Error adding element:", error);
      res.status(500).json({ error: "Fout bij toevoegen van element" });
    }
  }
);

// Update element
router.put(
  "/templates/:templateId/elements/:elementId",
  auth,
  upload.single("image"),
  async (req, res) => {
    try {
      const { elementId } = req.params;
      const {
        label,
        content,
        position_order,
        font_size,
        font_color,
        font_weight,
        calculation_formula,
      } = req.body;

      // Get current element
      const currentElement = await db.get(
        "SELECT * FROM invoice_template_elements WHERE id = ?",
        [elementId]
      );

      if (!currentElement) {
        return res.status(404).json({ error: "Element niet gevonden" });
      }

      let image_path = currentElement.image_path;

      // If new image uploaded, delete old one and use new one
      if (req.file) {
        if (currentElement.image_path) {
          const oldImagePath = path.join(
            __dirname,
            "../public",
            currentElement.image_path
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        image_path = "/uploads/invoices/" + req.file.filename;
      }

      await db.run(
        `UPDATE invoice_template_elements 
       SET label = ?, content = ?, image_path = ?, position_order = ?, 
           font_size = ?, font_color = ?, font_weight = ?, calculation_formula = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
        [
          label || null,
          content || null,
          image_path,
          position_order || 0,
          font_size || 14,
          font_color || "#000000",
          font_weight || "normal",
          calculation_formula || null,
          elementId,
        ]
      );

      const updated = await db.get(
        "SELECT * FROM invoice_template_elements WHERE id = ?",
        [elementId]
      );

      res.json(updated);
    } catch (error) {
      console.error("Error updating element:", error);
      res.status(500).json({ error: "Fout bij bijwerken van element" });
    }
  }
);

// Delete element
router.delete(
  "/templates/:templateId/elements/:elementId",
  auth,
  async (req, res) => {
    try {
      const { elementId } = req.params;

      // Get element to check for image
      const element = await db.get(
        "SELECT image_path FROM invoice_template_elements WHERE id = ?",
        [elementId]
      );

      if (element && element.image_path) {
        const imagePath = path.join(__dirname, "../public", element.image_path);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      await db.run("DELETE FROM invoice_template_elements WHERE id = ?", [
        elementId,
      ]);
      res.json({ success: true, message: "Element verwijderd" });
    } catch (error) {
      console.error("Error deleting element:", error);
      res.status(500).json({ error: "Fout bij verwijderen van element" });
    }
  }
);

// ============================================
// TEMPLATE LINE ITEM FIELDS
// ============================================

// Get line item field config for template
router.get("/templates/:templateId/line-fields", auth, async (req, res) => {
  try {
    const fields = await db.all(
      "SELECT * FROM invoice_template_line_fields WHERE template_id = ? ORDER BY position_order ASC",
      [req.params.templateId]
    );
    res.json(fields);
  } catch (error) {
    console.error("Error fetching line fields:", error);
    res.status(500).json({ error: "Fout bij ophalen van regelvelden" });
  }
});

// Update line item field visibility
router.put(
  "/templates/:templateId/line-fields/:fieldName",
  auth,
  async (req, res) => {
    try {
      const { templateId, fieldName } = req.params;
      const { is_visible, field_label, position_order } = req.body;

      await db.run(
        `INSERT OR REPLACE INTO invoice_template_line_fields 
       (template_id, field_name, field_label, is_visible, position_order)
       VALUES (?, ?, ?, ?, ?)`,
        [
          templateId,
          fieldName,
          field_label || fieldName,
          is_visible ? 1 : 0,
          position_order || 0,
        ]
      );

      const updated = await db.get(
        "SELECT * FROM invoice_template_line_fields WHERE template_id = ? AND field_name = ?",
        [templateId, fieldName]
      );

      res.json(updated);
    } catch (error) {
      console.error("Error updating line field:", error);
      res.status(500).json({ error: "Fout bij bijwerken van regelveld" });
    }
  }
);

// ============================================
// INVOICES
// ============================================

// Get all invoices
router.get("/invoices", auth, async (req, res) => {
  try {
    const invoices = await db.all(
      `SELECT i.*, t.name as template_name, u.full_name as creator_name
       FROM invoices i
       LEFT JOIN invoice_templates t ON i.template_id = t.id
       LEFT JOIN users u ON i.created_by = u.id
       ORDER BY i.created_at DESC`
    );
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Fout bij ophalen van facturen" });
  }
});

// Generate next invoice number (MUST BE BEFORE /invoices/:id)
router.get("/invoices/next-number", auth, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const lastInvoice = await db.get(
      `SELECT invoice_number FROM invoices 
       WHERE invoice_number LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${currentYear}-%`]
    );

    let nextNumber = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoice_number.split("-");
      if (parts.length === 2) {
        nextNumber = parseInt(parts[1]) + 1;
      }
    }

    const invoiceNumber = `${currentYear}-${String(nextNumber).padStart(
      4,
      "0"
    )}`;
    res.json({ invoice_number: invoiceNumber });
  } catch (error) {
    console.error("Error generating invoice number:", error);
    res.status(500).json({ error: "Fout bij genereren van factuurnummer" });
  }
});

// Get single invoice with line items
router.get("/invoices/:id", auth, async (req, res) => {
  try {
    const invoice = await db.get(
      `SELECT i.*, t.name as template_name
       FROM invoices i
       LEFT JOIN invoice_templates t ON i.template_id = t.id
       WHERE i.id = ?`,
      [req.params.id]
    );

    if (!invoice) {
      return res.status(404).json({ error: "Factuur niet gevonden" });
    }

    const lineItems = await db.all(
      "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY position_order ASC",
      [req.params.id]
    );

    res.json({ ...invoice, line_items: lineItems });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Fout bij ophalen van factuur" });
  }
});

// Create new invoice from template
router.post("/invoices", auth, async (req, res) => {
  try {
    const {
      template_id,
      invoice_number,
      customer_name,
      customer_address,
      invoice_date,
      due_date,
      line_items,
      notes,
    } = req.body;

    console.log("[POST /invoices] Received line_items:", JSON.stringify(line_items, null, 2));

    // Calculate totals
    let subtotal = 0;
    if (line_items && Array.isArray(line_items)) {
      subtotal = line_items.reduce((sum, item) => {
        return (
          sum +
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)
        );
      }, 0);
    }

    const vat_amount = subtotal * 0.21; // 21% BTW
    const total_amount = subtotal + vat_amount;

    // Create invoice
    const result = await db.run(
      `INSERT INTO invoices 
       (template_id, invoice_number, customer_name, customer_address, 
        invoice_date, due_date, subtotal, vat_amount, total_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        template_id,
        invoice_number,
        customer_name || null,
        customer_address || null,
        invoice_date,
        due_date || null,
        subtotal.toFixed(2),
        vat_amount.toFixed(2),
        total_amount.toFixed(2),
        notes || null,
        req.user.id,
      ]
    );

    const invoiceId = result.id;

    // Add line items
    let totalKm = 0;
    if (line_items && Array.isArray(line_items)) {
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const line_total =
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);

        console.log(`[Invoice ${invoiceId}] Saving line item ${i+1}:`, {
          description: item.description,
          item_date: item.item_date,
          item_km: item.item_km,
          item_hours: item.item_hours,
          item_rate: item.item_rate,
        });

        // Sum up kilometers for total
        if (item.item_km) {
          totalKm += parseFloat(item.item_km);
        }

        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, position_order, item_date, item_km, item_hours, item_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            item.description,
            item.quantity || 1,
            item.unit_price || 0,
            line_total.toFixed(2),
            i,
            item.item_date || null,
            item.item_km || null,
            item.item_hours || null,
            item.item_rate || null,
          ]
        );
      }

      // Get template to fetch km_rate and dot_rate (including percent flag)
      const template = await db.get(
        "SELECT km_rate, dot_rate, dot_rate_is_percent FROM invoice_templates WHERE id = ?",
        [template_id]
      );

      let totalLinesAmount = 0;
      let nextPosition = line_items.length;

      // Add total kilometers line if there are any kilometers and km_rate is set
      if (totalKm > 0 && template && template.km_rate) {
        const kmRate = parseFloat(template.km_rate);
        const kmLineTotal = totalKm * kmRate;

          await db.run(
            `INSERT INTO invoice_line_items 
             (invoice_id, description, quantity, unit_price, line_total, position_order, item_km, item_rate, is_total_row, total_row_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invoiceId,
              "Totaal Kilometers",
              1,
              kmLineTotal.toFixed(2),
              kmLineTotal.toFixed(2),
              nextPosition,
              totalKm,
              kmRate, // Add km_rate to item_rate column
              1, // Mark as total row
              "km_total",
            ]
          );        console.log(`[Invoice ${invoiceId}] Added KM total line: ${totalKm} km × €${kmRate} = €${kmLineTotal.toFixed(2)}`);

        totalLinesAmount += kmLineTotal;
        nextPosition++;
      }

      // Add total DOT line. If percentage flag is set, use subtotal; otherwise use kilometers.
      if (template && template.dot_rate) {
        const dotRate = parseFloat(template.dot_rate);
        const isPercent = Number(template.dot_rate_is_percent) === 1;

        let dotLineTotal = 0;
        let dotDescription = "Totaal DOT";
        let dotItemKm = totalKm;

        if (isPercent) {
          dotLineTotal = subtotal * (dotRate / 100);
          dotDescription = "Tarief DOT";
          dotItemKm = null; // percentage is based on subtotal, not km
        } else if (totalKm > 0) {
          dotLineTotal = totalKm * dotRate;
        }

        if (dotLineTotal > 0) {
            await db.run(
              `INSERT INTO invoice_line_items 
               (invoice_id, description, quantity, unit_price, line_total, position_order, item_km, item_rate, is_total_row, total_row_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                invoiceId,
                dotDescription,
                1,
                dotLineTotal.toFixed(2),
                dotLineTotal.toFixed(2),
                nextPosition,
                dotItemKm,
                dotRate,
                1,
                "dot_total",
              ]
            );        console.log(`[Invoice ${invoiceId}] Added DOT total line (${isPercent ? "percentage" : "per km"}): value €${dotLineTotal.toFixed(2)}`);

          totalLinesAmount += dotLineTotal;
        }
      }

      // Recalculate totals including all total lines
      if (totalLinesAmount > 0) {
        const newSubtotal = subtotal + totalLinesAmount;
        const newVatAmount = newSubtotal * 0.21;
        const newTotalAmount = newSubtotal + newVatAmount;

        await db.run(
          `UPDATE invoices 
           SET subtotal = ?, vat_amount = ?, total_amount = ?
           WHERE id = ?`,
          [
            newSubtotal.toFixed(2),
            newVatAmount.toFixed(2),
            newTotalAmount.toFixed(2),
            invoiceId,
          ]
        );
      }
    }

    const newInvoice = await db.get("SELECT * FROM invoices WHERE id = ?", [
      invoiceId,
    ]);

    res.status(201).json(newInvoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res
      .status(500)
      .json({ error: "Fout bij aanmaken van factuur: " + error.message });
  }
});

// Update invoice
router.put("/invoices/:id", auth, async (req, res) => {
  try {
    const {
      customer_name,
      customer_address,
      invoice_date,
      due_date,
      status,
      notes,
      line_items,
    } = req.body;

    // Recalculate totals if line items provided
    let subtotal = 0;
    if (line_items && Array.isArray(line_items)) {
      subtotal = line_items.reduce((sum, item) => {
        return (
          sum +
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0)
        );
      }, 0);
    } else {
      // Get existing line items
      const existing = await db.all(
        "SELECT * FROM invoice_line_items WHERE invoice_id = ?",
        [req.params.id]
      );
      subtotal = existing.reduce(
        (sum, item) => sum + parseFloat(item.line_total || 0),
        0
      );
    }

    const vat_amount = subtotal * 0.21;
    const total_amount = subtotal + vat_amount;

    // Update invoice
    await db.run(
      `UPDATE invoices 
       SET customer_name = ?, customer_address = ?, invoice_date = ?, due_date = ?,
           subtotal = ?, vat_amount = ?, total_amount = ?, status = ?, notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        customer_name,
        customer_address,
        invoice_date,
        due_date,
        subtotal.toFixed(2),
        vat_amount.toFixed(2),
        total_amount.toFixed(2),
        status || "draft",
        notes,
        req.params.id,
      ]
    );

    // Update line items if provided
    if (line_items && Array.isArray(line_items)) {
      // Delete existing line items
      await db.run("DELETE FROM invoice_line_items WHERE invoice_id = ?", [
        req.params.id,
      ]);

      // Add new line items and calculate total km
      let totalKm = 0;
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const line_total =
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);

        // Sum up kilometers
        if (item.item_km) {
          totalKm += parseFloat(item.item_km);
        }

        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, position_order, item_date, item_km, item_hours, item_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
            item.description,
            item.quantity || 1,
            item.unit_price || 0,
            line_total.toFixed(2),
            i,
            item.item_date || null,
            item.item_km || null,
            item.item_hours || null,
            item.item_rate || null,
          ]
        );
      }

      // Get invoice to find template_id
      const invoice = await db.get(
        "SELECT template_id FROM invoices WHERE id = ?",
        [req.params.id]
      );

      if (invoice && invoice.template_id) {
        // Get template to fetch km_rate and dot_rate (including percent flag)
        const template = await db.get(
          "SELECT km_rate, dot_rate, dot_rate_is_percent FROM invoice_templates WHERE id = ?",
          [invoice.template_id]
        );

        let totalLinesAmount = 0;
        let nextPosition = line_items.length;

        // Add total kilometers line if there are any kilometers and km_rate is set
        if (totalKm > 0 && template && template.km_rate) {
          const kmRate = parseFloat(template.km_rate);
          const kmLineTotal = totalKm * kmRate;

          await db.run(
            `INSERT INTO invoice_line_items 
             (invoice_id, description, quantity, unit_price, line_total, position_order, item_km, item_rate, is_total_row, total_row_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.params.id,
              "Totaal Kilometers",
              1,
              kmLineTotal.toFixed(2),
              kmLineTotal.toFixed(2),
              nextPosition,
              totalKm,
              kmRate, // Add km_rate to item_rate column
              1,
              "km_total",
            ]
          );

          console.log(`[Invoice ${req.params.id}] Added KM total line: ${totalKm} km × €${kmRate} = €${kmLineTotal.toFixed(2)}`);

          totalLinesAmount += kmLineTotal;
          nextPosition++;
        }

        // Add total DOT line. If percentage flag is set, use subtotal; otherwise use kilometers.
        if (template && template.dot_rate) {
          const dotRate = parseFloat(template.dot_rate);
          const isPercent = Number(template.dot_rate_is_percent) === 1;

          let dotLineTotal = 0;
          let dotDescription = "Totaal DOT";
          let dotItemKm = totalKm;

          if (isPercent) {
            dotLineTotal = subtotal * (dotRate / 100);
            dotDescription = "Tarief DOT";
            dotItemKm = null;
          } else if (totalKm > 0) {
            dotLineTotal = totalKm * dotRate;
          }

          if (dotLineTotal > 0) {
            await db.run(
              `INSERT INTO invoice_line_items 
               (invoice_id, description, quantity, unit_price, line_total, position_order, item_km, item_rate, is_total_row, total_row_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                req.params.id,
                dotDescription,
                1,
                dotLineTotal.toFixed(2),
                dotLineTotal.toFixed(2),
                nextPosition,
                dotItemKm,
                dotRate,
                1,
                "dot_total",
              ]
            );

            console.log(
              `[Invoice ${req.params.id}] Added DOT total line (${isPercent ? "percentage" : "per km"}): value €${dotLineTotal.toFixed(2)}`
            );

            totalLinesAmount += dotLineTotal;
          }
        }

        // Recalculate totals including all total lines
        if (totalLinesAmount > 0) {
          const newSubtotal = subtotal + totalLinesAmount;
          const newVatAmount = newSubtotal * 0.21;
          const newTotalAmount = newSubtotal + newVatAmount;

          await db.run(
            `UPDATE invoices 
             SET subtotal = ?, vat_amount = ?, total_amount = ?
             WHERE id = ?`,
            [
              newSubtotal.toFixed(2),
              newVatAmount.toFixed(2),
              newTotalAmount.toFixed(2),
              req.params.id,
            ]
          );
        }
      }
    }

    const updated = await db.get("SELECT * FROM invoices WHERE id = ?", [
      req.params.id,
    ]);

    res.json(updated);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: "Fout bij bijwerken van factuur" });
  }
});

// Delete invoice
router.delete("/invoices/:id", auth, async (req, res) => {
  try {
    await db.run("DELETE FROM invoices WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Factuur verwijderd" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Fout bij verwijderen van factuur" });
  }
});

// Download original imported PDF
router.get("/invoices/:id/original-pdf", auth, async (req, res) => {
  try {
    const invoice = await db.get(
      "SELECT invoice_number, original_pdf_path FROM invoices WHERE id = ?",
      [req.params.id]
    );

    if (!invoice) {
      return res.status(404).json({ error: "Factuur niet gevonden" });
    }

    if (!invoice.original_pdf_path) {
      return res
        .status(404)
        .json({ error: "Geen originele PDF beschikbaar voor deze factuur" });
    }

    // Normalize path and strip any leading slash so path.join doesn't drop earlier segments
    const normalizedOriginalPath = invoice.original_pdf_path.replace(/^[/\\]+/, "");
    const pdfPath = path.join(__dirname, "..", "public", normalizedOriginalPath);

    if (!fs.existsSync(pdfPath)) {
      return res
        .status(404)
        .json({ error: "Originele PDF bestand niet gevonden" });
    }

    res.download(pdfPath, `${invoice.invoice_number}-origineel.pdf`);
  } catch (error) {
    console.error("Error downloading original PDF:", error);
    res.status(500).json({ error: "Fout bij downloaden originele PDF" });
  }
});

// ============================================
// PDF GENERATION
// ============================================

// Generate PDF for invoice
router.post("/invoices/:id/generate-pdf", auth, async (req, res) => {
  try {
    const pdfResult = await generateInvoicePDF(req.params.id);

    // Update invoice with PDF path
    await db.run(
      "UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.params.id]
    );

    res.json({
      success: true,
      message: "PDF succesvol gegenereerd",
      pdf_url: pdfResult.path,
      filename: pdfResult.filename,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res
      .status(500)
      .json({ error: "Fout bij genereren van PDF: " + error.message });
  }
});

// Download PDF
router.get("/invoices/:id/download-pdf", auth, async (req, res) => {
  try {
    const invoice = await db.get("SELECT * FROM invoices WHERE id = ?", [
      req.params.id,
    ]);

    if (!invoice) {
      return res.status(404).json({ error: "Factuur niet gevonden" });
    }

    // Generate PDF
    const pdfResult = await generateInvoicePDF(req.params.id);

    // Send file
    res.download(pdfResult.fullPath, pdfResult.filename);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).json({ error: "Fout bij downloaden van PDF" });
  }
});

// ============================================
// EMAIL
// ============================================

// Send invoice via email
router.post("/invoices/:id/send-email", auth, async (req, res) => {
  try {
    const { recipient_email, subject, message } = req.body;

    if (!recipient_email) {
      return res.status(400).json({ error: "E-mailadres is verplicht" });
    }

    const invoice = await db.get("SELECT * FROM invoices WHERE id = ?", [
      req.params.id,
    ]);

    if (!invoice) {
      return res.status(404).json({ error: "Factuur niet gevonden" });
    }

    // Generate PDF
    const pdfResult = await generateInvoicePDF(req.params.id);

    // Send email
    const emailSubject = subject || `Factuur ${invoice.invoice_number}`;
    const emailMessage =
      message ||
      `Beste,\n\nIn de bijlage vindt u factuur ${invoice.invoice_number}.\n\nMet vriendelijke groet`;

    await sendInvoiceEmail({
      to: recipient_email,
      subject: emailSubject,
      text: emailMessage,
      html: emailMessage.replace(/\n/g, "<br>"),
      attachments: [
        {
          filename: pdfResult.filename,
          path: pdfResult.fullPath,
        },
      ],
    });

    // Update invoice status to 'sent'
    await db.run(
      `UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      message: "Factuur succesvol verzonden naar " + recipient_email,
    });
  } catch (error) {
    console.error("Error sending invoice email:", error);
    res
      .status(500)
      .json({ error: "Fout bij verzenden van e-mail: " + error.message });
  }
});

module.exports = router;

// ============================================
// PDF IMPORT
// ============================================

// Helper: parse common EU currency formats to float
function parseEuroAmount(str) {
  if (!str) return NaN;
  let s = String(str).trim().replace(/[\s€]/g, "");
  s = s.replace(/[\u00A0]/g, ""); // non-breaking spaces
  // Detect decimal separator
  if (/[,]\d{2}\b/.test(s)) {
    // Decimal comma style (e.g., 4.846,41)
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (/[.]\d{2}\b/.test(s)) {
    // Decimal dot style (e.g., 4,846.41)
    s = s.replace(/,/g, "");
  } else {
    // No obvious decimals; strip thousand separators
    s = s.replace(/[\.,]/g, "");
  }
  const val = parseFloat(s);
  return Number.isFinite(val) ? val : NaN;
}

// Helper: extract fields from PDF text using heuristics
function extractInvoiceDataFromText(text) {
  // Normalize repeated separators like 08/12//2025
  const normalized = String(text)
    .replace(/\/{2,}/g, "/")
    .replace(/\-{2,}/g, "-");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = lines.join(" \n ").toLowerCase();

  // Date patterns: dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd
  const dateRegexes = [
    /(factuurdatum|datum|invoice date)\s*[:\-]?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i,
    /(factuurdatum|datum|invoice date)\s*[:\-]?\s*(\d{4}[\/-]\d{2}[\/-]\d{2})/i,
    /(\d{2}[\/-]\d{2}[\/-]\d{4})/,
    /(20\d{2}[\/-]\d{2}[\/-]\d{2})/, // Only match years starting with 20xx
  ];
  let invoice_date = null;
  for (const rx of dateRegexes) {
    const m = normalized.match(rx);
    if (m) {
      invoice_date = m[m.length - 1].replace(/\//g, "-");
      // Normalize to YYYY-MM-DD if given as DD-MM-YYYY
      const parts = invoice_date.split("-");
      if (parts[0].length === 2) {
        invoice_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      // Validate year is reasonable (between 2000 and 2100)
      const yearParts = invoice_date.split("-");
      const year = parseInt(yearParts[0]);
      if (year >= 2000 && year <= 2100) {
        break;
      } else {
        invoice_date = null; // Invalid year, try next pattern
      }
    }
  }

  // Customer name: look after Klant/Customer/Aan:
  let customer_name = null;
  const custDirect = normalized.match(
    /\bAAN:\s*(.+?)(?:\s*(Factuur|Factuurnummer|Week|\n))/i
  );
  if (custDirect && custDirect[1]) {
    customer_name = custDirect[1].trim();
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
  if (!customer_name) {
    // Fallback: take first non-empty line that looks like a company (has space and letters)
    const guess = lines.find((l) => /[A-Za-z].+\s+[A-Za-z]/.test(l));
    if (guess) customer_name = guess.substring(0, 80);
  }

  // Invoice number: match common patterns (Factuurnummer, Factuur nr, Invoice number)
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

  // Amounts: total and VAT
  let total_amount = NaN;
  let vat_amount = NaN;
  let subtotal = NaN;

  // Find total by keywords
  const totalLine = [...lines]
    .reverse()
    .find((l) =>
      /(totaal\s*incl\.?\s*btw|totaal\b|grand total|total)/i.test(l)
    );
  if (totalLine) {
    const ms = [...totalLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) total_amount = parseEuroAmount(pick);
  }

  // Find VAT line
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
  if (vatLine) {
    const ms = [...vatLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) vat_amount = parseEuroAmount(pick);
    // Try rate
    const rateMatch = vatLine.match(/(\d{1,2})\s*%/);
    var vat_rate = rateMatch ? parseInt(rateMatch[1], 10) / 100 : 0.21;
    if (!Number.isFinite(vat_amount) && Number.isFinite(total_amount)) {
      vat_amount = (total_amount * vat_rate) / (1 + vat_rate);
    }
  } else {
    // No VAT line; assume 21%
    const vat_rate = 0.21;
    if (Number.isFinite(total_amount)) {
      vat_amount = (total_amount * vat_rate) / (1 + vat_rate);
    }
  }

  // Subtotal: if a line mentions Subtotaal
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

  // If subtotal still NaN, derive from total and VAT
  if (
    !Number.isFinite(subtotal) &&
    Number.isFinite(total_amount) &&
    Number.isFinite(vat_amount)
  ) {
    subtotal = total_amount - vat_amount;
  }

  // Extract line items from table (Mainfreight format)
  // Expected: columns: Omschrijving, Datum, Aantal KM, Uren, Uurtarief, Bedrag excl. BTW
  let line_items = [];
  let totalKmFromPdf = null;
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

    tableLines.forEach((line) => {
      // Skip summary rows and lines with keywords (not header since we already skipped it with .slice(1))
      if (/totaal|tarief|excl|btw|missende/i.test(line)) return;

      // Mainfreight format: [10-digit-ID][DD]-[MM]-[YY][KM (3-4 digits)][HOURS with decimals]€ [rate]€ [bedrag]
      // Example: 1115464760 01-12-25 377 12.75€ 65.00€ 828.75
      const match = line.match(/(\d{10})(\d{2})-(\d{2})-(\d{2})/);
      if (!match) return;

      const [, invoiceId, d, m, y] = match;

      // Convert dates: DD-MM-YY -> YYYY-MM-DD
      const fullYear =
        parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y);
      const isoDate = `${fullYear}-${m}-${d}`;

      // Extract bedrag (line total) and rate from the € signs
      const euroParts = line.split("€");
      if (euroParts.length < 3) return;

      const rate = parseEuroAmount(euroParts[1]) || null;
      const bedrag = parseEuroAmount(euroParts[2]) || null;

      if (!Number.isFinite(bedrag) || !Number.isFinite(rate) || rate === 0)
        return;

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
      line_items.push(item);
    });
  }

  // Extract totals from PDF footer ("Totaal uren39.75€ 2,583.75")
  // The footer shows: "Totaal uren<hours>€ <bedrag>"
  const totalHoursLine = text.match(/Totaal\s*uren\s*([\d.,]+)/);
  if (totalHoursLine) {
    totalHoursFromPdf = parseFloat(totalHoursLine[1].replace(",", "."));
  }

  // Calculate total KM from line items (sum all item_km values)
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

// Helper: get default template id or create one if missing
async function getDefaultTemplateId() {
  const def = await db.get(
    "SELECT id FROM invoice_templates WHERE is_default = 1 LIMIT 1"
  );
  if (def?.id) return def.id;
  const any = await db.get(
    "SELECT id FROM invoice_templates ORDER BY id ASC LIMIT 1"
  );
  if (any?.id) return any.id;
  const result = await db.run(
    "INSERT INTO invoice_templates (name, description, is_default) VALUES (?, ?, 1)",
    ["Imported PDF", "Autogenerated default template for imported invoices"]
  );
  return result.id;
}

// Helper: generate next invoice number (YYYY-####)
async function generateNextInvoiceNumber() {
  const currentYear = new Date().getFullYear();
  const lastInvoice = await db.get(
    `SELECT invoice_number FROM invoices 
       WHERE invoice_number LIKE ? 
       ORDER BY id DESC LIMIT 1`,
    [`${currentYear}-%`]
  );

  let nextNumber = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoice_number.split("-");
    if (parts.length === 2) {
      nextNumber = parseInt(parts[1]) + 1;
    }
  }

  return `${currentYear}-${String(nextNumber).padStart(4, "0")}`;
}

// Import PDF and create invoice
router.post("/import-pdf", auth, uploadPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Geen PDF geüpload" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const parsed = await pdfParse(fileBuffer);
    const extracted = extractInvoiceDataFromText(parsed.text || "");

    // Get template_id from request body, or use default
    let template_id = req.body.template_id
      ? parseInt(req.body.template_id)
      : null;
    if (!template_id) {
      template_id = await getDefaultTemplateId();
    } else {
      // Verify template exists
      const template = await db.get(
        "SELECT id FROM invoice_templates WHERE id = ?",
        [template_id]
      );
      if (!template) {
        return res
          .status(400)
          .json({ error: "Geselecteerde template niet gevonden" });
      }
    }

    let invoice_number =
      extracted.invoice_number || (await generateNextInvoiceNumber());
    let original_invoice_number = extracted.invoice_number || null;

    // Ensure uniqueness of invoice_number
    if (extracted.invoice_number) {
      const dup = await db.get(
        "SELECT id FROM invoices WHERE invoice_number = ?",
        [extracted.invoice_number]
      );
      if (dup) {
        // Skip duplicate - don't import again
        return res.status(409).json({
          error: `Factuur ${extracted.invoice_number} bestaat al en is overgeslagen`,
          duplicate: true,
          existing_id: dup.id,
        });
      }
    }

    // Ensure totals present; if not, fail gracefully
    if (!Number.isFinite(extracted.total_amount)) {
      return res
        .status(422)
        .json({ error: "Kon totaalbedrag niet herkennen in PDF" });
    }

    const subtotal = Number.isFinite(extracted.subtotal)
      ? extracted.subtotal
      : Number((extracted.total_amount / 1.21).toFixed(2));
    const vat_amount = Number.isFinite(extracted.vat_amount)
      ? extracted.vat_amount
      : Number((extracted.total_amount - subtotal).toFixed(2));

    // Store the original PDF path
    const originalPdfPath = `/uploads/invoices/imports/${path.basename(
      req.file.path
    )}`;

    const result = await db.run(
      `INSERT INTO invoices 
       (template_id, invoice_number, customer_name, invoice_date, subtotal, vat_amount, total_amount, status, notes, original_pdf_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [
        template_id,
        invoice_number,
        extracted.customer_name || null,
        extracted.invoice_date,
        subtotal,
        vat_amount,
        extracted.total_amount,
        `Geïmporteerd van PDF: ${path.basename(req.file.originalname)}${
          original_invoice_number
            ? ` | Origineel factuurnummer: ${original_invoice_number}`
            : ""
        }`,
        originalPdfPath,
        req.user.id,
      ]
    );

    const invoiceId = result.id;

    // Save line items from extracted data
    if (
      extracted.line_items &&
      Array.isArray(extracted.line_items) &&
      extracted.line_items.length > 0
    ) {
      for (const item of extracted.line_items) {
        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, item_date, item_km, item_hours, item_rate, is_total_row, total_row_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
          [
            invoiceId,
            item.description || "",
            item.quantity || 1,
            item.unit_price || 0,
            item.line_total || 0,
            item.item_date || null,
            item.item_km || null,
            item.item_hours || null,
            item.item_rate || null,
          ]
        );
      }

      // Add summary rows using totals extracted from PDF (more reliable than recalculating)
      const totalKm = extracted.totals?.total_km;
      const totalHours = extracted.totals?.total_hours;

      if (Number.isFinite(totalKm) && totalKm > 0) {
        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, item_km, item_hours, is_total_row, total_row_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [invoiceId, "Totaal KM", 1, 0, 0, totalKm, null, "km"]
        );
      }

      if (Number.isFinite(totalHours) && totalHours > 0) {
        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, item_km, item_hours, is_total_row, total_row_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [invoiceId, "Totaal Uren", 1, 0, 0, null, totalHours, "hours"]
        );
      }
    }

    const newInvoice = await db.get("SELECT * FROM invoices WHERE id = ?", [
      invoiceId,
    ]);
    res.status(201).json({
      success: true,
      invoice: newInvoice,
      message: "Factuur succesvol geïmporteerd uit PDF",
    });
  } catch (error) {
    console.error("Error importing invoice PDF:", error);
    res
      .status(500)
      .json({ error: "Fout bij importeren van PDF: " + error.message });
  }
});
