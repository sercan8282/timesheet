const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

// Get current user info
router.get('/me', async (req, res) => {
  try {
    const user = await db.get(
      'SELECT id, username, full_name, is_admin, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Get current user
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);

      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await db.run(
        'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get user's timesheets
router.get('/timesheets', async (req, res) => {
  try {
    const timesheets = await db.all(
      'SELECT * FROM timesheets WHERE user_id = ? ORDER BY date DESC, start_time DESC',
      [req.user.id]
    );

    res.json(timesheets);
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get timesheet details by IDs
router.post('/timesheets/details', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Timesheet IDs are required' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const timesheets = await db.all(
      `SELECT id, week_number, date FROM timesheets WHERE id IN (${placeholders}) AND user_id = ? ORDER BY week_number, date`,
      [...ids, req.user.id]
    );

    res.json(timesheets);
  } catch (error) {
    console.error('Error fetching timesheet details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add timesheet entry
router.post(
  '/timesheets',
  [
    body('date').isISO8601().withMessage('Valid date is required'),
    body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
    body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)'),
    body('startKm').isFloat({ min: 0 }).withMessage('Valid start km is required'),
    body('endKm').isFloat({ min: 0 }).withMessage('Valid end km is required'),
    body('pauseTime').matches(/^([0-9]+):([0-5][0-9])$/).withMessage('Valid pause time is required (HH:MM)'),
    body('ritnumber').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { date, startTime, endTime, startKm, endKm, pauseTime, ritnumber } = req.body;

      // Calculate week number
      const dateObj = new Date(date);
      const weekNumber = getWeekNumber(dateObj);

      // Calculate total hours
      const totalHours = calculateTotalHours(startTime, endTime, pauseTime);

      // Calculate total km
      const totalKm = endKm - startKm;

      const result = await db.run(
        `INSERT INTO timesheets (user_id, week_number, date, start_time, end_time, start_km, end_km, pause_time, total_hours, total_km, ritnumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, weekNumber, date, startTime, endTime, startKm, endKm, pauseTime, totalHours, totalKm, ritnumber || '']
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
        ritnumber: ritnumber || ''
      });
    } catch (error) {
      console.error('Error creating timesheet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update timesheet entry
router.put(
  '/timesheets/:id',
  [
    body('date').optional().isISO8601(),
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('startKm').optional().isFloat({ min: 0 }),
    body('endKm').optional().isFloat({ min: 0 }),
    body('pauseTime').optional().matches(/^([0-9]+):([0-5][0-9])$/),
    body('ritnumber').optional().trim()
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
        'SELECT * FROM timesheets WHERE id = ? AND user_id = ?',
        [id, req.user.id]
      );

      if (!timesheet) {
        return res.status(404).json({ error: 'Timesheet not found' });
      }

      const { date, startTime, endTime, startKm, endKm, pauseTime, ritnumber } = req.body;

      // Use existing values if not provided
      const updatedDate = date || timesheet.date;
      const updatedStartTime = startTime || timesheet.start_time;
      const updatedEndTime = endTime || timesheet.end_time;
      const updatedStartKm = startKm !== undefined ? startKm : timesheet.start_km;
      const updatedEndKm = endKm !== undefined ? endKm : timesheet.end_km;
      const updatedPauseTime = pauseTime || timesheet.pause_time;
      const updatedRitnumber = ritnumber !== undefined ? ritnumber : (timesheet.ritnumber || '');

      // Recalculate
      const weekNumber = getWeekNumber(new Date(updatedDate));
      const totalHours = calculateTotalHours(updatedStartTime, updatedEndTime, updatedPauseTime);
      const totalKm = updatedEndKm - updatedStartKm;

      await db.run(
        `UPDATE timesheets 
         SET week_number = ?, date = ?, start_time = ?, end_time = ?, start_km = ?, end_km = ?, pause_time = ?, total_hours = ?, total_km = ?, ritnumber = ?
         WHERE id = ? AND user_id = ?`,
        [weekNumber, updatedDate, updatedStartTime, updatedEndTime, updatedStartKm, updatedEndKm, updatedPauseTime, totalHours, totalKm, updatedRitnumber, id, req.user.id]
      );

      res.json({ message: 'Timesheet updated successfully' });
    } catch (error) {
      console.error('Error updating timesheet:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete timesheet entry
router.delete('/timesheets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.run(
      'DELETE FROM timesheets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Timesheet not found' });
    }

    res.json({ message: 'Timesheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting timesheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's submissions history
router.get('/submissions', async (req, res) => {
  try {
    const submissions = await db.all(
      'SELECT * FROM submissions WHERE user_id = ? ORDER BY submission_date DESC',
      [req.user.id]
    );

    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Helper function to calculate total hours
// Get weekly summary (aggregated hours per week)
router.get('/weekly-summary', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // 10 rows per page = 20 weeks max
    const offset = (page - 1) * limit;

    // Get all timesheets for this user grouped by week
    const timesheets = await db.all(
      `SELECT 
        week_number,
        SUM(total_hours) as total_hours_worked,
        COUNT(*) as entries_count,
        MIN(date) as week_start_date
      FROM timesheets 
      WHERE user_id = ? 
      GROUP BY week_number 
      ORDER BY week_number DESC
      LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );

    // Count total weeks for pagination
    const countResult = await db.get(
      `SELECT COUNT(DISTINCT week_number) as total_weeks 
       FROM timesheets 
       WHERE user_id = ?`,
      [req.user.id]
    );

    const totalWeeks = countResult?.total_weeks || 0;
    const totalPages = Math.ceil(totalWeeks / limit);

    // Calculate working hours per week (8 hours)
    const WORKING_HOURS_PER_WEEK = 40;

    const weekSummary = timesheets.map(week => ({
      weekNumber: week.week_number,
      workingHours: WORKING_HOURS_PER_WEEK,
      totalHours: parseFloat(week.total_hours_worked) || 0,
      overworked: Math.max(0, (parseFloat(week.total_hours_worked) || 0) - WORKING_HOURS_PER_WEEK),
      entriesCount: week.entries_count,
      weekStartDate: week.week_start_date
    }));

    res.json({
      data: weekSummary,
      pagination: {
        page,
        limit,
        totalWeeks,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching weekly summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function calculateTotalHours(startTime, endTime, pauseTime) {
  if (!startTime || !endTime || !pauseTime) {
    return '0.00';
  }
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const [pauseHour, pauseMinute] = pauseTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const pauseMinutes = pauseHour * 60 + pauseMinute;

  const totalMinutes = endMinutes - startMinutes - pauseMinutes;
  return (totalMinutes / 60).toFixed(2);
}

module.exports = router;
