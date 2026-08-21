<?php
// db.php - Database connection helper
ini_set('display_errors', 0);
error_reporting(0);

// ─── CORS Headers ───────────────────────────────────────────────
// Allow the web browser (localhost:3000) to call this PHP backend.
// Android app is unaffected — it doesn't use CORS.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request that browsers send before POST
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
// ────────────────────────────────────────────────────────────────

header("Content-Type: application/json; charset=UTF-8");

$host     = getenv('DB_HOST')     ?: "127.0.0.1";
$username = getenv('DB_USER')     ?: "root";
$password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : "";
$database = getenv('DB_NAME')     ?: "brain_scan_db";

$conn = new mysqli($host, $username, $password, $database);
if ($conn->connect_error) {
    echo json_encode([
        "status" => "error",
        "message" => "Database connection failed: " . $conn->connect_error
    ]);
    exit;
}
?>
