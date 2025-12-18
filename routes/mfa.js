const express = require("express");
const router = express.Router();
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { authMiddleware } = require("../middleware/auth");
const db = require("../config/database");

// Apply auth middleware to all MFA routes
router.use(authMiddleware);

// Setup MFA - generate secret and QR code
router.post("/setup", async (req, res) => {
  const userId = req.user.id;

  // Check if user already has MFA enabled
  const user = await db.get(
    "SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?",
    [userId]
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // If MFA already enabled, require disabling first
  if (user.mfa_enabled) {
    return res
      .status(400)
      .json({ error: "MFA already enabled. Disable first to re-setup." });
  }

  // Generate new secret
  const secret = speakeasy.generateSecret({
    name: `Timesheet (${req.user.username})`,
    issuer: "Timesheet App",
  });

  try {
    // Generate QR code data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store temporary secret (will be confirmed on verify)
    await db.run("UPDATE users SET mfa_secret = ? WHERE id = ?", [
      secret.base32,
      userId,
    ]);

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// Verify MFA token and enable MFA
router.post("/verify", async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }

  const user = await db.get(
    "SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?",
    [userId]
  );

  if (!user || !user.mfa_secret) {
    return res.status(400).json({ error: "MFA setup not initialized" });
  }

  // Verify the token
  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: "base32",
    token: token,
    window: 2, // Allow 2 time steps before/after for clock drift
  });

  if (!verified) {
    return res.status(400).json({ error: "Invalid token" });
  }

  // Generate backup codes
  const backupCodes = [];
  for (let i = 0; i < 8; i++) {
    backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }

  // Enable MFA and save backup codes
  await db.run(
    "UPDATE users SET mfa_enabled = 1, mfa_backup_codes = ?, mfa_skip_count = 0 WHERE id = ?",
    [JSON.stringify(backupCodes), userId]
  );

  res.json({
    success: true,
    message: "MFA enabled successfully",
    backupCodes: backupCodes,
  });
});

// Disable MFA
router.post("/disable", async (req, res) => {
  const userId = req.user.id;
  const { password, token } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password required" });
  }

  const bcrypt = require("bcryptjs");

  const user = await db.get(
    "SELECT password, mfa_enabled, mfa_secret FROM users WHERE id = ?",
    [userId]
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // If MFA is enabled, require token
  if (user.mfa_enabled && user.mfa_secret) {
    if (!token) {
      return res.status(400).json({ error: "MFA token required" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: "base32",
      token: token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: "Invalid MFA token" });
    }
  }

  // Disable MFA
  await db.run(
    "UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_codes = NULL WHERE id = ?",
    [userId]
  );

  res.json({
    success: true,
    message: "MFA disabled successfully",
  });
});

// NOTE: Removed /skip endpoint - skipping MFA setup is no longer supported.

// Get MFA status
router.get("/status", async (req, res) => {
  const userId = req.user.id;

  const user = await db.get(
    "SELECT mfa_enabled, mfa_skip_count FROM users WHERE id = ?",
    [userId]
  );

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const skipCount = user.mfa_skip_count || 0;
  const skipLimitReached = skipCount >= 3;

  res.json({
    mfaEnabled: user.mfa_enabled === 1,
    skipCount: skipCount,
    skipsRemaining: Math.max(0, 3 - skipCount),
    skipLimitReached: skipLimitReached,
    setupRequired: skipLimitReached && !user.mfa_enabled,
  });
});

// Verify backup code
router.post("/verify-backup", async (req, res) => {
  const userId = req.user.id;
  const { backupCode } = req.body;

  if (!backupCode) {
    return res.status(400).json({ error: "Backup code required" });
  }

  const user = await db.get("SELECT mfa_backup_codes FROM users WHERE id = ?", [
    userId,
  ]);

  if (!user || !user.mfa_backup_codes) {
    return res.status(400).json({ error: "No backup codes found" });
  }

  try {
    const backupCodes = JSON.parse(user.mfa_backup_codes);
    const codeIndex = backupCodes.indexOf(backupCode.toUpperCase());

    if (codeIndex === -1) {
      return res.status(400).json({ error: "Invalid backup code" });
    }

    // Remove used backup code
    backupCodes.splice(codeIndex, 1);

    await db.run("UPDATE users SET mfa_backup_codes = ? WHERE id = ?", [
      JSON.stringify(backupCodes),
      userId,
    ]);

    res.json({
      success: true,
      message: "Backup code verified",
      remainingCodes: backupCodes.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to parse backup codes" });
  }
});

module.exports = router;
