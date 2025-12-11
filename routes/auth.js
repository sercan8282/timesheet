const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");

const router = express.Router();

// Login
router.post(
  "/login",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
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
        `SELECT u.*, c.name AS company_name, c.pause_time AS company_pause_time
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE LOWER(u.username) = LOWER(?)`,
        [username]
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Blocked users cannot login
      if (user.is_blocked === 1) {
        return res
          .status(403)
          .json({
            error: "Your account has been blocked. Contact administrator.",
          });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
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

      // Get primary company (fallback to company_id if no user_companies record)
      let primaryCompany = userCompanies.find((c) => c.is_primary === 1);
      if (!primaryCompany && userCompanies.length > 0) {
        primaryCompany = userCompanies[0];
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.role === 'admin',
          role: user.role || "user",
          companyId: primaryCompany?.id || user.company_id,
          companyName: primaryCompany?.name || user.company_name,
          companyPauseTime: primaryCompany?.pause_time || user.company_pause_time,
          userCompanies: userCompanies.map((c) => ({
            id: c.id,
            name: c.name,
            pause_time: c.pause_time,
            is_primary: c.is_primary === 1,
          })),
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          isAdmin: user.role === 'admin',
          role: user.role || "user",
          companyId: primaryCompany?.id || user.company_id,
          companyName: primaryCompany?.name || user.company_name,
          companyPauseTime: primaryCompany?.pause_time || user.company_pause_time,
          company_name: primaryCompany?.name || user.company_name,
          company_pause_time: primaryCompany?.pause_time || user.company_pause_time,
          userCompanies: userCompanies.map((c) => ({
            id: c.id,
            name: c.name,
            pause_time: c.pause_time,
            is_primary: c.is_primary === 1,
          })),
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

module.exports = router;
