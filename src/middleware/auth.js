// ═══════════════════════════════════════════════════════════════
//  JAYNES MAX TV — src/middleware/auth.js
//  JWT verification middleware
// ═══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Hujaingia. Token inahitajika.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Token imeisha. Ingia tena.'
      : 'Token batili.';
    return res.status(401).json({ success: false, error: msg });
  }
}

module.exports = authMiddleware;
