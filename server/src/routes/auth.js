import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { ah } from '../util.js';

const r = Router();

r.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const [user] = await query('SELECT * FROM staff WHERE email = ?', [String(email || '').toLowerCase()]);
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!user.is_active) return res.status(403).json({ error: 'Account is disabled' });
  delete user.password_hash;
  res.json({ token: signToken(user), user });
}));

r.get('/me', requireAuth, (req, res) => res.json(req.user));

r.put('/password', requireAuth, ah(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const [u] = await query('SELECT password_hash FROM staff WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(current_password || ''), u.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await query('UPDATE staff SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
  res.json({ ok: true });
}));

export default r;
