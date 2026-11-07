// Creates the tables from db/schema.sql (database must exist & user must have rights).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';
import 'dotenv/config';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(dir, '../db/schema.sql'), 'utf8')
  .replace(/^\s*(CREATE DATABASE|USE)\b[\s\S]*?;/gim, ''); // DB is chosen by .env

const conn = await mariadb.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, multipleStatements: true,
});
await conn.query(sql);
await conn.end();
console.log('Schema created.');
