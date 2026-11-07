import mariadb from 'mariadb';
import 'dotenv/config';

export const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'equipment_manager',
  connectionLimit: 10,
  dateStrings: true,        // return DATE columns as 'YYYY-MM-DD'
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: true,
});

/** Run a single query and return rows. */
export async function query(sql, params = []) {
  return pool.query(sql, params);
}

/** Run fn(conn) inside a transaction. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
