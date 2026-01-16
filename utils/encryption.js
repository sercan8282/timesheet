const crypto = require("crypto");

// Use a fixed encryption key from environment or generate a default
// In production, this should be a strong key stored securely
let ENCRYPTION_KEY;

if (process.env.ENCRYPTION_KEY) {
  // If ENCRYPTION_KEY is provided as hex string (e.g., from .env), convert to Buffer
  const keyStr = process.env.ENCRYPTION_KEY.trim();
  ENCRYPTION_KEY = keyStr.length === 64 ? Buffer.from(keyStr, 'hex') : Buffer.from(keyStr);
} else {
  // Fallback to generated key
  ENCRYPTION_KEY = crypto.scryptSync("timesheet-default-key-change-in-production", "salt", 32);
}

/**
 * Encrypt a string (for SMTP passwords)
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text in base64 format
 */
function encryptPassword(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      ENCRYPTION_KEY,
      iv
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Return IV + encrypted data in base64
    return iv.toString("hex") + ":" + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    return null;
  }
}

/**
 * Decrypt a string (for SMTP passwords)
 * @param {string} encryptedText - The encrypted text in the format "iv:encrypted"
 * @returns {string} - The decrypted text
 */
function decryptPassword(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 2) {
      console.warn("Invalid encrypted format");
      return null;
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");

    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      ENCRYPTION_KEY,
      iv
    );

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

module.exports = {
  encryptPassword,
  decryptPassword,
};
