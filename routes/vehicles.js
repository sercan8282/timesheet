const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const db = require("../config/database");
const { sendEmail } = require("../utils/email");

// GET all vehicles
router.get("/", async (req, res) => {
  try {
    const vehicles = await db.all(`
      SELECT 
        v.id, v.license_plate, v.route_number, v.company_id, v.current_km, 
        v.apk_date, v.chassis_number, v.created_at, v.updated_at,
        c.name AS company_name,
        COUNT(vm.id) AS maintenance_count
      FROM vehicles v
      LEFT JOIN companies c ON c.id = v.company_id
      LEFT JOIN vehicle_maintenance vm ON vm.vehicle_id = v.id
      GROUP BY v.id
      ORDER BY v.license_plate
    `);
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single vehicle with maintenance history
router.get("/:id", async (req, res) => {
  try {
    const vehicle = await db.get(
      `SELECT v.*, c.name AS company_name 
       FROM vehicles v 
       LEFT JOIN companies c ON c.id = v.company_id 
       WHERE v.id = ?`,
      [req.params.id]
    );

    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    const maintenance = await db.all(
      `SELECT * FROM vehicle_maintenance WHERE vehicle_id = ? ORDER BY maintenance_date DESC`,
      [req.params.id]
    );

    const alerts = await db.get(
      `SELECT * FROM vehicle_apk_alerts WHERE vehicle_id = ?`,
      [req.params.id]
    );

    res.json({
      ...vehicle,
      maintenance_count: maintenance.length,
      maintenance_history: maintenance,
      apk_alerts: alerts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE new vehicle
router.post(
  "/",
  [
    body("license_plate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    body("route_number").trim(),
    body("company_id").isInt(),
    body("current_km")
      .isFloat({ min: 0 })
      .withMessage("KM must be a positive number"),
    body("apk_date").optional().isISO8601(),
    body("chassis_number").trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        license_plate,
        route_number,
        company_id,
        current_km,
        apk_date,
        chassis_number,
      } = req.body;

      const result = await db.run(
        `INSERT INTO vehicles (license_plate, route_number, company_id, current_km, apk_date, chassis_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          license_plate,
          route_number,
          company_id || null,
          current_km,
          apk_date || null,
          chassis_number,
        ]
      );

      const vehicle = await db.get("SELECT * FROM vehicles WHERE id = ?", [
        result.id,
      ]);

      // Create default APK alerts entry
      await db.run(
        `INSERT INTO vehicle_apk_alerts (vehicle_id, alert_one_month, alert_two_weeks, alert_email)
         VALUES (?, 1, 1, ?)`,
        [result.id, req.body.alert_email || null]
      );

      res.status(201).json(vehicle);
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "License plate already exists" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// UPDATE vehicle
router.put(
  "/:id",
  [
    body("license_plate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    body("route_number").trim(),
    body("company_id").isInt(),
    body("current_km")
      .isFloat({ min: 0 })
      .withMessage("KM must be a positive number"),
    body("apk_date").optional().isISO8601(),
    body("chassis_number").trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        license_plate,
        route_number,
        company_id,
        current_km,
        apk_date,
        chassis_number,
      } = req.body;

      await db.run(
        `UPDATE vehicles 
         SET license_plate = ?, route_number = ?, company_id = ?, current_km = ?, apk_date = ?, chassis_number = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          license_plate,
          route_number,
          company_id || null,
          current_km,
          apk_date || null,
          chassis_number,
          req.params.id,
        ]
      );

      const vehicle = await db.get("SELECT * FROM vehicles WHERE id = ?", [
        req.params.id,
      ]);
      res.json(vehicle);
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "License plate already exists" });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
);

// DELETE vehicle
router.delete("/:id", async (req, res) => {
  try {
    const result = await db.run("DELETE FROM vehicles WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MAINTENANCE HISTORY =====

// GET maintenance history for a vehicle
router.get("/:vehicleId/maintenance", async (req, res) => {
  try {
    const maintenance = await db.all(
      `SELECT * FROM vehicle_maintenance WHERE vehicle_id = ? ORDER BY maintenance_date DESC`,
      [req.params.vehicleId]
    );
    res.json(maintenance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD maintenance record
router.post(
  "/:vehicleId/maintenance",
  [
    body("maintenance_date").isISO8601().withMessage("Valid date is required"),
    body("km_at_maintenance")
      .isFloat({ min: 0 })
      .withMessage("KM must be a positive number"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { maintenance_date, km_at_maintenance, description } = req.body;

      const result = await db.run(
        `INSERT INTO vehicle_maintenance (vehicle_id, maintenance_date, km_at_maintenance, description)
         VALUES (?, ?, ?, ?)`,
        [req.params.vehicleId, maintenance_date, km_at_maintenance, description]
      );

      const record = await db.get(
        "SELECT * FROM vehicle_maintenance WHERE id = ?",
        [result.id]
      );
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// UPDATE maintenance record
router.put(
  "/maintenance/:maintenanceId",
  [
    body("maintenance_date").isISO8601().withMessage("Valid date is required"),
    body("km_at_maintenance")
      .isFloat({ min: 0 })
      .withMessage("KM must be a positive number"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("Description is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { maintenance_date, km_at_maintenance, description } = req.body;

      await db.run(
        `UPDATE vehicle_maintenance 
         SET maintenance_date = ?, km_at_maintenance = ?, description = ?
         WHERE id = ?`,
        [
          maintenance_date,
          km_at_maintenance,
          description,
          req.params.maintenanceId,
        ]
      );

      const record = await db.get(
        "SELECT * FROM vehicle_maintenance WHERE id = ?",
        [req.params.maintenanceId]
      );
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE maintenance record
router.delete("/maintenance/:maintenanceId", async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM vehicle_maintenance WHERE id = ?",
      [req.params.maintenanceId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Maintenance record not found" });
    }

    res.json({ message: "Maintenance record deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== APK ALERTS =====

// GET APK alerts for a vehicle
router.get("/:vehicleId/apk-alerts", async (req, res) => {
  try {
    const alerts = await db.get(
      `SELECT * FROM vehicle_apk_alerts WHERE vehicle_id = ?`,
      [req.params.vehicleId]
    );
    res.json(alerts || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE APK alerts
router.put("/:vehicleId/apk-alerts", async (req, res) => {
  try {
    const { alert_one_month, alert_two_weeks, alert_email } = req.body;

    const existing = await db.get(
      `SELECT * FROM vehicle_apk_alerts WHERE vehicle_id = ?`,
      [req.params.vehicleId]
    );

    if (existing) {
      await db.run(
        `UPDATE vehicle_apk_alerts 
         SET alert_one_month = ?, alert_two_weeks = ?, alert_email = ?, updated_at = CURRENT_TIMESTAMP
         WHERE vehicle_id = ?`,
        [
          alert_one_month ? 1 : 0,
          alert_two_weeks ? 1 : 0,
          alert_email,
          req.params.vehicleId,
        ]
      );
    } else {
      await db.run(
        `INSERT INTO vehicle_apk_alerts (vehicle_id, alert_one_month, alert_two_weeks, alert_email)
         VALUES (?, ?, ?, ?)`,
        [
          req.params.vehicleId,
          alert_one_month ? 1 : 0,
          alert_two_weeks ? 1 : 0,
          alert_email,
        ]
      );
    }

    const alerts = await db.get(
      "SELECT * FROM vehicle_apk_alerts WHERE vehicle_id = ?",
      [req.params.vehicleId]
    );
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE APK alert
router.delete("/apk-alerts/:vehicleId", async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM vehicle_apk_alerts WHERE vehicle_id = ?",
      [req.params.vehicleId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "APK alert niet gevonden" });
    }
    
    res.json({ message: "APK alert verwijderd" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger APK alert emails for vehicles with expiring APK dates
router.post("/apk-alerts/send", async (req, res) => {
  try {
    const vehicles = await db.all(`
      SELECT v.id, v.license_plate, v.apk_date,
             a.alert_one_month, a.alert_two_weeks, a.alert_email
      FROM vehicles v
      LEFT JOIN vehicle_apk_alerts a ON a.vehicle_id = v.id
      WHERE v.apk_date IS NOT NULL
    `);

    const now = new Date();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const results = [];
    const errors = [];

    for (const v of vehicles) {
      const apkDate = new Date(v.apk_date);
      if (Number.isNaN(apkDate.getTime())) continue;

      const daysRemaining = Math.round((apkDate - now) / MS_PER_DAY);
      if (daysRemaining < 0) continue; // already expired, skip

      const tasks = [];

      if (v.alert_one_month && daysRemaining <= 30) {
        tasks.push({ scope: "one_month" });
      }

      if (v.alert_two_weeks && daysRemaining <= 14) {
        tasks.push({ scope: "two_weeks" });
      }

      for (const t of tasks) {
        try {
          await sendEmail({
            to: v.alert_email || undefined,
            subject: `APK verloopt binnen ${daysRemaining} dagen - ${v.license_plate}`,
            text: `Let op: de APK voor voertuig ${v.license_plate} verloopt op ${v.apk_date} (nog ${daysRemaining} dagen).`,
          });
          results.push({
            vehicleId: v.id,
            license_plate: v.license_plate,
            daysRemaining,
            scope: t.scope,
          });
        } catch (err) {
          errors.push({ vehicleId: v.id, license_plate: v.license_plate, error: err.message });
        }
      }
    }

    res.json({ sent: results, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
