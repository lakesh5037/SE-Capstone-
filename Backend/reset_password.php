<?php
// reset_password.php - Securely update doctor's password after verifying OTP
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$otp_code = isset($_POST['otp_code']) ? trim($_POST['otp_code']) : '';
$new_password = isset($_POST['new_password']) ? trim($_POST['new_password']) : '';

if (empty($email) || empty($otp_code) || empty($new_password)) {
    echo json_encode([
        "status" => "error",
        "message" => "Email, otp_code, and new_password are required."
    ]);
    exit;
}

// 1. Verify that the OTP was verified (marked as 'VERIFIED') or matches the active code
$stmt = $conn->prepare("SELECT id FROM otp_verifications WHERE email = ? AND (otp_code = 'VERIFIED' OR otp_code = ?) AND action IN ('forgot_pwd', 'update_pwd') AND expires_at > NOW()");
$stmt->bind_param("ss", $email, $otp_code);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "OTP verification is invalid or expired. Please verify OTP first."
    ]);
    $stmt->close();
    exit;
}
$stmt->close();

// 2. Hash the new password
$hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

// 3. Update the password in doctors table
$stmt = $conn->prepare("UPDATE doctors SET password = ? WHERE email = ?");
$stmt->bind_param("ss", $hashed_password, $email);

if ($stmt->execute()) {
    // Clean up OTP verifications
    $stmt_clean = $conn->prepare("DELETE FROM otp_verifications WHERE email = ? AND action IN ('forgot_pwd', 'update_pwd')");
    $stmt_clean->bind_param("s", $email);
    $stmt_clean->execute();
    $stmt_clean->close();

    echo json_encode([
        "status" => "success",
        "message" => "Password reset successfully. You can now login with your new password."
    ]);
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Failed to reset password. Please try again."
    ]);
}

$stmt->close();
$conn->close();
?>
