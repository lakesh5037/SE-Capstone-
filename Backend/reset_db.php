<?php
// reset_db.php - Completely reset MySQL database and clear uploaded files
$host = "localhost";
$username = "root";
$password = "";
$database = "brain_scan_db";

$conn = new mysqli($host, $username, $password);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
}

// 1. Drop database if exists
if ($conn->query("DROP DATABASE IF EXISTS `$database`") === TRUE) {
    echo "Database '$database' dropped successfully.\n";
} else {
    echo "Error dropping database: " . $conn->error . "\n";
}
$conn->close();

// 2. Re-create database and tables by running install.php
echo "Re-running install.php to recreate tables...\n";
ob_start();
include 'install.php';
$install_output = ob_get_clean();
echo strip_tags($install_output) . "\n";

// 3. Clear upload directories
function delete_files_in_dir($dir_path) {
    if (!is_dir($dir_path)) return;
    $files = glob($dir_path . '*');
    foreach ($files as $file) {
        if (is_file($file)) {
            unlink($file);
            echo "Deleted file: $file\n";
        }
    }
}

echo "Clearing uploaded files...\n";
delete_files_in_dir('uploads/scans/');
delete_files_in_dir('uploads/profiles/');
echo "Uploaded files cleared.\n";

echo "Database and uploads reset successfully!\n";
?>
