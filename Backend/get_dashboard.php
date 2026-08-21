<?php
// get_dashboard.php - Return pre-calculated statistics & recent scans for fast rendering
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

$protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$baseUrl  = $protocol . '://' . $_SERVER['HTTP_HOST'] . '/brainscan_api/';

$doctor_email = isset($_GET['doctor_email']) ? trim($_GET['doctor_email']) : '';

// 1. Calculate aggregated counts
$countSql = "SELECT 
    COUNT(*) as total_scans,
    SUM(CASE WHEN LOWER(result) LIKE '%abnormal%' THEN 1 ELSE 0 END) as abnormal_scans,
    SUM(CASE WHEN LOWER(result) NOT LIKE '%abnormal%' THEN 1 ELSE 0 END) as normal_scans
    FROM scans";

if (!empty($doctor_email)) {
    $countSql .= " WHERE doctor_email = ?";
    $stmt = $conn->prepare($countSql);
    $stmt->bind_param("s", $doctor_email);
} else {
    $stmt = $conn->prepare($countSql);
}

$stmt->execute();
$countRes = $stmt->get_result()->fetch_assoc();
$stmt->close();

$total_scans    = (int)($countRes['total_scans'] ?? 0);
$abnormal_scans = (int)($countRes['abnormal_scans'] ?? 0);
$normal_scans   = (int)($countRes['normal_scans'] ?? 0);

// 2. Fetch top 10 recent scans
$query = "SELECT id, doctor_email, patient_id, patient_name, patient_age,
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

$query .= " ORDER BY id DESC LIMIT 10";

$stmt = $conn->prepare($query);
if (!empty($types)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$scansRes = $stmt->get_result();

$scans = [];
while ($row = $scansRes->fetch_assoc()) {
    $row['id'] = (string)$row['id'];
    if (!empty($row['image_path'])) {
        $row['image_path'] = $baseUrl . ltrim($row['image_path'], '/');
    }
    $scans[] = $row;
}
$stmt->close();
$conn->close();

echo json_encode([
    "status"         => "success",
    "total_scans"    => $total_scans,
    "normal_scans"   => $normal_scans,
    "abnormal_scans" => $abnormal_scans,
    "data"           => $scans,
    "server_time"    => time()
]);
?>
