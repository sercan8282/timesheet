const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all companies
router.get("/", async (req, res) => {
  try {
    const companies = await db.all("SELECT * FROM companies ORDER BY name ASC");
    res.json(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single company
router.get("/:id", async (req, res) => {
  try {
    const company = await db.get("SELECT * FROM companies WHERE id = ?", [
      req.params.id,
    ]);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json(company);
  } catch (error) {
    console.error("Error fetching company:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new company
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Company name is required"),
    body("address").optional().trim(),
    body("postal_code").optional().trim(),
    body("city").optional().trim(),
    body("kvk_number").optional().trim(),
    body("bank_account").optional().trim(),
    body("vat_number").optional().trim(),
    body("pause_time")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Pause time must be in HH:MM format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        address,
        postal_code,
        city,
        kvk_number,
        bank_account,
        vat_number,
        pause_time,
      } = req.body;

      const pauseTimeHM = pause_time || "00:30";

      const result = await db.run(
        `INSERT INTO companies (name, address, postal_code, city, kvk_number, bank_account, vat_number, pause_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          address || null,
          postal_code || null,
          city || null,
          kvk_number || null,
          bank_account || null,
          vat_number || null,
          pauseTimeHM,
        ]
      );

      const newCompany = await db.get("SELECT * FROM companies WHERE id = ?", [
        result.id,
      ]);

      res.status(201).json(newCompany);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update company
router.put(
  "/:id",
  [
    body("name").trim().notEmpty().withMessage("Company name is required"),
    body("address").optional().trim(),
    body("postal_code").optional().trim(),
    body("city").optional().trim(),
    body("kvk_number").optional().trim(),
    body("bank_account").optional().trim(),
    body("vat_number").optional().trim(),
    body("pause_time")
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage("Pause time must be in HH:MM format"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        address,
        postal_code,
        city,
        kvk_number,
        bank_account,
        vat_number,
        pause_time,
      } = req.body;

      const pauseTimeHM = pause_time || "00:30";

      await db.run(
        `UPDATE companies 
         SET name = ?, address = ?, postal_code = ?, city = ?, 
             kvk_number = ?, bank_account = ?, vat_number = ?, pause_time = ?, 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name,
          address || null,
          postal_code || null,
          city || null,
          kvk_number || null,
          bank_account || null,
          vat_number || null,
          pauseTimeHM,
          req.params.id,
        ]
      );

      const updatedCompany = await db.get(
        "SELECT * FROM companies WHERE id = ?",
        [req.params.id]
      );

      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete company
router.delete("/:id", async (req, res) => {
  try {
    // Check if any users are assigned to this company
    const usersCount = await db.get(
      "SELECT COUNT(*) as count FROM users WHERE company_id = ?",
      [req.params.id]
    );

    if (usersCount.count > 0) {
      return res.status(400).json({
        error: `Cannot delete company. ${usersCount.count} user(s) are still assigned to this company.`,
      });
    }

    await db.run("DELETE FROM companies WHERE id = ?", [req.params.id]);
    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== UTILITY FUNCTIONS =====
// Removed minutesToTimeStr - frontend now sends HH:MM format directly

module.exports = router;
