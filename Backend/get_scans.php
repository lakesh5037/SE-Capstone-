<?php
// get_scans.php - Fetch scans with optional filters
// Changes: absolute image_url returned, delta sync via ?since=<timestamp>, pagination
require_once 'db.php';

// ── Build the absolute base URL of this server so image paths work from any client ──
$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$baseUrl   = $protocol . '://' . $_SERVER['HTTP_HOST'] . '/brainscan_api/';

// ── Query parameters ──────────────────────────────────────────────────────────────
$doctor_email   = isset($_GET['doctor_email'])   ? trim($_GET['doctor_email'])   : '';
$patient_id     = isset($_GET['patient_id'])     ? trim($_GET['patient_id'])     : '';
$patient_name   = isset($_GET['patient_name'])   ? trim($_GET['patient_name'])   : '';
$patient_age    = isset($_GET['patient_age'])    ? trim($_GET['patient_age'])    : '';
$patient_gender = isset($_GET['patient_gender']) ? trim($_GET['patient_gender']) : '';

// Delta sync: ?since=<unix_timestamp> — only return scans newer than this time
$since = isset($_GET['since']) ? (int)$_GET['since'] : 0;

// Pagination support: limit defaults to 200 (production safe cap)
$page  = isset($_GET['page'])  ? max(1, (int)$_GET['page']) : 1;
$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 500) : 200;
$offset = ($page - 1) * $limit;

// ── Build query dynamically with prepared statement params ───────────────────────
$query  = "SELECT id, doctor_email, patient_id, patient_name, patient_age,
                  patient_gender, result, risk_level, image_path,
                  date_added, time_added, created_at
           FROM scans WHERE 1=1";
$params = [];
$types  = "";

if (!empty($doctor_email)) {
    $query .= " AND doctor_email = ?";
    $params[] = $doctor_email;
    $types .= "s";
}

if (!empty($patient_id)) {
    $query .= " AND patient_id LIKE ?";
    $params[] = "%" . $patient_id . "%";
    $types .= "s";
}

if (!empty($patient_name)) {
    $query .= " AND patient_name LIKE ?";
    $params[] = "%" . $patient_name . "%";
    $types .= "s";
}

if (!empty($patient_age)) {
    $query .= " AND patient_age = ?";
    $params[] = $patient_age;
    $types .= "s";
}

if (!empty($patient_gender)) {
    $query .= " AND patient_gender = ?";
    $params[] = $patient_gender;
    $types .= "s";
}

// Delta sync filter — only records created after the given Unix timestamp
if ($since > 0) {
    $query .= " AND UNIX_TIMESTAMP(created_at) > ?";
    $params[] = $since;
    $types .= "i";
}

$query .= " ORDER BY id DESC LIMIT ? OFFSET ?";
$params[] = $limit;
$params[] = $offset;
$types .= "ii";

$stmt = $conn->prepare($query);

if (!empty($types)) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();

$scans = [];
while ($row = $result->fetch_assoc()) {
    // Cast ID to string to match Retrofit's ScanItemDto expectation
    $row['id'] = (string)$row['id'];

    // Return an absolute image URL so Android and Web both load images
    // correctly regardless of which server IP/hostname they are calling from.
    if (!empty($row['image_path'])) {
        // image_path stored as e.g. "uploads/scans/scan_P001_1720000000.jpg"
        $row['image_path'] = $baseUrl . ltrim($row['image_path'], '/');
    }

    $scans[] = $row;
}

echo json_encode([
    "status"     => "success",
    "page"       => $page,
    "limit"      => $limit,
    "count"      => count($scans),
    "data"       => $scans,
    "server_time" => time()   // clients store this as their next delta-sync baseline
]);

$stmt->close();
$conn->close();
?>
