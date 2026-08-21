<?php
// get_notifications.php - Fetch notifications for a doctor
// Shared by web and Android to keep notification state synchronized.
require_once 'db.php';

$doctor_email = isset($_GET['email'])       ? trim($_GET['email'])       : '';
$unread_only  = isset($_GET['unread_only']) ? intval($_GET['unread_only']) : 0;
$limit        = isset($_GET['limit'])       ? min(intval($_GET['limit']), 200) : 50;

if (empty($doctor_email)) {
    echo json_encode(["status" => "error", "message" => "email parameter is required"]);
    exit;
}

$query  = "SELECT id, title, body, type, reference_id, is_read, created_at FROM notifications WHERE doctor_email = ?";
$types  = "s";
$params = [$doctor_email];

if ($unread_only === 1) {
    $query  .= " AND is_read = 0";
}

$query .= " ORDER BY created_at DESC LIMIT ?";
$params[] = $limit;
$types .= "i";

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$notifications = [];
while ($row = $result->fetch_assoc()) {
    $row['id']      = (int)$row['id'];
    $row['is_read'] = (int)$row['is_read'];
    $notifications[] = $row;
}

// Unread count for badge display
$count_stmt = $conn->prepare(
    "SELECT COUNT(*) as unread_count FROM notifications WHERE doctor_email = ? AND is_read = 0"
);
$count_stmt->bind_param("s", $doctor_email);
$count_stmt->execute();
$count_result = $count_stmt->get_result();
$unread_count = (int)$count_result->fetch_assoc()['unread_count'];
$count_stmt->close();

echo json_encode([
    "status"       => "success",
    "unread_count" => $unread_count,
    "count"        => count($notifications),
    "data"         => $notifications
]);

$stmt->close();
$conn->close();
?>
