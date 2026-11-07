import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(staff) {
  return jwt.sign({ id: staff.id, role: staff.role }, SECRET, { expiresIn: '12h' });
}

/** Require a valid JWT; loads the current staff member into req.user. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, SECRET);
    const [user] = await query(
      'SELECT id, full_name, email, role, employment_type, is_active FROM staff WHERE id = ?',
      [payload.id]
    );
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account disabled' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
