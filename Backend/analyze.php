<?php
/**
 * analyze.php — HemoScan AI Inference Endpoint
 *
 * Accepts: POST multipart/form-data with field 'image' (JPEG/PNG file)
 * Returns: JSON with inference results (same fields as ScanResult on the web frontend)
 *
 * Delegates to inference.py using Python's ai-edge-litert (TFLite) to run
 * the same 3-stage pipeline as the Android app:
 *   Stage 1: brain_ct_classifier.tflite (gatekeeper)
 *   Stage 2: hemorrhage_detector.tflite  (YOLO NMS)
 *   Stage 3: Hemorrhage.tflite           (subtype ODT signature)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle pre-flight CORS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['error' => 'Only POST method is allowed']);
    exit;
}

// ── Validate uploaded image ──────────────────────────────────────────────────
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['error' => 'No image uploaded or upload error: ' . ($_FILES['image']['error'] ?? 'none')]);
    exit;
}

$allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
$mime    = mime_content_type($_FILES['image']['tmp_name']);
if (!in_array(strtolower($mime), $allowed)) {
    echo json_encode(['error' => "Unsupported image type: $mime"]);
    exit;
}

// ── Save image to a temp location ───────────────────────────────────────────
$ext      = 'jpg';
$tmpDir   = sys_get_temp_dir();
$tmpFile  = $tmpDir . DIRECTORY_SEPARATOR . 'hemoscan_' . uniqid() . '.' . $ext;

if (!move_uploaded_file($_FILES['image']['tmp_name'], $tmpFile)) {
    echo json_encode(['error' => 'Failed to save uploaded file to temp directory']);
    exit;
}

// Downscale image to max 1024px to accelerate Python TFLite inference
if (function_exists('imagecreatefromjpeg')) {
    list($width, $height, $type) = @getimagesize($tmpFile);
    if ($width > 1024 || $height > 1024) {
        $src = null;
        if ($type === IMAGETYPE_JPEG) $src = @imagecreatefromjpeg($tmpFile);
        elseif ($type === IMAGETYPE_PNG) $src = @imagecreatefrompng($tmpFile);
        elseif ($type === IMAGETYPE_WEBP) $src = @imagecreatefromwebp($tmpFile);

        if ($src) {
            $ratio  = min(1024 / $width, 1024 / $height);
            $newW   = (int)round($width * $ratio);
            $newH   = (int)round($height * $ratio);
            $dst    = imagecreatetruecolor($newW, $newH);
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $width, $height);
            imagejpeg($dst, $tmpFile, 85);
            imagedestroy($src);
            imagedestroy($dst);
        }
    }
}

// ── Build the Python command ─────────────────────────────────────────────────
$scriptPath = __DIR__ . DIRECTORY_SEPARATOR . 'inference.py';
$scriptPath = escapeshellarg($scriptPath);
$imagePath  = escapeshellarg($tmpFile);

// Try 'python' first, then 'python3'
$pythonCmd = 'python';
exec('python --version 2>&1', $verOut, $verCode);
if ($verCode !== 0) {
    $pythonCmd = 'python3';
}

// Run inference — 2>&1 redirects stderr into output for debugging
$command = "$pythonCmd $scriptPath $imagePath 2>&1";
$output  = [];
$exitCode = 0;
exec($command, $output, $exitCode);

// ── Clean up temp file ───────────────────────────────────────────────────────
@unlink($tmpFile);

// ── Parse result ─────────────────────────────────────────────────────────────
$rawOutput = implode("\n", $output);

// Find the JSON line (last line that starts with '{')
$jsonLine = '';
foreach (array_reverse($output) as $line) {
    $line = trim($line);
    if ($line !== '' && $line[0] === '{') {
        $jsonLine = $line;
        break;
    }
}

if (empty($jsonLine)) {
    echo json_encode([
        'error'       => 'Inference script produced no JSON output',
        'exitCode'    => $exitCode,
        'rawOutput'   => $rawOutput,
        'command'     => "$pythonCmd inference.py <image>",
    ]);
    exit;
}

$result = json_decode($jsonLine, true);
if ($result === null) {
    echo json_encode([
        'error'     => 'Failed to parse inference JSON: ' . json_last_error_msg(),
        'rawOutput' => $rawOutput,
    ]);
    exit;
}

// Forward result to frontend
echo json_encode($result);
?>
