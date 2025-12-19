const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const { authMiddleware } = require("../middleware/auth");
const { generateXLSX } = require("../utils/excel");
const { generatePDF } = require("../utils/pdf");
const { sendEmail } = require("../utils/email");

const router = express.Router();

router.use(authMiddleware);

function summarizeTotals(timesheets) {
  const totalHours = timesheets.reduce((sum, entry) => {
    const hours = parseFloat(entry.total_hours);
    return sum + (Number.isFinite(hours) ? hours : 0);
  }, 0);

  const totalKm = timesheets.reduce((sum, entry) => {
    const km = parseFloat(entry.total_km);
    if (Number.isFinite(km)) {
      return sum + km;
    }

    const startKm = parseFloat(entry.start_km);
    const endKm = parseFloat(entry.end_km);
    if (Number.isFinite(startKm) && Number.isFinite(endKm)) {
      return sum + (endKm - startKm);
    }

    return sum;
  }, 0);

  const weekNumbers = Array.from(
    new Set(timesheets.map((ts) => ts.week_number))
  )
    .filter((week) => week !== undefined && week !== null)
    .sort((a, b) => a - b)
    .join(", ");

  return {
    totalHours,
    totalKm,
    weekNumbers: weekNumbers || "-",
  };
}

// Submit timesheets
router.post(
  "/submit",
  [
    body("timesheetIds")
      .isArray({ min: 1 })
      .withMessage("At least one timesheet must be selected"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { timesheetIds } = req.body;

      // Verify all timesheets belong to the user
      const placeholders = timesheetIds.map(() => "?").join(",");
      const timesheets = await db.all(
        `SELECT * FROM timesheets WHERE id IN (${placeholders}) AND user_id = ? ORDER BY date, start_time`,
        [...timesheetIds, req.user.id]
      );

      if (timesheets.length !== timesheetIds.length) {
        return res.status(400).json({ error: "Invalid timesheet selection" });
      }

      const summary = summarizeTotals(timesheets);

      // Generate XLSX file
      const xlsxBuffer = await generateXLSX(timesheets, req.user.fullName);
      const fileName = `timesheet_${req.user.username}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      let emailStatus = "pending";
      let emailError = null;

      // Try to send email, but don't fail submission if email fails
      try {
        await sendEmail(
          `Timesheet Submission - ${req.user.fullName}`,
          `Timesheet submission from ${
            req.user.fullName
          }\n\nDate: ${new Date().toLocaleString()}\nWeek(s): ${
            summary.weekNumbers
          }\nTotal entries: ${
            timesheets.length
          }\nTotal hours: ${summary.totalHours.toFixed(
            2
          )}\nTotal kilometers: ${summary.totalKm.toFixed(2)}`,
          [
            {
              filename: fileName,
              content: xlsxBuffer,
            },
          ]
        );
        emailStatus = "sent";
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
        emailError = emailErr.message;
        emailStatus = "failed";
      }

      // Calculate overtime hours (total hours - 40 hours per week)
      // Group timesheets by week and calculate overtime per week
      const weekGroups = {};
      timesheets.forEach((ts) => {
        if (!weekGroups[ts.week_number]) {
          weekGroups[ts.week_number] = 0;
        }
        weekGroups[ts.week_number] += parseFloat(ts.total_hours || 0);
      });

      let totalOvertime = 0;
      Object.values(weekGroups).forEach((weekHours) => {
        const overtime = weekHours - 40;
        if (overtime > 0) {
          totalOvertime += overtime;
        }
      });

      // Get unique week numbers, sorted
      const weekNumbers = Object.keys(weekGroups)
        .map((w) => parseInt(w, 10))
        .sort((a, b) => a - b)
        .join(",");

      // Save submission record regardless of email status
      await db.run(
        "INSERT INTO submissions (user_id, user_name, timesheet_ids, status, week_numbers) VALUES (?, ?, ?, ?, ?)",
        [
          req.user.id,
          req.user.fullName,
          timesheetIds.join(","),
          emailStatus,
          weekNumbers,
        ]
      );

      // Add overtime to user's leave balance if there is any
      if (totalOvertime > 0) {
        // Ensure leave balance record exists
        const existingBalance = await db.get(
          "SELECT id FROM leave_balances WHERE user_id = ?",
          [req.user.id]
        );

        if (!existingBalance) {
          await db.run(
            "INSERT INTO leave_balances (user_id, vacation_hours, overtime_hours) VALUES (?, 216, ?)",
            [req.user.id, totalOvertime]
          );
        } else {
          await db.run(
            "UPDATE leave_balances SET overtime_hours = overtime_hours + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            [totalOvertime, req.user.id]
          );
        }
      }

      if (emailStatus === "sent") {
        res.json({
          message: "Timesheets submitted and email sent successfully",
          overtimeAdded: totalOvertime > 0 ? totalOvertime.toFixed(2) : 0,
        });
      } else {
        res.json({
          message:
            "Timesheets submitted but email failed to send. Please check SMTP settings.",
          warning: emailError,
          overtimeAdded: totalOvertime > 0 ? totalOvertime.toFixed(2) : 0,
        });
      }
    } catch (error) {
      console.error("Error submitting timesheets:", error);
      res
        .status(500)
        .json({ error: "Failed to submit timesheets: " + error.message });
    }
  }
);

// Get PDF preview of selected timesheets
router.post("/preview-pdf", async (req, res) => {
  try {
    const { timesheetIds } = req.body;

    if (
      !timesheetIds ||
      !Array.isArray(timesheetIds) ||
      timesheetIds.length === 0
    ) {
      return res.status(400).json({ error: "Timesheet IDs required" });
    }

    // Verify all timesheets belong to the user
    const placeholders = timesheetIds.map(() => "?").join(",");
    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE id IN (${placeholders}) AND user_id = ? ORDER BY date, start_time`,
      [...timesheetIds, req.user.id]
    );

    if (timesheets.length === 0) {
      return res.status(400).json({ error: "No valid timesheets found" });
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(timesheets, req.user.fullName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=timesheet_preview.pdf`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF preview:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Get XLSX preview of selected timesheets
router.post("/preview-xlsx", async (req, res) => {
  try {
    const { timesheetIds } = req.body;

    if (
      !timesheetIds ||
      !Array.isArray(timesheetIds) ||
      timesheetIds.length === 0
    ) {
      return res.status(400).json({ error: "Timesheet IDs required" });
    }

    // Verify all timesheets belong to the user
    const placeholders = timesheetIds.map(() => "?").join(",");
    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE id IN (${placeholders}) AND user_id = ? ORDER BY date, start_time`,
      [...timesheetIds, req.user.id]
    );

    if (timesheets.length === 0) {
      return res.status(400).json({ error: "No valid timesheets found" });
    }

    // Generate XLSX
    const xlsxBuffer = await generateXLSX(timesheets, req.user.fullName);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=timesheet_preview.xlsx`
    );
    res.send(xlsxBuffer);
  } catch (error) {
    console.error("Error generating XLSX preview:", error);
    res.status(500).json({ error: "Failed to generate XLSX" });
  }
});

// Get PDF for a specific submission
router.get("/submissions/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;

    // Get submission
    const submission = await db.get(
      "SELECT * FROM submissions WHERE id = ? AND user_id = ?",
      [id, req.user.id]
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

    // Generate PDF
    const pdfBuffer = await generatePDF(timesheets, req.user.fullName);

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

// Get XLSX for a specific submission
router.get("/submissions/:id/xlsx", async (req, res) => {
  try {
    const { id } = req.params;

    // Get submission
    const submission = await db.get(
      "SELECT * FROM submissions WHERE id = ? AND user_id = ?",
      [id, req.user.id]
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

    // Generate XLSX
    const xlsxBuffer = await generateXLSX(timesheets, req.user.fullName);

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

// Resend submission email
router.post("/submissions/:id/resend", async (req, res) => {
  try {
    const { id } = req.params;

    // Get submission
    const submission = await db.get(
      "SELECT * FROM submissions WHERE id = ? AND user_id = ?",
      [id, req.user.id]
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

    const summary = summarizeTotals(timesheets);

    // Generate XLSX file
    const xlsxBuffer = await generateXLSX(timesheets, req.user.fullName);
    const fileName = `timesheet_${req.user.username}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;

    let emailStatus = "pending";
    let emailError = null;

    // Try to send email
    try {
      await sendEmail(
        `Timesheet Submission - ${req.user.fullName}`,
        `Timesheet submission from ${
          req.user.fullName
        }\n\nDate: ${new Date().toLocaleString()}\nWeek(s): ${
          summary.weekNumbers
        }\nTotal entries: ${
          timesheets.length
        }\nTotal hours: ${summary.totalHours.toFixed(
          2
        )}\nTotal kilometers: ${summary.totalKm.toFixed(2)}`,
        [
          {
            filename: fileName,
            content: xlsxBuffer,
          },
        ]
      );
      emailStatus = "sent";

      // Update submission status
      await db.run(
        "UPDATE submissions SET status = ?, submission_date = CURRENT_TIMESTAMP WHERE id = ?",
        [emailStatus, id]
      );

      res.json({ message: "Email sent successfully" });
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr);
      emailError = emailErr.message;
      emailStatus = "failed";

      // Update submission status
      await db.run("UPDATE submissions SET status = ? WHERE id = ?", [
        emailStatus,
        id,
      ]);

      res.status(500).json({
        error: "Failed to send email: " + emailError,
      });
    }
  } catch (error) {
    console.error("Error resending submission:", error);
    res
      .status(500)
      .json({ error: "Failed to resend submission: " + error.message });
  }
});

module.exports = router;
