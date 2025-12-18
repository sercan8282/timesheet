const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const speakeasy = require("speakeasy");
const crypto = require("crypto");
const { testSMTPConnection, sendEmail } = require("../utils/email");
const { generatePDF } = require("../utils/pdf");
const { generateXLSX } = require("../utils/excel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get("/users", async (req, res) => {
  try {
    const users = await db.all(
      `SELECT 
         u.id, u.username, u.full_name, u.role, u.is_blocked, u.created_at,
         u.company_id, u.phone, u.ritnumber, u.adr, u.mega_kast,
         u.can_fill_in, u.fill_in_company_id,
         u.mfa_enabled, u.mfa_skip_count,
         c.name AS company_name,
         fc.name AS fill_in_company_name,
         COALESCE(lb.vacation_hours, 0) AS vacation_hours,
         COALESCE(lb.overtime_hours, 0) AS overtime_hours
       FROM users u
       LEFT JOIN leave_balances lb ON lb.user_id = u.id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN companies fc ON fc.id = u.fill_in_company_id
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new user
router.post(
  "/users",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("isAdmin").optional().isBoolean(),
    body("role")
      .optional()
      .isIn(["admin", "user", "reader"])
      .withMessage("Role must be admin, user, or reader"),
    body("companyId").optional().isInt(),
    body("phone").optional().trim(),
    body("email").optional({ checkFalsy: true }).trim().isEmail(),
    body("ritnumber").optional().trim(),
    body("adr").optional().isBoolean(),
    // Allow arbitrary truck type strings that come from fleet management
    body("megaKast").optional().trim().isLength({ max: 100 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        username,
        password,
        fullName,
        isAdmin,
        role = "user",
        companyId,
        phone,
        email,
        ritnumber,
        adr = false,
        megaKast = "only_mega",
      } = req.body;

      // Check if username already exists (case-insensitive)
      const existingUser = await db.get(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
        [username]
      );

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with role
      const result = await db.run(
        `INSERT INTO users (username, password, full_name, role, company_id, phone, ritnumber, adr, mega_kast) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          username,
          hashedPassword,
          fullName,
          role,
          companyId || null,
          phone || null,
          ritnumber || null,
          adr ? 1 : 0,
          megaKast,
        ]
      );

      // Initialize leave balance for new user
      await db.run(
        "INSERT OR IGNORE INTO leave_balances (user_id, vacation_hours, overtime_hours) VALUES (?, 0, 0)",
        [result.id]
      );

      res.status(201).json({
        id: result.id,
        username,
        fullName,
        isAdmin: isAdmin || false,
        role,
        companyId,
        phone,
        email,
        ritnumber,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update user
router.put(
  "/users/:id",
  [
    body("fullName").optional().trim().notEmpty(),
    body("isAdmin").optional().isBoolean(),
    body("password").optional().trim().isLength({ min: 6 }),
    body("role").optional().isIn(["user", "reader", "admin"]),
    body("companyId").optional(),
    body("phone").optional().trim(),
    body("email").optional().trim(),
    body("ritnumber").optional().trim(),
    body("adr").optional().isBoolean(),
    // Allow arbitrary truck type strings that come from fleet management
    body("megaKast").optional().trim().isLength({ max: 100 }),
    body("canFillIn").optional(),
    body("fillInCompanyId").optional(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        fullName,
        isAdmin,
        password,
        role,
        companyId,
        phone,
        email,
        ritnumber,
        adr,
        megaKast,
        canFillIn,
        fillInCompanyId,
      } = req.body;

      console.log(`Updating user ${id} with data:`, {
        fullName,
        isAdmin,
        role,
        companyId,
        phone,
        email,
        ritnumber,
        adr,
        megaKast,
        canFillIn,
        fillInCompanyId,
      });

      const updates = [];
      const values = [];

      if (fullName !== undefined) {
        updates.push("full_name = ?");
        values.push(fullName);
      }

      if (role !== undefined) {
        updates.push("role = ?");
        values.push(role);
      }

      if (companyId !== undefined) {
        updates.push("company_id = ?");
        values.push(companyId || null);
      }

      if (phone !== undefined) {
        updates.push("phone = ?");
        values.push(phone || null);
      }

      if (ritnumber !== undefined) {
        updates.push("ritnumber = ?");
        values.push(ritnumber || null);
      }

      if (adr !== undefined) {
        updates.push("adr = ?");
        values.push(adr ? 1 : 0);
        console.log(`Setting ADR: input=${adr}, converted to=${adr ? 1 : 0}`);
      }

      if (megaKast !== undefined) {
        updates.push("mega_kast = ?");
        values.push(megaKast || "only_mega");
      }

      if (canFillIn !== undefined) {
        updates.push("can_fill_in = ?");
        values.push(canFillIn ? 1 : 0);
      }

      if (fillInCompanyId !== undefined) {
        updates.push("fill_in_company_id = ?");
        values.push(fillInCompanyId || null);
      }

      if (password !== undefined) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push("password = ?");
        values.push(hashedPassword);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
      console.log(`Executing SQL: ${sql}`);
      console.log(`With values:`, values);

      await db.run(sql, values);

      res.json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Toggle block user
router.put("/users/:id/block", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;

    if (typeof is_blocked !== "boolean") {
      return res.status(400).json({ error: "is_blocked must be a boolean" });
    }

    await db.run("UPDATE users SET is_blocked = ? WHERE id = ?", [
      is_blocked ? 1 : 0,
      id,
    ]);

    res.json({
      message: `User ${is_blocked ? "blocked" : "unblocked"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling block status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the last admin
    const user = await db.get("SELECT role FROM users WHERE id = ?", [id]);

    if (user && user.role === "admin") {
      const adminCount = await db.get(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      if (adminCount.count <= 1) {
        return res
          .status(400)
          .json({ error: "Cannot delete the last admin user" });
      }
    }

    await db.run("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get leave balances for all users
router.get("/leave-balances", async (req, res) => {
  try {
    const balances = await db.all(
      `SELECT u.id as user_id, u.username, u.full_name,
              COALESCE(lb.vacation_hours, 0) AS vacation_hours,
              COALESCE(lb.overtime_hours, 0) AS overtime_hours,
              u.is_blocked
       FROM users u
       LEFT JOIN leave_balances lb ON lb.user_id = u.id
       ORDER BY u.full_name COLLATE NOCASE`
    );
    res.json(balances);
  } catch (error) {
    console.error("Error fetching leave balances:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update leave balance for a user (vacation and/or overtime)
router.put(
  "/leave-balances/:userId",
  [
    body("vacationHours").optional().isFloat({ min: 0 }),
    body("overtimeHours").optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { vacationHours, overtimeHours } = req.body;

      const balance = await ensureLeaveBalance(userId);
      if (!balance) {
        return res.status(404).json({ error: "User not found" });
      }

      const updates = [];
      const values = [];

      if (vacationHours !== undefined) {
        updates.push("vacation_hours = ?");
        values.push(parseFloat(vacationHours));
      }

      if (overtimeHours !== undefined) {
        updates.push("overtime_hours = ?");
        values.push(parseFloat(overtimeHours));
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "No balance fields provided" });
      }

      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(userId);

      await db.run(
        `UPDATE leave_balances SET ${updates.join(", ")} WHERE user_id = ?`,
        values
      );

      res.json({ message: "Leave balance updated" });
    } catch (error) {
      console.error("Error updating leave balance:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get all submissions (admin can see all)
router.get("/submissions", async (req, res) => {
  try {
    const submissions = await db.all(`
            SELECT s.*, u.username, u.full_name, c.name AS company_name,
              (SELECT COALESCE(SUM(CAST(t.total_hours AS REAL)), 0)
          FROM timesheets t
          WHERE (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')) AS total_hours
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN companies c ON u.company_id = c.id
      ORDER BY s.submission_date DESC
    `);

    res.json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get timesheets for a specific submission
router.get("/submissions/:id/timesheets", async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get("SELECT * FROM submissions WHERE id = ?", [
      id,
    ]);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (!submission.timesheet_ids) {
      return res
        .status(400)
        .json({ error: "No timesheets in this submission" });
    }

    const timesheetIds = submission.timesheet_ids.split(",");
    const placeholders = timesheetIds.map(() => "?").join(",");

    const timesheets = await db.all(
      `SELECT t.*, u.full_name as user_name
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.start_time`,
      timesheetIds
    );

    res.json(timesheets);
  } catch (error) {
    console.error("Error fetching submission timesheets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update timesheet entry (admin can edit any timesheet)
router.put("/timesheets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, startKm, endKm, pauseTime, ritnumber } =
      req.body;

    // Check if timesheet exists
    const existing = await db.get("SELECT * FROM timesheets WHERE id = ?", [
      id,
    ]);
    if (!existing) {
      return res.status(404).json({ error: "Timesheet not found" });
    }

    // Calculate week number
    const dateObj = new Date(date);
    const weekNumber = getWeekNumber(dateObj);

    // Calculate total hours
    const totalHours = calculateTotalHours(startTime, endTime, pauseTime);

    // Calculate total km
    const totalKm = endKm - startKm;

    await db.run(
      `UPDATE timesheets 
       SET week_number = ?, date = ?, start_time = ?, end_time = ?, 
           start_km = ?, end_km = ?, pause_time = ?, total_hours = ?, total_km = ?, ritnumber = ?
       WHERE id = ?`,
      [
        weekNumber,
        date,
        startTime,
        endTime,
        startKm,
        endKm,
        pauseTime,
        totalHours,
        totalKm,
        ritnumber || "",
        id,
      ]
    );

    res.json({
      message: "Timesheet updated successfully",
      id,
      totalHours,
      totalKm,
    });
  } catch (error) {
    console.error("Error updating timesheet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get PDF for a specific submission (admin)
router.get("/submissions/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get("SELECT * FROM submissions WHERE id = ?", [
      id,
    ]);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (!submission.timesheet_ids) {
      return res
        .status(400)
        .json({ error: "No timesheets in this submission" });
    }

    const timesheetIds = submission.timesheet_ids.split(",");
    const placeholders = timesheetIds.map(() => "?").join(",");

    const timesheets = await db.all(
      `SELECT t.*, u.full_name as user_name
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.start_time`,
      timesheetIds
    );

    const user = await db.get("SELECT full_name FROM users WHERE id = ?", [
      submission.user_id,
    ]);
    const pdfBuffer = await generatePDF(timesheets, user.full_name);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=submission_${id}.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating submission PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Get XLSX for a specific submission (admin)
router.get("/submissions/:id/xlsx", async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get("SELECT * FROM submissions WHERE id = ?", [
      id,
    ]);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (!submission.timesheet_ids) {
      return res
        .status(400)
        .json({ error: "No timesheets in this submission" });
    }

    const timesheetIds = submission.timesheet_ids.split(",");
    const placeholders = timesheetIds.map(() => "?").join(",");

    const timesheets = await db.all(
      `SELECT t.*, u.full_name as user_name
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.start_time`,
      timesheetIds
    );

    const user = await db.get("SELECT full_name FROM users WHERE id = ?", [
      submission.user_id,
    ]);
    const xlsxBuffer = await generateXLSX(timesheets, user.full_name);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=submission_${id}.xlsx`
    );
    res.send(xlsxBuffer);
  } catch (error) {
    console.error("Error generating submission XLSX:", error);
    res.status(500).json({ error: "Failed to generate XLSX" });
  }
});

// Delete submission
router.delete("/submissions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.run("DELETE FROM submissions WHERE id = ?", [id]);
    res.json({ message: "Submission deleted successfully" });
  } catch (error) {
    console.error("Error deleting submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all leave requests
router.get("/leave-requests", async (req, res) => {
  try {
    const requests = await db.all(
      `SELECT lr.*, u.full_name, u.username,
              approver.full_name AS approver_name
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.id
       LEFT JOIN users approver ON approver.id = lr.approved_by
       ORDER BY lr.created_at DESC`
    );

    res.json(requests);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Approve or reject a leave request
router.post(
  "/leave-requests/:id/decision",
  [
    body("status").isIn(["approved", "rejected"]),
    body("adminNote").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status, adminNote } = req.body;

      const request = await db.get(
        "SELECT * FROM leave_requests WHERE id = ?",
        [id]
      );

      if (!request) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Leave request already decided" });
      }

      await ensureLeaveBalance(request.user_id);

      // If rejected, restore the deducted hours
      if (status === "rejected") {
        const column =
          request.balance_type === "vacation"
            ? "vacation_hours"
            : "overtime_hours";

        await db.run(
          `UPDATE leave_balances SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [request.hours_requested, request.user_id]
        );
      }

      await db.run(
        `UPDATE leave_requests 
         SET status = ?, admin_note = ?, approved_by = ?, decision_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, adminNote || null, req.user.id, id]
      );

      res.json({ message: `Request ${status}` });
    } catch (error) {
      console.error("Error deciding leave request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Admin: Delete (withdraw) any leave request and refund hours
router.delete("/leave-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const request = await db.get("SELECT * FROM leave_requests WHERE id = ?", [
      id,
    ]);

    if (!request) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    await db.run("BEGIN TRANSACTION");

    // Refund hours
    const column =
      request.balance_type === "vacation" ? "vacation_hours" : "overtime_hours";
    await db.run(
      `UPDATE leave_balances SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [request.hours_requested, request.user_id]
    );

    // Delete request
    await db.run("DELETE FROM leave_requests WHERE id = ?", [id]);

    await db.run("COMMIT");
    res.json({ message: "Leave request deleted and hours refunded" });
  } catch (error) {
    console.error("Error deleting leave request:", error);
    await db.run("ROLLBACK");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: Update any leave request (adjust hours, dates, etc.)
router.put(
  "/leave-requests/:id",
  [
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
    body("startTime").optional().isString(),
    body("endTime").optional().isString(),
    body("hours")
      .isFloat({ min: 0.25 })
      .withMessage("Hours must be at least 0.25"),
    body("balanceType")
      .isIn(["vacation", "overtime"])
      .withMessage("balanceType must be vacation or overtime"),
    body("reason").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        startDate,
        endDate,
        startTime,
        endTime,
        hours,
        balanceType,
        reason,
      } = req.body;

      const existingRequest = await db.get(
        "SELECT * FROM leave_requests WHERE id = ?",
        [id]
      );

      if (!existingRequest) {
        return res.status(404).json({ error: "Leave request not found" });
      }

      const hoursRequested = parseFloat(hours);
      const oldHours = parseFloat(existingRequest.hours_requested);
      const hoursDelta = hoursRequested - oldHours;

      // Check if balance type changed
      if (balanceType !== existingRequest.balance_type) {
        return res.status(400).json({
          error:
            "Cannot change balance type. Delete and create a new request instead.",
        });
      }

      const balance = await ensureLeaveBalance(existingRequest.user_id);
      const available =
        balanceType === "vacation"
          ? parseFloat(balance.vacation_hours || 0)
          : parseFloat(balance.overtime_hours || 0);

      // If increasing hours, check availability
      if (hoursDelta > 0 && hoursDelta > available) {
        return res.status(400).json({
          error: `Insufficient ${balanceType} hours. Available: ${available.toFixed(
            2
          )}`,
        });
      }

      await db.run("BEGIN TRANSACTION");

      // Update request
      await db.run(
        `UPDATE leave_requests 
         SET start_date = ?, end_date = ?, start_time = ?, end_time = ?, hours_requested = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          startDate,
          endDate,
          startTime || null,
          endTime || null,
          hoursRequested,
          reason || null,
          id,
        ]
      );

      // Adjust balance if hours changed
      if (hoursDelta !== 0) {
        const column =
          balanceType === "vacation" ? "vacation_hours" : "overtime_hours";
        await db.run(
          `UPDATE leave_balances SET ${column} = ${column} - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [hoursDelta, existingRequest.user_id]
        );
      }

      await db.run("COMMIT");
      res.json({ message: "Leave request updated" });
    } catch (error) {
      console.error("Error updating leave request:", error);
      await db.run("ROLLBACK");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Send submission email with custom recipient and format
router.post("/submissions/:id/send-email", async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient, format } = req.body;

    // Get submission
    const submission = await db.get(
      `
      SELECT s.*, u.full_name, u.username
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `,
      [id]
    );

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (!submission.timesheet_ids) {
      return res
        .status(400)
        .json({ error: "No timesheets in this submission" });
    }

    // Get timesheets for this submission
    const timesheetIds = submission.timesheet_ids.split(",");
    const placeholders = timesheetIds.map(() => "?").join(",");

    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE id IN (${placeholders}) ORDER BY date, start_time`,
      timesheetIds
    );

    // Get SMTP settings
    const smtpSettings = await db.get("SELECT * FROM smtp_settings LIMIT 1");
    const emailTo = recipient || smtpSettings.email_to;

    // Generate file based on format
    let fileBuffer, fileName, mimeType;

    if (format === "pdf") {
      fileBuffer = await generatePDF(timesheets, submission.full_name);
      fileName = `timesheet_${submission.username}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      mimeType = "application/pdf";
    } else {
      fileBuffer = await generateXLSX(timesheets, submission.full_name);
      fileName = `timesheet_${submission.username}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      mimeType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // Send email
    await sendEmail(
      `Timesheet Submission - ${submission.full_name}`,
      `Timesheet submission from ${submission.full_name}\n\nDate: ${new Date(
        submission.submission_date
      ).toLocaleString()}\nTotal entries: ${
        timesheets.length
      }\n\nSent by admin.`,
      [
        {
          filename: fileName,
          content: fileBuffer,
        },
      ],
      emailTo
    );

    // Update submission status
    await db.run(
      "UPDATE submissions SET status = ?, submission_date = CURRENT_TIMESTAMP WHERE id = ?",
      ["sent", id]
    );

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending submission email:", error);
    res.status(500).json({ error: "Failed to send email: " + error.message });
  }
});

// Update submission (for admin and user editing)
router.put("/submissions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { timesheetIds, timesheet_ids, status } = req.body;
    const ids = timesheetIds || timesheet_ids;

    // Get current submission
    const submission = await db.get("SELECT * FROM submissions WHERE id = ?", [
      id,
    ]);

    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // Only admin can change status, owner can update timesheet IDs
    const updatedTimesheetIds = ids || submission.timesheet_ids;
    const updatedStatus =
      req.user.role === "admin" && status ? status : submission.status;

    await db.run(
      "UPDATE submissions SET timesheet_ids = ?, status = ? WHERE id = ?",
      [updatedTimesheetIds, updatedStatus, id]
    );

    res.json({ message: "Submission updated successfully" });
  } catch (error) {
    console.error("Error updating submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get SMTP settings
router.get("/smtp-settings", async (req, res) => {
  try {
    const settings = await db.get("SELECT * FROM smtp_settings LIMIT 1");

    if (settings) {
      // Don't send password to frontend
      delete settings.smtp_pass;
    }

    res.json(settings || {});
  } catch (error) {
    console.error("Error fetching SMTP settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update SMTP settings (supports Basic and Microsoft 365 OAuth2)
router.put(
  "/smtp-settings",
  [
    body("smtp_host").trim().notEmpty(),
    body("smtp_port").isInt({ min: 1, max: 65535 }),
    body("smtp_user").trim().notEmpty(),
    body("email_from").isEmail(),
    body("email_to").isEmail(),
    body("auth_type").optional().isIn(["basic", "oauth2"]),
    body("oauth_tenant_id").optional(),
    body("oauth_client_id").optional(),
    body("oauth_client_secret").optional(),
    body("oauth_scope").optional(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_pass,
        email_from,
        email_to,
        auth_type = "basic",
        oauth_tenant_id,
        oauth_client_id,
        oauth_client_secret,
        oauth_scope,
      } = req.body;

      if (auth_type === "oauth2" && (!oauth_tenant_id || !oauth_client_id)) {
        return res.status(400).json({
          error: "Tenant ID and Client ID are required for Microsoft 365 OAuth",
        });
      }

      const existing = await db.get("SELECT id FROM smtp_settings LIMIT 1");

      if (existing) {
        const updates = [
          "smtp_host = ?",
          "smtp_port = ?",
          "smtp_secure = ?",
          "smtp_user = ?",
          "email_from = ?",
          "email_to = ?",
          "auth_type = ?",
          "oauth_tenant_id = ?",
          "oauth_client_id = ?",
          "oauth_scope = ?",
          "updated_at = CURRENT_TIMESTAMP",
        ];

        const values = [
          smtp_host,
          smtp_port,
          smtp_secure ? 1 : 0,
          smtp_user,
          email_from,
          email_to,
          auth_type,
          oauth_tenant_id || null,
          oauth_client_id || null,
          oauth_scope || "https://outlook.office365.com/.default",
        ];

        if (smtp_pass) {
          updates.splice(4, 0, "smtp_pass = ?");
          values.splice(4, 0, smtp_pass);
        }

        if (oauth_client_secret) {
          updates.splice(updates.length - 1, 0, "oauth_client_secret = ?");
          values.splice(values.length - 1, 0, oauth_client_secret);
        }

        await db.run(
          `UPDATE smtp_settings SET ${updates.join(", ")} WHERE id = ?`,
          [...values, existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO smtp_settings (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, email_from, email_to, auth_type, oauth_tenant_id, oauth_client_id, oauth_client_secret, oauth_scope)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            smtp_host,
            smtp_port,
            smtp_secure ? 1 : 0,
            smtp_user,
            smtp_pass || "",
            email_from,
            email_to,
            auth_type,
            oauth_tenant_id || null,
            oauth_client_id || null,
            oauth_client_secret || null,
            oauth_scope || "https://outlook.office365.com/.default",
          ]
        );
      }

      res.json({ message: "SMTP settings updated successfully" });
    } catch (error) {
      console.error("Error updating SMTP settings:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Test SMTP settings
router.post("/smtp-settings/test", async (req, res) => {
  try {
    const result = await testSMTPConnection();
    res.json(result);
  } catch (error) {
    console.error("Error testing SMTP:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get branding settings
router.get("/branding-settings", async (req, res) => {
  try {
    const settings = await db.get("SELECT * FROM branding_settings LIMIT 1");
    res.json(settings || {});
  } catch (error) {
    console.error("Error fetching branding settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update branding settings
router.put(
  "/branding-settings",
  [
    body("company_name")
      .trim()
      .notEmpty()
      .withMessage("Company name is required"),
    body("primary_color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Invalid color format"),
    body("tagline").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error("[BRANDING UPDATE] Validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { company_name, primary_color, tagline } = req.body;
      console.log("[BRANDING UPDATE] Received:", {
        company_name,
        primary_color,
        tagline,
      });

      // Check if settings exist
      const existing = await db.get("SELECT id FROM branding_settings LIMIT 1");

      if (existing) {
        await db.run(
          `UPDATE branding_settings SET company_name = ?, primary_color = ?, tagline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [
            company_name,
            primary_color || "#0066CC",
            tagline || "Please sign in to continue",
            existing.id,
          ]
        );
        console.log(
          "[BRANDING UPDATE] Updated existing record, ID:",
          existing.id
        );
      } else {
        await db.run(
          `INSERT INTO branding_settings (company_name, primary_color, tagline) VALUES (?, ?, ?)`,
          [
            company_name,
            primary_color || "#0066CC",
            tagline || "Please sign in to continue",
          ]
        );
        console.log("[BRANDING UPDATE] Inserted new record");
      }

      // Return updated settings
      const updated = await db.get("SELECT * FROM branding_settings LIMIT 1");
      res.json({
        message: "Branding settings updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("Error updating branding settings:", error);
      res
        .status(500)
        .json({ error: "Internal server error: " + error.message });
    }
  }
);

// Get custom CSS
router.get("/branding-settings/custom-css", async (_req, res) => {
  try {
    const settings = await db.get(
      "SELECT custom_css FROM branding_settings LIMIT 1"
    );
    res.json({ custom_css: settings?.custom_css || "" });
  } catch (error) {
    console.error("Error fetching custom CSS:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update custom CSS
router.put(
  "/branding-settings/custom-css",
  [
    body("custom_css")
      .isString()
      .withMessage("CSS must be a string")
      .isLength({ max: 20000 })
      .withMessage("CSS too long (max 20000 chars)"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { custom_css } = req.body;

      const existing = await db.get("SELECT id FROM branding_settings LIMIT 1");
      if (existing) {
        await db.run(
          `UPDATE branding_settings SET custom_css = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [custom_css, existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO branding_settings (custom_css) VALUES (?)`,
          [custom_css]
        );
      }

      const updated = await db.get(
        "SELECT custom_css FROM branding_settings LIMIT 1"
      );
      res.json({
        message: "Custom CSS saved",
        custom_css: updated?.custom_css || "",
      });
    } catch (error) {
      console.error("Error updating custom CSS:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, "logo" + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, svg)"));
    }
  },
});

// Upload logo
router.post(
  "/branding-settings/logo",
  upload.single("logo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const logoPath = "/uploads/" + req.file.filename;

      // Update branding settings with logo path
      const existing = await db.get("SELECT id FROM branding_settings LIMIT 1");

      if (existing) {
        await db.run(
          `UPDATE branding_settings SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [logoPath, existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO branding_settings (company_name, logo_path) VALUES (?, ?)`,
          ["Timesheet System", logoPath]
        );
      }

      res.json({ message: "Logo uploaded successfully", logoPath });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

// ===== Fleet Management =====
// Get distinct truck types (used to populate user truck-type dropdown)
router.get("/fleet/types", async (_req, res) => {
  try {
    const rows = await db.all(
      `SELECT DISTINCT truck_type FROM fleet_vehicles WHERE truck_type IS NOT NULL AND TRIM(truck_type) != '' ORDER BY truck_type ASC`
    );
    const types = rows.map((r) => r.truck_type);
    res.json(types);
  } catch (error) {
    console.error("Error fetching fleet truck types:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Get all vehicles
router.get("/fleet/vehicles", async (_req, res) => {
  try {
    const vehicles = await db.all(
      `SELECT v.*, 
              c.name AS company_name,
              (SELECT COUNT(*) FROM fleet_maintenance fm WHERE fm.vehicle_id = v.id) AS maintenance_count
       FROM fleet_vehicles v
       LEFT JOIN companies c ON c.id = v.company_id
       ORDER BY v.license_plate ASC`
    );
    res.json(vehicles);
  } catch (error) {
    console.error("Error fetching fleet vehicles:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single vehicle with maintenance history
router.get("/fleet/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await db.get(
      `SELECT v.*, 
              c.name AS company_name,
              (SELECT COUNT(*) FROM fleet_maintenance fm WHERE fm.vehicle_id = v.id) AS maintenance_count
       FROM fleet_vehicles v
       LEFT JOIN companies c ON c.id = v.company_id
       WHERE v.id = ?`,
      [id]
    );
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

    const maintenance = await db.all(
      `SELECT * FROM fleet_maintenance WHERE vehicle_id = ? ORDER BY maintenance_date DESC, id DESC`,
      [id]
    );

    res.json({ vehicle, maintenance });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create vehicle
router.post(
  "/fleet/vehicles",
  [
    body("license_plate")
      .trim()
      .notEmpty()
      .withMessage("License plate is required"),
    body("km").optional().isNumeric(),
    body("apk_due_date").optional().isString(),
    body("rit_number").optional().isString(),
    body("truck_type").optional().trim().isLength({ max: 100 }),
    body("company_id").optional().isInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { license_plate, km, apk_due_date, rit_number, company_id, truck_type } =
        req.body;

      const result = await db.run(
        `INSERT INTO fleet_vehicles (license_plate, km, apk_due_date, rit_number, company_id, truck_type) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          license_plate,
          km || 0,
          apk_due_date || null,
          rit_number || null,
          company_id || null,
          truck_type || null,
        ]
      );

      const created = await db.get(
        "SELECT * FROM fleet_vehicles WHERE id = ?",
        [result.id]
      );
      res.json(created);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update vehicle
router.put(
  "/fleet/vehicles/:id",
  [
    body("license_plate").optional().trim().notEmpty(),
    body("km").optional().isNumeric(),
    body("apk_due_date").optional().isString(),
    body("rit_number").optional().isString(),
    body("truck_type").optional().trim().isLength({ max: 100 }),
    body("company_id").optional().isInt(),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await db.get(
        "SELECT * FROM fleet_vehicles WHERE id = ?",
        [id]
      );
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

      const { license_plate, km, apk_due_date, rit_number, company_id, truck_type } =
        req.body;
      await db.run(
        `UPDATE fleet_vehicles 
         SET license_plate = COALESCE(?, license_plate),
             km = COALESCE(?, km),
             apk_due_date = COALESCE(?, apk_due_date),
             rit_number = COALESCE(?, rit_number),
             company_id = COALESCE(?, company_id),
             truck_type = COALESCE(?, truck_type),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          license_plate || null,
          km ?? null,
          apk_due_date || null,
          rit_number || null,
          company_id ?? null,
          truck_type || null,
          id,
        ]
      );

      const updated = await db.get(
        "SELECT * FROM fleet_vehicles WHERE id = ?",
        [id]
      );
      res.json(updated);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete vehicle
router.delete("/fleet/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM fleet_vehicles WHERE id = ?", [id]);
    res.json({ message: "Vehicle deleted" });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add maintenance entry
router.post(
  "/fleet/vehicles/:id/maintenance",
  [
    body("maintenance_date").trim().notEmpty().withMessage("Date is required"),
    body("km").optional().isNumeric(),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const vehicle = await db.get(
        "SELECT id FROM fleet_vehicles WHERE id = ?",
        [id]
      );
      if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });

      const { maintenance_date, km, notes } = req.body;

      const result = await db.run(
        `INSERT INTO fleet_maintenance (vehicle_id, maintenance_date, km, notes) VALUES (?, ?, ?, ?)`,
        [id, maintenance_date, km || 0, notes || null]
      );

      const created = await db.get(
        "SELECT * FROM fleet_maintenance WHERE id = ?",
        [result.id]
      );
      res.json(created);
    } catch (error) {
      console.error("Error adding maintenance:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update maintenance record
router.put(
  "/fleet/maintenance/:id",
  [
    body("maintenance_date").optional().trim().notEmpty(),
    body("km").optional().isNumeric(),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const maintenance = await db.get(
        "SELECT id FROM fleet_maintenance WHERE id = ?",
        [id]
      );
      if (!maintenance)
        return res.status(404).json({ error: "Maintenance record not found" });

      const { maintenance_date, km, notes } = req.body;
      await db.run(
        `UPDATE fleet_maintenance 
         SET maintenance_date = COALESCE(?, maintenance_date),
             km = COALESCE(?, km),
             notes = COALESCE(?, notes)
         WHERE id = ?`,
        [maintenance_date || null, km ?? null, notes || null, id]
      );

      const updated = await db.get(
        "SELECT * FROM fleet_maintenance WHERE id = ?",
        [id]
      );
      res.json(updated);
    } catch (error) {
      console.error("Error updating maintenance:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete maintenance record
router.delete("/fleet/maintenance/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM fleet_maintenance WHERE id = ?", [id]);
    res.json({ message: "Maintenance record deleted" });
  } catch (error) {
    console.error("Error deleting maintenance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get hours report for all users or specific user
router.get("/hours-report", async (req, res) => {
  try {
    const userId = req.query.userId;

    let query = `
      SELECT 
        u.id as user_id,
        u.full_name,
        t.week_number,
        COUNT(*) as work_days,
        SUM(CAST(t.total_hours AS REAL)) as total_hours
      FROM users u
      LEFT JOIN timesheets t ON u.id = t.user_id
      LEFT JOIN submissions s ON (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')
      WHERE 1=1 AND s.id IS NOT NULL
    `;

    const params = [];
    if (userId) {
      query += " AND u.id = ?";
      params.push(userId);
    }

    query += `
      GROUP BY u.id, u.full_name, t.week_number
      ORDER BY u.full_name, t.week_number DESC
    `;

    const results = await db.all(query, params);

    // Calculate overworked hours
    const report = results.map((row) => ({
      ...row,
      total_hours: parseFloat(row.total_hours || 0).toFixed(2),
      overworked: row.week_number
        ? (parseFloat(row.total_hours || 0) - 40).toFixed(2)
        : "0.00",
    }));

    res.json(report);
  } catch (error) {
    console.error("Error fetching hours report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper functions
async function ensureLeaveBalance(userId) {
  const user = await db.get("SELECT id FROM users WHERE id = ?", [userId]);
  if (!user) return null;

  const existing = await db.get(
    "SELECT * FROM leave_balances WHERE user_id = ?",
    [userId]
  );

  if (existing) return existing;

  await db.run(
    "INSERT INTO leave_balances (user_id, vacation_hours, overtime_hours) VALUES (?, 216, 0)",
    [userId]
  );

  return { user_id: userId, vacation_hours: 216, overtime_hours: 0 };
}

// ===== USER COMPANIES ENDPOINTS =====

// Get all companies for a user
router.get("/users/:id/companies", async (req, res) => {
  try {
    const companies = await db.all(
      `SELECT c.id, c.name, c.pause_time, uc.is_primary
       FROM user_companies uc
       JOIN companies c ON c.id = uc.company_id
       WHERE uc.user_id = ?
       ORDER BY uc.is_primary DESC, c.name ASC`,
      [req.params.id]
    );
    res.json(companies);
  } catch (error) {
    console.error("Error fetching user companies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user's companies (multi-select)
router.put("/users/:id/companies", async (req, res) => {
  try {
    const { companyIds, primaryCompanyId } = req.body;
    const userId = req.params.id;

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one company is required" });
    }

    // Start transaction - remove all existing assignments
    await db.run("DELETE FROM user_companies WHERE user_id = ?", [userId]);

    // Insert new assignments
    for (const companyId of companyIds) {
      const isPrimary = companyId === primaryCompanyId ? 1 : 0;
      await db.run(
        "INSERT INTO user_companies (user_id, company_id, is_primary) VALUES (?, ?, ?)",
        [userId, companyId, isPrimary]
      );
    }

    // Update primary company_id in users table for backward compatibility
    const primaryId = primaryCompanyId || companyIds[0];
    await db.run("UPDATE users SET company_id = ? WHERE id = ?", [
      primaryId,
      userId,
    ]);

    res.json({
      message: "User companies updated successfully",
      userId,
      companyIds,
      primaryCompanyId: primaryId,
    });
  } catch (error) {
    console.error("Error updating user companies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function calculateTotalHours(startTime, endTime, pauseTime) {
  if (!startTime || !endTime || !pauseTime) {
    return "0.00";
  }
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const [pauseHour, pauseMinute] = pauseTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const pauseMinutes = pauseHour * 60 + pauseMinute;

  const totalMinutes = endMinutes - startMinutes - pauseMinutes;
  return (totalMinutes / 60).toFixed(2);
}

// Get all companies
router.get("/companies", async (req, res) => {
  try {
    const companies = await db.all(
      "SELECT id, name, pause_time FROM companies ORDER BY name"
    );
    res.json(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset MFA for a user (admin only) - requires admin's own MFA token
router.post("/users/:id/reset-mfa", async (req, res) => {
  try {
    const { id } = req.params;
    const { mfaToken } = req.body;

    if (!mfaToken) {
      return res.status(400).json({ error: "Admin MFA token is required" });
    }

    // Verify admin's own MFA
    const admin = await db.get(
      "SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!admin || !admin.mfa_enabled || !admin.mfa_secret) {
      return res
        .status(403)
        .json({ error: "Admin MFA must be enabled to reset user MFA" });
    }

    const verified = speakeasy.totp.verify({
      secret: admin.mfa_secret,
      encoding: "base32",
      token: mfaToken,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid admin MFA token" });
    }

    // Check if target user exists
    const user = await db.get("SELECT id FROM users WHERE id = ?", [id]);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Reset MFA for target user
    await db.run(
      `UPDATE users 
       SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_skip_count = 0 
       WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "MFA reset successfully. User can set up new MFA on next login.",
    });
  } catch (error) {
    console.error("Error resetting MFA:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset user password (admin only) - requires admin's own MFA token
router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, showPassword, mfaToken } = req.body;

    if (!mfaToken) {
      return res.status(400).json({ error: "Admin MFA token is required" });
    }

    // Verify admin's own MFA
    const admin = await db.get(
      "SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!admin || !admin.mfa_enabled || !admin.mfa_secret) {
      return res
        .status(403)
        .json({ error: "Admin MFA must be enabled to reset user passwords" });
    }

    const verified = speakeasy.totp.verify({
      secret: admin.mfa_secret,
      encoding: "base32",
      token: mfaToken,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ error: "Invalid admin MFA token" });
    }

    // Check if target user exists. Some older DBs may not have an `email` column,
    // so check table info first and only select `email` when present.
    const tableInfo = await db.all("PRAGMA table_info('users')");
    const hasEmailCol = tableInfo.some((c) => c.name === "email");

    // Fetch user row with or without email depending on schema
    const user = hasEmailCol
      ? await db.get("SELECT id, username, email FROM users WHERE id = ?", [id])
      : await db.get("SELECT id, username FROM users WHERE id = ?", [id]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Determine password: use provided or generate a temporary one
    let passwordToSet = newPassword;
    if (!passwordToSet || passwordToSet.trim().length === 0) {
      // generate a reasonably strong temporary password
      passwordToSet = crypto
        .randomBytes(9)
        .toString("base64")
        .replace(/[+=\\/]/g, "")
        .slice(0, 12);
    }

    if (typeof passwordToSet !== "string" || passwordToSet.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Hash and update
    const hashed = await bcrypt.hash(passwordToSet, 10);
    await db.run(
      "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [hashed, id]
    );

    // Try to email the user their new password if email exists
    let emailed = false;
    try {
      if (hasEmailCol && user.email) {
        await sendEmail({
          to: user.email,
          subject: "Your account password has been reset",
          text: `Hello ${user.username},\n\nYour account password was reset by an administrator. Use the following temporary password to sign in:\n\n${passwordToSet}\n\nAfter signing in, please change your password in your account settings.\n\nIf you did not request this change, contact your administrator.`,
        });
        emailed = true;
      }
    } catch (emailErr) {
      console.error("Failed to email new password:", emailErr);
      // continue - we still return success but note email failed
    }

    const response = { success: true, message: "Password reset successfully", emailed };
    if (showPassword) response.tempPassword = passwordToSet;

    res.json(response);
  } catch (error) {
    console.error("Error resetting user password:", error);
    // Return detailed error in development to aid debugging
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

module.exports = router;
