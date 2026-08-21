-- ============================================================
-- HemoScan / BrainScan DB Setup Script
-- Run via: D:\xamp\mysql\bin\mysql.exe -u root < setup_db.sql
-- ============================================================

-- 1. Create database
CREATE DATABASE IF NOT EXISTS `brain_scan_db`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `brain_scan_db`;

-- 2. doctors table
CREATE TABLE IF NOT EXISTS `doctors` (
  `id`            INT           AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(100)  NOT NULL,
  `email`         VARCHAR(100)  UNIQUE NOT NULL,
  `mobile`        VARCHAR(20)   NOT NULL,
  `gender`        VARCHAR(10)   NOT NULL,
  `password`      VARCHAR(255)  NOT NULL,
  `specialty`     VARCHAR(100)  DEFAULT NULL,
  `profile_image` VARCHAR(255)  DEFAULT NULL,
  `bio`           TEXT          DEFAULT NULL,
  `hospital`      VARCHAR(100)  DEFAULT NULL,
  `license`       VARCHAR(50)   DEFAULT NULL,
  `years_exp`     INT           DEFAULT NULL,
  `dark_mode`     TINYINT(1)    DEFAULT 0,
  `language`      VARCHAR(50)   DEFAULT 'English',
  `daily_summary` TINYINT(1)    DEFAULT 1,
  `sound`         TINYINT(1)    DEFAULT 1,
  `vibration`     TINYINT(1)    DEFAULT 1,
  `theme_mode`    INT           DEFAULT 0,
  `created_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. otp_verifications table
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id`         INT          AUTO_INCREMENT PRIMARY KEY,
  `email`      VARCHAR(255) NOT NULL,
  `otp_code`   VARCHAR(10)  NOT NULL,
  `action`     VARCHAR(50)  NOT NULL,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME     NOT NULL,
  INDEX `idx_email_action` (`email`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. scans table
CREATE TABLE IF NOT EXISTS `scans` (
  `id`             INT          AUTO_INCREMENT PRIMARY KEY,
  `doctor_email`   VARCHAR(100) NOT NULL,
  `patient_id`     VARCHAR(100) NOT NULL,
  `patient_name`   VARCHAR(100) NOT NULL,
  `patient_age`    VARCHAR(10)  NOT NULL,
  `patient_gender` VARCHAR(10)  NOT NULL,
  `result`         VARCHAR(50)  NOT NULL,
  `risk_level`     VARCHAR(20)  NOT NULL,
  `image_path`     VARCHAR(255) NOT NULL,
  `date_added`     VARCHAR(20)  NOT NULL,
  `time_added`     VARCHAR(20)  NOT NULL,
  `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctor_email` (`doctor_email`),
  INDEX `idx_patient_id`   (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Done
SELECT 'brain_scan_db setup complete!' AS status;
SELECT TABLE_NAME, TABLE_ROWS
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = 'brain_scan_db';
