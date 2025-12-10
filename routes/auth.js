const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

// Login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user (case-insensitive)
      const user = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Blocked users cannot login
      if (user.is_blocked === 1) {
        return res.status(403).json({ error: 'Your account has been blocked. Contact administrator.' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin === 1
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.is_admin === 1
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
