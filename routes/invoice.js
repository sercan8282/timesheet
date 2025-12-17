const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authMiddleware: auth } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { generateInvoicePDF } = require("../utils/invoice-pdf");
const { sendInvoiceEmail } = require("../utils/email");

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
    const { name, description, is_default } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await db.run("UPDATE invoice_templates SET is_default = 0");
    }

    const result = await db.run(
      "INSERT INTO invoice_templates (name, description, is_default) VALUES (?, ?, ?)",
      [name, description || null, is_default ? 1 : 0]
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
    const { name, description, is_default } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await db.run(
        "UPDATE invoice_templates SET is_default = 0 WHERE id != ?",
        [req.params.id]
      );
    }

    await db.run(
      "UPDATE invoice_templates SET name = ?, description = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description || null, is_default ? 1 : 0, req.params.id]
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
    if (line_items && Array.isArray(line_items)) {
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const line_total =
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);

        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, position_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            item.description,
            item.quantity || 1,
            item.unit_price || 0,
            line_total.toFixed(2),
            i,
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

      // Add new line items
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const line_total =
          parseFloat(item.quantity || 0) * parseFloat(item.unit_price || 0);

        await db.run(
          `INSERT INTO invoice_line_items 
           (invoice_id, description, quantity, unit_price, line_total, position_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            req.params.id,
            item.description,
            item.quantity || 1,
            item.unit_price || 0,
            line_total.toFixed(2),
            i,
          ]
        );
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
