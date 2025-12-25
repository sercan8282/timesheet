const crypto = require('crypto');

// Available modules
const AVAILABLE_MODULES = [
    { id: 'leave', name: 'Verlof' },
    { id: 'fleet', name: 'Wagenpark' },
    { id: 'planning', name: 'Planning' },
    { id: 'invoices', name: 'Facturen' },
    { id: 'revenue', name: 'Omzet' }
];

// Generate a unique license key
function generateLicenseKey() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `LIC-${timestamp}-${random}`;
}

// Create license data object
function createLicenseData(companyName, modules, validFrom, validUntil) {
    return {
        company: companyName,
        modules: modules,
        validFrom: validFrom,
        validUntil: validUntil,
        generatedAt: new Date().toISOString()
    };
}

// Encrypt license data for signing
function signLicenseKey(key, data) {
    const hmac = crypto.createHmac('sha256', process.env.LICENSE_SECRET || 'license-secret-key');
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
}

// Create complete license with signature
function createSignedLicense(key, data) {
    const signature = signLicenseKey(key, data);
    return {
        key: key,
        data: data,
        signature: signature
    };
}

// Verify license integrity
function verifyLicense(licenseKey, licenseData, signature) {
    const hmac = crypto.createHmac('sha256', process.env.LICENSE_SECRET || 'license-secret-key');
    hmac.update(JSON.stringify(licenseData));
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature;
}

// Check if license is valid (not expired)
function isLicenseValid(licenseData) {
    const now = new Date();
    const validUntil = new Date(licenseData.validUntil);
    return now <= validUntil;
}

// Check if license has specific module
function hasModule(licenseData, moduleName) {
    return licenseData.modules && licenseData.modules.includes(moduleName);
}

module.exports = {
    AVAILABLE_MODULES,
    generateLicenseKey,
    createLicenseData,
    signLicenseKey,
    createSignedLicense,
    verifyLicense,
    isLicenseValid,
    hasModule
};
