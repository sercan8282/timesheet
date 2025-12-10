const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is not blocked
    try {
      const user = await db.get('SELECT id, is_blocked FROM users WHERE id = ?', [decoded.id]);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      // Check if user is blocked (is_blocked = 1)
      if (user.is_blocked === 1) {
        return res.status(403).json({ error: 'Your account has been blocked. Contact administrator.' });
      }
    } catch (dbError) {
      // If there's a database error (e.g., column doesn't exist yet), allow access
      console.warn('Error checking user block status:', dbError.message);
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
