<?php
// get_tickets.php — Return all support tickets for a specific doctor email
require_once 'db.php';

$doctor_email = isset($_GET['email']) ? trim($_GET['email']) : '';

if (!filter_var($doctor_email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "message" => "Valid email required."]);
    exit;
}

$stmt = $conn->prepare(
    "SELECT ticket_number, category, message, status, priority,
            admin_reply, created_at, updated_at
     FROM support_tickets
     WHERE doctor_email = ?
     ORDER BY created_at DESC
     LIMIT 50"
);
$stmt->bind_param("s", $doctor_email);
$stmt->execute();
$result = $stmt->get_result();

$tickets = [];
while ($row = $result->fetch_assoc()) {
    $tickets[] = $row;
}

echo json_encode([
    "status" => "success",
    "count"  => count($tickets),
    "data"   => $tickets
]);

$stmt->close();
$conn->close();
?>
