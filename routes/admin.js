const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { testSMTPConnection, sendEmail } = require('../utils/email');
const { generatePDF } = require('../utils/pdf');
const { generateXLSX } = require('../utils/excel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await db.all(
      'SELECT id, username, full_name, is_admin, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user
router.post(
  '/users',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('isAdmin').optional().isBoolean(),
    body('role').optional().isIn(['admin', 'user', 'reader']).withMessage('Role must be admin, user, or reader')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, fullName, isAdmin, role = 'user' } = req.body;

      // Check if username already exists (case-insensitive)
      const existingUser = await db.get(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );

      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with role
      const result = await db.run(
        'INSERT INTO users (username, password, full_name, is_admin, role) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, fullName, isAdmin ? 1 : 0, role]
      );

      res.status(201).json({
        id: result.id,
        username,
        fullName,
        isAdmin: isAdmin || false,
        role
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update user
router.put(
  '/users/:id',
  [
    body('fullName').optional().trim().notEmpty(),
    body('isAdmin').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { fullName, isAdmin } = req.body;

      const updates = [];
      const values = [];

      if (fullName !== undefined) {
        updates.push('full_name = ?');
        values.push(fullName);
      }

      if (isAdmin !== undefined) {
        updates.push('is_admin = ?');
        values.push(isAdmin ? 1 : 0);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      res.json({ message: 'User updated successfully' });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting the last admin
    const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [id]);

    if (user && user.is_admin === 1) {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all submissions (admin can see all)
router.get('/submissions', async (req, res) => {
  try {
    const submissions = await db.all(`
      SELECT s.*, u.username, u.full_name
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.submission_date DESC
    `);

    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get timesheets for a specific submission
router.get('/submissions/:id/timesheets', async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get('SELECT * FROM submissions WHERE id = ?', [id]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.timesheet_ids) {
      return res.status(400).json({ error: 'No timesheets in this submission' });
    }

    const timesheetIds = submission.timesheet_ids.split(',');
    const placeholders = timesheetIds.map(() => '?').join(',');

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
    console.error('Error fetching submission timesheets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update timesheet entry (admin can edit any timesheet)
router.put('/timesheets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, startKm, endKm, pauseTime, ritnumber } = req.body;

    // Check if timesheet exists
    const existing = await db.get('SELECT * FROM timesheets WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Timesheet not found' });
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
      [weekNumber, date, startTime, endTime, startKm, endKm, pauseTime, totalHours, totalKm, ritnumber || '', id]
    );

    res.json({ 
      message: 'Timesheet updated successfully',
      id,
      totalHours,
      totalKm
    });
  } catch (error) {
    console.error('Error updating timesheet:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get PDF for a specific submission (admin)
router.get('/submissions/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get('SELECT * FROM submissions WHERE id = ?', [id]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.timesheet_ids) {
      return res.status(400).json({ error: 'No timesheets in this submission' });
    }

    const timesheetIds = submission.timesheet_ids.split(',');
    const placeholders = timesheetIds.map(() => '?').join(',');

    const timesheets = await db.all(
      `SELECT t.*, u.full_name as user_name
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.start_time`,
      timesheetIds
    );

    const user = await db.get('SELECT full_name FROM users WHERE id = ?', [submission.user_id]);
    const pdfBuffer = await generatePDF(timesheets, user.full_name);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=submission_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating submission PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get XLSX for a specific submission (admin)
router.get('/submissions/:id/xlsx', async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.get('SELECT * FROM submissions WHERE id = ?', [id]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.timesheet_ids) {
      return res.status(400).json({ error: 'No timesheets in this submission' });
    }

    const timesheetIds = submission.timesheet_ids.split(',');
    const placeholders = timesheetIds.map(() => '?').join(',');

    const timesheets = await db.all(
      `SELECT t.*, u.full_name as user_name
       FROM timesheets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id IN (${placeholders})
       ORDER BY t.date, t.start_time`,
      timesheetIds
    );

    const user = await db.get('SELECT full_name FROM users WHERE id = ?', [submission.user_id]);
    const xlsxBuffer = await generateXLSX(timesheets, user.full_name);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=submission_${id}.xlsx`);
    res.send(xlsxBuffer);
  } catch (error) {
    console.error('Error generating submission XLSX:', error);
    res.status(500).json({ error: 'Failed to generate XLSX' });
  }
});

// Delete submission
router.delete('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.run('DELETE FROM submissions WHERE id = ?', [id]);
    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send submission email with custom recipient and format
router.post('/submissions/:id/send-email', async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient, format } = req.body;

    // Get submission
    const submission = await db.get(`
      SELECT s.*, u.full_name, u.username
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [id]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.timesheet_ids) {
      return res.status(400).json({ error: 'No timesheets in this submission' });
    }

    // Get timesheets for this submission
    const timesheetIds = submission.timesheet_ids.split(',');
    const placeholders = timesheetIds.map(() => '?').join(',');

    const timesheets = await db.all(
      `SELECT * FROM timesheets WHERE id IN (${placeholders}) ORDER BY date, start_time`,
      timesheetIds
    );

    // Get SMTP settings
    const smtpSettings = await db.get('SELECT * FROM smtp_settings LIMIT 1');
    const emailTo = recipient || smtpSettings.email_to;

    // Generate file based on format
    let fileBuffer, fileName, mimeType;
    
    if (format === 'pdf') {
      fileBuffer = await generatePDF(timesheets, submission.full_name);
      fileName = `timesheet_${submission.username}_${new Date().toISOString().split('T')[0]}.pdf`;
      mimeType = 'application/pdf';
    } else {
      fileBuffer = await generateXLSX(timesheets, submission.full_name);
      fileName = `timesheet_${submission.username}_${new Date().toISOString().split('T')[0]}.xlsx`;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // Send email
    await sendEmail(
      `Timesheet Submission - ${submission.full_name}`,
      `Timesheet submission from ${submission.full_name}\n\nDate: ${new Date(submission.submission_date).toLocaleString()}\nTotal entries: ${timesheets.length}\n\nSent by admin.`,
      [
        {
          filename: fileName,
          content: fileBuffer
        }
      ],
      emailTo
    );

    // Update submission status
    await db.run(
      'UPDATE submissions SET status = ?, submission_date = CURRENT_TIMESTAMP WHERE id = ?',
      ['sent', id]
    );

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending submission email:', error);
    res.status(500).json({ error: 'Failed to send email: ' + error.message });
  }
});

// Update submission (for admin and user editing)
router.put('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { timesheetIds, timesheet_ids, status } = req.body;
    const ids = timesheetIds || timesheet_ids;

    // Get current submission
    const submission = await db.get('SELECT * FROM submissions WHERE id = ?', [id]);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Only admin can change status, owner can update timesheet IDs
    const updatedTimesheetIds = ids || submission.timesheet_ids;
    const updatedStatus = req.user.is_admin && status ? status : submission.status;

    await db.run(
      'UPDATE submissions SET timesheet_ids = ?, status = ? WHERE id = ?',
      [updatedTimesheetIds, updatedStatus, id]
    );

    res.json({ message: 'Submission updated successfully' });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get SMTP settings
router.get('/smtp-settings', async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM smtp_settings LIMIT 1');
    
    if (settings) {
      // Don't send password to frontend
      delete settings.smtp_pass;
    }
    
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update SMTP settings (supports Basic and Microsoft 365 OAuth2)
router.put(
  '/smtp-settings',
  [
    body('smtp_host').trim().notEmpty(),
    body('smtp_port').isInt({ min: 1, max: 65535 }),
    body('smtp_user').trim().notEmpty(),
    body('email_from').isEmail(),
    body('email_to').isEmail(),
    body('auth_type').optional().isIn(['basic', 'oauth2']),
    body('oauth_tenant_id').optional(),
    body('oauth_client_id').optional(),
    body('oauth_client_secret').optional(),
    body('oauth_scope').optional()
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
        auth_type = 'basic',
        oauth_tenant_id,
        oauth_client_id,
        oauth_client_secret,
        oauth_scope
      } = req.body;

      if (auth_type === 'oauth2' && (!oauth_tenant_id || !oauth_client_id)) {
        return res.status(400).json({ error: 'Tenant ID and Client ID are required for Microsoft 365 OAuth' });
      }

      const existing = await db.get('SELECT id FROM smtp_settings LIMIT 1');

      if (existing) {
        const updates = [
          'smtp_host = ?',
          'smtp_port = ?',
          'smtp_secure = ?',
          'smtp_user = ?',
          'email_from = ?',
          'email_to = ?',
          'auth_type = ?',
          'oauth_tenant_id = ?',
          'oauth_client_id = ?',
          'oauth_scope = ?',
          'updated_at = CURRENT_TIMESTAMP'
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
          oauth_scope || 'https://outlook.office365.com/.default'
        ];

        if (smtp_pass) {
          updates.splice(4, 0, 'smtp_pass = ?');
          values.splice(4, 0, smtp_pass);
        }

        if (oauth_client_secret) {
          updates.splice(updates.length - 1, 0, 'oauth_client_secret = ?');
          values.splice(values.length - 1, 0, oauth_client_secret);
        }

        await db.run(
          `UPDATE smtp_settings SET ${updates.join(', ')} WHERE id = ?`,
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
            smtp_pass || '',
            email_from,
            email_to,
            auth_type,
            oauth_tenant_id || null,
            oauth_client_id || null,
            oauth_client_secret || null,
            oauth_scope || 'https://outlook.office365.com/.default'
          ]
        );
      }

      res.json({ message: 'SMTP settings updated successfully' });
    } catch (error) {
      console.error('Error updating SMTP settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Test SMTP settings
router.post('/smtp-settings/test', async (req, res) => {
  try {
    const result = await testSMTPConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing SMTP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get branding settings
router.get('/branding-settings', async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM branding_settings LIMIT 1');
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update branding settings
router.put(
  '/branding-settings',
  [
    body('company_name').trim().notEmpty().withMessage('Company name is required'),
    body('primary_color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format'),
    body('tagline').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { company_name, primary_color, tagline } = req.body;

      // Check if settings exist
      const existing = await db.get('SELECT id FROM branding_settings LIMIT 1');

      if (existing) {
        await db.run(
          `UPDATE branding_settings SET company_name = ?, primary_color = ?, tagline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [company_name, primary_color || '#0066CC', tagline || 'Please sign in to continue', existing.id]
        );
      } else {
        await db.run(
          `INSERT INTO branding_settings (company_name, primary_color, tagline) VALUES (?, ?, ?)`,
          [company_name, primary_color || '#0066CC', tagline || 'Please sign in to continue']
        );
      }

      res.json({ message: 'Branding settings updated successfully' });
    } catch (error) {
      console.error('Error updating branding settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'logo' + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg)'));
    }
  }
});

// Upload logo
router.post('/branding-settings/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoPath = '/uploads/' + req.file.filename;

    // Update branding settings with logo path
    const existing = await db.get('SELECT id FROM branding_settings LIMIT 1');

    if (existing) {
      await db.run(
        `UPDATE branding_settings SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [logoPath, existing.id]
      );
    } else {
      await db.run(
        `INSERT INTO branding_settings (company_name, logo_path) VALUES (?, ?)`,
        ['Timesheet System', logoPath]
      );
    }

    res.json({ message: 'Logo uploaded successfully', logoPath });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get hours report for all users or specific user
router.get('/hours-report', async (req, res) => {
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
      query += ' AND u.id = ?';
      params.push(userId);
    }
    
    query += `
      GROUP BY u.id, u.full_name, t.week_number
      ORDER BY u.full_name, t.week_number DESC
    `;

    const results = await db.all(query, params);

    // Calculate overworked hours
    const report = results.map(row => ({
      ...row,
      total_hours: parseFloat(row.total_hours || 0).toFixed(2),
      overworked: row.week_number ? (parseFloat(row.total_hours || 0) - 40).toFixed(2) : '0.00'
    }));

    res.json(report);
  } catch (error) {
    console.error('Error fetching hours report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

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
