-- ============================================================
-- HemoScan DB Migration: Support Tickets System
-- Run via phpMyAdmin or:
--   D:\xamp\mysql\bin\mysql.exe -u root brain_scan_db < create_tickets_table.sql
-- ============================================================

USE `brain_scan_db`;

-- support_tickets table
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`            INT           AUTO_INCREMENT PRIMARY KEY,
  `ticket_number` VARCHAR(30)   NOT NULL UNIQUE,           -- e.g. HST-20260707-A1B2C3
  `doctor_email`  VARCHAR(255)  NOT NULL,
  `category`      VARCHAR(100)  NOT NULL,
  `message`       TEXT          NOT NULL,
  `platform`      VARCHAR(20)   DEFAULT 'unknown',         -- 'android' | 'web' | 'unknown'
  `device_info`   VARCHAR(255)  DEFAULT NULL,              -- Android: "Samsung SM-G998B"
  `status`        ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  `priority`      ENUM('low','medium','high','critical')   DEFAULT 'medium',
  `admin_reply`   TEXT          DEFAULT NULL,
  `created_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email`  (`doctor_email`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- fcm_tokens table (required for push notifications - Sprint 2)
CREATE TABLE IF NOT EXISTS `fcm_tokens` (
  `id`           INT           AUTO_INCREMENT PRIMARY KEY,
  `doctor_email` VARCHAR(255)  NOT NULL,
  `fcm_token`    TEXT          NOT NULL,
  `platform`     ENUM('android','web') NOT NULL,
  `last_updated` TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_email_platform` (`doctor_email`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Performance index on scans table for faster doctor+date queries
ALTER TABLE `scans`
  ADD INDEX IF NOT EXISTS `idx_doctor_date` (`doctor_email`, `created_at`);

SELECT 'Migration complete: support_tickets + fcm_tokens tables created.' AS status;
