<?php
// update_profile.php - Update doctor's name, specialty, and profile picture
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email = isset($_POST['email']) ? trim($_POST['email']) : '';

if (empty($email)) {
    echo json_encode([
        "status" => "error",
        "message" => "Email is required to update profile."
    ]);
    exit;
}

// Check if doctor exists and select all fields to allow partial updates
$stmt = $conn->prepare("SELECT id, name, specialty, profile_image, bio, hospital, license, years_exp, dark_mode, language, daily_summary, sound, vibration, theme_mode, mobile, gender FROM doctors WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Account not found."
    ]);
    $stmt->close();
    exit;
}

$stmt->bind_result($doctor_id, $curr_name, $curr_specialty, $current_profile_image, $curr_bio, $curr_hospital, $curr_license, $curr_years_exp, $curr_dark_mode, $curr_language, $curr_daily_summary, $curr_sound, $curr_vibration, $curr_theme_mode, $curr_mobile, $curr_gender);
$stmt->fetch();
$stmt->close();

// Extract new values or keep existing ones
$name = isset($_POST['name']) ? trim($_POST['name']) : $curr_name;
$specialty = isset($_POST['specialty']) ? trim($_POST['specialty']) : $curr_specialty;
$bio = isset($_POST['bio']) ? trim($_POST['bio']) : $curr_bio;
$hospital = isset($_POST['hospital']) ? trim($_POST['hospital']) : $curr_hospital;
$license = isset($_POST['license']) ? trim($_POST['license']) : $curr_license;
$years_exp = isset($_POST['years_exp']) ? intval($_POST['years_exp']) : $curr_years_exp;
$dark_mode = isset($_POST['dark_mode']) ? intval($_POST['dark_mode']) : $curr_dark_mode;
$language = isset($_POST['language']) ? trim($_POST['language']) : $curr_language;
$daily_summary = isset($_POST['daily_summary']) ? intval($_POST['daily_summary']) : $curr_daily_summary;
$sound = isset($_POST['sound']) ? intval($_POST['sound']) : $curr_sound;
$vibration = isset($_POST['vibration']) ? intval($_POST['vibration']) : $curr_vibration;
$theme_mode = isset($_POST['theme_mode']) ? intval($_POST['theme_mode']) : $curr_theme_mode;
$mobile = isset($_POST['mobile']) ? trim($_POST['mobile']) : $curr_mobile;
$gender = isset($_POST['gender']) ? trim($_POST['gender']) : $curr_gender;

$profile_image_path = $current_profile_image;

// Process file upload if profileImage or profile_image is provided
$file_key = isset($_FILES['profileImage']) ? 'profileImage' : (isset($_FILES['profile_image']) ? 'profile_image' : '');
if (!empty($file_key) && $_FILES[$file_key]['error'] === UPLOAD_ERR_OK) {
    $file_tmp = $_FILES[$file_key]['tmp_name'];
    $file_name = $_FILES[$file_key]['name'];
    $file_ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
    
    // Validate file extension
    $allowed_extensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($file_ext, $allowed_extensions)) {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid image format. Allowed formats: " . implode(', ', $allowed_extensions)
        ]);
        exit;
    }
    
    // Create uploads/profiles directory if it doesn't exist
    $upload_dir = 'uploads/profiles/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
    
    // Generate clean unique filename
    $email_prefix = preg_replace('/[^a-zA-Z0-9]/', '_', explode('@', $email)[0]);
    $new_file_name = 'profile_' . $email_prefix . '_' . time() . '.' . $file_ext;
    $dest_path = $upload_dir . $new_file_name;
    
    if (move_uploaded_file($file_tmp, $dest_path)) {
        // Delete the old profile picture if it exists and is different
        if (!empty($current_profile_image) && file_exists($current_profile_image) && is_file($current_profile_image)) {
            @unlink($current_profile_image);
        }
        $profile_image_path = $dest_path;
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Failed to save profile image."
        ]);
        exit;
    }
}

// Update all fields in database
$stmt_update = $conn->prepare("UPDATE doctors SET name = ?, specialty = ?, profile_image = ?, bio = ?, hospital = ?, license = ?, years_exp = ?, dark_mode = ?, language = ?, daily_summary = ?, sound = ?, vibration = ?, theme_mode = ?, mobile = ?, gender = ? WHERE email = ?");
$stmt_update->bind_param("ssssssiisiiiisss", $name, $specialty, $profile_image_path, $bio, $hospital, $license, $years_exp, $dark_mode, $language, $daily_summary, $sound, $vibration, $theme_mode, $mobile, $gender, $email);

if ($stmt_update->execute()) {
    echo json_encode([
        "status" => "success",
        "message" => "Profile updated successfully.",
        "profile_image" => $profile_image_path,
        "user" => [
            "name" => $name,
            "specialty" => $specialty,
            "profile_image" => $profile_image_path,
            "bio" => $bio,
            "hospital" => $hospital,
            "license" => $license,
            "years_exp" => $years_exp,
            "dark_mode" => $dark_mode,
            "language" => $language,
            "daily_summary" => $daily_summary,
            "sound" => $sound,
            "vibration" => $vibration,
            "theme_mode" => $theme_mode,
            "mobile" => $mobile,
            "gender" => $gender
        ]
    ]);
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Failed to update profile details in database: " . $stmt_update->error
    ]);
}

$stmt_update->close();
$conn->close();
?>
