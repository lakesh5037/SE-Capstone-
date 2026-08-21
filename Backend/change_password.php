<?php
// change_password.php - Authenticated password change (requires current password)
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$email        = isset($_POST['email'])        ? trim($_POST['email'])        : '';
$old_password = isset($_POST['old_password']) ? trim($_POST['old_password']) : '';
$new_password = isset($_POST['new_password']) ? trim($_POST['new_password']) : '';

if (empty($email) || empty($old_password) || empty($new_password)) {
    echo json_encode(["status" => "error", "message" => "Email, current password, and new password are required."]);
    exit;
}

if (strlen($new_password) < 6) {
    echo json_encode(["status" => "error", "message" => "New password must be at least 6 characters."]);
    exit;
}

// Fetch current hashed password
$stmt = $conn->prepare("SELECT password FROM doctors WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    echo json_encode(["status" => "error", "message" => "Account not found."]);
    $stmt->close();
    $conn->close();
    exit;
}

$stmt->bind_result($hashed_password);
$stmt->fetch();
$stmt->close();

// Verify the current password
if (!password_verify($old_password, $hashed_password)) {
    echo json_encode(["status" => "error", "message" => "Current password is incorrect."]);
    $conn->close();
    exit;
}

// Prevent reuse of same password
if (password_verify($new_password, $hashed_password)) {
    echo json_encode(["status" => "error", "message" => "New password must be different from the current password."]);
    $conn->close();
    exit;
}

// Hash the new password and update
$new_hashed = password_hash($new_password, PASSWORD_DEFAULT);
$upd = $conn->prepare("UPDATE doctors SET password = ? WHERE email = ?");
$upd->bind_param("ss", $new_hashed, $email);

if ($upd->execute()) {
    echo json_encode(["status" => "success", "message" => "Password changed successfully."]);
} else {
    echo json_encode(["status" => "error", "message" => "Database update failed. Please try again."]);
}

$upd->close();
$conn->close();
?>
