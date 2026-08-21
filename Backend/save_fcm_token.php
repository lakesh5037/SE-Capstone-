<?php
// save_fcm_token.php — Upsert FCM push token for a doctor (Android or Web)
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

$email    = isset($_POST['email'])    ? trim($_POST['email'])    : '';
$token    = isset($_POST['token'])    ? trim($_POST['token'])    : '';
$platform = isset($_POST['platform']) ? trim($_POST['platform']) : 'android';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "message" => "Invalid email"]);
    exit;
}
if (empty($token) || strlen($token) < 10) {
    echo json_encode(["status" => "error", "message" => "Invalid token"]);
    exit;
}
if (!in_array($platform, ['android', 'web'])) {
    $platform = 'android';
}

// INSERT ... ON DUPLICATE KEY UPDATE — upserts the token atomically
$stmt = $conn->prepare(
    "INSERT INTO fcm_tokens (doctor_email, fcm_token, platform)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE fcm_token = VALUES(fcm_token), last_updated = NOW()"
);
$stmt->bind_param("sss", $email, $token, $platform);

if ($stmt->execute()) {
    echo json_encode(["status" => "success", "message" => "Token saved"]);
} else {
    echo json_encode(["status" => "error", "message" => "Database error"]);
}

$stmt->close();
$conn->close();
?>
