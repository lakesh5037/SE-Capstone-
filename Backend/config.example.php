<?php
// config.php - HemoScan Global Configuration
// ⚠️  SECURITY: This file contains credentials. It is listed in .gitignore.
//
// SETUP:
//   1. Copy this file:  cp config.example.php config.php
//   2. Fill in the values below with your actual credentials.
//   3. Never commit config.php to version control.

// ── Database ───────────────────────────────────────────────────────────────────
define('DB_HOST',     'localhost');
define('DB_USER',     'your_db_username');          // e.g. root (local) or your hosting DB user
define('DB_PASSWORD', 'your_db_password');           // leave empty '' for default XAMPP root
define('DB_NAME',     'brain_scan_db');              // must match your SQL schema

// ── SMTP (Gmail App Password) ──────────────────────────────────────────────────
// How to generate an App Password:
//   Gmail → Google Account → Security → 2-Step Verification → App Passwords
define('SMTP_HOST',      'smtp.gmail.com');
define('SMTP_PORT',      587);
define('SMTP_USERNAME',  'your_email@gmail.com');
define('SMTP_PASSWORD',  'xxxx xxxx xxxx xxxx');    // 16-char Gmail App Password
define('SMTP_FROM',      'your_email@gmail.com');
define('SMTP_FROM_NAME', 'HemoScan — Brain Hemorrhage Detection');

// ── Firebase Cloud Messaging ───────────────────────────────────────────────────
// Get from: Firebase Console → Project Settings → Cloud Messaging → Server key
// NOTE: Use Firebase HTTP v1 API with a service account for production.
define('FCM_SERVER_KEY', 'YOUR_FCM_SERVER_KEY_HERE');

// ── Admin Notification Key ─────────────────────────────────────────────────────
// A random secret you choose — required to call send_notification.php
// Generate with: openssl rand -hex 32
define('ADMIN_NOTIFICATION_KEY', 'YOUR_RANDOM_ADMIN_SECRET_HERE');
?>
