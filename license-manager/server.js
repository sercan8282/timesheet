const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const licenseUtil = require('./utils/license');

const app = express();

// Database setup
const db = new sqlite3.Database(path.join(__dirname, '..', 'data.db'), (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database (License Manager)');
        initializeDatabase();
    }
});

// Function to initialize database
function initializeDatabase() {
    // License Manager Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS license_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            mfa_secret TEXT,
            mfa_enabled BOOLEAN DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Companies table
    db.run(`
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            email TEXT,
            contact_person TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Licenses table
    db.run(`
        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            license_key TEXT UNIQUE NOT NULL,
            modules TEXT NOT NULL,
            valid_from DATETIME NOT NULL,
            valid_until DATETIME NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(created_by) REFERENCES license_users(id)
        )
    `);

    // Create default admin user if it doesn't exist
    const adminEmail = 'admin@license.local';
    db.get('SELECT * FROM license_users WHERE email = ?', [adminEmail], (err, row) => {
        if (!row) {
            const hashedPassword = bcrypt.hashSync('Admin@123', 10);
            db.run(
                'INSERT INTO license_users (email, password, is_active) VALUES (?, ?, ?)',
                [adminEmail, hashedPassword, 1],
                function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err);
                    } else {
                        console.log('✓ Default admin user created (admin@license.local / Admin@123)');
                    }
                }
            );
        }
    });
}

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'license-manager-secret-key-2025',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

function requireMFA(req, res, next) {
    if (!req.session.mfaVerified) {
        return res.redirect('/mfa-verify');
    }
    next();
}

// Routes

// Login page
app.get('/login', (req, res) => {
    if (req.session.userId && req.session.mfaVerified) {
        return res.redirect('/dashboard');
    }
    res.render('login', { message: null });
});

// Login POST
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('login', { message: 'Email en wachtwoord zijn verplicht' });
    }

    db.get('SELECT * FROM license_users WHERE email = ? AND is_active = 1', [email], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.render('login', { message: 'Er is een fout opgetreden' });
        }

        if (!user) {
            return res.render('login', { message: 'Ongeldige email of wachtwoord' });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password);
        if (!passwordMatch) {
            return res.render('login', { message: 'Ongeldige email of wachtwoord' });
        }

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.mfaEnabled = user.mfa_enabled;

        if (user.mfa_enabled) {
            return res.redirect('/mfa-verify');
        } else {
            req.session.mfaVerified = true;
            return res.redirect('/mfa-setup');
        }
    });
});

// MFA Setup page
app.get('/mfa-setup', requireAuth, (req, res) => {
    if (req.session.mfaVerified && req.session.userId !== 1) {
        return res.redirect('/dashboard');
    }

    const secret = speakeasy.generateSecret({
        name: `Licentiemanager (${req.session.userEmail})`,
        issuer: 'Licentiemanager'
    });

    req.session.tempSecret = secret.base32;

    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
        if (err) {
            return res.render('mfa-setup', { 
                error: 'Fout bij genereren QR code',
                secret: secret.base32,
                qrCode: null
            });
        }

        res.render('mfa-setup', {
            secret: secret.base32,
            qrCode: dataUrl,
            error: null
        });
    });
});

// MFA Verify page
app.get('/mfa-verify', requireAuth, (req, res) => {
    if (req.session.mfaVerified) {
        return res.redirect('/dashboard');
    }

    res.render('mfa-verify', { message: null });
});

// MFA Verify POST
app.post('/mfa-verify', requireAuth, (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.render('mfa-verify', { message: 'Voer een verificatiecode in' });
    }

    db.get('SELECT mfa_secret FROM license_users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.render('mfa-verify', { message: 'Fout bij verificatie' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.mfa_secret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (verified) {
            req.session.mfaVerified = true;
            res.redirect('/dashboard');
        } else {
            res.render('mfa-verify', { message: 'Ongeldige verificatiecode' });
        }
    });
});

// MFA Setup POST
app.post('/mfa-setup', requireAuth, (req, res) => {
    const { token } = req.body;

    if (!token || !req.session.tempSecret) {
        return res.json({ success: false, message: 'Geen verificatiecode ontvangen' });
    }

    const verified = speakeasy.totp.verify({
        secret: req.session.tempSecret,
        encoding: 'base32',
        token: token,
        window: 2
    });

    if (verified) {
        db.run(
            'UPDATE license_users SET mfa_secret = ?, mfa_enabled = 1 WHERE id = ?',
            [req.session.tempSecret, req.session.userId],
            (err) => {
                if (err) {
                    return res.json({ success: false, message: 'Fout bij opslaan MFA' });
                }

                delete req.session.tempSecret;
                req.session.mfaVerified = true;
                res.json({ success: true, redirect: '/dashboard' });
            }
        );
    } else {
        res.json({ success: false, message: 'Ongeldige verificatiecode' });
    }
});

// Dashboard
app.get('/dashboard', requireAuth, requireMFA, (req, res) => {
    res.render('dashboard', { email: req.session.userEmail });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Fout bij afmelden');
        }
        res.redirect('/login');
    });
});

// Root redirect
app.get('/', (req, res) => {
    if (req.session.userId && req.session.mfaVerified) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// ============ API ROUTES - GEBRUIKERS ============

// Get all users (API)
app.get('/api/users', requireAuth, requireMFA, (req, res) => {
    db.all('SELECT id, email, mfa_enabled, is_active, created_at FROM license_users ORDER BY created_at DESC', 
        (err, users) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, users });
        }
    );
});

// Create new user (API)
app.post('/api/users', requireAuth, requireMFA, (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email en wachtwoord verplicht' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Wachtwoord moet minstens 8 karakters zijn' });
    }

    db.get('SELECT id FROM license_users WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (user) {
            return res.status(400).json({ success: false, message: 'Email bestaat al' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run(
            'INSERT INTO license_users (email, password, is_active) VALUES (?, ?, ?)',
            [email, hashedPassword, 1],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Fout bij aanmaken gebruiker' });
                }

                res.json({ 
                    success: true, 
                    message: 'Gebruiker aangemaakt',
                    user: {
                        id: this.lastID,
                        email: email,
                        mfa_enabled: false,
                        is_active: true,
                        created_at: new Date().toISOString()
                    }
                });
            }
        );
    });
});

// Update user
app.put('/api/users/:id', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;
    const { is_active, password } = req.body;

    if (is_active === undefined && !password) {
        return res.status(400).json({ success: false, message: 'Niets te updaten' });
    }

    if (password && password.length < 8) {
        return res.status(400).json({ success: false, message: 'Wachtwoord moet minstens 8 karakters zijn' });
    }

    const hashedPassword = password ? bcrypt.hashSync(password, 10) : null;

    if (is_active !== undefined && hashedPassword) {
        db.run(
            'UPDATE license_users SET is_active = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [is_active, hashedPassword, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.json({ success: true, message: 'Gebruiker bijgewerkt' });
            }
        );
    } else if (is_active !== undefined) {
        db.run(
            'UPDATE license_users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [is_active, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.json({ success: true, message: 'Gebruiker bijgewerkt' });
            }
        );
    } else if (hashedPassword) {
        db.run(
            'UPDATE license_users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Database error' });
                }
                res.json({ success: true, message: 'Wachtwoord gewijzigd' });
            }
        );
    }
});

// Delete user
app.delete('/api/users/:id', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;

    if (parseInt(id) === 1) {
        return res.status(400).json({ success: false, message: 'Kan admin niet verwijderen' });
    }

    db.run('DELETE FROM license_users WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.json({ success: true, message: 'Gebruiker verwijderd' });
    });
});

// ============ API ROUTES - BEDRIJVEN ============

// Get all companies (API)
app.get('/api/companies', requireAuth, requireMFA, (req, res) => {
    db.all('SELECT id, name, address, email, contact_person, created_at FROM companies ORDER BY created_at DESC', 
        (err, companies) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, companies });
        }
    );
});

// Create new company (API)
app.post('/api/companies', requireAuth, requireMFA, (req, res) => {
    const { name, address, email, contact_person } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Bedrijfsnaam is verplicht' });
    }

    db.run(
        'INSERT INTO companies (name, address, email, contact_person) VALUES (?, ?, ?, ?)',
        [name.trim(), address || null, email || null, contact_person || null],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Fout bij aanmaken bedrijf' });
            }

            res.json({ 
                success: true, 
                message: 'Bedrijf aangemaakt',
                company: {
                    id: this.lastID,
                    name: name.trim(),
                    address: address || null,
                    email: email || null,
                    contact_person: contact_person || null,
                    created_at: new Date().toISOString()
                }
            });
        }
    );
});

// Update company
app.put('/api/companies/:id', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;
    const { name, address, email, contact_person } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Bedrijfsnaam is verplicht' });
    }

    db.run(
        'UPDATE companies SET name = ?, address = ?, email = ?, contact_person = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name.trim(), address || null, email || null, contact_person || null, id],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Bedrijf bijgewerkt' });
        }
    );
});

// Delete company
app.delete('/api/companies/:id', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;

    // Check if company has licenses
    db.get('SELECT COUNT(*) as count FROM licenses WHERE company_id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        if (row.count > 0) {
            return res.status(400).json({ success: false, message: 'Kan bedrijf niet verwijderen - heeft actieve licenties' });
        }

        db.run('DELETE FROM companies WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Bedrijf verwijderd' });
        });
    });
});

// ============ API ROUTES - LICENTIES ============

// Get available modules
app.get('/api/modules', requireAuth, requireMFA, (req, res) => {
    res.json({ success: true, modules: licenseUtil.AVAILABLE_MODULES });
});

// Get all licenses (API)
app.get('/api/licenses', requireAuth, requireMFA, (req, res) => {
    const sql = `
        SELECT l.*, c.name as company_name 
        FROM licenses l 
        JOIN companies c ON l.company_id = c.id 
        ORDER BY l.created_at DESC
    `;
    
    db.all(sql, (err, licenses) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        // Parse modules JSON for each license
        const parsedLicenses = licenses.map(lic => ({
            ...lic,
            modules: JSON.parse(lic.modules || '[]'),
            is_valid: new Date() <= new Date(lic.valid_until),
            days_remaining: Math.ceil((new Date(lic.valid_until) - new Date()) / (1000 * 60 * 60 * 24))
        }));
        
        res.json({ success: true, licenses: parsedLicenses });
    });
});

// Generate new license
app.post('/api/licenses', requireAuth, requireMFA, (req, res) => {
    const { company_id, modules, valid_from, valid_until } = req.body;

    if (!company_id || !modules || !Array.isArray(modules) || modules.length === 0) {
        return res.status(400).json({ success: false, message: 'Bedrijf en minstens 1 module verplicht' });
    }

    if (!valid_from || !valid_until) {
        return res.status(400).json({ success: false, message: 'Geldigheidsduur verplicht' });
    }

    const fromDate = new Date(valid_from);
    const untilDate = new Date(valid_until);

    if (fromDate >= untilDate) {
        return res.status(400).json({ success: false, message: 'Einddatum moet na startdatum zijn' });
    }

    // Get company name
    db.get('SELECT name FROM companies WHERE id = ?', [company_id], (err, company) => {
        if (err || !company) {
            return res.status(400).json({ success: false, message: 'Bedrijf niet gevonden' });
        }

        // Generate license key
        const licenseKey = licenseUtil.generateLicenseKey();
        
        // Create license data
        const licenseData = licenseUtil.createLicenseData(
            company.name,
            modules,
            valid_from,
            valid_until
        );

        // Create signed license
        const signedLicense = licenseUtil.createSignedLicense(licenseKey, licenseData);

        // Store in database
        db.run(
            `INSERT INTO licenses (company_id, license_key, modules, valid_from, valid_until, is_active, created_by) 
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [company_id, licenseKey, JSON.stringify(modules), valid_from, valid_until, req.session.userId],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Fout bij aanmaken licentie' });
                }

                res.json({
                    success: true,
                    message: 'Licentie gegenereerd',
                    license: {
                        id: this.lastID,
                        license_key: licenseKey,
                        company_name: company.name,
                        modules: modules,
                        valid_from: valid_from,
                        valid_until: valid_until,
                        is_active: true,
                        is_valid: true,
                        signature: signedLicense.signature
                    }
                });
            }
        );
    });
});

// Get license details with signature
app.get('/api/licenses/:id', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;

    db.get(
        `SELECT l.*, c.name as company_name 
         FROM licenses l 
         JOIN companies c ON l.company_id = c.id 
         WHERE l.id = ?`,
        [id],
        (err, license) => {
            if (err || !license) {
                return res.status(404).json({ success: false, message: 'Licentie niet gevonden' });
            }

            const modules = JSON.parse(license.modules || '[]');
            const licenseData = licenseUtil.createLicenseData(
                license.company_name,
                modules,
                license.valid_from,
                license.valid_until
            );

            const signedLicense = licenseUtil.createSignedLicense(license.license_key, licenseData);

            res.json({
                success: true,
                license: {
                    ...license,
                    modules: modules,
                    signature: signedLicense.signature,
                    is_valid: new Date() <= new Date(license.valid_until),
                    days_remaining: Math.ceil((new Date(license.valid_until) - new Date()) / (1000 * 60 * 60 * 24))
                }
            });
        }
    );
});

// Download license file
app.get('/api/licenses/:id/download', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;

    db.get(
        `SELECT l.*, c.name as company_name 
         FROM licenses l 
         JOIN companies c ON l.company_id = c.id 
         WHERE l.id = ?`,
        [id],
        (err, license) => {
            if (err || !license) {
                return res.status(404).json({ success: false, message: 'Licentie niet gevonden' });
            }

            const modules = JSON.parse(license.modules || '[]');
            const licenseData = licenseUtil.createLicenseData(
                license.company_name,
                modules,
                license.valid_from,
                license.valid_until
            );

            const signedLicense = licenseUtil.createSignedLicense(license.license_key, licenseData);

            const licenseFile = {
                key: signedLicense.key,
                data: signedLicense.data,
                signature: signedLicense.signature
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="license-${license.license_key}.json"`);
            res.send(JSON.stringify(licenseFile, null, 2));
        }
    );
});

// Revoke license
app.put('/api/licenses/:id/revoke', requireAuth, requireMFA, (req, res) => {
    const { id } = req.params;

    db.run(
        'UPDATE licenses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id],
        function(err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Database error' });
            }
            res.json({ success: true, message: 'Licentie ingetrokken' });
        }
    );
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', { error: 'Er is een fout opgetreden' });
});

// Start server
const PORT = process.env.LICENSE_PORT || 3001;
app.listen(PORT, () => {
    console.log(`\n✓ Licentiemanager server gestart op http://localhost:${PORT}`);
    console.log(`\nStandaard login:`);
    console.log(`  Email: admin@license.local`);
    console.log(`  Wachtwoord: Admin@123\n`);
});

module.exports = app;
