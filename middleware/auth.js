const jwt = require("jsonwebtoken");
const db = require("../config/database");
const crypto = require("crypto");

const authMiddleware = async (req, res, next) => {
  try {
    // Support Authorization header and fallback to token in query for SSE/EventSource
    const headerToken = req.headers.authorization?.split(" ")[1];
    const queryToken = req.query && (req.query.token || req.query.access_token);
    const token = headerToken || queryToken;

    if (!token) {
      // Fallback: allow API Key auth via header x-api-key or query api_key
      const apiKey = req.headers["x-api-key"] || (req.query && req.query.api_key);
      if (!apiKey) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Validate API key against hashed values in database
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
      const apiRecord = await db.get(
        `SELECT ak.id, ak.created_by, ak.revoked_at, u.role AS creator_role
         FROM api_keys ak
         LEFT JOIN users u ON u.id = ak.created_by
         WHERE ak.key_hash = ?`,
        [keyHash]
      );

      if (!apiRecord || apiRecord.revoked_at) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      // Load creator user profile to populate req.user
      const user = await db.get(
        `SELECT 
            u.id, u.username, u.full_name, u.is_blocked, u.role,
            u.company_id, u.phone, u.ritnumber, u.adr, u.mega_kast,
            u.mfa_enabled, u.mfa_required,
            c.name AS company_name, c.pause_time AS company_pause_time
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = ?`,
        [apiRecord.created_by]
      );

      if (!user) {
        return res.status(401).json({ error: "API key creator not found" });
      }

      if (user.is_blocked === 1) {
        return res.status(403).json({
          error: "Your account has been blocked. Contact administrator.",
        });
      }

      // With API keys, skip MFA enforcement to allow automation
      req.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        isAdmin: user.role === "admin",
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name,
        company_pause_time: user.company_pause_time,
        phone: user.phone,
        email: user.email,
        ritnumber: user.ritnumber,
        adr: user.adr,
        mega_kast: user.mega_kast,
      };
      // Mark request as API key-authenticated
      req.authViaApiKey = true;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is not blocked; also hydrate full profile for downstream use
    try {
      const user = await db.get(
        `SELECT 
            u.id, u.username, u.full_name, u.is_blocked, u.role,
            u.company_id, u.phone, u.ritnumber, u.adr, u.mega_kast,
            u.mfa_enabled, u.mfa_required,
            c.name AS company_name, c.pause_time AS company_pause_time
         FROM users u
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = ?`,
        [decoded.id]
      );
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (user.is_blocked === 1) {
        return res.status(403).json({
          error: "Your account has been blocked. Contact administrator.",
        });
      }

      // Check if MFA setup is required (only if mfa_required is set)
      // Allow access to MFA-related endpoints even if MFA not enabled
      // These endpoints should allow the user to SET UP MFA
      if (!user.mfa_enabled && user.mfa_required === 1) {
        // Build full path including base path for checking
        const fullPath = req.baseUrl + req.path;
        
        // Only allow MFA setup/verify/disable and logout endpoints
        // For other endpoints, return MFA setup required error
        const allowedWithoutMFA = [
          '/api/mfa/setup',
          '/api/mfa/verify',
          '/api/mfa/disable',
          '/api/mfa/verify-backup',
          '/api/mfa/status',
          '/api/auth/logout'
        ];
        
        const isAllowedEndpoint = allowedWithoutMFA.some(ep => 
          fullPath === ep || 
          fullPath.startsWith(ep + '/') ||
          fullPath.startsWith(ep + '?')
        );
        
        console.log(`[MFA Check] User ${user.id} (${user.username}) MFA required but not enabled`);
        console.log(`[MFA Check] req.path: ${req.path}, req.baseUrl: ${req.baseUrl}, fullPath: ${fullPath}`);
        console.log(`[MFA Check] Allowed: ${isAllowedEndpoint}`);
        
        if (!isAllowedEndpoint) {
          console.log(`[MFA Check] BLOCKING access to ${fullPath}`);
          return res.status(403).json({
            error: "MFA setup required",
            mfaSetupRequired: true
          });
        } else {
          console.log(`[MFA Check] ALLOWING access to ${fullPath}`);
        }
      }

      // Merge DB values to ensure fullName is always available for logging/submissions
      req.user = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        isAdmin: user.role === "admin",
        role: user.role || decoded.role,
        company_id: user.company_id,
        company_name: user.company_name,
        company_pause_time: user.company_pause_time,
        phone: user.phone,
        email: user.email,
        ritnumber: user.ritnumber,
        adr: user.adr,
        mega_kast: user.mega_kast,
      };
    } catch (dbError) {
      // If there's a database error (e.g., column doesn't exist yet), allow access using token payload
      console.warn("Error checking user block status:", dbError.message);
      req.user = decoded;
    }
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
