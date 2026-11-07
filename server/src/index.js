import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import itemRoutes from './routes/items.js';
import reservationRoutes from './routes/reservations.js';
import dashboardRoutes from './routes/dashboard.js';
import { locationsRouter, courseUnitsRouter } from './routes/lookups.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/staff', requireAuth, staffRoutes);
app.use('/api/items', requireAuth, itemRoutes);
app.use('/api/reservations', requireAuth, reservationRoutes);
app.use('/api/locations', requireAuth, locationsRouter);
app.use('/api/course-units', requireAuth, courseUnitsRouter);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

// In production, serve the built React app.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with that unique value (email / serial / code) already exists' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'This record is still in use and cannot be deleted' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'A referenced record (staff, location, item or course unit) does not exist' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
