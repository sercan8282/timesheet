const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

// Get current user info
router.get("/me", async (req, res) => {
  try {
    const user = await db.get(
      `SELECT 
          u.id, u.username, u.full_name, u.role, u.created_at,
          u.company_id, c.name AS company_name, c.pause_time AS company_pause_time
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get all companies for this user
    const userCompanies = await db.all(
      `SELECT c.id, c.name, c.pause_time, uc.is_primary
       FROM user_companies uc
       JOIN companies c ON c.id = uc.company_id
       WHERE uc.user_id = ?
       ORDER BY uc.is_primary DESC, c.name ASC`,
      [user.id]
    );

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      isAdmin: user.role === "admin",
      role: user.role || "user",
      createdAt: user.created_at,
      companyId: user.company_id,
      companyName: user.company_name,
      companyPauseTime: user.company_pause_time,
      company_name: user.company_name,
      company_pause_time: user.company_pause_time,
      userCompanies: userCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        pause_time: c.pause_time,
        is_primary: c.is_primary === 1,
      })),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Change password
router.post(
  "/change-password",
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Get current user
      const user = await db.get("SELECT * FROM users WHERE id = ?", [
        req.user.id,
      ]);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);

      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.run(
        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, req.user.id]
      );

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get user's timesheets
router.get("/timesheets", async (req, res) => {
  try {
    // Get all submissions for this user to find submitted timesheet IDs
    const submissions = await db.all(
      "SELECT timesheet_ids FROM submissions WHERE user_id = ?",
      [req.user.id]
    );

    // Extract all submitted timesheet IDs
    const submittedIds = new Set();
    submissions.forEach((sub) => {
      if (sub.timesheet_ids) {
        const ids = sub.timesheet_ids
          .split(",")
          .map((id) => parseInt(id.trim()));
        ids.forEach((id) => submittedIds.add(id));
      }
    });

    // Get all timesheets for user
    const allTimesheets = await db.all(
      "SELECT * FROM timesheets WHERE user_id = ? ORDER BY date DESC, start_time DESC",
      [req.user.id]
    );

    // Filter out submitted timesheets - only return unsumbitted ones
    const unsubmittedTimesheets = allTimesheets.filter(
      (ts) => !submittedIds.has(ts.id)
    );

    res.json(unsubmittedTimesheets);
  } catch (error) {
    console.error("Error fetching timesheets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single timesheet by ID
router.get("/timesheets/:id", async (req, res) => {
  try {
    const timesheetId = parseInt(req.params.id);
    if (isNaN(timesheetId)) {
      return res.status(400).json({ error: "Invalid timesheet ID" });
    }

    const timesheet = await db.get(
      "SELECT * FROM timesheets WHERE id = ? AND user_id = ?",
      [timesheetId, req.user.id]
    );

    if (!timesheet) {
      return res.status(404).json({ error: "Timesheet not found" });
    }

    res.json(timesheet);
  } catch (error) {
    console.error("Error fetching timesheet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get timesheet details by IDs
router.post("/timesheets/details", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Timesheet IDs are required" });
    }

    const placeholders = ids.map(() => "?").join(",");
    const timesheets = await db.all(
      `SELECT t.id, t.week_number, t.date, t.start_time, t.end_time, t.start_km, t.end_km, t.pause_time, t.ritnumber, t.user_id, t.company_id,
              COALESCE(c.name, 'Unknown') AS company_name
       FROM timesheets t
       LEFT JOIN companies c ON t.company_id = c.id
       WHERE t.id IN (${placeholders}) AND t.user_id = ? ORDER BY t.week_number, t.date`,
      [...ids, req.user.id]
    );

    // Enhance with user_name from users table (fallback to token fullName/username)
    const enrichedTimesheets = timesheets.map((ts) => ({
      ...ts,
      user_name:
        req.user.fullName || req.user.username || ts.user_name || "Unknown",
    }));

    res.json(enrichedTimesheets);
  } catch (error) {
    console.error("Error fetching timesheet details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add timesheet entry
router.post(
  "/timesheets",
  [
    body("date").isISO8601().withMessage("Valid date is required"),
    body("startTime")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Valid start time is required (HH:MM)"),
    body("endTime")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Valid end time is required (HH:MM)"),
    body("startKm")
      .isFloat({ min: 0 })
      .withMessage("Valid start km is required"),
    body("endKm").isFloat({ min: 0 }).withMessage("Valid end km is required"),
    body("pauseTime")
      .optional()
      .matches(/^([0-9]+):([0-5][0-9])$/)
      .withMessage("Valid pause time is required (HH:MM)"),
    body("ritnumber").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let {
        date,
        startTime,
        endTime,
        startKm,
        endKm,
        pauseTime,
        ritnumber,
        companyId,
      } = req.body;

      // Default pause based on company if not provided
      if (!pauseTime) {
        pauseTime =
          req.user.company_pause_time || req.user.companyPauseTime || "00:30";
      }

      try {
        // Calculate week number
        const dateObj = new Date(date);
        const weekNumber = getWeekNumber(dateObj);

        // Calculate total hours
        const totalHours = calculateTotalHours(startTime, endTime, pauseTime);

        // Calculate total km
        const totalKm = endKm - startKm;

        const result = await db.run(
          `INSERT INTO timesheets (user_id, week_number, date, start_time, end_time, start_km, end_km, pause_time, total_hours, total_km, ritnumber, company_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
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
            companyId || null,
          ]
        );

        res.status(201).json({
          id: result.id,
          userId: req.user.id,
          weekNumber,
          date,
          startTime,
          endTime,
          startKm,
          endKm,
          pauseTime,
          totalHours,
          totalKm,
          ritnumber: ritnumber || "",
          companyId: companyId || null,
        });
      } catch (calcError) {
        console.error("Error during calculation or insert:", calcError);
        res
          .status(500)
          .json({ error: "Failed to create timesheet: " + calcError.message });
      }
    } catch (error) {
      console.error("Error creating timesheet:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update timesheet entry
router.put(
  "/timesheets/:id",
  [
    body("date").optional().isISO8601(),
    body("startTime")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("endTime")
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body("startKm").optional().isFloat({ min: 0 }),
    body("endKm").optional().isFloat({ min: 0 }),
    body("pauseTime")
      .optional()
      .matches(/^([0-9]+):([0-5][0-9])$/),
    body("ritnumber").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      // Verify ownership
      const timesheet = await db.get(
        "SELECT * FROM timesheets WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );

      if (!timesheet) {
        return res.status(404).json({ error: "Timesheet not found" });
      }

      const { date, startTime, endTime, startKm, endKm, pauseTime, ritnumber } =
        req.body;

      // Use existing values if not provided
      const updatedDate = date || timesheet.date;
      const updatedStartTime = startTime || timesheet.start_time;
      const updatedEndTime = endTime || timesheet.end_time;
      const updatedStartKm =
        startKm !== undefined ? startKm : timesheet.start_km;
      const updatedEndKm = endKm !== undefined ? endKm : timesheet.end_km;
      let updatedPauseTime = pauseTime || timesheet.pause_time;

      // Default pause based on company if still missing
      if (!updatedPauseTime) {
        updatedPauseTime =
          req.user.company_pause_time || req.user.companyPauseTime || "00:30";
      }
      const updatedRitnumber =
        ritnumber !== undefined ? ritnumber : timesheet.ritnumber || "";

      // Recalculate
      const weekNumber = getWeekNumber(new Date(updatedDate));
      const totalHours = calculateTotalHours(
        updatedStartTime,
        updatedEndTime,
        updatedPauseTime
      );
      const totalKm = updatedEndKm - updatedStartKm;

      await db.run(
        `UPDATE timesheets 
         SET week_number = ?, date = ?, start_time = ?, end_time = ?, start_km = ?, end_km = ?, pause_time = ?, total_hours = ?, total_km = ?, ritnumber = ?
         WHERE id = ? AND user_id = ?`,
        [
          weekNumber,
          updatedDate,
          updatedStartTime,
          updatedEndTime,
          updatedStartKm,
          updatedEndKm,
          updatedPauseTime,
          totalHours,
          totalKm,
          updatedRitnumber,
          id,
          req.user.id,
        ]
      );

      res.json({ message: "Timesheet updated successfully" });
    } catch (error) {
      console.error("Error updating timesheet:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete timesheet entry
router.delete("/timesheets/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.run(
      "DELETE FROM timesheets WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Timesheet not found" });
    }

    res.json({ message: "Timesheet deleted successfully" });
  } catch (error) {
    console.error("Error deleting timesheet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's submissions history
router.get("/submissions", async (req, res) => {
  try {
    const submissions = await db.all(
      `SELECT 
         s.*, 
         COALESCE(u.full_name, u.username, s.user_name, 'Unknown') AS user_name
       FROM submissions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.user_id = ?
       ORDER BY s.submission_date DESC`,
      [req.user.id]
    );

    res.json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get leave balance for current user
router.get("/leave/balance", async (req, res) => {
  try {
    const balance = await ensureLeaveBalance(req.user.id);
    res.json({
      vacation_hours: balance.vacation_hours,
      overtime_hours: balance.overtime_hours,
      updated_at: balance.updated_at,
    });
  } catch (error) {
    console.error("Error fetching leave balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get leave requests for current user
router.get("/leave/requests", async (req, res) => {
  try {
    const requests = await db.all(
      `SELECT lr.*, approver.full_name AS approver_name
       FROM leave_requests lr
       LEFT JOIN users approver ON approver.id = lr.approved_by
       WHERE lr.user_id = ?
       ORDER BY lr.created_at DESC`,
      [req.user.id]
    );

    res.json(requests);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all approved leave requests for calendar view (all users)
router.get("/leave/calendar", async (req, res) => {
  try {
    const requests = await db.all(
      `SELECT lr.*, u.full_name, u.username
       FROM leave_requests lr
       INNER JOIN users u ON u.id = lr.user_id
       WHERE lr.status = 'approved' AND u.is_blocked = 0
       ORDER BY lr.start_date ASC`
    );

    res.json(requests);
  } catch (error) {
    console.error("Error fetching calendar leave requests:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit a leave request (deducts balance immediately)
router.post(
  "/leave/requests",
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

      const {
        startDate,
        endDate,
        startTime,
        endTime,
        hours,
        balanceType,
        reason,
      } = req.body;
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        return res
          .status(400)
          .json({ error: "End date must be on or after start date" });
      }

      const hoursRequested = parseFloat(hours);

      const balance = await ensureLeaveBalance(req.user.id);
      const available =
        balanceType === "vacation"
          ? parseFloat(balance.vacation_hours || 0)
          : parseFloat(balance.overtime_hours || 0);

      if (hoursRequested > available) {
        return res.status(400).json({
          error: `Insufficient ${balanceType} hours. Available: ${available.toFixed(
            2
          )}`,
        });
      }

      // Deduct immediately and create request
      await db.run("BEGIN TRANSACTION");

      await db.run(
        `INSERT INTO leave_requests (user_id, start_date, end_date, start_time, end_time, hours_requested, balance_type, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          startDate,
          endDate,
          startTime || null,
          endTime || null,
          hoursRequested,
          balanceType,
          reason || null,
        ]
      );

      if (balanceType === "vacation") {
        await db.run(
          "UPDATE leave_balances SET vacation_hours = vacation_hours - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
          [hoursRequested, req.user.id]
        );
      } else {
        await db.run(
          "UPDATE leave_balances SET overtime_hours = overtime_hours - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
          [hoursRequested, req.user.id]
        );
      }

      await db.run("COMMIT");

      res.status(201).json({ message: "Leave request submitted" });
    } catch (error) {
      console.error("Error submitting leave request:", error);
      await db.run("ROLLBACK");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update (withdraw/modify) a leave request (even if approved)
router.put(
  "/leave/requests/:id",
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
        "SELECT * FROM leave_requests WHERE id = ? AND user_id = ?",
        [id, req.user.id]
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

      const balance = await ensureLeaveBalance(req.user.id);
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
          [hoursDelta, req.user.id]
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

// Delete (withdraw) a leave request (even if approved, refunds hours)
router.delete("/leave/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const request = await db.get(
      "SELECT * FROM leave_requests WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (!request) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    await db.run("BEGIN TRANSACTION");

    // Refund hours
    const column =
      request.balance_type === "vacation" ? "vacation_hours" : "overtime_hours";
    await db.run(
      `UPDATE leave_balances SET ${column} = ${column} + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [request.hours_requested, req.user.id]
    );

    // Delete request
    await db.run("DELETE FROM leave_requests WHERE id = ?", [id]);

    await db.run("COMMIT");
    res.json({ message: "Leave request withdrawn and hours refunded" });
  } catch (error) {
    console.error("Error deleting leave request:", error);
    await db.run("ROLLBACK");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get weekly summary with pagination
router.get("/weekly-summary", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // Get weekly summary data - only count submitted timesheets
    const weeklySummary = await db.all(
      `
      SELECT 
        t.week_number,
        COUNT(*) as work_days,
        SUM(CAST(t.total_hours AS REAL)) as total_hours
      FROM timesheets t
      INNER JOIN submissions s ON (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')
      WHERE t.user_id = ?
      GROUP BY t.week_number
      ORDER BY t.week_number DESC
      LIMIT ? OFFSET ?
    `,
      [req.user.id, limit, offset]
    );

    // Get total count for pagination
    const totalResult = await db.get(
      `
      SELECT COUNT(DISTINCT t.week_number) as total
      FROM timesheets t
      INNER JOIN submissions s ON (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')
      WHERE t.user_id = ?
    `,
      [req.user.id]
    );

    // Calculate overworked hours (assuming 40 hours per week is standard)
    const summary = weeklySummary.map((week) => ({
      ...week,
      total_hours: parseFloat(week.total_hours || 0).toFixed(2),
      overworked: (parseFloat(week.total_hours || 0) - 40).toFixed(2),
    }));

    res.json({
      data: summary,
      pagination: {
        page,
        limit,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching weekly summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper function to calculate week number
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

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Helper function to calculate total hours
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

// Get backup codes (for MFA-enabled users)
router.get("/backup-codes", async (req, res) => {
  try {
    const user = await db.get(
      "SELECT mfa_enabled, mfa_backup_codes FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!user || !user.mfa_enabled) {
      return res.status(400).json({ error: "MFA not enabled" });
    }

    if (!user.mfa_backup_codes) {
      return res.status(400).json({ error: "No backup codes found" });
    }

    try {
      const codes = JSON.parse(user.mfa_backup_codes);
      res.json({ codes: codes });
    } catch (error) {
      res.status(500).json({ error: "Failed to parse backup codes" });
    }
  } catch (error) {
    console.error("Error fetching backup codes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
