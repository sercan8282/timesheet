const LicenseManager = require('../utils/license-manager');
const path = require('path');

/**
 * License check middleware for Timesheet routes
 */

const licenseManager = new LicenseManager();
let activeLicense = null;

/**
 * Initialize license - load from stored licenses
 */
function initializeLicense() {
    const licenses = licenseManager.getStoredLicenses();
    
    for (const filename in licenses) {
        const licenseResult = licenses[filename];
        if (licenseResult.valid && licenseResult.license) {
            activeLicense = licenseResult.license;
            console.log(`✓ License loaded: ${licenseResult.license.data.company}`);
            console.log(`  Modules: ${licenseResult.license.data.modules.join(', ')}`);
            console.log(`  Valid until: ${new Date(licenseResult.license.data.validUntil).toLocaleDateString()}`);
            return true;
        }
    }
    
    console.warn('⚠️  No valid license found');
    return false;
}

/**
 * Check if module is licensed
 */
function checkLicense(moduleName) {
    if (!activeLicense) {
        return {
            allowed: false,
            reason: 'No license loaded',
            errorCode: 'NO_LICENSE'
        };
    }

    if (!licenseManager.isLicenseValid(activeLicense.data)) {
        return {
            allowed: false,
            reason: 'License expired',
            errorCode: 'LICENSE_EXPIRED',
            validUntil: activeLicense.data.validUntil
        };
    }

    if (!licenseManager.hasModule(activeLicense, moduleName)) {
        return {
            allowed: false,
            reason: `Module '${moduleName}' not included in license`,
            errorCode: 'MODULE_NOT_LICENSED',
            availableModules: activeLicense.data.modules
        };
    }

    return {
        allowed: true,
        company: activeLicense.data.company,
        validUntil: activeLicense.data.validUntil,
        daysRemaining: Math.ceil(
            (new Date(activeLicense.data.validUntil) - new Date()) / (1000 * 60 * 60 * 24)
        )
    };
}

/**
 * Express middleware to check license for a specific module
 */
function requireModule(moduleName) {
    return (req, res, next) => {
        const result = checkLicense(moduleName);
        
        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                message: result.reason,
                errorCode: result.errorCode,
                details: result
            });
        }

        // Attach license info to request
        req.license = {
            company: result.company,
            validUntil: result.validUntil,
            daysRemaining: result.daysRemaining
        };

        next();
    };
}

/**
 * Get current license status
 */
function getLicenseStatus() {
    if (!activeLicense) {
        return {
            loaded: false,
            message: 'No license loaded'
        };
    }

    return {
        loaded: true,
        company: activeLicense.data.company,
        modules: activeLicense.data.modules,
        validFrom: activeLicense.data.validFrom,
        validUntil: activeLicense.data.validUntil,
        isValid: licenseManager.isLicenseValid(activeLicense.data),
        daysRemaining: Math.ceil(
            (new Date(activeLicense.data.validUntil) - new Date()) / (1000 * 60 * 60 * 24)
        )
    };
}

/**
 * Upload and activate a license
 */
function activateLicense(licenseContent, filename = null) {
    const result = licenseManager.loadLicense(filename);
    
    if (!result.valid) {
        return {
            success: false,
            error: result.error
        };
    }

    activeLicense = result.license;
    return {
        success: true,
        message: 'License activated successfully',
        license: getLicenseStatus()
    };
}

module.exports = {
    initializeLicense,
    checkLicense,
    requireModule,
    getLicenseStatus,
    activateLicense,
    licenseManager
};
