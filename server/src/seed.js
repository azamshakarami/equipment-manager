// Fills the database with demo data. WARNING: clears existing data.
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const d = (offset) => {
  const t = new Date(); t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

const conn = await pool.getConnection();
try {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['reservations', 'item_course_units', 'items', 'course_units', 'locations', 'staff']) {
    await conn.query(`TRUNCATE TABLE ${t}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  const pw = await bcrypt.hash('password123', 10);
  const admin = await bcrypt.hash('admin123', 10);
  const staff = [
    ['System Admin', 'admin@uni.edu', admin, 'full_time', 'admin', '555-0100'],
    ['Dr. Sara Ahmadi', 'sara@uni.edu', pw, 'full_time', 'staff', '555-0101'],
    ['Dr. James Okoro', 'james@uni.edu', pw, 'full_time', 'staff', '555-0102'],
    ['Lina Park', 'lina@uni.edu', pw, 'part_time', 'staff', '555-0103'],
    ['Tom Becker', 'tom@uni.edu', pw, 'part_time', 'staff', null],
  ];
  for (const s of staff) {
    await conn.query('INSERT INTO staff (full_name,email,password_hash,employment_type,role,phone) VALUES (?,?,?,?,?,?)', s);
  }
  const locations = [
    ['Robotics Lab', 'Engineering Building', 'E2.14', 'Locked cabinets A-D'],
    ['Networking Lab', 'Computing Building', 'C1.05', 'Rack room, key from reception'],
    ['Central Store', 'Computing Building', 'C0.01', 'Main equipment store'],
    ['IoT Lab', 'Computing Building', 'C2.20', null],
  ];
  for (const l of locations) await conn.query('INSERT INTO locations (name,building,room,description) VALUES (?,?,?,?)', l);
  const courses = [
    ['CS2041', 'Introduction to Robotics'], ['CS3052', 'Autonomous Systems'],
    ['CS2210', 'Computer Networks'], ['CS3310', 'Network Security'], ['CS2600', 'Internet of Things'],
  ];
  for (const c of courses) await conn.query('INSERT INTO course_units (code,name) VALUES (?,?)', c);

  // name, category, model, serial, description, location, ordered_by, order_date, supplier, cost, condition, courses
  const items = [
    ['TurtleBot 4 #1', 'Robot', 'TurtleBot 4 Standard', 'TB4-0001', 'ROS2 mobile robot with lidar + camera', 1, 2, d(-200), 'Clearpath', 1899, 'working', [1, 2]],
    ['TurtleBot 4 #2', 'Robot', 'TurtleBot 4 Standard', 'TB4-0002', 'ROS2 mobile robot with lidar + camera', 1, 2, d(-200), 'Clearpath', 1899, 'working', [1, 2]],
    ['UR3e Robot Arm', 'Robot', 'Universal Robots UR3e', 'UR3E-7781', 'Collaborative 6-axis arm', 1, 3, d(-400), 'Universal Robots', 24500, 'working', [2]],
    ['NAO Humanoid', 'Robot', 'NAO V6', 'NAO-5521', null, 1, 2, d(-700), 'Aldebaran', 9800, 'maintenance', [1]],
    ['Cisco Catalyst 2960 Switch', 'Network', 'WS-C2960X-24TS', 'FOC2231X0A1', '24-port managed switch', 2, 3, d(-300), 'Cisco', 1200, 'working', [3, 4]],
    ['Cisco ISR 4331 Router', 'Network', 'ISR4331/K9', 'FDO2301M0B2', null, 2, 3, d(-300), 'Cisco', 2600, 'working', [3, 4]],
    ['MikroTik hEX Router Kit (x10)', 'Network', 'RB750Gr3', 'MT-KIT-01', 'Box of 10 routers for labs', 3, 4, d(-90), 'MikroTik', 650, 'working', [3]],
    ['Raspberry Pi 5 Kit (x20)', 'Microcontroller', 'Raspberry Pi 5 8GB', 'RPI5-KIT-A', 'Class set with cases + PSUs', 4, 4, d(-60), 'Pimoroni', 1700, 'working', [5]],
    ['Arduino Sensor Kit (x15)', 'Sensor', 'Arduino Sensor Kit Base', 'ARD-SK-15', null, 4, 5, d(-30), 'Arduino', 420, 'working', [5]],
    ['Fluke Network Tester', 'Network', 'LinkIQ', 'FLK-LIQ-993', 'Cable & network tester', 3, 3, d(-500), 'Fluke', 1500, 'working', [3, 4]],
  ];
  for (const [...it] of items) {
    const cus = it.pop();
    const res = await conn.query(
      `INSERT INTO items (name,category,model,serial_number,description,location_id,ordered_by,order_date,supplier,cost,item_condition)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, it);
    for (const cu of cus) await conn.query('INSERT INTO item_course_units VALUES (?,?)', [res.insertId, cu]);
  }

  // item, staff, course, start, end, purpose
  const reservations = [
    [1, 2, 1, d(-10), d(80), 'Semester-long robotics labs'],
    [3, 3, 2, d(-3), d(4), 'Arm calibration demo'],
    [3, 2, 2, d(10), d(30), 'Autonomous systems coursework'],
    [5, 3, 3, d(-20), d(60), 'Networks lab topology'],
    [8, 4, 5, d(5), d(95), 'IoT module (whole term)'],
    [6, 5, 4, d(14), d(21), 'Firewall practical'],
    [2, 4, 1, d(40), d(55), 'Robotics open day'],
  ];
  for (const r of reservations) {
    await conn.query('INSERT INTO reservations (item_id,staff_id,course_unit_id,start_date,end_date,purpose) VALUES (?,?,?,?,?,?)', r);
  }
  console.log('Seeded. Admin login: admin@uni.edu / admin123   Staff login: sara@uni.edu / password123');
} finally {
  conn.release();
  await pool.end();
}
