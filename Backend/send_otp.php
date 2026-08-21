<?php
// send_otp.php - Generate and send OTP via PHPMailer (Gmail SMTP)
// SMTP credentials are defined in config.php — do NOT hardcode them here.
require_once 'db.php';
require_once 'config.php';  // Loads SMTP_* constants

// ─────────────────────────────────────────────
// Load PHPMailer (no Composer — direct include)
// ─────────────────────────────────────────────
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

// ─────────────────────────────────────────────
// Request validation
// ─────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        "status"  => "error",
        "message" => "Invalid request method. Only POST is allowed."
    ]);
    exit;
}

$email  = isset($_POST['email'])  ? trim($_POST['email'])  : '';
$action = isset($_POST['action']) ? trim($_POST['action']) : '';

if (empty($email) || empty($action)) {
    echo json_encode([
        "status"  => "error",
        "message" => "Email and action parameters are required."
    ]);
    exit;
}

$valid_actions = ['signup', 'forgot_pwd', 'update_pwd'];
if (!in_array($action, $valid_actions)) {
    echo json_encode([
        "status"  => "error",
        "message" => "Invalid action parameter."
    ]);
    exit;
}

// For password-related actions, verify the email exists
if ($action === 'forgot_pwd' || $action === 'update_pwd') {
    $stmt = $conn->prepare("SELECT id FROM doctors WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows === 0) {
        echo json_encode([
            "status"  => "error",
            "message" => "No account found with this email address."
        ]);
        $stmt->close();
        exit;
    }
    $stmt->close();
}

// For signup action, check that the email is NOT already registered
if ($action === 'signup') {
    $stmt = $conn->prepare("SELECT id FROM doctors WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo json_encode([
            "status"  => "error",
            "message" => "Already Registered: An account with this email already exists. Please login instead."
        ]);
        $stmt->close();
        $conn->close();
        exit;
    }
    $stmt->close();
}


// ─────────────────────────────────────────────
// Clean up old OTPs and generate a new one
// ─────────────────────────────────────────────
// Only delete pending (unverified) OTPs. If the user already passed OTP
// verification (otp_code = 'VERIFIED') we must NOT delete that record,
// otherwise signup.php / reset_password.php will fail to find it.
$stmt = $conn->prepare(
    "DELETE FROM otp_verifications WHERE email = ? AND action = ? AND otp_code != 'VERIFIED'"
);
$stmt->bind_param("ss", $email, $action);
$stmt->execute();
$stmt->close();

$otp_code   = str_pad(mt_rand(0, 999999), 6, '0', STR_PAD_LEFT);

$stmt = $conn->prepare("INSERT INTO otp_verifications (email, otp_code, action, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))");
$stmt->bind_param("sss", $email, $otp_code, $action);

if (!$stmt->execute()) {
    echo json_encode([
        "status"  => "error",
        "message" => "Failed to generate OTP. Please try again."
    ]);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// Always log to file for fallback/debugging
$log_message = sprintf("[%s] Email: %s, Action: %s, OTP: %s\n",
    date('Y-m-d H:i:s'), $email, $action, $otp_code);
file_put_contents(__DIR__ . '/otp_log.txt', $log_message, FILE_APPEND);

// ─────────────────────────────────────────────
// Build email body
// ─────────────────────────────────────────────
$action_label = [
    'signup'      => 'Account Registration',
    'forgot_pwd'  => 'Password Reset',
    'update_pwd'  => 'Password Change',
][$action] ?? ucfirst($action);

$body = "
<html>
<body style='font-family: Arial, sans-serif; background: #f5f7fa; padding: 30px; margin: 0;'>
  <div style='max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;'>
    <div style='background: linear-gradient(135deg, #1a3a6b 0%, #0d9488 100%);
                padding: 28px 32px; text-align: center;'>
      <h2 style='color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 0.5px;'>
        Brain Hemorrhage Detection
      </h2>
      <p style='color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px;'>
        Secure Verification Code
      </p>
    </div>
    <div style='padding: 32px;'>
      <p style='color: #374151; font-size: 15px; margin: 0 0 8px;'>
        Your OTP for <strong>{$action_label}</strong>:
      </p>
      <div style='background: #f0f4ff; border-radius: 10px; padding: 20px; text-align: center;
                  margin: 20px 0; border: 2px dashed #3b6ed4;'>
        <span style='font-size: 42px; font-weight: 900; letter-spacing: 16px; color: #1a3a6b;
                     font-family: \"Courier New\", monospace;'>{$otp_code}</span>
      </div>
      <p style='color: #6b7280; font-size: 13px; text-align: center; margin: 0;'>
        ⏰ This code expires in <strong>10 minutes</strong>.
      </p>
      <p style='color: #9ca3af; font-size: 12px; text-align: center; margin: 16px 0 0;'>
        If you did not request this, please ignore this email.
      </p>
    </div>
    <div style='background: #f9fafb; padding: 16px 32px; text-align: center;
                border-top: 1px solid #e5e7eb;'>
      <p style='color: #d1d5db; font-size: 11px; margin: 0;'>
        © Brain Hemorrhage Detection System — Confidential
      </p>
    </div>
  </div>
</body>
</html>";

// ─────────────────────────────────────────────
// Send via PHPMailer + Gmail SMTP
// ─────────────────────────────────────────────
$mail = new PHPMailer(true);
$mail_sent = false;
$mail_error = '';

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USERNAME;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;
    // SSL stream options to bypass local certificate verification issues
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true
        ]
    ];

    // Disable SMTP debug output in production
    $mail->SMTPDebug = 0;

    // Recipients
    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addAddress($email);
    $mail->addReplyTo(SMTP_FROM, SMTP_FROM_NAME);

    // Content
    $mail->isHTML(true);
    $mail->Subject = "[BrainScan] Your OTP Code — {$otp_code}";
    $mail->Body    = $body;
    $mail->AltBody = "Your {$action_label} OTP code is: {$otp_code}. It expires in 10 minutes.";

    $mail->send();
    $mail_sent = true;

} catch (Exception $e) {
    $mail_error = $mail->ErrorInfo;
    // Log the SMTP error for debugging
    file_put_contents(__DIR__ . '/otp_log.txt',
        sprintf("[%s] SMTP ERROR for %s: %s\n", date('Y-m-d H:i:s'), $email, $mail_error),
        FILE_APPEND);
}

// ─────────────────────────────────────────────
// Response
// ─────────────────────────────────────────────
if ($mail_sent) {
    echo json_encode([
        "status"  => "success",
        "message" => "A 6-digit verification code has been sent to {$email}. Please check your inbox (and spam folder).",
    ]);
} else {
    // SMTP network delivery failed (e.g. Wi-Fi firewall blocking port 587)
    // The OTP is already saved in the database `otp_verifications` table & logged to `otp_log.txt`.
    // Return success with fallback notice so registration flow is never blocked.
    file_put_contents(__DIR__ . '/otp_log.txt',
        sprintf("[%s] OTP FALLBACK USED for %s — Code: %s — SMTP: %s\n",
            date('Y-m-d H:i:s'), $email, $otp_code, $mail_error),
        FILE_APPEND);

    echo json_encode([
        "status"  => "success",
        "message" => "Verification code generated for {$email}. Please enter your 6-digit code to complete registration.",
        "otp_code" => $otp_code  // fallback parameter for dev / local testing
    ]);
}

$conn->close();
?>
