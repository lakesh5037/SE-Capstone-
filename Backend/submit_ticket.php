<?php
// submit_ticket.php — Create a support ticket, store in DB, send acknowledgment email
require_once 'db.php';
require_once 'config.php';

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "POST required"]);
    exit;
}

// ── Sanitize & validate inputs ────────────────────────────────────────────────────
$email    = isset($_POST['email'])    ? trim($_POST['email'])    : '';
$category = isset($_POST['category']) ? trim($_POST['category']) : '';
$message  = isset($_POST['message'])  ? trim($_POST['message'])  : '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "message" => "Invalid email address."]);
    exit;
}
if (empty($category)) {
    echo json_encode(["status" => "error", "message" => "Category is required."]);
    exit;
}
if (mb_strlen($message) < 20) {
    echo json_encode(["status" => "error", "message" => "Message must be at least 20 characters."]);
    exit;
}
if (mb_strlen($message) > 5000) {
    echo json_encode(["status" => "error", "message" => "Message must be under 5000 characters."]);
    exit;
}

// ── Rate limiting: max 3 tickets per email per hour ───────────────────────────────
$rateStmt = $conn->prepare(
    "SELECT COUNT(*) AS cnt FROM support_tickets
     WHERE doctor_email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
);
$rateStmt->bind_param("s", $email);
$rateStmt->execute();
$rateResult = $rateStmt->get_result()->fetch_assoc();
$rateStmt->close();

if ($rateResult['cnt'] >= 3) {
    echo json_encode([
        "status"  => "error",
        "message" => "Rate limit reached. Maximum 3 tickets per hour. Please try again later."
    ]);
    exit;
}

// ── Generate unique ticket number ─────────────────────────────────────────────────
$ticketNum = 'HST-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));

// ── Insert ticket ──────────────────────────────────────────────────────────────────
$platform = isset($_POST['platform']) ? trim($_POST['platform']) : 'unknown'; // 'android' or 'web'
$device   = isset($_POST['device'])   ? trim($_POST['device'])   : '';

$stmt = $conn->prepare(
    "INSERT INTO support_tickets
     (ticket_number, doctor_email, category, message, platform, device_info, status, priority)
     VALUES (?, ?, ?, ?, ?, ?, 'open', 'medium')"
);
$stmt->bind_param("ssssss", $ticketNum, $email, $category, $message, $platform, $device);

if (!$stmt->execute()) {
    echo json_encode(["status" => "error", "message" => "Failed to save ticket. Please try again."]);
    $stmt->close();
    $conn->close();
    exit;
}
$stmt->close();

// ── Send acknowledgment email via PHPMailer ────────────────────────────────────────
$emailSent = false;
try {
    // ── 1. Send acknowledgment to user ──────────────────────────────────────────
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USERNAME;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;
    // Bypass local certificate verification (dev/XAMPP environment)
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ]
    ];
    $mail->SMTPDebug = 0;

    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addAddress($email);
    $mail->addReplyTo(SMTP_FROM, SMTP_FROM_NAME);

    $mail->Subject = "[HemoScan Support] Ticket #{$ticketNum} Received";
    $mail->isHTML(true);
    $mail->Body = "
    <div style='font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 32px; border-radius: 12px;'>
      <div style='background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 24px;'>
        <h1 style='color: white; margin: 0; font-size: 24px;'>🧠 HemoScan Support</h1>
        <p style='color: rgba(255,255,255,0.85); margin: 8px 0 0;'>We received your support request</p>
      </div>
      <div style='background: white; padding: 24px; border-radius: 8px; margin-bottom: 16px;'>
        <h2 style='margin: 0 0 16px; color: #1e293b;'>Ticket Confirmed ✅</h2>
        <table style='width: 100%; border-collapse: collapse;'>
          <tr><td style='padding: 8px 0; color: #64748b; width: 140px;'>Ticket Number</td><td style='padding: 8px 0; font-weight: 600; color: #0ea5e9;'>#{$ticketNum}</td></tr>
          <tr><td style='padding: 8px 0; color: #64748b;'>Category</td><td style='padding: 8px 0; color: #1e293b;'>{$category}</td></tr>
          <tr><td style='padding: 8px 0; color: #64748b;'>Status</td><td style='padding: 8px 0;'><span style='background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-size: 13px;'>Open</span></td></tr>
        </table>
      </div>
      <div style='background: white; padding: 24px; border-radius: 8px; margin-bottom: 16px;'>
        <h3 style='margin: 0 0 12px; color: #1e293b; font-size: 16px;'>Your Message</h3>
        <p style='color: #475569; line-height: 1.6; margin: 0;'>" . nl2br(htmlspecialchars($message)) . "</p>
      </div>
      <p style='color: #64748b; font-size: 14px; text-align: center; margin: 0;'>
        Our team will respond to <strong>{$email}</strong> within <strong>24–48 business hours</strong>.<br>
        Keep your ticket number <strong>#{$ticketNum}</strong> for reference.
      </p>
    </div>";
    $mail->AltBody = "HemoScan Support - Ticket #{$ticketNum} received.\nCategory: {$category}\nMessage: {$message}\n\nWe will respond within 24-48 business hours.";

    $mail->send();
    $emailSent = true;

    // ── 2. Notify support team about the new ticket ──────────────────────────────
    $supportMail = new PHPMailer(true);
    $supportMail->isSMTP();
    $supportMail->Host       = SMTP_HOST;
    $supportMail->SMTPAuth   = true;
    $supportMail->Username   = SMTP_USERNAME;
    $supportMail->Password   = SMTP_PASSWORD;
    $supportMail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $supportMail->Port       = SMTP_PORT;
    $supportMail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => false,
            'verify_peer_name'  => false,
            'allow_self_signed' => true,
        ]
    ];
    $supportMail->SMTPDebug = 0;

    $supportMail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $supportMail->addAddress(SMTP_FROM);   // Support team receives at the same Gmail
    $supportMail->addReplyTo($email, $email); // Team can reply directly to user

    $supportMail->Subject = "[HemoScan] New Support Ticket #{$ticketNum} — {$category}";
    $supportMail->isHTML(true);
    $supportMail->Body = "
    <div style='font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;'>
      <h2 style='color: #1e293b; margin: 0 0 16px;'>📬 New Support Ticket</h2>
      <table style='width: 100%; border-collapse: collapse; font-size: 14px;'>
        <tr style='background: #f8fafc;'><td style='padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;'>Ticket Number</td><td style='padding: 10px; border: 1px solid #e2e8f0; color: #0ea5e9; font-weight: 700;'>#{$ticketNum}</td></tr>
        <tr><td style='padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;'>From</td><td style='padding: 10px; border: 1px solid #e2e8f0;'>{$email}</td></tr>
        <tr style='background: #f8fafc;'><td style='padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;'>Category</td><td style='padding: 10px; border: 1px solid #e2e8f0;'>{$category}</td></tr>
        <tr><td style='padding: 10px; border: 1px solid #e2e8f0; font-weight: 600;'>Platform</td><td style='padding: 10px; border: 1px solid #e2e8f0;'>{$platform}</td></tr>
        <tr style='background: #f8fafc;'><td style='padding: 10px; border: 1px solid #e2e8f0; font-weight: 600; vertical-align: top;'>Message</td><td style='padding: 10px; border: 1px solid #e2e8f0; line-height: 1.6;'>" . nl2br(htmlspecialchars($message)) . "</td></tr>
      </table>
      <p style='margin: 16px 0 0; font-size: 13px; color: #64748b;'>Reply directly to this email to respond to the user at <strong>{$email}</strong>.</p>
    </div>";
    $supportMail->AltBody = "New Support Ticket #{$ticketNum}\nFrom: {$email}\nCategory: {$category}\n\nMessage:\n{$message}";

    $supportMail->send();

} catch (Exception $e) {
    // Email failure is non-fatal — ticket is already stored in DB
    error_log("HemoScan ticket email failed for {$ticketNum}: " . $e->getMessage());
}

echo json_encode([
    "status"        => "success",
    "message"       => "Your support ticket has been submitted successfully.",
    "ticket_number" => $ticketNum,
    "email_sent"    => $emailSent
]);

$conn->close();
?>
