import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAdmin } from '../auth.js';
import { ah, isDate } from '../util.js';

const r = Router();

/**
 * Base SELECT for items. Adds:
 *  - location + "ordered by" names
 *  - current_* : the reservation covering today (item is "in use")
 *  - next_start : start date of the next upcoming reservation
 *  - conflicts  : number of active reservations overlapping [from, to] (when a range is given)
 */
function itemsSql(where = '', withRange = false) {
  return `
    SELECT i.*, l.name AS location_name, l.building, l.room,
      s.full_name AS ordered_by_name, s.employment_type AS ordered_by_type,
      cur.id AS current_reservation_id, cur.staff_id AS current_staff_id,
      cur.full_name AS current_user_name, cur.start_date AS current_from, cur.end_date AS current_until,
      (SELECT MIN(n.start_date) FROM reservations n
         WHERE n.item_id = i.id AND n.status = 'active' AND n.start_date > CURDATE()) AS next_start
      ${withRange ? `, (SELECT COUNT(*) FROM reservations c WHERE c.item_id = i.id AND c.status = 'active'
                        AND c.start_date <= ? AND c.end_date >= ?) AS conflicts` : ''}
    FROM items i
    LEFT JOIN locations l ON l.id = i.location_id
    LEFT JOIN staff s ON s.id = i.ordered_by
    LEFT JOIN (
      SELECT r.id, r.item_id, r.staff_id, r.start_date, r.end_date, st.full_name
      FROM reservations r JOIN staff st ON st.id = r.staff_id
      WHERE r.status = 'active' AND CURDATE() BETWEEN r.start_date AND r.end_date
    ) cur ON cur.item_id = i.id
    ${where}
    ORDER BY i.category, i.name`;
}

function computeStatus(item) {
  if (item.item_condition === 'retired') return 'retired';
  if (item.item_condition === 'maintenance') return 'maintenance';
  if (item.current_reservation_id) return 'in_use';
  return 'available';
}

async function attachCourseUnits(items) {
  if (!items.length) return items;
  const rows = await query(
    `SELECT icu.item_id, cu.id, cu.code, cu.name FROM item_course_units icu
     JOIN course_units cu ON cu.id = icu.course_unit_id
     WHERE icu.item_id IN (${items.map(() => '?').join(',')}) ORDER BY cu.code`,
    items.map((i) => i.id)
  );
  for (const it of items) {
    it.course_units = rows.filter((r) => r.item_id === it.id).map(({ item_id, ...cu }) => cu);
    it.status = computeStatus(it);
    if (it.conflicts !== undefined) {
      it.available_in_range = it.conflicts === 0 && it.item_condition === 'working';
    }
  }
  return items;
}

// GET /api/items?search=&category=&location_id=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD
r.get('/', ah(async (req, res) => {
  const { search, category, location_id, status, from, to } = req.query;
  const conds = [];
  const params = [];
  const withRange = isDate(from) && isDate(to);
  if (withRange) {
    if (to < from) return res.status(400).json({ error: '"to" date must be on or after "from" date' });
    params.push(to, from);
  }
  if (search) {
    conds.push('(i.name LIKE ? OR i.model LIKE ? OR i.serial_number LIKE ? OR i.description LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  if (category) { conds.push('i.category = ?'); params.push(category); }
  if (location_id) { conds.push('i.location_id = ?'); params.push(location_id); }
  let items = await query(itemsSql(conds.length ? `WHERE ${conds.join(' AND ')}` : '', withRange), params);
  items = await attachCourseUnits(items);
  if (status) items = items.filter((i) => i.status === status);
  res.json(items);
}));

r.get('/categories', ah(async (req, res) => {
  const rows = await query('SELECT DISTINCT category FROM items ORDER BY category');
  const defaults = ['Robot', 'Network', 'Computer', 'Sensor', 'Microcontroller', 'Audio/Visual', 'Other'];
  res.json([...new Set([...defaults, ...rows.map((r) => r.category)])]);
}));

r.get('/:id', ah(async (req, res) => {
  const [item] = await attachCourseUnits(await query(itemsSql('WHERE i.id = ?'), [req.params.id]));
  if (!item) return res.status(404).json({ error: 'Item not found' });
  item.reservations = await query(
    `SELECT r.*, s.full_name AS staff_name, s.employment_type, cu.code AS course_code, cu.name AS course_name
     FROM reservations r JOIN staff s ON s.id = r.staff_id
     LEFT JOIN course_units cu ON cu.id = r.course_unit_id
     WHERE r.item_id = ? ORDER BY r.start_date DESC`,
    [req.params.id]
  );
  res.json(item);
}));

function validateItem(b) {
  const errs = [];
  if (!b.name?.trim()) errs.push('Name is required');
  if (b.order_date && !isDate(b.order_date)) errs.push('Order date is invalid');
  if (b.item_condition && !['working', 'maintenance', 'retired'].includes(b.item_condition)) errs.push('Invalid condition');
  if (b.cost !== undefined && b.cost !== null && b.cost !== '' && Number.isNaN(Number(b.cost))) errs.push('Cost must be a number');
  return errs;
}

const ITEM_FIELDS = ['name', 'category', 'model', 'serial_number', 'description', 'location_id',
  'ordered_by', 'order_date', 'supplier', 'cost', 'item_condition'];
const itemValues = (b) => ITEM_FIELDS.map((f) => {
  const v = typeof b[f] === 'string' ? b[f].trim() : b[f];
  if (f === 'category') return v || 'Other';
  if (f === 'item_condition') return v || 'working';
  return v === '' || v === undefined ? null : v;
});

async function setCourseUnits(conn, itemId, ids) {
  await conn.query('DELETE FROM item_course_units WHERE item_id = ?', [itemId]);
  for (const cid of [...new Set(ids || [])]) {
    await conn.query('INSERT INTO item_course_units (item_id, course_unit_id) VALUES (?, ?)', [itemId, cid]);
  }
}

r.post('/', requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const errs = validateItem(b);
  if (errs.length) return res.status(400).json({ error: errs.join('. ') });
  const id = await withTransaction(async (conn) => {
    const result = await conn.query(
      `INSERT INTO items (${ITEM_FIELDS.join(', ')}) VALUES (${ITEM_FIELDS.map(() => '?').join(', ')})`,
      itemValues(b));
    await setCourseUnits(conn, result.insertId, b.course_unit_ids);
    return result.insertId;
  });
  const [item] = await attachCourseUnits(await query(itemsSql('WHERE i.id = ?'), [id]));
  res.status(201).json(item);
}));

r.put('/:id', requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const errs = validateItem(b);
  if (errs.length) return res.status(400).json({ error: errs.join('. ') });
  const id = Number(req.params.id);
  const found = await withTransaction(async (conn) => {
    const result = await conn.query(
      `UPDATE items SET ${ITEM_FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`, [...itemValues(b), id]);
    if (!result.affectedRows) return false;
    if (Array.isArray(b.course_unit_ids)) await setCourseUnits(conn, id, b.course_unit_ids);
    return true;
  });
  if (!found) return res.status(404).json({ error: 'Item not found' });
  const [item] = await attachCourseUnits(await query(itemsSql('WHERE i.id = ?'), [id]));
  res.json(item);
}));

r.delete('/:id', requireAdmin, ah(async (req, res) => {
  const result = await query('DELETE FROM items WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true });
}));

export default r;
