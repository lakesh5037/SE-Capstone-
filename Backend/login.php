<?php
// login.php - Doctor login authentication
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email = isset($_POST['email']) ? trim($_POST['email']) : '';
$password = isset($_POST['password']) ? trim($_POST['password']) : '';

if (empty($email) || empty($password)) {
    echo json_encode([
        "status" => "error",
        "message" => "Email and password are required."
    ]);
    exit;
}

// Query doctor by email
$stmt = $conn->prepare("SELECT name, email, mobile, gender, password, specialty, profile_image, bio, hospital, license, years_exp, dark_mode, language, daily_summary, sound, vibration, theme_mode FROM doctors WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    $stmt->bind_result($name, $db_email, $mobile, $gender, $db_password, $specialty, $profile_image, $bio, $hospital, $license, $years_exp, $dark_mode, $language, $daily_summary, $sound, $vibration, $theme_mode);
    $stmt->fetch();
    
    // Verify password hash
    if (password_verify($password, $db_password)) {
        echo json_encode([
            "status" => "success",
            "message" => "Login successful",
            "user" => [
                "name" => $name,
                "email" => $db_email,
                "mobile" => $mobile,
                "gender" => $gender,
                "specialty" => $specialty ?? "",
                "profile_image" => $profile_image ?? "",
                "bio" => $bio ?? "",
                "hospital" => $hospital ?? "",
                "license" => $license ?? "",
                "years_exp" => $years_exp ?? 0,
                "dark_mode" => (int)($dark_mode ?? 0),
                "language" => $language ?? "English",
                "daily_summary" => (int)($daily_summary ?? 1),
                "sound" => (int)($sound ?? 1),
                "vibration" => (int)($vibration ?? 1),
                "theme_mode" => (int)($theme_mode ?? 0)
            ]
        ]);
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid email or password"
        ]);
    }
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid email or password"
    ]);
}

$stmt->close();
$conn->close();
?>
