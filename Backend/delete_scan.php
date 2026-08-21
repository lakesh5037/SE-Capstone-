<?php
// delete_scan.php - Delete a scan record and its image file
// Both the web and mobile apps call this endpoint to keep scan history in sync.
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

$scan_id      = isset($_POST['scan_id'])      ? intval($_POST['scan_id'])      : 0;
$doctor_email = isset($_POST['doctor_email']) ? trim($_POST['doctor_email'])   : '';

if ($scan_id <= 0 || empty($doctor_email)) {
    echo json_encode(["status" => "error", "message" => "scan_id and doctor_email are required"]);
    exit;
}

// Fetch image_path BEFORE deleting so we can remove the file from disk
$stmt = $conn->prepare("SELECT image_path FROM scans WHERE id = ? AND doctor_email = ?");
$stmt->bind_param("is", $scan_id, $doctor_email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["status" => "error", "message" => "Scan not found or access denied"]);
    $stmt->close();
    $conn->close();
    exit;
}

$row = $result->fetch_assoc();
$image_path = $row['image_path'];
$stmt->close();

// Delete from database
$del = $conn->prepare("DELETE FROM scans WHERE id = ? AND doctor_email = ?");
$del->bind_param("is", $scan_id, $doctor_email);

if ($del->execute() && $del->affected_rows > 0) {
    // Remove the physical image file (relative path stored in DB)
    if (!empty($image_path)) {
        // Strip absolute URL prefix if stored that way
        $relative = preg_replace('#^https?://[^/]+/brainscan_api/#', '', $image_path);
        $file_path = __DIR__ . '/' . ltrim($relative, '/');
        if (file_exists($file_path) && is_file($file_path)) {
            @unlink($file_path);
        }
    }

    // Write notification so other devices see the deletion event
    $notif_stmt = $conn->prepare(
        "INSERT INTO notifications (doctor_email, title, body, type, reference_id)
         VALUES (?, 'Scan Deleted', 'A scan record has been removed.', 'scan_deleted', ?)"
    );
    $ref_id = (string)$scan_id;
    $notif_stmt->bind_param("ss", $doctor_email, $ref_id);
    $notif_stmt->execute();
    $notif_stmt->close();

    echo json_encode(["status" => "success", "message" => "Scan deleted successfully"]);
} else {
    echo json_encode(["status" => "error", "message" => "Failed to delete scan"]);
}

$del->close();
$conn->close();
?>
