const jwt = require("jsonwebtoken");
const db = require("../config/database");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is not blocked; also hydrate full profile for downstream use
    try {
      const user = await db.get(
        `SELECT 
            u.id, u.username, u.full_name, u.is_blocked, u.role,
            u.company_id, u.phone, u.ritnumber, u.adr, u.mega_kast,
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
