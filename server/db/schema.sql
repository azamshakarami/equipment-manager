-- Computing Department Equipment Manager - MariaDB schema
-- Usage: mariadb -u root -p < server/db/schema.sql

CREATE DATABASE IF NOT EXISTS equipment_manager
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE equipment_manager;

-- Staff members (full-time / part-time). role=admin can manage the system.
CREATE TABLE IF NOT EXISTS staff (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(120) NOT NULL,
  email           VARCHAR(160) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  employment_type ENUM('full_time','part_time') NOT NULL DEFAULT 'full_time',
  role            ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  phone           VARCHAR(40),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Where items are physically stored.
CREATE TABLE IF NOT EXISTS locations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  building    VARCHAR(120),
  room        VARCHAR(60),
  description VARCHAR(255)
) ENGINE=InnoDB;

-- Course units the equipment is used for (e.g. CS2041 Robotics).
CREATE TABLE IF NOT EXISTS course_units (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30)  NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL
) ENGINE=InnoDB;

-- Equipment items. ordered_by = staff member who ordered the item.
CREATE TABLE IF NOT EXISTS items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(160) NOT NULL,
  category       VARCHAR(60)  NOT NULL DEFAULT 'Other',
  model          VARCHAR(120),
  serial_number  VARCHAR(120) UNIQUE,
  description    TEXT,
  location_id    INT NULL,
  ordered_by     INT NULL,
  order_date     DATE NULL,
  supplier       VARCHAR(160),
  cost           DECIMAL(10,2),
  item_condition ENUM('working','maintenance','retired') NOT NULL DEFAULT 'working',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_items_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_items_ordered_by FOREIGN KEY (ordered_by) REFERENCES staff(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Which course units an item was ordered for / is used in (many-to-many).
CREATE TABLE IF NOT EXISTS item_course_units (
  item_id        INT NOT NULL,
  course_unit_id INT NOT NULL,
  PRIMARY KEY (item_id, course_unit_id),
  CONSTRAINT fk_icu_item   FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_icu_course FOREIGN KEY (course_unit_id) REFERENCES course_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Reservations: a staff member books an item between two dates (inclusive).
CREATE TABLE IF NOT EXISTS reservations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  item_id        INT NOT NULL,
  staff_id       INT NOT NULL,
  course_unit_id INT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  purpose        VARCHAR(255),
  status         ENUM('active','returned','cancelled') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_dates CHECK (end_date >= start_date),
  CONSTRAINT fk_res_item   FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_staff  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_course FOREIGN KEY (course_unit_id) REFERENCES course_units(id) ON DELETE SET NULL,
  INDEX idx_res_item_dates (item_id, status, start_date, end_date)
) ENGINE=InnoDB;
