import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { ah } from '../util.js';

const r = Router();
const COLS = 'id, full_name, email, employment_type, role, phone, is_active, created_at';

// Everyone can see the staff directory (needed to show who ordered / who is using items).
r.get('/', ah(async (req, res) => {
  const rows = await query(`
    SELECT ${COLS},
      (SELECT COUNT(*) FROM items i WHERE i.ordered_by = s.id) AS items_ordered,
      (SELECT COUNT(*) FROM reservations rv WHERE rv.staff_id = s.id AND rv.status = 'active'
         AND rv.end_date >= CURDATE()) AS active_reservations
    FROM staff s ORDER BY full_name`);
  res.json(rows);
}));

function validate(body, isNew) {
  const errors = [];
  if (!body.full_name?.trim()) errors.push('Full name is required');
  if (!/^\S+@\S+\.\S+$/.test(body.email || '')) errors.push('Valid email is required');
  if (!['full_time', 'part_time'].includes(body.employment_type)) errors.push('Employment type must be full_time or part_time');
  if (!['admin', 'staff'].includes(body.role)) errors.push('Role must be admin or staff');
  if (isNew && (!body.password || body.password.length < 6)) errors.push('Password must be at least 6 characters');
  if (!isNew && body.password && body.password.length < 6) errors.push('Password must be at least 6 characters');
  return errors;
}

r.post('/', requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const errors = validate(b, true);
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  const result = await query(
    `INSERT INTO staff (full_name, email, password_hash, employment_type, role, phone, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [b.full_name.trim(), b.email.toLowerCase().trim(), await bcrypt.hash(b.password, 10),
     b.employment_type, b.role, b.phone || null, b.is_active === false ? 0 : 1]
  );
  const [row] = await query(`SELECT ${COLS} FROM staff WHERE id = ?`, [result.insertId]);
  res.status(201).json(row);
}));

r.put('/:id', requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const errors = validate(b, false);
  if (errors.length) return res.status(400).json({ error: errors.join('. ') });
  const id = Number(req.params.id);
  if (id === req.user.id && (b.role !== 'admin' || b.is_active === false)) {
    return res.status(400).json({ error: 'You cannot remove your own admin rights or disable yourself' });
  }
  const fields = ['full_name = ?', 'email = ?', 'employment_type = ?', 'role = ?', 'phone = ?', 'is_active = ?'];
  const params = [b.full_name.trim(), b.email.toLowerCase().trim(), b.employment_type, b.role, b.phone || null, b.is_active === false ? 0 : 1];
  if (b.password) { fields.push('password_hash = ?'); params.push(await bcrypt.hash(b.password, 10)); }
  const result = await query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Staff not found' });
  const [row] = await query(`SELECT ${COLS} FROM staff WHERE id = ?`, [id]);
  res.json(row);
}));

r.delete('/:id', requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const result = await query('DELETE FROM staff WHERE id = ?', [id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Staff not found' });
  res.json({ ok: true });
}));

export default r;
