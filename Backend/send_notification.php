<?php
// send_notification.php — Send FCM push notification to one or all doctors
// This endpoint is for ADMIN/INTERNAL use only.
// Secure it in production with a secret key or move to a server-side cron.
require_once 'db.php';
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

// ── Simple admin key guard ────────────────────────────────────────────────────────
$adminKey = isset($_POST['admin_key']) ? $_POST['admin_key'] : '';
if (!defined('ADMIN_NOTIFICATION_KEY') || $adminKey !== ADMIN_NOTIFICATION_KEY) {
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

// ── Parameters ────────────────────────────────────────────────────────────────────
$doctor_email = isset($_POST['email'])    ? trim($_POST['email'])    : '';  // empty = broadcast to ALL
$title        = isset($_POST['title'])    ? trim($_POST['title'])    : 'HemoScan Notification';
$body         = isset($_POST['body'])     ? trim($_POST['body'])     : '';
$type         = isset($_POST['type'])     ? trim($_POST['type'])     : 'alert';   // alert | results
$scan_id      = isset($_POST['scan_id'])  ? trim($_POST['scan_id'])  : '';

if (empty($body)) {
    echo json_encode(["status" => "error", "message" => "Body is required"]);
    exit;
}

// ── Fetch target tokens ───────────────────────────────────────────────────────────
if (!empty($doctor_email)) {
    $stmt = $conn->prepare(
        "SELECT fcm_token, platform FROM fcm_tokens WHERE doctor_email = ?"
    );
    $stmt->bind_param("s", $doctor_email);
} else {
    $stmt = $conn->prepare(
        "SELECT fcm_token, platform FROM fcm_tokens"
    );
}
$stmt->execute();
$result = $stmt->get_result();

$tokens = [];
while ($row = $result->fetch_assoc()) {
    $tokens[] = $row;
}
$stmt->close();

if (empty($tokens)) {
    echo json_encode(["status" => "error", "message" => "No registered devices found"]);
    $conn->close();
    exit;
}

// ── Firebase HTTP v1 API ─────────────────────────────────────────────────────────
// Requires: service-account credentials or server key
// Using legacy HTTP API for simplicity (replace with OAuth2 v1 in production)
$fcmServerKey = defined('FCM_SERVER_KEY') ? FCM_SERVER_KEY : '';

if (empty($fcmServerKey)) {
    echo json_encode([
        "status"  => "error",
        "message" => "FCM_SERVER_KEY not configured in config.php"
    ]);
    $conn->close();
    exit;
}

$successCount = 0;
$failCount    = 0;

foreach ($tokens as $tokenRow) {
    $payload = [
        "to" => $tokenRow['fcm_token'],
        "notification" => [
            "title" => $title,
            "body"  => $body,
            "sound" => "default"
        ],
        "data" => [
            "type"    => $type,
            "scan_id" => $scan_id,
            "click_action" => "FLUTTER_NOTIFICATION_CLICK"
        ],
        "android" => [
            "priority"      => "high",
            "notification"  => [
                "channel_id" => ("results" === $type ? "hemoscan_results" : "hemoscan_alerts"),
                "icon"       => "ic_notification",
                "color"      => "#0EA5E9"
            ]
        ]
    ];

    $ch = curl_init("https://fcm.googleapis.com/fcm/send");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "Authorization: key=" . $fcmServerKey
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response   = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);
    if ($httpCode === 200 && isset($decoded['success']) && $decoded['success'] > 0) {
        $successCount++;
    } else {
        $failCount++;
        error_log("FCM send failed for token: " . substr($tokenRow['fcm_token'], 0, 20)
                . " | Response: " . $response);
    }
}

echo json_encode([
    "status"        => "success",
    "sent"          => $successCount,
    "failed"        => $failCount,
    "total_targets" => count($tokens)
]);

$conn->close();
?>
