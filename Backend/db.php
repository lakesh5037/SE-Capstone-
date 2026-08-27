<?php
// db.php - Resilient database connection and auto-schema initialization helper
ini_set('display_errors', 0);
error_reporting(0);

// ─── CORS Headers ───────────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

$host     = getenv('DB_HOST')     ?: "127.0.0.1";
$username = getenv('DB_USER')     ?: "root";
$password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : "";
$database = getenv('DB_NAME')     ?: "brain_scan_db";

// Connect to MySQL server with retry (handles boot delay)
$conn = null;
$max_retries = 8;
for ($i = 0; $i < $max_retries; $i++) {
    $conn = @new mysqli($host, $username, $password);
    if (!$conn->connect_error) {
        break;
    }
    sleep(1);
}

if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database server connection failed: " . $conn->connect_error
    ]);
    exit;
}

// 1. Ensure Database exists
$conn->query("CREATE DATABASE IF NOT EXISTS `$database` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$conn->select_db($database);

// 2. Ensure Doctors table exists
$conn->query("CREATE TABLE IF NOT EXISTS `doctors` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// 3. Ensure OTP table exists
$conn->query("CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id`         INT          AUTO_INCREMENT PRIMARY KEY,
  `email`      VARCHAR(255) NOT NULL,
  `otp_code`   VARCHAR(10)  NOT NULL,
  `action`     VARCHAR(50)  NOT NULL,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME     NOT NULL,
  INDEX `idx_email_action` (`email`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// 4. Ensure Scans table exists
$conn->query("CREATE TABLE IF NOT EXISTS `scans` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// 5. Ensure Notifications table exists
$conn->query("CREATE TABLE IF NOT EXISTS `notifications` (
  `id`            INT           AUTO_INCREMENT PRIMARY KEY,
  `doctor_email`  VARCHAR(255)  NOT NULL,
  `title`         VARCHAR(255)  NOT NULL,
  `body`          TEXT          NOT NULL,
  `type`          VARCHAR(50)   DEFAULT 'info',
  `reference_id`  VARCHAR(100)  DEFAULT NULL,
  `is_read`       TINYINT(1)    DEFAULT 0,
  `created_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctor_unread` (`doctor_email`, `is_read`),
  INDEX `idx_created_at`    (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// 6. Ensure Support Tickets table exists
$conn->query("CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id`            INT           AUTO_INCREMENT PRIMARY KEY,
  `ticket_number` VARCHAR(30)   NOT NULL UNIQUE,
  `doctor_email`  VARCHAR(255)  NOT NULL,
  `category`      VARCHAR(100)  NOT NULL,
  `message`       TEXT          NOT NULL,
  `platform`      VARCHAR(20)   DEFAULT 'unknown',
  `device_info`   VARCHAR(255)  DEFAULT NULL,
  `status`        ENUM('open','in_progress','resolved','closed') DEFAULT 'open',
  `priority`      ENUM('low','medium','high','critical')   DEFAULT 'medium',
  `admin_reply`   TEXT          DEFAULT NULL,
  `created_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email`  (`doctor_email`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// 7. Ensure FCM tokens table exists
$conn->query("CREATE TABLE IF NOT EXISTS `fcm_tokens` (
  `id`           INT           AUTO_INCREMENT PRIMARY KEY,
  `doctor_email` VARCHAR(255)  NOT NULL,
  `fcm_token`    TEXT          NOT NULL,
  `platform`     ENUM('android','web') NOT NULL,
  `last_updated` TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_email_platform` (`doctor_email`, `platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
?>
