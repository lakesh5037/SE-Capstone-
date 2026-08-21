<?php
// check_user.php - Lightweight session validation endpoint.
// The Android app calls this at startup to verify that the locally-cached
// email address still exists in the database. If the DB was wiped / the
// account was deleted the app clears its local session and shows Login.
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status"  => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email = isset($_POST['email']) ? trim($_POST['email']) : '';

if (empty($email)) {
    echo json_encode([
        "status"  => "error",
        "message" => "Email parameter is required."
    ]);
    exit;
}

// Check whether this email exists in the doctors table
$stmt = $conn->prepare(
    "SELECT id, name, email, mobile, gender, specialty, profile_image, bio, hospital, license, years_exp, dark_mode, language, daily_summary, sound, vibration, theme_mode "
  . "FROM doctors WHERE email = ? LIMIT 1"
);
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    // Account no longer exists — tell the app to clear its local session
    $stmt->close();
    $conn->close();
    echo json_encode([
        "status"  => "error",
        "message" => "Account not found. Please log in again."
    ]);
    exit;
}

$row = $result->fetch_assoc();
$stmt->close();
$conn->close();

// Return fresh user data so the app can refresh its cached profile
echo json_encode([
    "status" => "success",
    "user"   => [
        "name"          => $row['name'],
        "email"         => $row['email'],
        "mobile"        => $row['mobile'],
        "gender"        => $row['gender'],
        "specialty"     => $row['specialty']      ?? '',
        "profile_image" => $row['profile_image']  ?? '',
        "bio"           => $row['bio']            ?? '',
        "hospital"      => $row['hospital']       ?? '',
        "license"       => $row['license']        ?? '',
        "years_exp"     => (int)($row['years_exp'] ?? 0),
        "dark_mode"     => (int)($row['dark_mode'] ?? 0),
        "language"      => $row['language']       ?? 'English',
        "daily_summary" => (int)($row['daily_summary'] ?? 1),
        "sound"         => (int)($row['sound'] ?? 1),
        "vibration"     => (int)($row['vibration'] ?? 1),
        "theme_mode"    => (int)($row['theme_mode'] ?? 0)
    ]
]);
?>
