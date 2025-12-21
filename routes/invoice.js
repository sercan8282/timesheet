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
      "SELECT * FROM import_templates WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC"
    );
    res.json(templates);
  } catch (error) {
    console.error("Error fetching import templates:", error);
    res.status(500).json({ error: "Fout bij ophalen van import templates" });
  }
});

// Public (no-auth) import templates list for UI fallback
router.get("/public/import-templates", async (req, res) => {
  try {
    const templates = await db.all(
      "SELECT * FROM import_templates WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC"
    );
    res.json(templates);
  } catch (error) {
    console.error("Error fetching import templates (public):", error);
    res.status(500).json({ error: "Fout bij ophalen van import templates" });
  }
});

// Get single import template with mappings
router.get("/import-templates/:id", auth, async (req, res) => {
  try {
    const tpl = await db.get("SELECT * FROM import_templates WHERE id = ?", [
      req.params.id,
    ]);
    if (!tpl) return res.status(404).json({ error: "Template niet gevonden" });
    const mappings = await db.all(
      "SELECT field_key, pattern, page FROM template_field_mappings WHERE template_id = ?",
      [req.params.id]
    );
    res.json({ ...tpl, mappings });
  } catch (error) {
    console.error("Error fetching import template:", error);
    res.status(500).json({ error: "Fout bij ophalen van import template" });
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
      `INSERT INTO import_templates (name, description, parser_type, config, is_active) VALUES (?, ?, ?, ?, 1)`,
      [name, description || null, parser_type, JSON.stringify(config || {})]
    );

    const newTemplate = await db.get(
      "SELECT * FROM import_templates WHERE id = ?",
      [result.id]
    );

    // Ensure a matching invoice_template exists so it shows up in the layout dropdown
    const existingInvoiceTpl = await db.get(
      "SELECT id FROM invoice_templates WHERE name = ?",
      [name]
    );
    if (!existingInvoiceTpl) {
      await db.run(
        `INSERT INTO invoice_templates (name, description, is_default, hourly_rate, km_rate, dot_rate, dot_rate_is_percent)
         VALUES (?, ?, 0, 0, 0, 0, 0)`,
        [name, description || null]
      );
    }

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating import template:", error);
    res.status(500).json({ error: "Fout bij aanmaken import template" });
  }
});

// Upload a sample PDF for an import template to support mapping/preview
router.post(
  "/import-templates/:id/sample",
  auth,
  uploadPdf.single("pdf"),
  async (req, res) => {
    try {
      const tpl = await db.get("SELECT * FROM import_templates WHERE id = ?", [
        req.params.id,
      ]);
      if (!tpl)
        return res.status(404).json({ error: "Template niet gevonden" });
      if (!req.file) {
        return res.status(400).json({ error: "Geen PDF geüpload" });
      }

      const relativePath = `/uploads/invoices/imports/${path.basename(
        req.file.path
      )}`;
      await db.run(
        "UPDATE import_templates SET sample_pdf_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [relativePath, req.params.id]
      );

      res.json({ success: true, sample_pdf_path: relativePath });
    } catch (error) {
      console.error("Error uploading sample PDF:", error);
      res.status(500).json({ error: "Fout bij uploaden van sample PDF" });
    }
  }
);

// Save field mappings for an import template (regex-based anchors)
router.put("/import-templates/:id/mappings", auth, async (req, res) => {
  try {
    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: "Mappings array is verplicht" });
    }

    const tpl = await db.get("SELECT id FROM import_templates WHERE id = ?", [
      req.params.id,
    ]);
    if (!tpl) return res.status(404).json({ error: "Template niet gevonden" });

    // Replace existing mappings
    await db.run("DELETE FROM template_field_mappings WHERE template_id = ?", [
      req.params.id,
    ]);

    for (const m of mappings) {
      if (!m.field_key) continue;
      await db.run(
        `INSERT INTO template_field_mappings (template_id, field_key, pattern, page)
         VALUES (?, ?, ?, ?)`,
        [req.params.id, m.field_key, m.pattern || null, m.page || 1]
      );
    }

    const saved = await db.all(
      "SELECT field_key, pattern, page FROM template_field_mappings WHERE template_id = ?",
      [req.params.id]
    );
    res.json({ success: true, mappings: saved });
  } catch (error) {
    console.error("Error saving template mappings:", error);
    res.status(500).json({ error: "Fout bij opslaan van mappings" });
  }
});

// Delete import template (and cascade mappings)
router.delete("/import-templates/:id", auth, async (req, res) => {
  try {
    const tpl = await db.get(
      "SELECT id, sample_pdf_path FROM import_templates WHERE id = ?",
      [req.params.id]
    );
    if (!tpl) {
      return res.status(404).json({ error: "Template niet gevonden" });
    }

    // Remove sample PDF file if present
    if (tpl.sample_pdf_path) {
      const normalized = tpl.sample_pdf_path.replace(/^[/\\]+/, "");
      const full = path.join(__dirname, "..", "public", normalized);
      try {
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch (e) {
        console.warn("Kon sample PDF niet verwijderen:", e.message);
      }
    }

    await db.run("DELETE FROM import_templates WHERE id = ?", [
      req.params.id,
    ]);

    // template_field_mappings has ON DELETE CASCADE, so no manual cleanup needed
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting import template:", error);
    res
      .status(500)
      .json({ error: "Fout bij verwijderen van import template" });
  }
});

// Cleanup unused import templates (no mappings and no sample PDF)
router.post("/import-templates/cleanup", auth, async (req, res) => {
  try {
    // Find templates with zero mappings and no sample_pdf_path
    const candidates = await db.all(
      `SELECT it.id
       FROM import_templates it
       LEFT JOIN template_field_mappings tfm ON tfm.template_id = it.id
       GROUP BY it.id
       HAVING COUNT(tfm.id) = 0 AND (it.sample_pdf_path IS NULL OR it.sample_pdf_path = '')`
    );

    const ids = candidates.map((r) => r.id);
    if (!ids.length) {
      return res.json({ deleted: [], count: 0 });
    }

    // Delete all candidates
    const placeholders = ids.map(() => "?").join(",");
    await db.run(
      `DELETE FROM import_templates WHERE id IN (${placeholders})`,
      ids
    );

    res.json({ deleted: ids, count: ids.length });
  } catch (error) {
    console.error("Error cleaning up import templates:", error);
    res
      .status(500)
      .json({ error: "Fout bij opschonen van import templates" });
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
    const {
      name,
      description,
      is_default,
      hourly_rate,
      km_rate,
      dot_rate,
      dot_rate_is_percent,
    } = req.body;

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
    const {
      name,
      description,
      is_default,
      hourly_rate,
      km_rate,
      dot_rate,
      dot_rate_is_percent,
    } = req.body;

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
        image_align,
        image_width,
        calculation_formula,
      } = req.body;

      let image_path = null;
      if (req.file) {
        image_path = "/uploads/invoices/" + req.file.filename;
      }

      const result = await db.run(
        `INSERT INTO invoice_template_elements 
         (template_id, element_type, label, content, image_path, position_order, 
          font_size, font_color, font_weight, image_align, image_width, calculation_formula) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            image_align || "left",
            image_width || 150,
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
        element_type,
        label,
        content,
        position_order,
        font_size,
        font_color,
        font_weight,
        image_align,
        image_width,
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
       SET element_type = ?, label = ?, content = ?, image_path = ?, position_order = ?, 
           font_size = ?, font_color = ?, font_weight = ?, image_align = ?, image_width = ?, calculation_formula = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
        [
          element_type || currentElement.element_type,
          label || null,
          content || null,
          image_path,
          position_order || 0,
          font_size || 14,
          font_color || "#000000",
          font_weight || "normal",
          image_align || currentElement.image_align || "left",
          image_width || currentElement.image_width || 150,
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
      invoice_type,
      customer_name,
      customer_address,
      invoice_date,
      due_date,
      line_items,
      notes,
    } = req.body;

    console.log(
      "[POST /invoices] Received line_items:",
      JSON.stringify(line_items, null, 2)
    );

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
       (template_id, invoice_number, invoice_type, customer_name, customer_address, 
        invoice_date, due_date, subtotal, vat_amount, total_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        template_id,
        invoice_number,
        invoice_type || 'Verkoop',
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

        console.log(`[Invoice ${invoiceId}] Saving line item ${i + 1}:`, {
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
        );
        console.log(
          `[Invoice ${invoiceId}] Added KM total line: ${totalKm} km × €${kmRate} = €${kmLineTotal.toFixed(
            2
          )}`
        );

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
          );
          console.log(
            `[Invoice ${invoiceId}] Added DOT total line (${
              isPercent ? "percentage" : "per km"
            }): value €${dotLineTotal.toFixed(2)}`
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
      invoice_type,
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
           invoice_type = ?, subtotal = ?, vat_amount = ?, total_amount = ?, status = ?, notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        customer_name,
        customer_address,
        invoice_date,
        due_date,
        invoice_type || 'Verkoop',
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

          console.log(
            `[Invoice ${
              req.params.id
            }] Added KM total line: ${totalKm} km × €${kmRate} = €${kmLineTotal.toFixed(
              2
            )}`
          );

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
              `[Invoice ${req.params.id}] Added DOT total line (${
                isPercent ? "percentage" : "per km"
              }): value €${dotLineTotal.toFixed(2)}`
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
    const normalizedOriginalPath = invoice.original_pdf_path.replace(
      /^[/\\]+/,
      ""
    );
    const pdfPath = path.join(
      __dirname,
      "..",
      "public",
      normalizedOriginalPath
    );

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
  const raw = String(str)
    .replace(/[€\u00A0]/g, " ")
    .trim();
  // Capture the first plausible number token (with optional thousands and optional 2 decimals)
  const m = raw.match(
    /\b(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{2})|\d+(?:[\.,]\d{2})|\d+)\b/
  );
  if (!m) return NaN;
  let token = m[1];
  // Decide decimal separator using the last occurrence and digits count after it
  const lastComma = token.lastIndexOf(",");
  const lastDot = token.lastIndexOf(".");
  if (lastComma > -1 && token.length - lastComma - 1 === 2) {
    // comma decimals; strip thousands dots
    token = token.replace(/\./g, "").replace(/,/g, ".");
  } else if (lastDot > -1 && token.length - lastDot - 1 === 2) {
    // dot decimals; strip thousands commas
    token = token.replace(/,/g, "");
  } else {
    // No clear decimals; remove all separators
    token = token.replace(/[\.,]/g, "");
  }
  const val = parseFloat(token);
  return Number.isFinite(val) ? val : NaN;
}

// Apply template mappings (regex-based) to extract specific fields before heuristics results are returned
async function applyTemplateMappings(text, templateId) {
  if (!templateId) return {};
  try {
    const mappings = await db.all(
      "SELECT field_key, pattern FROM template_field_mappings WHERE template_id = ?",
      [templateId]
    );
    if (!mappings || mappings.length === 0) return {};

    const result = {};
    for (const m of mappings) {
      if (!m.pattern) continue;
      try {
        const rx = new RegExp(m.pattern, "i");
        const match = text.match(rx);
        if (match && match[1]) {
          const raw = match[1].trim();
          if (
            m.field_key === "total_amount" ||
            m.field_key === "subtotal" ||
            m.field_key === "vat_amount"
          ) {
            const num = parseEuroAmount(raw);
            if (Number.isFinite(num)) result[m.field_key] = num;
          } else {
            result[m.field_key] = raw;
          }
        }
      } catch (err) {
        console.warn("Invalid mapping regex", m.pattern, err.message);
      }
    }
    return result;
  } catch (err) {
    console.error("Error applying template mappings:", err);
    return {};
  }
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
    // Heuristic: take the first meaningful line after a 'Klant' label, or a company-like line near the top
    const idxKlant = lines.findIndex((l) => /\bKlant\b/i.test(l));
    const blacklist =
      /(Factuur|Factuurnummer|PAGINA|DATUM|Verzend|Vervaldatum|Referentie)/i;
    if (idxKlant >= 0) {
      for (let i = idxKlant + 1; i <= idxKlant + 6 && i < lines.length; i++) {
        const cand = lines[i];
        if (cand && !blacklist.test(cand) && /[A-Za-z]{2,}/.test(cand)) {
          customer_name = cand.replace(/\s{2,}/g, " ").trim();
          break;
        }
      }
    }
    if (!customer_name) {
      const guess = lines.find(
        (l) => /[A-Za-z].+\s+[A-Za-z]/.test(l) && !blacklist.test(l)
      );
      if (guess) customer_name = guess.substring(0, 80).trim();
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
      /(totaal\s*te\s*betalen|te\s*betalen\s*totaal|totaal\s*incl\.?\s*btw|totaal\b|grand total|total|amount due|balance due)/i.test(
        l
      )
    );
  if (totalLine) {
    const ms = [...totalLine.matchAll(/([€]?[\s\u00A0]*[0-9\.,]+\-?)/g)].map(
      (m) => m[1]
    );
    const pick = ms.reverse().find((x) => x.includes("€")) || ms.pop();
    if (pick) total_amount = parseEuroAmount(pick);
  }

  // Fallback: if no total found, look at nearby lines after 'TE BETALEN' or 'Amount due'
  if (!Number.isFinite(total_amount)) {
    // Try inline match in normalized text where label and amount are separated by spaces/newlines
    const inline = normalized.match(
      /(te\s*betalen|amount\s*due|balance\s*due|grand\s*total|total)[^€0-9]{0,80}(€?\s*[0-9\.,]+\-?)/i
    );
    if (inline && inline[2]) {
      const val = parseEuroAmount(inline[2]);
      if (Number.isFinite(val)) total_amount = val;
    }

    const idx = lines.findIndex((l) =>
      /(te\s*betalen|amount\s*due|balance\s*due|grand\s*total|total)/i.test(l)
    );
    if (idx >= 0) {
      const windowLines = lines.slice(
        Math.max(0, idx - 2),
        Math.min(lines.length, idx + 4)
      );
      for (const l of windowLines) {
        const m = l.match(/€\s*[0-9\.,]+\-?/);
        if (m) {
          const val = parseEuroAmount(m[0]);
          if (Number.isFinite(val)) {
            total_amount = val;
            break;
          }
        } else {
          const m2 = l.match(/\b[0-9][0-9\.,]+\-?\b/);
          if (m2) {
            const val2 = parseEuroAmount(m2[0]);
            if (Number.isFinite(val2)) {
              total_amount = val2;
              break;
            }
          }
        }
      }
    }
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

  // Generic table extraction fallback (columns: Artikel nr., Omschrijving, Aant., Net p/s, Net tot., BTW)
  if (line_items.length === 0) {
    const headerIdx = lines.findIndex(
      (l) => /Artikel\s*nr\.?/i.test(l) && /Omschrijving/i.test(l)
    );
    if (headerIdx >= 0) {
      const endIdx = lines.findIndex(
        (l, i) =>
          i > headerIdx &&
          /(TE\s*BETALEN|TOTAAL\s*EXCL\.|TOTAAL\s*INC|TOTAAL\s*INCL|TOTAAL\s*TOT)/i.test(
            l
          )
      );
      const dataLines = lines.slice(
        headerIdx + 1,
        endIdx > headerIdx + 1 ? endIdx : headerIdx + 120
      );

      const isDivider = (t) => /^(\-|=|_)+$/.test(t) || !t.trim();
      const hasEuro = (t) => /€\s*[0-9\.,]+\-?/.test(t);
      const normalize = (t) => t.replace(/\s{2,}/g, " ").trim();

      // Aggregate 1–3 lines per row to capture description + unit + total that may be split
      for (let i = 0; i < dataLines.length; i++) {
        let rowText = normalize(dataLines[i]);
        if (isDivider(rowText)) continue;

        // If the line doesn't contain enough price info, try to append next lines
        let j = i + 1;
        while (
          j < dataLines.length &&
          (!hasEuro(rowText) ||
            (rowText.match(/€\s*[0-9\.,]+\-?/g) || []).length < 2)
        ) {
          const candidate = normalize(dataLines[j]);
          if (isDivider(candidate)) break;
          rowText += " " + candidate;
          j++;
        }
        i = j - 1; // advance index

        const euros = rowText.match(/€\s*[0-9\.,]+\-?/g) || [];
        if (euros.length === 0) continue; // not a data row

        // Parse euro values present on the row (unit, total, possibly VAT)
        const euroVals = euros
          .map((e) => parseEuroAmount(e))
          .filter((v) => Number.isFinite(v));
        if (euroVals.length === 0) continue;

        // Quantity: prefer the rightmost decimal/integer near prices; allow 12,75 style
        const firstEuroIdx = rowText.indexOf(euros[0]);
        const leftPart =
          firstEuroIdx > -1 ? rowText.substring(0, firstEuroIdx) : rowText;
        const cleanedLeft = leftPart
          // Remove dates: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY
          .replace(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi, " ")
          .replace(/\b20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}\b/gi, " ")
          // Remove times like 10:00
          .replace(/\b\d{1,2}:\d{2}\b/g, " ")
          // Remove long IDs or product codes (6+ digits)
          .replace(/\b\d{6,}\b/g, " ")
          .replace(/\s{2,}/g, " ");
        // Prefer integer quantities 1-3 digits not attached to letters, near the end
        const tail = cleanedLeft.slice(Math.max(0, cleanedLeft.length - 40));
        const intTokens =
          tail.match(/(?<![A-Za-z])\b\d{1,3}\b(?![A-Za-z])/g) || [];
        let qtyCandidates = intTokens
          .map((q) => parseInt(q, 10))
          .filter((q) => Number.isFinite(q) && q > 0 && q < 1000);
        // If no integer found, allow decimals (still exclude large values)
        if (qtyCandidates.length === 0) {
          const decTokens =
            tail.match(
              /(?<![A-Za-z])\b\d{1,3}(?:[\.,]\d{1,2})?\b(?![A-Za-z])/g
            ) || [];
          qtyCandidates = decTokens
            .map((q) => parseFloat(q.replace(/,/g, ".")))
            .filter((q) => Number.isFinite(q) && q > 0 && q < 1000);
        }
        let qty = qtyCandidates.length
          ? qtyCandidates[qtyCandidates.length - 1]
          : 1;

        // Pick unit and total ensuring consistency with qty (qty * unit ≈ total)
        let unitPrice =
          euroVals.length >= 2 ? euroVals[euroVals.length - 2] : euroVals[0];
        let lineTotal = euroVals[euroVals.length - 1];
        const tolerance = (t) => Math.max(0.01, t * 0.005); // 0.5% or 0.01 min

        // Try all combinations to find the best match
        let best = {
          resid: Number.POSITIVE_INFINITY,
          qty,
          unit: unitPrice,
          total: lineTotal,
        };
        for (const q of qtyCandidates.length ? qtyCandidates : [qty]) {
          for (let i = 0; i < euroVals.length; i++) {
            for (let j = i + 1; j < euroVals.length; j++) {
              const unit = euroVals[i];
              const total = euroVals[j];
              const resid = Math.abs(q * unit - total);
              if (resid < best.resid) best = { resid, qty: q, unit, total };
            }
          }
        }
        if (best.resid <= tolerance(best.total)) {
          qty = best.qty;
          unitPrice = best.unit;
          lineTotal = best.total;
        } else {
          // If only one euro value, infer unit from total and qty
          if (euroVals.length === 1 && Number.isFinite(qty)) {
            lineTotal = euroVals[0];
            unitPrice = qty ? lineTotal / qty : euroVals[0];
          } else {
            // Fallback to rightmost pair: penultimate as unit, last as total
            unitPrice =
              euroVals.length >= 2
                ? euroVals[euroVals.length - 2]
                : euroVals[0];
            lineTotal = euroVals[euroVals.length - 1];
          }
        }
        // Always compute total as qty * unit to ensure consistency
        if (
          !Number.isFinite(unitPrice) &&
          Number.isFinite(qty) &&
          Number.isFinite(lineTotal) &&
          qty > 0
        ) {
          unitPrice = lineTotal / qty;
        }
        if (Number.isFinite(qty) && Number.isFinite(unitPrice)) {
          lineTotal = Number((qty * unitPrice).toFixed(2));
        }
        if (!Number.isFinite(lineTotal)) continue;

        // Description: remove leading code/id and quantity tokens
        let description = normalize(
          leftPart.replace(/^\s*\d+[A-Za-z0-9\-\/ _]*\s*/, "")
        );
        if (!description || description.length < 2)
          description = normalize(rowText.replace(euros.join(" "), "").trim());

        line_items.push({
          description,
          quantity: Number.isFinite(qty) ? qty : 1,
          unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
          line_total: lineTotal,
          item_date: null,
          item_km: null,
          item_hours: null,
          item_rate: Number.isFinite(unitPrice) ? unitPrice : null,
        });
      }
    }
  }

  // Filter out rows that match total, subtotal, or VAT (summary rows, not data rows)
  const summaryThreshold = 0.1; // allow minor rounding differences
  line_items = line_items.filter((item) => {
    // Skip if line_total matches any summary amount
    if (
      Number.isFinite(total_amount) &&
      Math.abs(item.line_total - total_amount) < summaryThreshold
    )
      return false;
    if (
      Number.isFinite(subtotal) &&
      Math.abs(item.line_total - subtotal) < summaryThreshold
    )
      return false;
    if (
      Number.isFinite(vat_amount) &&
      Math.abs(item.line_total - vat_amount) < summaryThreshold
    )
      return false;

    const desc = (item.description || "").trim();
    const hasLetters = /[A-Za-z]/.test(desc);
    const hasSummaryKeyword =
      /(totaal|subtotal|subtotaal|btw|incl\.?|excl\.?)/i.test(desc);

    // Drop lines that look like summary rows (no letters, only euros/numbers)
    if (!hasLetters && desc.length < 100) return false;
    // Drop explicit summary keywords when qty/unit/total align
    if (
      hasSummaryKeyword &&
      item.quantity === 1 &&
      Math.abs(item.line_total - item.unit_price) < summaryThreshold
    )
      return false;

    // Drop empty/blank description lines that equal the total/subtotal
    const descHasContent = desc.length > 0 && /[A-Za-z0-9]/.test(desc);
    if (
      !descHasContent &&
      Number.isFinite(total_amount) &&
      Math.abs(item.line_total - total_amount) < summaryThreshold
    )
      return false;
    if (
      !descHasContent &&
      Number.isFinite(subtotal) &&
      Math.abs(item.line_total - subtotal) < summaryThreshold
    )
      return false;

    // Drop very short descriptions (<10 chars) when totals match summary amounts (common for blank total rows)
    if (desc.trim().length < 10) {
      if (
        Number.isFinite(total_amount) &&
        Math.abs(item.line_total - total_amount) < summaryThreshold
      )
        return false;
      if (
        Number.isFinite(subtotal) &&
        Math.abs(item.line_total - subtotal) < summaryThreshold
      )
        return false;
    }

    // Drop lines where qty=1, unit=total, and total matches grand/subtotal closely (typical summary row)
    if (
      item.quantity === 1 &&
      Math.abs(item.line_total - item.unit_price) < summaryThreshold
    ) {
      if (
        Number.isFinite(total_amount) &&
        Math.abs(item.line_total - total_amount) < summaryThreshold
      )
        return false;
      if (
        Number.isFinite(subtotal) &&
        Math.abs(item.line_total - subtotal) < summaryThreshold
      )
        return false;
    }

    // Drop numeric-only short lines with qty=1 and unit==total even if we didn't detect totals
    if (
      !hasLetters &&
      desc.trim().length < 60 &&
      item.quantity === 1 &&
      Math.abs(item.line_total - item.unit_price) < summaryThreshold
    ) {
      return false;
    }

    // Drop lines that have no letters and consist mainly of euros/numbers matching the grand total
    if (
      !hasLetters &&
      Number.isFinite(total_amount) &&
      Math.abs(item.line_total - total_amount) < summaryThreshold
    )
      return false;
    // Drop very short descriptions (<40 chars, no letters) that match total/subtotal
    if (desc.trim().length < 40 && !hasLetters) {
      if (
        Number.isFinite(total_amount) &&
        Math.abs(item.line_total - total_amount) < summaryThreshold
      )
        return false;
      if (
        Number.isFinite(subtotal) &&
        Math.abs(item.line_total - subtotal) < summaryThreshold
      )
        return false;
    }
    return true;
  });

  // Final guard: if the last line_item matches the invoice total or subtotal and has a short/empty description, drop it
  if (line_items.length > 0) {
    const last = line_items[line_items.length - 1];
    const lastDesc = (last.description || "").trim();
    const lastHasLetters = /[A-Za-z]/.test(lastDesc);
    const lastShort = lastDesc.length < 40;
    if (!lastHasLetters && lastShort) {
      if (
        Number.isFinite(total_amount) &&
        Math.abs(last.line_total - total_amount) < summaryThreshold
      ) {
        line_items.pop();
      } else if (
        Number.isFinite(subtotal) &&
        Math.abs(last.line_total - subtotal) < summaryThreshold
      ) {
        line_items.pop();
      }
    }
  }

  // Additional guard: drop any numeric-only/short line that equals the detected total/subtotal or looks like a grand total row
  if (line_items.length > 0) {
    const sumTotals = line_items.reduce(
      (s, it) => s + (Number.isFinite(it.line_total) ? it.line_total : 0),
      0
    );
    const candidates = [];
    for (let idx = 0; idx < line_items.length; idx++) {
      const it = line_items[idx];
      const desc = (it.description || "").trim();
      const hasLetters = /[A-Za-z]/.test(desc);
      const shortDesc = desc.length < 60;
      const qtyIsOne = Math.abs((it.quantity || 0) - 1) < 0.01;
      const unitEqualsTotal =
        Math.abs((it.unit_price || 0) - (it.line_total || 0)) <
        summaryThreshold;
      const matchesTotal =
        Number.isFinite(total_amount) &&
        Math.abs(it.line_total - total_amount) < summaryThreshold;
      const matchesSubtotal =
        Number.isFinite(subtotal) &&
        Math.abs(it.line_total - subtotal) < summaryThreshold;
      const sumOthers =
        sumTotals - (Number.isFinite(it.line_total) ? it.line_total : 0);

      if (
        !hasLetters &&
        shortDesc &&
        qtyIsOne &&
        unitEqualsTotal &&
        (matchesTotal || matchesSubtotal)
      ) {
        candidates.push(idx);
        continue;
      }
      // If this line is the max and close to total/subtotal while others sum to less, also drop
      const isMax =
        it.line_total === Math.max(...line_items.map((x) => x.line_total || 0));
      if (!hasLetters && shortDesc && isMax) {
        if (
          matchesTotal ||
          matchesSubtotal ||
          (sumOthers > 0 &&
            Math.abs(it.line_total - sumOthers) > summaryThreshold &&
            it.line_total > sumOthers * 0.8)
        ) {
          candidates.push(idx);
        }
      }
    }
    // Remove candidates from the end to preserve indexes
    candidates
      .sort((a, b) => b - a)
      .forEach((idx) => {
        line_items.splice(idx, 1);
      });
  }

  // Pattern-based block extraction fallback: match rows with description, qty, unit and total
  if (line_items.length === 0) {
    const blockStart = normalized.indexOf("artikel nr");
    const teBetalenIdx = normalized.lastIndexOf("te betalen");
    const blockEnd =
      teBetalenIdx > blockStart ? teBetalenIdx : normalized.length;
    if (blockStart > -1) {
      const block = normalized.substring(blockStart, blockEnd);
      const rowRegex =
        /(.*?)\s+(\d{1,3}(?:[\.,]\d{1,2})?)\s+€\s*([0-9\.,\-]+)\s+€\s*([0-9\.,\-]+)/g;
      let m;
      while ((m = rowRegex.exec(block)) !== null) {
        const desc = m[1].trim();
        const qty = parseFloat(m[2].replace(/,/g, "."));
        let unit = parseEuroAmount(m[3]);
        let total = parseEuroAmount(m[4]);
        // Always compute total from qty * unit; if unit missing, infer from provided total
        if (
          !Number.isFinite(unit) &&
          Number.isFinite(total) &&
          Number.isFinite(qty) &&
          qty > 0
        ) {
          unit = total / qty;
        }
        if (Number.isFinite(qty) && Number.isFinite(unit)) {
          total = Number((qty * unit).toFixed(2));
        }
        if (!Number.isFinite(total)) continue;
        line_items.push({
          description: desc,
          quantity: Number.isFinite(qty) ? qty : 1,
          unit_price: Number.isFinite(unit) ? unit : 0,
          line_total: total,
          item_date: null,
          item_km: null,
          item_hours: null,
          item_rate: Number.isFinite(unit) ? unit : null,
        });
      }
    }
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

// Auto-detect fields from a PDF without saving an invoice
router.post(
  "/import-templates/auto-detect",
  auth,
  uploadPdf.single("pdf"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Geen PDF geüpload" });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(fileBuffer);
      const templateId = req.body?.template_id
        ? parseInt(req.body.template_id)
        : req.query?.template_id
        ? parseInt(req.query.template_id)
        : null;

      const extracted = extractInvoiceDataFromText(parsed.text || "");

      // Apply template mappings first to override missing fields
      const mapped = await applyTemplateMappings(parsed.text || "", templateId);
      Object.assign(extracted, mapped);

      const requiredFields = ["invoice_number", "total_amount"];
      const fields = {};
      const notes = [];

      const annotateField = (
        key,
        value,
        type = "string",
        source = "heuristic"
      ) => {
        const isNumber = type === "number";
        const normalizedValue = isNumber
          ? Number.isFinite(value)
            ? Number(parseFloat(value).toFixed(2))
            : null
          : value || null;

        const confidence =
          normalizedValue === null ? 0 : source === "computed" ? 0.65 : 0.82;
        const missing = normalizedValue === null;

        fields[key] = {
          value: normalizedValue,
          type,
          confidence,
          missing,
          source,
        };
      };

      annotateField(
        "invoice_number",
        extracted.invoice_number,
        "string",
        "pattern"
      );
      annotateField("invoice_date", extracted.invoice_date, "date", "pattern");
      annotateField(
        "customer_name",
        extracted.customer_name,
        "string",
        "fallback"
      );
      annotateField("subtotal", extracted.subtotal, "number", "pattern");
      annotateField("vat_amount", extracted.vat_amount, "number", "pattern");
      annotateField(
        "total_amount",
        extracted.total_amount,
        "number",
        "pattern"
      );

      // Add computed totals to help the UI spot mismatches
      if (
        Number.isFinite(extracted.subtotal) &&
        Number.isFinite(extracted.vat_amount)
      ) {
        const computedTotal = Number(
          (
            parseFloat(extracted.subtotal) + parseFloat(extracted.vat_amount)
          ).toFixed(2)
        );
        annotateField(
          "total_amount_computed",
          computedTotal,
          "number",
          "computed"
        );

        const delta =
          fields.total_amount && fields.total_amount.value !== null
            ? Math.abs(computedTotal - fields.total_amount.value)
            : null;
        if (delta !== null && delta > 0.51) {
          notes.push(
            `Totaal uit regels wijkt ${delta.toFixed(
              2
            )} af van gevonden totaal; controleer subtotal en BTW.`
          );
        }
      }

      const missingFields = requiredFields.filter((key) => {
        return !fields[key] || fields[key].missing;
      });

      // Keep raw lines for UI-assisted mapping
      const raw_lines = String(parsed.text || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 400);

      // Map line items with light metadata
      const line_items = Array.isArray(extracted.line_items)
        ? extracted.line_items.map((item) => {
            const computedLine =
              Number.parseFloat(item.quantity || 0) *
              Number.parseFloat(item.unit_price || 0);
            return {
              description: item.description || "",
              item_date: item.item_date || null,
              item_km: item.item_km ?? null,
              item_hours: item.item_hours ?? null,
              item_rate: item.item_rate ?? null,
              quantity: item.quantity ?? 1,
              unit_price: item.unit_price ?? 0,
              line_total: item.line_total ?? null,
              computed_line_total: Number.isFinite(computedLine)
                ? Number(computedLine.toFixed(2))
                : null,
              confidence: 0.5,
            };
          })
        : [];

      const availableConfidences = Object.values(fields)
        .map((f) => f.confidence)
        .filter((c) => typeof c === "number");
      const avgConfidence =
        availableConfidences.length > 0
          ? Number(
              (
                availableConfidences.reduce((sum, v) => sum + v, 0) /
                availableConfidences.length
              ).toFixed(2)
            )
          : 0;

      res.json({
        success: true,
        file: {
          filename: req.file.originalname,
          size: req.file.size,
        },
        fields,
        line_items,
        summary: {
          confidence: avgConfidence,
          missing_fields: missingFields,
          notes,
        },
        raw_lines,
      });
    } catch (error) {
      console.error("Error auto-detecting PDF:", error);
      res
        .status(500)
        .json({ error: "Fout bij analyseren van PDF: " + error.message });
    } finally {
      if (req.file?.path) {
        fs.unlink(req.file.path, () => {});
      }
    }
  }
);

// Import PDF and create invoice
router.post("/import-pdf", auth, uploadPdf.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Geen PDF geüpload" });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const parsed = await pdfParse(fileBuffer);
    let extracted = extractInvoiceDataFromText(parsed.text || "");

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

    // Apply AI import template mappings if provided to improve field detection
    const ai_template_id = req.body.ai_template_id
      ? parseInt(req.body.ai_template_id)
      : null;
    if (ai_template_id) {
      try {
        const mapped = await applyTemplateMappings(
          parsed.text || "",
          ai_template_id
        );
        extracted = { ...extracted, ...mapped };
      } catch (err) {
        console.warn("AI import template mappings failed", err.message);
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

    // Get invoice_type from request body (Verkoop or Inkoop)
    const invoice_type = req.body.invoice_type === 'Inkoop' ? 'Inkoop' : 'Verkoop';

    const result = await db.run(
      `INSERT INTO invoices 
       (template_id, invoice_number, customer_name, invoice_date, subtotal, vat_amount, total_amount, status, notes, original_pdf_path, invoice_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
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
        invoice_type,
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
