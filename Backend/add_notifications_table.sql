-- ============================================================
-- HemoScan DB Migration: Notifications Table
-- Run via phpMyAdmin or:
--   D:\xamp\mysql\bin\mysql.exe -u root brain_scan_db < add_notifications_table.sql
-- ============================================================

USE `brain_scan_db`;

-- notifications table — stores in-app notifications for each doctor
-- Both web and Android read from this table to keep notification state in sync.
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`            INT           AUTO_INCREMENT PRIMARY KEY,
  `doctor_email`  VARCHAR(255)  NOT NULL,
  `title`         VARCHAR(255)  NOT NULL,
  `body`          TEXT          NOT NULL,
  `type`          VARCHAR(50)   DEFAULT 'info',         -- info | scan_uploaded | scan_deleted | alert
  `reference_id`  VARCHAR(100)  DEFAULT NULL,           -- scan_id, ticket_id, etc.
  `is_read`       TINYINT(1)    DEFAULT 0,
  `created_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctor_unread` (`doctor_email`, `is_read`),
  INDEX `idx_created_at`    (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration complete: notifications table created.' AS status;
