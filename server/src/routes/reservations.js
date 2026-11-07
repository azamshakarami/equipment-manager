import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { ah, isDate, today, HttpError } from '../util.js';

const r = Router();

const SELECT = `
  SELECT r.*, i.name AS item_name, i.category, s.full_name AS staff_name, s.employment_type,
         cu.code AS course_code, cu.name AS course_name, l.name AS location_name
  FROM reservations r
  JOIN items i ON i.id = r.item_id
  JOIN staff s ON s.id = r.staff_id
  LEFT JOIN course_units cu ON cu.id = r.course_unit_id
  LEFT JOIN locations l ON l.id = i.location_id`;

// GET /api/reservations?from=&to=&item_id=&staff_id=&mine=1&status=active|returned|cancelled|all
r.get('/', ah(async (req, res) => {
  const { from, to, item_id, staff_id, mine, status = 'active' } = req.query;
  const conds = [];
  const params = [];
  if (status !== 'all') { conds.push('r.status = ?'); params.push(status); }
  if (isDate(from)) { conds.push('r.end_date >= ?'); params.push(from); }
  if (isDate(to)) { conds.push('r.start_date <= ?'); params.push(to); }
  if (item_id) { conds.push('r.item_id = ?'); params.push(item_id); }
  if (mine === '1') { conds.push('r.staff_id = ?'); params.push(req.user.id); }
  else if (staff_id) { conds.push('r.staff_id = ?'); params.push(staff_id); }
  const rows = await query(`${SELECT} ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY r.start_date, i.name`, params);
  res.json(rows);
}));

/** Throws 409 if [start,end] overlaps an active reservation of the item (excluding excludeId). */
async function assertAvailable(conn, itemId, start, end, excludeId = 0) {
  // Lock the item row so two simultaneous bookings cannot both succeed.
  const [item] = await conn.query('SELECT id, name, item_condition FROM items WHERE id = ? FOR UPDATE', [itemId]);
  if (!item) throw new HttpError(404, 'Item not found');
  if (item.item_condition !== 'working') throw new HttpError(409, `This item is currently marked as "${item.item_condition}" and cannot be reserved`);
  const clashes = await conn.query(
    `SELECT r.start_date, r.end_date, s.full_name FROM reservations r JOIN staff s ON s.id = r.staff_id
     WHERE r.item_id = ? AND r.status = 'active' AND r.id <> ? AND r.start_date <= ? AND r.end_date >= ?
     ORDER BY r.start_date`,
    [itemId, excludeId, end, start]);
  if (clashes.length) {
    const list = clashes.map((c) => `${c.start_date} → ${c.end_date} (${c.full_name})`).join(', ');
    throw new HttpError(409, `"${item.name}" is already reserved during: ${list}`);
  }
}

function validateDates(start, end, allowPastStart) {
  if (!isDate(start) || !isDate(end)) throw new HttpError(400, 'Start and end dates are required (YYYY-MM-DD)');
  if (end < start) throw new HttpError(400, 'End date must be on or after start date');
  if (!allowPastStart && start < today()) throw new HttpError(400, 'Start date cannot be in the past');
}

r.post('/', ah(async (req, res) => {
  const { item_id, start_date, end_date, course_unit_id, purpose } = req.body || {};
  validateDates(start_date, end_date, false);
  // Admins may book on behalf of another staff member.
  const staffId = req.user.role === 'admin' && req.body.staff_id ? Number(req.body.staff_id) : req.user.id;
  const id = await withTransaction(async (conn) => {
    await assertAvailable(conn, item_id, start_date, end_date);
    const result = await conn.query(
      `INSERT INTO reservations (item_id, staff_id, course_unit_id, start_date, end_date, purpose)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item_id, staffId, course_unit_id || null, start_date, end_date, purpose?.trim() || null]);
    return result.insertId;
  });
  const [row] = await query(`${SELECT} WHERE r.id = ?`, [id]);
  res.status(201).json(row);
}));

async function loadOwned(req) {
  const [row] = await query('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Reservation not found');
  if (row.staff_id !== req.user.id && req.user.role !== 'admin') throw new HttpError(403, 'You can only change your own reservations');
  if (row.status !== 'active') throw new HttpError(400, `Reservation is already ${row.status}`);
  return row;
}

// Change dates (e.g. extend a long-term reservation), course unit or purpose.
r.put('/:id', ah(async (req, res) => {
  const existing = await loadOwned(req);
  const b = req.body || {};
  const start = b.start_date || existing.start_date;
  const end = b.end_date || existing.end_date;
  // An already-started reservation may keep its past start date.
  validateDates(start, end, start === existing.start_date);
  await withTransaction(async (conn) => {
    await assertAvailable(conn, existing.item_id, start, end, existing.id);
    await conn.query(
      'UPDATE reservations SET start_date = ?, end_date = ?, course_unit_id = ?, purpose = ? WHERE id = ?',
      [start, end, b.course_unit_id === undefined ? existing.course_unit_id : b.course_unit_id || null,
       b.purpose === undefined ? existing.purpose : b.purpose?.trim() || null, existing.id]);
  });
  const [row] = await query(`${SELECT} WHERE r.id = ?`, [existing.id]);
  res.json(row);
}));

r.post('/:id/cancel', ah(async (req, res) => {
  const row = await loadOwned(req);
  await query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [row.id]);
  res.json({ ok: true });
}));

// Return an item early: closes the reservation today, freeing the item.
r.post('/:id/return', ah(async (req, res) => {
  const row = await loadOwned(req);
  if (row.start_date > today()) throw new HttpError(400, 'This reservation has not started yet - cancel it instead');
  await query(
    "UPDATE reservations SET status = 'returned', end_date = LEAST(end_date, CURDATE()) WHERE id = ?", [row.id]);
  res.json({ ok: true });
}));

export default r;
