<?php
// install.php - Database initialization script for brain_scan_db

$host = "localhost";
$username = "root";
$password = "";
$database = "brain_scan_db";

echo "<h2>Starting database setup for '$database'...</h2>";

// 1. Establish connection to MySQL server
$conn = new mysqli($host, $username, $password);
if ($conn->connect_error) {
    die("<p style='color:red;'>Connection failed: " . $conn->connect_error . "</p>");
}

// 2. Create database if not exists
$sql_db = "CREATE DATABASE IF NOT EXISTS `$database` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci";
if ($conn->query($sql_db) === TRUE) {
    echo "<p style='color:green;'>Database '$database' verified/created successfully.</p>";
} else {
    echo "<p style='color:red;'>Error creating database: " . $conn->error . "</p>";
}

// Select database
$conn->select_db($database);

// 3. Create doctors table
$sql_doctors = "CREATE TABLE IF NOT EXISTS `doctors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `gender` VARCHAR(10) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(100) DEFAULT NULL,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `hospital` VARCHAR(100) DEFAULT NULL,
  `license` VARCHAR(50) DEFAULT NULL,
  `years_exp` INT DEFAULT NULL,
  `dark_mode` TINYINT(1) DEFAULT 0,
  `language` VARCHAR(50) DEFAULT 'English',
  `daily_summary` TINYINT(1) DEFAULT 1,
  `sound` TINYINT(1) DEFAULT 1,
  `vibration` TINYINT(1) DEFAULT 1,
  `theme_mode` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_doctors) === TRUE) {
    echo "<p style='color:green;'>Table 'doctors' verified/created successfully.</p>";
} else {
    echo "<p style='color:red;'>Error creating table 'doctors': " . $conn->error . "</p>";
}

// 4. Create otp_verifications table
$sql_otp = "CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_otp) === TRUE) {
    echo "<p style='color:green;'>Table 'otp_verifications' verified/created successfully.</p>";
} else {
    echo "<p style='color:red;'>Error creating table 'otp_verifications': " . $conn->error . "</p>";
}

// 5. Create scans table
$sql_scans = "CREATE TABLE IF NOT EXISTS `scans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctor_email` VARCHAR(100) NOT NULL,
  `patient_id` VARCHAR(100) NOT NULL,
  `patient_name` VARCHAR(100) NOT NULL,
  `patient_age` VARCHAR(10) NOT NULL,
  `patient_gender` VARCHAR(10) NOT NULL,
  `result` VARCHAR(50) NOT NULL,
  `risk_level` VARCHAR(20) NOT NULL,
  `image_path` VARCHAR(255) NOT NULL,
  `date_added` VARCHAR(20) NOT NULL,
  `time_added` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql_scans) === TRUE) {
    echo "<p style='color:green;'>Table 'scans' verified/created successfully.</p>";
} else {
    echo "<p style='color:red;'>Error creating table 'scans': " . $conn->error . "</p>";
}

$conn->close();
echo "<h3 style='color:green;'>✅ Database setup complete!</h3>";

// ── AI Engine Setup ──────────────────────────────────────────────────────────
echo "<hr><h2>Setting up AI Inference Engine...</h2>";

// Check Python
$pyVersion = [];
exec('python --version 2>&1', $pyVersion, $pyCode);
if ($pyCode !== 0 || empty($pyVersion)) {
    exec('python3 --version 2>&1', $pyVersion, $pyCode);
}

if ($pyCode !== 0) {
    echo "<p style='color:red;'>❌ Python not found. Please install Python 3.10+ from <a href='https://python.org' target='_blank'>python.org</a> and re-run this page.</p>";
} else {
    echo "<p style='color:green;'>✅ Python found: " . htmlspecialchars(implode(' ', $pyVersion)) . "</p>";

    // Install Python packages
    echo "<p>Installing AI packages (ai-edge-litert, numpy, Pillow)... <em>This may take 1-2 minutes on first run.</em></p>";
    flush();

    $pipOut = [];
    exec('python -m pip install --quiet ai-edge-litert numpy Pillow 2>&1', $pipOut, $pipCode);
    if ($pipCode === 0) {
        echo "<p style='color:green;'>✅ AI packages installed successfully.</p>";
    } else {
        echo "<p style='color:orange;'>⚠️ pip output: " . htmlspecialchars(implode('<br>', $pipOut)) . "</p>";
        echo "<p style='color:orange;'>⚠️ Auto-install attempted. If AI inference fails, run manually: <code>pip install ai-edge-litert numpy Pillow</code></p>";
    }

    // Verify models exist
    $models = [
        'brain_ct_classifier.tflite' => 'Gatekeeper',
        'hemorrhage_detector.tflite' => 'YOLO Detector',
        'Hemorrhage.tflite'          => 'Subtype Classifier',
    ];
    $modelsDir = __DIR__ . '/models/';
    echo "<h3>Checking AI Model Files:</h3>";
    foreach ($models as $file => $name) {
        if (file_exists($modelsDir . $file)) {
            $size = round(filesize($modelsDir . $file) / 1024 / 1024, 1);
            echo "<p style='color:green;'>✅ $name ({$size}MB) — ready</p>";
        } else {
            echo "<p style='color:red;'>❌ $name ($file) — NOT FOUND in /models/ folder</p>";
        }
    }

    // Quick inference smoke test
    $scriptPath = __DIR__ . '/inference.py';
    if (file_exists($scriptPath)) {
        echo "<p style='color:green;'>✅ inference.py found</p>";
    } else {
        echo "<p style='color:red;'>❌ inference.py not found in brainscan_api/</p>";
    }
}

echo "<hr><h3>🎉 Setup Complete! Your HemoScan system is ready.</h3>";
echo "<p><a href='../hemoscan/'>→ Open HemoScan Website</a></p>";
?>

