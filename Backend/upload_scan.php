<?php
// upload_scan.php - Upload scan results and image
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status" => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$doctor_email = isset($_POST['doctor_email']) ? trim($_POST['doctor_email']) : '';
$patient_id = isset($_POST['patient_id']) ? trim($_POST['patient_id']) : '';
$patient_name = isset($_POST['patient_name']) ? trim($_POST['patient_name']) : '';
$patient_age = isset($_POST['patient_age']) ? trim($_POST['patient_age']) : '';
$patient_gender = isset($_POST['patient_gender']) ? trim($_POST['patient_gender']) : '';
$result = isset($_POST['result']) ? trim($_POST['result']) : '';
$risk_level = isset($_POST['risk_level']) ? trim($_POST['risk_level']) : '';

if (empty($doctor_email) || empty($patient_id) || empty($patient_name) || empty($result) || empty($risk_level)) {
    echo json_encode([
        "status" => "error",
        "message" => "Required fields (doctor_email, patient_id, patient_name, result, risk_level) are missing."
    ]);
    exit;
}

$image_path = '';

// Process the scan image file upload
if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
    $file_tmp = $_FILES['image']['tmp_name'];
    $file_name = $_FILES['image']['name'];
    $file_ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
    
    // Validate image extension
    $allowed_extensions = ['jpg', 'jpeg', 'png', 'webp'];
    if (!in_array($file_ext, $allowed_extensions)) {
        echo json_encode([
            "status" => "error",
            "message" => "Invalid image format. Allowed formats: " . implode(', ', $allowed_extensions)
        ]);
        exit;
    }
    
    // Create uploads/scans directory if it doesn't exist
    $upload_dir = 'uploads/scans/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
    
    // Generate unique name for the scan
    $new_file_name = 'scan_' . $patient_id . '_' . time() . '.' . $file_ext;
    $dest_path = $upload_dir . $new_file_name;
    
    if (move_uploaded_file($file_tmp, $dest_path)) {
        $image_path = $dest_path;
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "Failed to save uploaded scan image."
        ]);
        exit;
    }
} else {
    echo json_encode([
        "status" => "error",
        "message" => "Scan image file is required and was not uploaded successfully."
    ]);
    exit;
}

// Generate date and time added
$date_added = date('d M Y');
$time_added = date('h:i A');

// Insert scan record into database
$stmt = $conn->prepare("INSERT INTO scans (doctor_email, patient_id, patient_name, patient_age, patient_gender, result, risk_level, image_path, date_added, time_added) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("ssssssssss", $doctor_email, $patient_id, $patient_name, $patient_age, $patient_gender, $result, $risk_level, $image_path, $date_added, $time_added);

if ($stmt->execute()) {
    $inserted_id = $stmt->insert_id;

    // ── Write notification so other devices can detect the new scan via polling ──
    $notif = $conn->prepare(
        "INSERT INTO notifications (doctor_email, title, body, type, reference_id)
         VALUES (?, ?, ?, 'scan_uploaded', ?)"
    );
    $notif_title = 'New Scan Uploaded';
    $notif_body  = 'A new CT scan for ' . $patient_name . ' has been added to your records.';
    $notif_ref   = (string)$inserted_id;
    $notif->bind_param("ssss", $doctor_email, $notif_title, $notif_body, $notif_ref);
    $notif->execute();
    $notif->close();

    echo json_encode([
        "status"     => "success",
        "message"    => "Scan uploaded and saved successfully.",
        "scan_id"    => $inserted_id,
        "patient_id" => $patient_id
    ]);
} else {
    echo json_encode([
        "status"  => "error",
        "message" => "Failed to save scan record to database."
    ]);
}

$stmt->close();
$conn->close();
?>
