# Computing Department Equipment Manager

A web app for managing equipment (robots, network gear, kits, …) that the Computing
Department orders. Built with **React (Vite)**, **Node.js / Express** and **MariaDB**.

## Features

| Requirement | Where |
|---|---|
| Full-time and part-time staff | `staff.employment_type`; badges throughout, filter on **Staff** page |
| Who ordered each item | `items.ordered_by` (+ order date, supplier, cost); shown on list & detail |
| Where items are stored | `locations` table (name, building, room); shown on list & detail |
| Which course units the item is used for | `item_course_units` (many-to-many); each reservation also records a course unit |
| Available vs. in use | Live status per item: **Available / In use (by whom, until when) / Maintenance / Retired** |
| Admin: add/delete items, add/edit staff | Admin-only buttons + server-side `requireAdmin` checks |
| Staff can reserve for long periods | Start/end date reservations, quick buttons for 1 week … a semester, extend/change dates later |
| Calendar with start/end dates | Click-to-select month calendar on each item (free days green, booked red) |
| See availability in advance | **Availability planner**: timeline of every item over any period (up to a year), “Book” button for items free for the whole period; **Equipment** page filter “free between X and Y” |

Also: double-booking is prevented in the database transaction (row lock + overlap check),
early **Return** frees an item immediately, **Cancel** for future bookings, admins can book on
behalf of other staff, and admins manage locations and course units.

## Roles

- **Admin** – everything below plus: add/edit/delete items, add/edit/deactivate/delete staff,
  manage locations & course units, cancel/return anyone's reservation.
- **Staff** – view all equipment & availability, reserve items, change/cancel/return their own reservations.

## Setup

Requirements: Node.js 18+, and MariaDB 10.6+ (or Docker).

### 1. Database

**Option A – Docker** (creates DB, user and tables):
```bash
docker compose up -d
```

**Option B – existing MariaDB server:**
```bash
sudo mariadb < server/db/schema.sql
sudo mariadb -e "CREATE USER 'equipment'@'localhost' IDENTIFIED BY 'equipment_pw';
                 GRANT ALL ON equipment_manager.* TO 'equipment'@'localhost';"
```

### 2. Backend
```bash
cd server
cp .env.example .env      # edit DB credentials and JWT_SECRET
npm install
npm run db:init           # (re)creates tables if missing – not needed with Docker
npm run db:seed           # OPTIONAL demo data – wipes existing data!
npm run dev               # API on http://localhost:4000
```

### 3. Frontend
```bash
cd client
npm install
npm run dev               # http://localhost:5173 (proxies /api to :4000)
```

Demo logins after seeding: **admin@uni.edu / admin123** (admin), **sara@uni.edu / password123** (staff).

> Without seed data you need a first admin. Generate a hash with
> `node -e "console.log(require('bcryptjs').hashSync('yourpass',10))"` inside `server/`, then
> `INSERT INTO staff (full_name,email,password_hash,role) VALUES ('Admin','admin@uni.edu','<hash>','admin');`

### Production
```bash
npm --prefix client run build   # builds client/dist
npm --prefix server start       # Express serves the API and the built React app on :4000
```

## Project structure
```
server/
  db/schema.sql          MariaDB tables
  src/index.js           Express app
  src/routes/            auth, staff, items, reservations, locations & course units, dashboard
  src/seed.js            demo data
client/src/
  pages/                 Dashboard, Items, ItemDetail, Availability, CalendarPage, MyReservations, Staff, Settings
  components/            MonthCalendar, ReserveForm, ItemForm, shared UI
```

## API summary (all under `/api`, JWT bearer auth)

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/login` | all | Get token |
| `GET /items?search&category&location_id&status&from&to` | staff | List with live status; `from/to` adds `available_in_range` |
| `GET /items/:id` | staff | Item + full reservation history |
| `POST/PUT/DELETE /items[/:id]` | admin | Manage items (`course_unit_ids` array) |
| `GET /reservations?from&to&item_id&mine=1&status` | staff | List reservations |
| `POST /reservations` | staff | Reserve `{item_id,start_date,end_date,course_unit_id,purpose}` – 409 on clash |
| `PUT /reservations/:id` | owner/admin | Change dates / extend |
| `POST /reservations/:id/cancel` · `/return` | owner/admin | Cancel future / return early |
| `GET/POST/PUT/DELETE /staff` | read: staff, write: admin | Staff management |
| `GET/POST/PUT/DELETE /locations`, `/course-units` | read: staff, write: admin | Lookups |
