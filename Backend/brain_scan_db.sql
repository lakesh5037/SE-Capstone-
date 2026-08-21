-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 11, 2026 at 06:59 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `brain_scan_db`
--
CREATE DATABASE IF NOT EXISTS `brain_scan_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `brain_scan_db`;

-- --------------------------------------------------------

--
-- Table structure for table `doctors`
--

DROP TABLE IF EXISTS `doctors`;
CREATE TABLE IF NOT EXISTS `doctors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `mobile` varchar(20) NOT NULL,
  `gender` varchar(10) NOT NULL,
  `password` varchar(255) NOT NULL,
  `specialty` varchar(100) DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `hospital` varchar(100) DEFAULT NULL,
  `license` varchar(50) DEFAULT NULL,
  `years_exp` int(11) DEFAULT NULL,
  `dark_mode` tinyint(1) DEFAULT 0,
  `language` varchar(50) DEFAULT 'English',
  `daily_summary` tinyint(1) DEFAULT 1,
  `sound` tinyint(1) DEFAULT 1,
  `vibration` tinyint(1) DEFAULT 1,
  `theme_mode` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `doctors`
--

INSERT INTO `doctors` (`id`, `name`, `email`, `mobile`, `gender`, `password`, `specialty`, `profile_image`, `bio`, `hospital`, `license`, `years_exp`, `dark_mode`, `language`, `daily_summary`, `sound`, `vibration`, `theme_mode`, `created_at`) VALUES
(1, 'Lakesh', 'lakeshb5037.sse@saveetha.com', '7842264209', 'Male', '$2y$10$bKzrrT.OKdYga7868lBh0.wqXOJZeovr8ku9wSC91U1cyT1c2pcvy', '', NULL, '', '', '', 0, 0, 'English', 1, 1, 1, 0, '2026-08-11 04:18:13');

-- --------------------------------------------------------

--
-- Table structure for table `fcm_tokens`
--

DROP TABLE IF EXISTS `fcm_tokens`;
CREATE TABLE IF NOT EXISTS `fcm_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doctor_email` varchar(255) NOT NULL,
  `fcm_token` text NOT NULL,
  `platform` enum('android','web') NOT NULL,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email_platform` (`doctor_email`,`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doctor_email` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `reference_id` varchar(100) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_doctor_unread` (`doctor_email`,`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `doctor_email`, `title`, `body`, `type`, `reference_id`, `is_read`, `created_at`) VALUES
(1, 'lakeshb5037.sse@saveetha.com', 'New Scan Uploaded', 'A new CT scan for Emily has been added to your records.', 'scan_uploaded', '1', 0, '2026-08-11 04:19:26');

-- --------------------------------------------------------

--
-- Table structure for table `otp_verifications`
--

DROP TABLE IF EXISTS `otp_verifications`;
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `action` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `scans`
--

DROP TABLE IF EXISTS `scans`;
CREATE TABLE IF NOT EXISTS `scans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doctor_email` varchar(100) NOT NULL,
  `patient_id` varchar(100) NOT NULL,
  `patient_name` varchar(100) NOT NULL,
  `patient_age` varchar(10) NOT NULL,
  `patient_gender` varchar(10) NOT NULL,
  `result` varchar(50) NOT NULL,
  `risk_level` varchar(20) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `date_added` varchar(20) NOT NULL,
  `time_added` varchar(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_doctor_date` (`doctor_email`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `scans`
--

INSERT INTO `scans` (`id`, `doctor_email`, `patient_id`, `patient_name`, `patient_age`, `patient_gender`, `result`, `risk_level`, `image_path`, `date_added`, `time_added`, `created_at`) VALUES
(1, 'lakeshb5037.sse@saveetha.com', 'PAT-01', 'Emily', '45', 'Female', 'Normal (No Hemorrhage)', 'Low Risk', 'uploads/scans/scan_PAT-01_1786421966.jpg', '11 Aug 2026', '06:19 AM', '2026-08-11 04:19:26');

-- --------------------------------------------------------

--
-- Table structure for table `support_tickets`
--

DROP TABLE IF EXISTS `support_tickets`;
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_number` varchar(30) NOT NULL,
  `doctor_email` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `platform` varchar(20) DEFAULT 'unknown',
  `device_info` varchar(255) DEFAULT NULL,
  `status` enum('open','in_progress','resolved','closed') DEFAULT 'open',
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `admin_reply` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `idx_email` (`doctor_email`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
