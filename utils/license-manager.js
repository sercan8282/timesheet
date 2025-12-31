const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * License Manager for Timesheet Application
 * Verifies and manages licenses
 */

class LicenseManager {
    constructor(licensesDir = path.join(__dirname, '..', 'license-files')) {
        this.licensesDir = licensesDir;
        // Ensure directory exists
        if (!fs.existsSync(this.licensesDir)) {
            fs.mkdirSync(this.licensesDir, { recursive: true });
        }
    }

    /**
     * Load and verify a license file
     */
    loadLicense(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const license = JSON.parse(data);
            
            if (!license.key || !license.data || !license.signature) {
                return { valid: false, error: 'Invalid license file format' };
            }

            // Verify signature
            if (!this.verifySignature(license.key, license.data, license.signature)) {
                return { valid: false, error: 'License signature invalid - file may be tampered' };
            }

            // Check expiration
            if (!this.isLicenseValid(license.data)) {
                return { valid: false, error: 'License has expired', license };
            }

            return { valid: true, license, error: null };
        } catch (err) {
            return { valid: false, error: `Failed to load license: ${err.message}` };
        }
    }

    /**
     * Verify license signature using HMAC
     */
    verifySignature(key, data, signature) {
        const hmac = crypto.createHmac('sha256', process.env.LICENSE_SECRET || 'license-secret-key');
        hmac.update(JSON.stringify(data));
        const expectedSignature = hmac.digest('hex');
        return signature === expectedSignature;
    }

    /**
     * Check if license is not expired
     */
    isLicenseValid(licenseData) {
        const now = new Date();
        const validUntil = new Date(licenseData.validUntil);
        return now <= validUntil;
    }

    /**
     * Check if license has specific module
     */
    hasModule(license, moduleName) {
        if (!license || !license.data || !license.data.modules) {
            return false;
        }
        return license.data.modules.includes(moduleName);
    }

    /**
     * Get license info
     */
    getLicenseInfo(license) {
        if (!license || !license.valid) {
            return null;
        }

        const validUntil = new Date(license.license.data.validUntil);
        const now = new Date();
        const daysRemaining = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24));

        return {
            company: license.license.data.company,
            modules: license.license.data.modules,
            validFrom: license.license.data.validFrom,
            validUntil: license.license.data.validUntil,
            daysRemaining: daysRemaining,
            isValid: true
        };
    }

    /**
     * Store license file in the licenses directory
     */
    storeLicense(licenseContent, filename = null) {
        try {
            const name = filename || `license-${Date.now()}.json`;
            const filePath = path.join(this.licensesDir, name);
            fs.writeFileSync(filePath, JSON.stringify(licenseContent, null, 2));
            return { success: true, path: filePath };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Get all stored licenses
     */
    getStoredLicenses() {
        try {
            const files = fs.readdirSync(this.licensesDir);
            const licenses = {};

            files.forEach(file => {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.licensesDir, file);
                    const result = this.loadLicense(filePath);
                    licenses[file] = result;
                }
            });

            return licenses;
        } catch (err) {
            return {};
        }
    }
}

module.exports = LicenseManager;
