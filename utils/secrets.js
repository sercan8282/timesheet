/**
 * Secrets Management - Encryption for sensitive configuration
 * Uses AES-256-GCM encryption for storing secrets securely
 */

const crypto = require('crypto');

class SecretsManager {
  constructor() {
    // Use a master key derived from a configuration or environment variable
    // In production, this should come from a secure key management system
    this.masterKey = process.env.MASTER_SECRET_KEY || this.generateDefaultMasterKey();
  }

  /**
   * Generate a default master key (for development only)
   * In production, this should be managed securely (e.g., AWS KMS, HashiCorp Vault)
   */
  generateDefaultMasterKey() {
    // For development: Use a consistent key based on JWT_SECRET
    const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
    // Derive a 32-byte key from JWT_SECRET using SHA256
    return crypto.createHash('sha256').update(jwtSecret).digest();
  }

  /**
   * Encrypt a secret value
   * Returns: { iv, authTag, encryptedData } all in base64
   */
  encryptSecret(plaintext) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encryptedData: encrypted,
        algorithm: 'aes-256-gcm'
      };
    } catch (error) {
      console.error('[SECRETS] Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt a secret value
   */
  decryptSecret(encrypted) {
    try {
      if (!encrypted || typeof encrypted !== 'string') {
        throw new Error('Invalid encrypted data');
      }

      // Parse the encrypted data (format: "iv:authTag:encryptedData")
      const parts = encrypted.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const encryptedData = parts[2];

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        iv
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[SECRETS] Decryption error:', error);
      throw new Error('Failed to decrypt secret - key may be invalid');
    }
  }

  /**
   * Format encrypted data for storage
   */
  formatForStorage(encrypted) {
    return `${encrypted.iv}:${encrypted.authTag}:${encrypted.encryptedData}`;
  }

  /**
   * Hash a secret for verification (one-way)
   */
  hashSecret(secret) {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  /**
   * Generate a strong random secret
   */
  generateRandomSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64').substring(0, length);
  }
}

module.exports = new SecretsManager();
