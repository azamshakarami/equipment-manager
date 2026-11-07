import { Router } from 'express';
import { query } from '../db.js';
import { ah } from '../util.js';

const r = Router();

r.get('/', ah(async (req, res) => {
  const [counts] = await query(`
    SELECT
      (SELECT COUNT(*) FROM items WHERE item_condition <> 'retired') AS total_items,
      (SELECT COUNT(DISTINCT r.item_id) FROM reservations r JOIN items i ON i.id = r.item_id
         WHERE r.status = 'active' AND CURDATE() BETWEEN r.start_date AND r.end_date
           AND i.item_condition = 'working') AS in_use,
      (SELECT COUNT(*) FROM items WHERE item_condition = 'maintenance') AS maintenance,
      (SELECT COUNT(*) FROM staff WHERE is_active = 1) AS staff,
      (SELECT COUNT(*) FROM reservations WHERE status = 'active' AND start_date > CURDATE()) AS upcoming`);
  counts.available = counts.total_items - counts.in_use - counts.maintenance;
  const byCategory = await query(`
    SELECT category, COUNT(*) AS total FROM items WHERE item_condition <> 'retired' GROUP BY category ORDER BY category`);
  res.json({ ...counts, byCategory });
}));

export default r;
