const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { body, validationResult } = require("express-validator");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { generatePlanningPDF } = require("../utils/planning-pdf");
const { sendEmail } = require("../utils/email");

// All routes require admin authentication
router.use(authMiddleware);
router.use(adminMiddleware);

// GET planning schedule for a specific week
router.get("/week/:weekNumber", async (req, res) => {
  try {
    const { weekNumber } = req.params;

    const schedules = await db.all(
      `SELECT 
        ps.*,
        u.full_name AS driver_name,
        u.phone AS driver_phone,
        u.adr AS driver_adr,
        u.mega_kast AS driver_mega_kast,
        u.note AS driver_note,
        COALESCE(v.license_plate, fv.license_plate) AS license_plate,
        c.name AS company_name
      FROM planning_schedules ps
      LEFT JOIN users u ON u.id = ps.driver_id
      LEFT JOIN vehicles v ON v.id = ps.vehicle_id
      LEFT JOIN fleet_vehicles fv ON fv.id = ps.vehicle_id
      LEFT JOIN companies c ON c.id = ps.company_id
      WHERE ps.week_number = ? AND ps.is_active = 1
      ORDER BY ps.company_id, ps.day_of_week, ps.route_number`,
      [weekNumber]
    );

    res.json(schedules);
  } catch (error) {
    console.error("Error fetching planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET all active route numbers for auto-population
router.get("/routes", async (req, res) => {
  try {
    const routes = await db.all(
      `SELECT DISTINCT route_number, company_id, c.name AS company_name
      FROM vehicles v
      LEFT JOIN companies c ON c.id = v.company_id
      WHERE v.route_number IS NOT NULL AND v.route_number != ''
      ORDER BY company_id, route_number`
    );

    res.json(routes);
  } catch (error) {
    console.error("Error fetching routes:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET drivers by company
router.get("/drivers/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    const drivers = await db.all(
      `SELECT 
        id, 
        full_name, 
        ritnumber, 
        phone, 
        adr, 
        mega_kast
      FROM users
      WHERE (company_id = ? OR (can_fill_in = 1 AND fill_in_company_id = ?))
        AND role = 'user' 
        AND is_blocked = 0
      ORDER BY full_name`,
      [companyId, companyId]
    );

    res.json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: error.message });
  }
});

// CREATE planning entry
router.post(
  "/",
  [
    body("weekNumber").isInt({ min: 1, max: 53 }),
    body("dayOfWeek").isInt({ min: 1, max: 5 }), // Monday to Friday
    body("routeNumber").trim().notEmpty(),
    body("driverId").isInt(),
    body("companyId").isInt(),
    body("vehicleId").optional().isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        weekNumber,
        dayOfWeek,
        routeNumber,
        driverId,
        vehicleId,
        companyId,
        adr,
        megaKast,
        phoneNumber,
        notes,
      } = req.body;

      const result = await db.run(
        `INSERT INTO planning_schedules 
        (week_number, day_of_week, route_number, driver_id, vehicle_id, company_id, adr, mega_kast, phone_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          weekNumber,
          dayOfWeek,
          routeNumber,
          driverId,
          vehicleId || null,
          companyId,
          adr ? 1 : 0,
          megaKast || "only_mega",
          phoneNumber || null,
          notes || null,
        ]
      );

      const newSchedule = await db.get(
        `SELECT 
          ps.*,
          u.full_name AS driver_name,
          u.phone AS driver_phone,
          u.adr AS driver_adr,
          u.mega_kast AS driver_mega_kast,
          u.note AS driver_note,
          v.license_plate,
          c.name AS company_name
        FROM planning_schedules ps
        LEFT JOIN users u ON u.id = ps.driver_id
        LEFT JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN companies c ON c.id = ps.company_id
        WHERE ps.id = ?`,
        [result.id]
      );

      res.status(201).json(newSchedule);
    } catch (error) {
      console.error("Error creating planning:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// UPDATE planning entry (partial updates supported)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      route_number,
      driver_id,
      vehicle_id,
      adr,
      mega_kast,
      phone_number,
      notes,
    } = req.body;

    // Build dynamic UPDATE query based on provided fields
    const updates = [];
    const values = [];

    if (route_number !== undefined) {
      updates.push("route_number = ?");
      values.push(route_number);
    }
    if (driver_id !== undefined) {
      updates.push("driver_id = ?");
      values.push(driver_id);
    }
    if (vehicle_id !== undefined) {
      updates.push("vehicle_id = ?");
      values.push(vehicle_id || null);
    }
    if (adr !== undefined) {
      updates.push("adr = ?");
      values.push(adr ? 1 : 0);
    }
    if (mega_kast !== undefined) {
      updates.push("mega_kast = ?");
      values.push(mega_kast || "only_mega");
    }
    if (phone_number !== undefined) {
      updates.push("phone_number = ?");
      values.push(phone_number || null);
    }
    if (notes !== undefined) {
      updates.push("notes = ?");
      values.push(notes || null);
    }

    // Always update timestamp
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    if (updates.length === 1) {
      return res.status(400).json({ error: "No fields to update" });
    }

    await db.run(
      `UPDATE planning_schedules SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    const updated = await db.get(
      `SELECT 
        ps.*,
        u.full_name AS driver_name,
        u.phone AS driver_phone,
        u.adr AS driver_adr,
        u.mega_kast AS driver_mega_kast,
        u.note AS driver_note,
        v.license_plate,
        c.name AS company_name
      FROM planning_schedules ps
      LEFT JOIN users u ON u.id = ps.driver_id
      LEFT JOIN vehicles v ON v.id = ps.vehicle_id
      LEFT JOIN companies c ON c.id = ps.company_id
      WHERE ps.id = ?`,
      [id]
    );

    res.json(updated);
  } catch (error) {
    console.error("Error updating planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// HARD DELETE planning entry
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.run(`DELETE FROM planning_schedules WHERE id = ?`, [
      id,
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Planning entry not found" });
    }

    res.json({ message: "Planning entry verwijderd", id });
  } catch (error) {
    console.error("Error deleting planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// BULK DELETE all planning entries for a week
router.delete("/week/:weekNumber/clear", async (req, res) => {
  try {
    const { weekNumber } = req.params;
    const { companyId } = req.query;

    let sql = `DELETE FROM planning_schedules WHERE week_number = ?`;
    let params = [weekNumber];

    if (companyId) {
      sql += ` AND company_id = ?`;
      params.push(companyId);
    }

    const result = await db.run(sql, params);

    console.log(
      `Deleted ${result.changes} planning entries for week ${weekNumber}${
        companyId ? " (company " + companyId + ")" : ""
      }`
    );

    res.json({
      message: `${result.changes} planning entries verwijderd voor week ${weekNumber}`,
      deletedCount: result.changes,
    });
  } catch (error) {
    console.error("Error clearing week planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// GENERATE weekly planning based on active drivers per company
router.post("/generate/:weekNumber", async (req, res) => {
  try {
    const { weekNumber } = req.params;

    // Get all companies
    const companies = await db.all("SELECT id FROM companies");

    console.log(
      `Generating planning for week ${weekNumber}, found ${companies.length} companies`
    );

    let totalCreated = 0;

    for (const company of companies) {
      // Get active drivers for this company (with or without ritnumber)
      const drivers = await db.all(
        `SELECT id, ritnumber, phone, adr, mega_kast 
        FROM users 
        WHERE company_id = ? AND role = 'user' AND is_blocked = 0`,
        [company.id]
      );

      console.log(
        `Company ${company.id}: found ${drivers.length} active drivers`
      );

      // Get vehicles for this company
      const vehicles = await db.all(
        `SELECT id, route_number, license_plate
        FROM vehicles
        WHERE company_id = ?`,
        [company.id]
      );

      // Create planning entries for Mon-Fri (days 1-5)
      for (let day = 1; day <= 5; day++) {
        for (const driver of drivers) {
          // Find matching vehicle by route number
          const vehicle = vehicles.find(
            (v) => v.route_number === driver.ritnumber
          );

          // Check if entry already exists
          const existing = await db.get(
            `SELECT id FROM planning_schedules 
            WHERE week_number = ? AND day_of_week = ? AND driver_id = ? AND company_id = ? AND is_active = 1`,
            [weekNumber, day, driver.id, company.id]
          );

          if (!existing) {
            console.log(
              `Creating entry for driver ${driver.id} (${driver.ritnumber}), day ${day}, week ${weekNumber}`
            );
            await db.run(
              `INSERT INTO planning_schedules 
              (week_number, day_of_week, route_number, driver_id, vehicle_id, company_id, adr, mega_kast, phone_number)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                weekNumber,
                day,
                driver.ritnumber || "",
                driver.id,
                vehicle?.id || null,
                company.id,
                driver.adr || 0,
                driver.mega_kast || "only_mega",
                driver.phone || null,
              ]
            );
            totalCreated++;
          } else {
            console.log(
              `Skipping driver ${driver.id}, day ${day} - entry already exists (id: ${existing.id})`
            );
          }
        }
      }
    }

    console.log(
      `Total created: ${totalCreated} entries for week ${weekNumber}`
    );

    res.json({
      message: `Generated ${totalCreated} planning entries for week ${weekNumber}`,
      totalCreated,
    });
  } catch (error) {
    console.error("Error generating planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// GENERATE weekly planning for a specific company
router.post("/generate/:weekNumber/company/:companyId", async (req, res) => {
  try {
    const { weekNumber, companyId } = req.params;

    // Validate company exists
    const company = await db.get("SELECT id FROM companies WHERE id = ?", [
      companyId,
    ]);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get active drivers for this company
    const drivers = await db.all(
      `SELECT id, ritnumber, phone, adr, mega_kast 
       FROM users 
       WHERE company_id = ? AND role = 'user' AND is_blocked = 0`,
      [companyId]
    );

    // Get vehicles for this company
    const vehicles = await db.all(
      `SELECT id, route_number, license_plate
       FROM vehicles
       WHERE company_id = ?`,
      [companyId]
    );

    let totalCreated = 0;

    // Create planning entries for Mon-Fri (days 1-5)
    for (let day = 1; day <= 5; day++) {
      for (const driver of drivers) {
        const vehicle = vehicles.find(
          (v) => v.route_number === driver.ritnumber
        );
        const existing = await db.get(
          `SELECT id FROM planning_schedules 
           WHERE week_number = ? AND day_of_week = ? AND driver_id = ? AND company_id = ? AND is_active = 1`,
          [weekNumber, day, driver.id, companyId]
        );
        if (!existing) {
          await db.run(
            `INSERT INTO planning_schedules 
             (week_number, day_of_week, route_number, driver_id, vehicle_id, company_id, adr, mega_kast, phone_number)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              weekNumber,
              day,
              driver.ritnumber || "",
              driver.id,
              vehicle?.id || null,
              companyId,
              driver.adr || 0,
              driver.mega_kast || "only_mega",
              driver.phone || null,
            ]
          );
          totalCreated++;
        }
      }
    }

    res.json({
      message: `Generated ${totalCreated} planning entries for company ${companyId} in week ${weekNumber}`,
      totalCreated,
      companyId: Number(companyId),
      weekNumber: Number(weekNumber),
    });
  } catch (error) {
    console.error("Error generating company planning:", error);
    res.status(500).json({ error: error.message });
  }
});

// EXPORT planning as PDF
router.get("/week/:weekNumber/export-pdf", async (req, res) => {
  try {
    const { weekNumber } = req.params;

    const pdfBuffer = await generatePlanningPDF(weekNumber);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=planning-week-${weekNumber}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

// EMAIL planning PDF
router.post(
  "/week/:weekNumber/email",
  [
    body("recipients")
      .isArray({ min: 1 })
      .withMessage("At least one recipient required"),
    body("recipients.*").isEmail().withMessage("Invalid email address"),
    body("subject").optional().trim(),
    body("message").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { weekNumber } = req.params;
      const { recipients, subject, message } = req.body;

      // Generate PDF
      const pdfBuffer = await generatePlanningPDF(weekNumber);

      // Get branding for email
      const branding = await db.get("SELECT * FROM branding_settings LIMIT 1");
      const companyName = branding?.company_name || "Timesheet System";

      const emailSubject =
        subject || `Weekplanning Week ${weekNumber} - ${companyName}`;
      const emailBody =
        message ||
        `
        <p>Beste,</p>
        <p>Bijgevoegd vind je de weekplanning voor week ${weekNumber}.</p>
        <p>Met vriendelijke groet,<br>${companyName}</p>
      `;

      // Send email to each recipient
      const emailPromises = recipients.map((recipient) =>
        sendEmail({
          to: recipient,
          subject: emailSubject,
          html: emailBody,
          attachments: [
            {
              filename: `planning-week-${weekNumber}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        })
      );

      await Promise.all(emailPromises);

      res.json({
        message: `Planning PDF sent to ${recipients.length} recipient(s)`,
        recipients,
      });
    } catch (error) {
      console.error("Error emailing planning:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// NEW: Generate planning by vehicles for a company (Monday-Friday)
router.post(
  "/generate-by-vehicles/:weekNumber/company/:companyId",
  async (req, res) => {
    try {
      const { weekNumber, companyId } = req.params;

      // Validate company exists
      const company = await db.get("SELECT id FROM companies WHERE id = ?", [
        companyId,
      ]);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get all vehicles for this company
      const vehicles = await db.all(
        `SELECT id, license_plate, rit_number
       FROM fleet_vehicles
       WHERE company_id = ?
       ORDER BY rit_number ASC`,
        [companyId]
      );

      if (vehicles.length === 0) {
        return res
          .status(400)
          .json({ error: "No vehicles found for this company" });
      }

      let totalCreated = 0;

      // Prepare a fallback driver per company to satisfy NOT NULL constraint
      const fallbackDriver = await db.get(
        `SELECT id FROM users WHERE company_id = ? AND role = 'user' AND is_blocked = 0 ORDER BY full_name LIMIT 1`,
        [companyId]
      );

      // Create planning entries: one row per vehicle per day (Mon-Fri = days 1-5)
      for (let day = 1; day <= 5; day++) {
        for (const vehicle of vehicles) {
          const existing = await db.get(
            `SELECT id FROM planning_schedules 
           WHERE week_number = ? AND day_of_week = ? AND vehicle_id = ? AND company_id = ? AND is_active = 1`,
            [weekNumber, day, vehicle.id, companyId]
          );

          if (!existing) {
            // Ensure we set a driver_id to satisfy NOT NULL; admin can update later in UI
            const driverIdToUse = fallbackDriver ? fallbackDriver.id : null;
            if (!driverIdToUse) {
              // If there is truly no driver for the company, skip creating this entry to avoid constraint error
              continue;
            }
            await db.run(
              `INSERT INTO planning_schedules 
             (week_number, day_of_week, route_number, driver_id, vehicle_id, company_id, mega_kast)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                weekNumber,
                day,
                vehicle.rit_number || "",
                driverIdToUse,
                vehicle.id,
                companyId,
                "only_mega",
              ]
            );
            totalCreated++;
          }
        }
      }

      res.json({
        message: `Generated ${totalCreated} planning entries for company ${companyId} in week ${weekNumber}`,
        totalCreated,
        companyId: Number(companyId),
        weekNumber: Number(weekNumber),
      });
    } catch (error) {
      console.error("Error generating planning by vehicles:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
