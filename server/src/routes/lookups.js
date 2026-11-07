// Simple CRUD for locations and course units (read: everyone, write: admin).
import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { ah } from '../util.js';

function crud(table, fields, required, orderBy) {
  const r = Router();
  r.get('/', ah(async (req, res) => {
    res.json(await query(`SELECT t.*, (SELECT COUNT(*) FROM ${table === 'locations' ? 'items x WHERE x.location_id' : 'item_course_units x WHERE x.course_unit_id'} = t.id) AS item_count FROM ${table} t ORDER BY ${orderBy}`));
  }));
  const values = (b) => fields.map((f) => (typeof b[f] === 'string' ? b[f].trim() : b[f]) || null);
  const check = (b) => required.filter((f) => !String(b[f] || '').trim()).map((f) => `${f} is required`);

  r.post('/', requireAdmin, ah(async (req, res) => {
    const errs = check(req.body || {});
    if (errs.length) return res.status(400).json({ error: errs.join('. ') });
    const result = await query(
      `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, values(req.body));
    const [row] = await query(`SELECT * FROM ${table} WHERE id = ?`, [result.insertId]);
    res.status(201).json(row);
  }));
  r.put('/:id', requireAdmin, ah(async (req, res) => {
    const errs = check(req.body || {});
    if (errs.length) return res.status(400).json({ error: errs.join('. ') });
    await query(`UPDATE ${table} SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`, [...values(req.body), req.params.id]);
    const [row] = await query(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  }));
  r.delete('/:id', requireAdmin, ah(async (req, res) => {
    const result = await query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  }));
  return r;
}

export const locationsRouter = crud('locations', ['name', 'building', 'room', 'description'], ['name'], 'name');
export const courseUnitsRouter = crud('course_units', ['code', 'name'], ['code', 'name'], 'code');
