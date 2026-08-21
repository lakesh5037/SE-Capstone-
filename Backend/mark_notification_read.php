<?php
// mark_notification_read.php - Mark one or all notifications as read
// Called by both web and Android so read/unread state stays in sync.
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

$doctor_email = isset($_POST['email'])  ? trim($_POST['email'])    : '';
$mark_all     = isset($_POST['all'])    ? intval($_POST['all'])     : 0;   // 1 = mark all
$notif_id     = isset($_POST['id'])     ? intval($_POST['id'])      : 0;

if (empty($doctor_email)) {
    echo json_encode(["status" => "error", "message" => "email is required"]);
    exit;
}

if ($mark_all === 1) {
    // Mark ALL unread notifications as read for this doctor
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE doctor_email = ? AND is_read = 0");
    $stmt->bind_param("s", $doctor_email);
} elseif ($notif_id > 0) {
    // Mark a single notification as read (verify ownership)
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND doctor_email = ?");
    $stmt->bind_param("is", $notif_id, $doctor_email);
} else {
    echo json_encode(["status" => "error", "message" => "Provide 'id' or 'all=1'"]);
    $conn->close();
    exit;
}

$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();

echo json_encode([
    "status"   => "success",
    "message"  => "Marked as read",
    "affected" => $affected
]);

$conn->close();
?>
