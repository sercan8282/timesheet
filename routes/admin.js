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
const { encryptPassword, decryptPassword } = require("../utils/encryption");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// =========================
// System Update (background)
// =========================
const { spawn } = require("child_process");
let updateInProgress = false;
let updateStatusMessages = [];
const updateSseClients = new Set();

// Helper: broadcast status to SSE clients
function broadcastUpdateStatus(line) {
  const msg = typeof line === "string" ? line : JSON.stringify(line);
  updateStatusMessages.push(msg);
  updateSseClients.forEach((res) => {
    try {
      res.write(`data: ${msg}\n\n`);
    } catch (e) {
      // drop broken client
      updateSseClients.delete(res);
    }
  });
}

// SSE stream of update status
router.get("/system/update/status", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  // Send existing messages
  try {
    updateStatusMessages.forEach((msg) => {
      res.write(`data: ${msg}\n\n`);
    });
  } catch (e) {}

  // Keep connection open
  updateSseClients.add(res);

  req.on("close", () => {
    updateSseClients.delete(res);
    try {
      res.end();
    } catch (e) {}
  });
});

// =========================
// API Keys Management
// =========================

// Create a new API key (returns plaintext once)
router.post(
  "/api-keys",
  [body("label").optional().isString().isLength({ max: 100 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const label = (req.body.label || "").trim();
      const rawKey = crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      await db.run(
        `INSERT INTO api_keys (key_hash, label, created_by) VALUES (?, ?, ?)`,
        [keyHash, label, req.user.id]
      );
      return res.json({ key: rawKey, label });
    } catch (error) {
      console.error("Error creating API key:", error);
      return res.status(500).json({ error: "Failed to create API key" });
    }
  }
);

// List API keys (no plaintext)
router.get("/api-keys", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, label, created_by, created_at, revoked_at FROM api_keys ORDER BY created_at DESC`
    );
    return res.json({ keys: rows });
  } catch (error) {
    console.error("Error listing API keys:", error);
    return res.status(500).json({ error: "Failed to list API keys" });
  }
});

// Revoke API key
router.post("/api-keys/:id/revoke", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    await db.run(`UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return res.status(500).json({ error: "Failed to revoke API key" });
  }
});

// Trigger system update (asynchronous)
router.post("/system/update", async (req, res) => {
  if (updateInProgress) {
    return res.status(429).json({ error: "Update already in progress" });
  }

  updateInProgress = true;
  updateStatusMessages = [];
  broadcastUpdateStatus({ stage: "start", message: "Preparing update" });

  // Determine platform-specific script and spawn command
  const projectRoot = path.join(__dirname, "..");
  const isWin = process.platform === "win32";
  let child;
  if (isWin) {
    const ps1 = path.join(projectRoot, "scripts", "update.ps1");
    if (!fs.existsSync(ps1)) {
      broadcastUpdateStatus({ stage: "error", message: "Windows update script not found" });
      updateInProgress = false;
      return res.status(500).json({ error: "Windows update script not found" });
    }
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      ps1,
    ];
    child = spawn("powershell", args, { cwd: projectRoot });
  } else {
    const sh = path.join(projectRoot, "scripts", "update.sh");
    if (!fs.existsSync(sh)) {
      broadcastUpdateStatus({ stage: "error", message: "Linux update script not found" });
      updateInProgress = false;
      return res.status(500).json({ error: "Linux update script not found" });
    }
    child = spawn("bash", [sh], { cwd: projectRoot });
  }

  child.stdout.on("data", (data) => {
    const lines = String(data).split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => broadcastUpdateStatus(line));
  });

  child.stderr.on("data", (data) => {
    const lines = String(data).split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => broadcastUpdateStatus(`[error] ${line}`));
  });

  child.on("close", (code) => {
    if (code === 0) {
      broadcastUpdateStatus({ stage: "done", message: "Update complete" });
    } else {
      broadcastUpdateStatus({ stage: "error", message: `Update failed with code ${code}` });
    }
    updateInProgress = false;
  });

  res.json({ ok: true, started: true });
});

// Update or insert translations (bulk)
router.put("/i18n", async (req, res) => {
  try {
    const items = req.body;
    if (!items || !Array.isArray(items))
      return res
        .status(400)
        .json({ error: "Expected an array of translations" });
    const dryRun =
      req.query &&
      (req.query.dryRun === "1" ||
        String(req.query.dryRun) === "true" ||
        req.query.dry_run === "1");

    const resultDetails = [];
    let processed = 0;

    for (const it of items) {
      const namespace = it.namespace && String(it.namespace).trim();
      const key = it.key && String(it.key).trim();
      const locale = it.locale && String(it.locale).trim().toLowerCase();
      const text =
        typeof it.text === "undefined" || it.text === null
          ? ""
          : String(it.text);

      const detail = { namespace, key, locale, text, action: "skip" };
      if (!namespace || !key || !locale) {
        detail.action = "invalid";
        resultDetails.push(detail);
        continue;
      }

      // Check existing translation
      const existing = await db.get(
        `SELECT text FROM translations WHERE namespace = ? AND key = ? AND locale = ?`,
        [namespace, key, locale]
      );

      if (existing) {
        if (existing.text === text) {
          detail.action = "noop";
        } else {
          detail.action = "update";
          detail.currentText = existing.text;
        }
      } else {
        detail.action = "insert";
      }

      resultDetails.push(detail);

      if (dryRun) {
        // don't apply changes
        processed++;
        continue;
      }

      // Apply changes
      if (detail.action === "update") {
        await db.run(
          `UPDATE translations SET text = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE namespace = ? AND key = ? AND locale = ?`,
          [text, req.user.id, namespace, key, locale]
        );
      } else if (detail.action === "insert") {
        await db.run(
          `INSERT INTO translations (namespace, key, locale, text, updated_by) VALUES (?, ?, ?, ?, ?)`,
          [namespace, key, locale, text, req.user.id]
        );
      }
      processed++;
    }

    if (dryRun) {
      // Summarize actions
      const summary = resultDetails.reduce((acc, d) => {
        acc[d.action] = (acc[d.action] || 0) + 1;
        return acc;
      }, {});
      return res.json({ dryRun: true, summary, details: resultDetails });
    }

    // Optionally record import audit if requested
    try {
      const record =
        req.query &&
        (req.query.recordImport === "1" ||
          String(req.query.recordImport) === "true");
      if (record) {
        const inserted = resultDetails.filter(
          (d) => d.action === "insert"
        ).length;
        const updatedCount = resultDetails.filter(
          (d) => d.action === "update"
        ).length;
        const invalid = resultDetails.filter(
          (d) => d.action === "invalid"
        ).length;
        const total = resultDetails.length;
        const filename = req.query.filename ? String(req.query.filename) : null;
        await db.run(
          `INSERT INTO translation_imports (admin_user_id, filename, total_rows, inserted, updated, invalid, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            filename,
            total,
            inserted,
            updatedCount,
            invalid,
            JSON.stringify(resultDetails),
          ]
        );
      }
    } catch (err) {
      console.error("Error recording import audit:", err);
    }

    res.json({ updated: processed, details: resultDetails });
  } catch (error) {
    console.error("Error updating translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List import audit logs (admin only)
router.get("/i18n/imports", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const rows = await db.all(
      `SELECT ti.id, ti.admin_user_id, u.username AS admin_username, ti.filename, ti.total_rows, ti.inserted, ti.updated, ti.invalid, ti.details, ti.created_at
       FROM translation_imports ti
       LEFT JOIN users u ON u.id = ti.admin_user_id
       ORDER BY ti.created_at DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching import logs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all keys for a namespace (includes ui_menu page_keys for 'menu')
router.get("/i18n/keys", async (req, res) => {
  try {
    const namespace = req.query.namespace && String(req.query.namespace).trim();
    if (!namespace)
      return res.status(400).json({ error: "namespace is required" });

    let rows;
    if (namespace === "menu") {
      // include page_key from ui_menu as well
      rows = await db.all(
        `SELECT DISTINCT key FROM (
           SELECT key FROM translations WHERE namespace = ?
           UNION
           SELECT page_key AS key FROM ui_menu
         ) ORDER BY key`,
        [namespace]
      );
    } else {
      rows = await db.all(
        `SELECT DISTINCT key FROM translations WHERE namespace = ? ORDER BY key`,
        [namespace]
      );
    }

    const keys = (rows || []).map((r) => r.key);
    res.json(keys);
  } catch (error) {
    console.error("Error fetching translation keys:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================
// Admin: UI Menu Management
// =========================
// Upsert menu items: [{ page_key, label, sort_order, visible }]
router.put("/ui/menu", async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Expected an array of menu items" });
    }

    for (const it of items) {
      const page_key = it.page_key && String(it.page_key).trim();
      const label = it.label != null ? String(it.label) : "";
      const sort_order = Number.isFinite(it.sort_order) ? it.sort_order : 0;
      const visible = it.visible ? 1 : 0;
      if (!page_key) continue;

      // Insert or replace
      await db.run(
        `INSERT OR REPLACE INTO ui_menu (page_key, label, sort_order, visible)
         VALUES (?, ?, ?, ?)`,
        [page_key, label, sort_order, visible]
      );
    }

    // Return updated list
    const rows = await db.all(
      `SELECT page_key, label, sort_order, visible FROM ui_menu ORDER BY sort_order ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error("Error updating UI menu:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
router.get("/users", async (req, res) => {
  try {
    const users = await db.all(
      `SELECT 
         u.id, u.username, u.full_name, u.role, u.is_blocked, u.created_at,
         u.company_id, u.phone, u.ritnumber, u.adr, u.mega_kast, u.note,
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
    body("note").optional().trim(),
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
        note,
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
        `INSERT INTO users (username, password, full_name, role, company_id, phone, ritnumber, adr, mega_kast, note) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          note || null,
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
        note,
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
    body("note").optional().trim(),
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
        note,
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

      if (note !== undefined) {
        updates.push("note = ?");
        values.push(note || null);
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

// Get all submissions (admin can see all) - optionally filter by year
router.get("/submissions", async (req, res) => {
  try {
    const { year } = req.query; // Optional year filter (e.g., 2024)
    let query = `
            SELECT s.*, u.username, u.full_name, c.name AS company_name,
              (SELECT COALESCE(SUM(CAST(t.total_hours AS REAL)), 0)
          FROM timesheets t
          WHERE (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')) AS total_hours
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN companies c ON u.company_id = c.id
    `;
    
    const params = [];
    
    if (year) {
      query += ` WHERE CAST(strftime('%Y', s.submission_date) AS INTEGER) = ?`;
      params.push(year);
    }
    
    query += ` ORDER BY s.submission_date DESC`;
    
    const submissions = await db.all(query, params);

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
router.post(
  "/smtp-settings",
  [
    body("smtp_host").trim().notEmpty(),
    body("smtp_port").isInt({ min: 1, max: 65535 }),
    body("smtp_user").trim().notEmpty(),
    body("smtp_pass").optional().isString(),
    body("email_from").isEmail(),
    body("email_to").isEmail(),
    body("auth_type").optional().isIn(["basic", "oauth2"]),
    body("oauth_tenant_id").optional(),
    body("oauth_client_id").optional(),
    body("oauth_client_secret").optional(),
    body("oauth_scope").optional(),
    body("signature_enabled").optional().isInt({ min: 0, max: 1 }),
    body("signature_html").optional().isString(),
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
        signature_enabled = 0,
        signature_html = null,
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
          "signature_enabled = ?",
          "signature_html = ?",
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
          signature_enabled ? 1 : 0,
          signature_html || null,
        ];

        if (smtp_pass && smtp_pass.trim()) {
          updates.splice(4, 0, "smtp_pass_encrypted = ?");
          values.splice(4, 0, encryptPassword(smtp_pass.trim()));
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
          `INSERT INTO smtp_settings (smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, email_from, email_to, auth_type, oauth_tenant_id, oauth_client_id, oauth_client_secret, oauth_scope, signature_enabled, signature_html)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            smtp_host,
            smtp_port,
            smtp_secure ? 1 : 0,
            smtp_user,
            encryptPassword(smtp_pass || ""),
            email_from,
            email_to,
            auth_type,
            oauth_tenant_id || null,
            oauth_client_id || null,
            oauth_client_secret || null,
            oauth_scope || "https://outlook.office365.com/.default",
            signature_enabled ? 1 : 0,
            signature_html || null,
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
        await db.run(`INSERT INTO branding_settings (custom_css) VALUES (?)`, [
          custom_css,
        ]);
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

// Update menu configuration (admin only)
router.put("/ui/menu", async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items))
      return res.status(400).json({ error: "Invalid payload" });

    // Basic validation
    for (const it of items) {
      if (!it.page_key || typeof it.label !== "string") {
        return res
          .status(400)
          .json({ error: "Each item must include page_key and label" });
      }
    }

    // Replace existing config in a transaction-like way: delete all and insert
    await db.run("BEGIN TRANSACTION");
    await db.run("DELETE FROM ui_menu");
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await db.run(
        "INSERT INTO ui_menu (page_key, label, sort_order, visible) VALUES (?, ?, ?, ?)",
        [it.page_key, it.label, i, it.visible ? 1 : 0]
      );
    }
    await db.run("COMMIT");

    const rows = await db.all(
      "SELECT page_key, label, sort_order, visible FROM ui_menu ORDER BY sort_order ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error updating UI menu:", error);
    try {
      await db.run("ROLLBACK");
    } catch (e) {}
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

      const {
        license_plate,
        km,
        apk_due_date,
        rit_number,
        company_id,
        truck_type,
      } = req.body;

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

      const {
        license_plate,
        km,
        apk_due_date,
        rit_number,
        company_id,
        truck_type,
      } = req.body;
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

// Get hours report for all users or specific user (optional year filter)
router.get("/hours-report", async (req, res) => {
  try {
    const userId = req.query.userId;
    const year = req.query.year; // Optional: filter by year of timesheet date

    let query = `
      SELECT 
        u.id as user_id,
        u.full_name,
        c.name as company_name,
        t.week_number,
        CAST(strftime('%Y', t.date) AS INTEGER) as year,
        COUNT(*) as work_days,
        SUM(CAST(t.total_hours AS REAL)) as total_hours,
        SUM(CAST(t.total_km AS REAL)) as total_km
      FROM users u
      LEFT JOIN timesheets t ON u.id = t.user_id
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN submissions s ON (',' || s.timesheet_ids || ',') LIKE ('%,' || t.id || ',%')
      WHERE 1=1 AND s.id IS NOT NULL
    `;

    const params = [];
    if (userId) {
      query += " AND u.id = ?";
      params.push(userId);
    }
    if (year) {
      query += " AND CAST(strftime('%Y', t.date) AS INTEGER) = ?";
      params.push(year);
    }

    query += `
      GROUP BY u.id, u.full_name, c.name, t.week_number, year
      ORDER BY u.full_name, year DESC, t.week_number DESC
    `;

    const results = await db.all(query, params);

    // Calculate overworked hours
    const report = results.map((row) => ({
      ...row,
      total_hours: parseFloat(row.total_hours || 0).toFixed(2),
      total_km: parseFloat(row.total_km || 0).toFixed(2),
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

    // NOW verify admin's own MFA (after password is validated)
    if (!mfaToken) {
      return res.status(400).json({ error: "Admin MFA token is required" });
    }

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

    const response = {
      success: true,
      message: "Password reset successfully",
      emailed,
    };
    if (showPassword) response.tempPassword = passwordToSet;

    res.json(response);
  } catch (error) {
    console.error("Error resetting user password:", error);
    // Return detailed error in development to aid debugging
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// ========== SYSTEM CONFIGURATION ==========

const secrets = require("../utils/secrets");

// Helper: enforce MFA for admin accounts on sensitive config routes
async function ensureAdminMfa(req, res) {
  try {
    if (!req.user || req.user.role !== "admin") return true;
    const user = await db.get("SELECT mfa_enabled FROM users WHERE id = ?", [req.user.id]);
    if (!user || user.mfa_enabled !== 1) {
      res
        .status(403)
        .json({ error: "Admin MFA is required to access configuration. Enable MFA first." });
      return false;
    }
    return true;
  } catch (err) {
    console.error("MFA enforcement error:", err);
    res.status(500).json({ error: "Failed to validate admin MFA" });
    return false;
  }
}

// Get all system configuration
router.get("/system-config", async (req, res) => {
  try {
    if (!(await ensureAdminMfa(req, res))) return;

    const configs = await db.all(`
      SELECT key, value, encrypted, description, is_secret, updated_at
      FROM system_config
      ORDER BY key
    `);

    // Mask secret values
    const maskedConfigs = configs.map(config => ({
      ...config,
      value: config.is_secret ? '***' : config.value,
      display_value: config.is_secret ? '(Set - hidden for security)' : config.value
    }));

    res.json(maskedConfigs);
  } catch (error) {
    console.error("Error fetching system config:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// Get specific config value (for internal use)
router.get("/system-config/:key", async (req, res) => {
  try {
    if (!(await ensureAdminMfa(req, res))) return;

    const config = await db.get(
      "SELECT * FROM system_config WHERE key = ?",
      [req.params.key]
    );

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    // Don't expose secret values
    if (config.is_secret) {
      return res.json({
        key: config.key,
        value: "***",
        display_value: "(Set - hidden for security)"
      });
    }

    res.json(config);
  } catch (error) {
    console.error("Error fetching config:", error);
    res.status(500).json({ error: "Failed to fetch configuration" });
  }
});

// Update system configuration
router.post("/system-config", async (req, res) => {
  try {
    if (!(await ensureAdminMfa(req, res))) return;

    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ error: "Key and value are required" });
    }

    // Validate key exists
    const existing = await db.get(
      "SELECT * FROM system_config WHERE key = ?",
      [key]
    );

    if (!existing) {
      return res.status(400).json({ error: `Unknown configuration key: ${key}` });
    }

    // Validation by key
    const validators = {
      APP_DOMAIN: (v) => /^(?:[a-zA-Z0-9.-]+)(?::\d{2,5})?$/.test(v),
      APP_URL: (v) => /^https?:\/\/[^\s]+$/.test(v),
      SSL_ENABLED: (v) => v === '0' || v === '1' || v === 0 || v === 1,
      SSL_CERT_PATH: (v) => typeof v === 'string' && v.length < 512,
      SSL_KEY_PATH: (v) => typeof v === 'string' && v.length < 512,
      JWT_SECRET: (v) => typeof v === 'string' && v.length >= 32,
      DB_PASSWORD: (v) => typeof v === 'string',
      LETSENCRYPT_EMAIL: (v) => /.+@.+\..+/.test(v) || v === ''
    };

    if (validators[key] && !validators[key](value)) {
      return res.status(400).json({ error: `Invalid value for ${key}` });
    }

    // Skip empty secrets (don't overwrite with empty values)
    if (existing.is_secret && (!value || value.trim() === '')) {
      return res.status(400).json({ 
        error: "Cannot set an empty secret. Leave unchanged if you don't want to modify it." 
      });
    }

    // Encrypt secret values before storing
    let valueToStore = value;
    if (existing.is_secret && value) {
      try {
        const encrypted = secrets.encryptSecret(value);
        valueToStore = secrets.formatForStorage(encrypted);
      } catch (error) {
        console.error('Encryption error:', error);
        return res.status(500).json({ error: "Failed to encrypt secret" });
      }
    }

    // Update the configuration
    await db.run(
      `UPDATE system_config 
       SET value = ?, encrypted = ?, updated_at = CURRENT_TIMESTAMP
       WHERE key = ?`,
      [valueToStore, existing.is_secret ? 1 : 0, key]
    );

    // Ensure audit_log table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT,
        config_key TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fetch old value for audit (masked for secrets)
    const oldVal = existing.is_secret ? '(secret updated)' : existing.value;
    const newVal = existing.is_secret ? '(secret updated)' : String(value);
    await db.run(
      `INSERT INTO audit_log (user_id, action, config_key, old_value, new_value)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user && req.user.id ? req.user.id : null, 'UPDATE_CONFIG', key, oldVal, newVal]
    );

    // Log the change (don't log secret values)
    if (existing.is_secret) {
      console.log(`✓ Admin updated secret config: ${key}`);
    } else {
      console.log(`✓ Admin updated config: ${key} = ${value}`);
    }

    res.json({ 
      success: true, 
      message: `Configuration '${key}' updated successfully`,
      requiresRestart: key === 'JWT_SECRET' || key === 'APP_DOMAIN' || key === 'APP_URL'
    });
  } catch (error) {
    console.error("Error updating system config:", error);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

// Update multiple configurations at once
router.post("/system-config/batch", async (req, res) => {
  try {
    if (!(await ensureAdminMfa(req, res))) return;

    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: "configs must be an array" });
    }

    let requiresRestart = false;
    const results = [];

    for (const { key, value } of configs) {
      const existing = await db.get(
        "SELECT * FROM system_config WHERE key = ?",
        [key]
      );

      if (!existing) {
        results.push({ key, error: "Unknown configuration key" });
        continue;
      }

      // Validation by key (reuse simple validators)
      const validators = {
        APP_DOMAIN: (v) => /^(?:[a-zA-Z0-9.-]+)(?::\d{2,5})?$/.test(v),
        APP_URL: (v) => /^https?:\/\/[^\s]+$/.test(v),
        SSL_ENABLED: (v) => v === '0' || v === '1' || v === 0 || v === 1,
        SSL_CERT_PATH: (v) => typeof v === 'string' && v.length < 512,
        SSL_KEY_PATH: (v) => typeof v === 'string' && v.length < 512,
        JWT_SECRET: (v) => typeof v === 'string' && v.length >= 32,
        DB_PASSWORD: (v) => typeof v === 'string',
        LETSENCRYPT_EMAIL: (v) => /.+@.+\..+/.test(v) || v === ''
      };

      if (validators[key] && !validators[key](value)) {
        results.push({ key, error: `Invalid value for ${key}` });
        continue;
      }

      await db.run(
        `UPDATE system_config 
         SET value = ?, updated_at = CURRENT_TIMESTAMP
         WHERE key = ?`,
        [value, key]
      );

      if (key === 'JWT_SECRET' || key === 'APP_DOMAIN' || key === 'APP_URL') {
        requiresRestart = true;
      }

      // Audit
      await db.run(
        `INSERT INTO audit_log (user_id, action, config_key, old_value, new_value)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user && req.user.id ? req.user.id : null, 'UPDATE_CONFIG', key, existing.is_secret ? '(secret updated)' : existing.value, existing.is_secret ? '(secret updated)' : String(value)]
      );

      results.push({ key, success: true });
    }

    res.json({ 
      success: true, 
      results,
      requiresRestart,
      message: "Batch update completed"
    });
  } catch (error) {
    console.error("Error batch updating config:", error);
    res.status(500).json({ error: "Failed to update configurations" });
  }
});

// Test domain/URL connectivity
router.post("/system-config/test-domain", async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    // Simple validation
    const isValid = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]{1,5})?$/.test(domain) ||
                   domain === 'localhost' ||
                   /^localhost:[0-9]{1,5}$/.test(domain) ||
                   /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:[0-9]{1,5})?$/.test(domain);

    if (!isValid) {
      return res.status(400).json({ error: "Invalid domain format" });
    }

    res.json({ 
      valid: true, 
      domain,
      message: "Domain format is valid"
    });
  } catch (error) {
    console.error("Error validating domain:", error);
    res.status(500).json({ error: "Failed to validate domain" });
  }
});

// Get decrypted secret (internal use only)
// This is used by the application to retrieve secrets at runtime
router.get("/system-config/secret/:key", async (req, res) => {
  try {
    if (!(await ensureAdminMfa(req, res))) return;

    const config = await db.get(
      "SELECT * FROM system_config WHERE key = ? AND is_secret = 1",
      [req.params.key]
    );

    if (!config) {
      return res.status(404).json({ error: "Secret not found" });
    }

    // Decrypt the secret
    let decryptedValue = config.value;
    if (config.encrypted && config.value) {
      try {
        decryptedValue = secrets.decryptSecret(config.value);
      } catch (error) {
        console.error('Decryption error:', error);
        return res.status(500).json({ error: "Failed to decrypt secret" });
      }
    }

    // Log access to sensitive configuration
    console.log(`[CONFIG] Secret accessed: ${req.params.key}`);

    res.json({
      key: config.key,
      value: decryptedValue
    });
  } catch (error) {
    console.error("Error fetching secret:", error);
    res.status(500).json({ error: "Failed to fetch secret" });
  }
});

// ========== LET'S ENCRYPT CERTIFICATE MANAGEMENT ==========

const letsencrypt = require("../utils/letsencrypt");

// Initialize Let's Encrypt on first use
letsencrypt.init().catch(err => console.error("Failed to init Let's Encrypt:", err));

// List available certificates
router.get("/letsencrypt/certificates", async (req, res) => {
  try {
    const certs = await letsencrypt.listCertificates();
    res.json(certs);
  } catch (error) {
    console.error("Error listing certificates:", error);
    res.status(500).json({ error: "Failed to list certificates" });
  }
});

// Get certificate info
router.get("/letsencrypt/certificate/:domain", async (req, res) => {
  try {
    const info = await letsencrypt.getCertificateInfo(req.params.domain);
    if (!info) {
      return res.status(404).json({ error: "Certificate not found" });
    }
    res.json(info);
  } catch (error) {
    console.error("Error fetching certificate:", error);
    res.status(500).json({ error: "Failed to fetch certificate info" });
  }
});

// Request a new Let's Encrypt certificate
router.post("/letsencrypt/request-certificate", async (req, res) => {
  try {
    const { domain, email } = req.body;

    if (!domain || !email) {
      return res.status(400).json({ error: "Domain and email are required" });
    }

    // Validate domain format
    const isValid = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]{1,5})?$/.test(domain) ||
                   /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:[0-9]{1,5})?$/.test(domain);

    if (!isValid) {
      return res.status(400).json({ error: "Invalid domain format" });
    }

    // Don't allow localhost/IP addresses with Let's Encrypt (LE doesn't support them)
    if (domain === "localhost" || /^127\./.test(domain) || /^192\.168\./.test(domain)) {
      return res.status(400).json({ 
        error: "Let's Encrypt doesn't support localhost or private IP addresses. Use a valid domain.",
        suggestion: "For local testing, use a self-signed certificate instead."
      });
    }

    console.log(`[ADMIN] Requesting Let's Encrypt certificate for ${domain}`);

    // Request certificate
    const result = await letsencrypt.requestCertificate(domain, email, true);

    res.json({
      success: result.success !== false,
      domain,
      message: result.message,
      certificatePath: result.certPath || "/certs/" + domain,
      requestId: result.orderId,
      challenges: result.challenges
    });

  } catch (error) {
    console.error("[LE] Certificate request error:", error);
    res.status(500).json({ 
      error: "Failed to request certificate",
      details: error.message 
    });
  }
});

// Generate self-signed certificate (for testing/fallback)
router.post("/letsencrypt/self-signed", async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    console.log(`[ADMIN] Generating self-signed certificate for ${domain}`);

    const result = await letsencrypt.generateSelfSignedCertificate(domain);

    // Update system config with cert paths
    await db.run(
      `UPDATE system_config 
       SET value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE key = 'SSL_CERT_PATH'`,
      [result.certPath]
    );

    await db.run(
      `UPDATE system_config 
       SET value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE key = 'SSL_ENABLED'`,
      ["1"]
    );

    res.json({
      success: true,
      domain,
      message: "Self-signed certificate generated successfully",
      certificatePath: result.certPath,
      keyPath: result.keyPath,
      requiresRestart: true
    });

  } catch (error) {
    console.error("[LE] Self-signed certificate error:", error);
    res.status(500).json({ 
      error: "Failed to generate self-signed certificate",
      details: error.message 
    });
  }
});

// Switch Let's Encrypt mode
router.post("/letsencrypt/mode", async (req, res) => {
  try {
    const { mode } = req.body; // 'staging' or 'production'

    if (!["staging", "production"].includes(mode)) {
      return res.status(400).json({ error: "Mode must be 'staging' or 'production'" });
    }

    if (mode === "production") {
      letsencrypt.switchToProduction();
      console.log("[LE] Switched to production mode");
    } else {
      letsencrypt.switchToStaging();
      console.log("[LE] Switched to staging mode");
    }

    res.json({
      success: true,
      mode,
      message: `Switched to ${mode} Let's Encrypt`
    });

  } catch (error) {
    console.error("Error switching LE mode:", error);
    res.status(500).json({ error: "Failed to switch mode" });
  }
});

module.exports = router;
