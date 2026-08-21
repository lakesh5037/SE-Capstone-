<?php
// delete_account.php - Delete doctor account and all associated data
// SECURITY: Requires the current password to prevent unauthorized account deletion.
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email    = isset($_POST['email'])    ? trim($_POST['email'])    : '';
$password = isset($_POST['password']) ? trim($_POST['password']) : '';

if (empty($email)) {
    echo json_encode([
        "status" => "error",
        "message" => "Email parameter is required to delete account."
    ]);
    exit;
}

if (empty($password)) {
    echo json_encode([
        "status" => "error",
        "message" => "Password confirmation is required to delete account."
    ]);
    exit;
}

// 0. Verify password before proceeding with deletion
$stmt_pwd = $conn->prepare("SELECT password, profile_image FROM doctors WHERE email = ?");
$stmt_pwd->bind_param("s", $email);
$stmt_pwd->execute();
$stmt_pwd->store_result();

if ($stmt_pwd->num_rows === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "No account found with this email address."
    ]);
    $stmt_pwd->close();
    exit;
}

$stmt_pwd->bind_result($db_password, $profile_image);
$stmt_pwd->fetch();
$stmt_pwd->close();

if (!password_verify($password, $db_password)) {
    echo json_encode([
        "status" => "error",
        "message" => "Incorrect password. Account deletion requires password confirmation."
    ]);
    exit;
}

// 2. Delete profile image file if exists
if (!empty($profile_image) && file_exists($profile_image) && is_file($profile_image)) {
    @unlink($profile_image);
}

// 3. Get all scan image paths to delete them from disk
$stmt_scans = $conn->prepare("SELECT image_path FROM scans WHERE doctor_email = ?");
$stmt_scans->bind_param("s", $email);
$stmt_scans->execute();
$result_scans = $stmt_scans->get_result();

while ($row = $result_scans->fetch_assoc()) {
    $scan_image = $row['image_path'];
    if (!empty($scan_image) && file_exists($scan_image) && is_file($scan_image)) {
        @unlink($scan_image);
    }
}
$stmt_scans->close();

// 4. Delete scans from database
$stmt_del_scans = $conn->prepare("DELETE FROM scans WHERE doctor_email = ?");
$stmt_del_scans->bind_param("s", $email);
$stmt_del_scans->execute();
$stmt_del_scans->close();

// 5. Delete OTP verifications from database
$stmt_del_otp = $conn->prepare("DELETE FROM otp_verifications WHERE email = ?");
$stmt_del_otp->bind_param("s", $email);
$stmt_del_otp->execute();
$stmt_del_otp->close();

// 6. Delete doctor record from database
$stmt_del_doc = $conn->prepare("DELETE FROM doctors WHERE email = ?");
$stmt_del_doc->bind_param("s", $email);

if ($stmt_del_doc->execute()) {
    echo json_encode([
        "status" => "success",
        "message" => "Your account and all associated scans have been permanently deleted."
    ]);
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Failed to delete doctor account. Please try again."
    ]);
}

$stmt_del_doc->close();
$conn->close();
?>
