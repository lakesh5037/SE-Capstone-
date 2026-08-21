<?php
/**
 * HemoScan Comprehensive Backend Test Suite
 * Tests all endpoints with expected responses and error cases
 */
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'db.php';

$results = [];
$pass = 0;
$fail = 0;

function check($name, $actual, $expectedKey, $expectedValue = null) {
    global $results, $pass, $fail;
    $decoded = json_decode($actual, true);
    $ok = false;
    if ($decoded !== null) {
        if ($expectedValue === null) {
            $ok = isset($decoded[$expectedKey]);
        } else {
            $ok = isset($decoded[$expectedKey]) && $decoded[$expectedKey] === $expectedValue;
        }
    }
    if ($ok) { $pass++; $status = 'PASS'; }
    else      { $fail++; $status = 'FAIL'; }
    $results[] = "[$status] $name => " . substr(trim($actual ?? 'null'), 0, 120);
}

function callEndpoint($endpoint, $method = 'GET', $data = []) {
    $url = 'http://localhost/brainscan_api/' . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['body' => $response, 'code' => $httpCode];
}

// ─── T1: login.php — Valid login attempt with known user ─────────────────────
$r = callEndpoint('login.php', 'POST', ['email' => 'lakeshlakesh526262@gmail.com', 'password' => 'wrongpassword123']);
check('T1 login.php — Wrong password returns error', $r['body'], 'status', 'error');

// ─── T2: login.php — Empty fields ─────────────────────────────────────────────
$r = callEndpoint('login.php', 'POST', []);
check('T2 login.php — Empty fields returns error', $r['body'], 'status', 'error');

// ─── T3: login.php — GET method rejected ─────────────────────────────────────
$r = callEndpoint('login.php', 'GET');
check('T3 login.php — GET method rejected', $r['body'], 'status', 'error');

// ─── T4: signup.php — Missing fields ─────────────────────────────────────────
$r = callEndpoint('signup.php', 'POST', ['email' => 'x@x.com']);
check('T4 signup.php — Missing fields returns error', $r['body'], 'status', 'error');

// ─── T5: send_otp.php — Missing email ─────────────────────────────────────────
$r = callEndpoint('send_otp.php', 'POST', ['action' => 'signup']);
check('T5 send_otp.php — Missing email returns error', $r['body'], 'status', 'error');

// ─── T6: send_otp.php — Invalid email format ──────────────────────────────────
$r = callEndpoint('send_otp.php', 'POST', ['email' => 'notanemail', 'action' => 'signup']);
check('T6 send_otp.php — Invalid email returns error', $r['body'], 'status', 'error');

// ─── T7: verify_otp.php — Wrong OTP code ─────────────────────────────────────
$r = callEndpoint('verify_otp.php', 'POST', ['email' => 'test@test.com', 'otp_code' => '000000', 'action' => 'signup']);
check('T7 verify_otp.php — Wrong OTP returns error', $r['body'], 'status', 'error');

// ─── T8: get_scans.php — Query without email (returns all scans) ───────────────
$r = callEndpoint('get_scans.php');
check('T8 get_scans.php — Query without email returns all scans', $r['body'], 'status', 'success');

// ─── T9: get_scans.php — Valid email (real user) ─────────────────────────────
$r = callEndpoint('get_scans.php?email=lakeshlakesh526262@gmail.com');
check('T9 get_scans.php — Valid email returns status', $r['body'], 'status');

// ─── T10: get_dashboard.php — Valid email ────────────────────────────────────
$r = callEndpoint('get_dashboard.php?email=lakeshlakesh526262@gmail.com');
check('T10 get_dashboard.php — Returns status key', $r['body'], 'status');

// ─── T11: get_tickets.php — Valid email ──────────────────────────────────────
$r = callEndpoint('get_tickets.php?email=lakeshlakesh526262@gmail.com');
check('T11 get_tickets.php — Returns status key', $r['body'], 'status');

// ─── T12: get_notifications.php — Valid email ────────────────────────────────
$r = callEndpoint('get_notifications.php?email=lakeshlakesh526262@gmail.com');
check('T12 get_notifications.php — Returns status key', $r['body'], 'status');

// ─── T13: change_password.php — Missing fields ───────────────────────────────
$r = callEndpoint('change_password.php', 'POST', ['email' => '']);
check('T13 change_password.php — Missing fields returns error', $r['body'], 'status', 'error');

// ─── T14: delete_scan.php — Missing fields ───────────────────────────────────
$r = callEndpoint('delete_scan.php', 'POST', []);
check('T14 delete_scan.php — Missing fields returns error', $r['body'], 'status', 'error');

// ─── T15: upload_scan.php — No image ─────────────────────────────────────────
$r = callEndpoint('upload_scan.php', 'POST', ['doctor_email' => 'test@test.com', 'patient_id' => '1', 'patient_name' => 'Test', 'result' => 'Normal', 'risk_level' => 'LOW']);
check('T15 upload_scan.php — No image returns error', $r['body'], 'status', 'error');

// ─── T16: analyze.php — No image ─────────────────────────────────────────────
$r = callEndpoint('analyze.php', 'POST', []);
check('T16 analyze.php — No image returns error', $r['body'], 'error');

// ─── T17: reset_password.php — Missing fields ────────────────────────────────
$r = callEndpoint('reset_password.php', 'POST', []);
check('T17 reset_password.php — Missing fields returns error', $r['body'], 'status', 'error');

// ─── T18: check_user.php — Existing user check ───────────────────────────────
$r = callEndpoint('check_user.php?email=lakeshlakesh526262@gmail.com');
$d = json_decode($r['body'], true);
$ok = isset($d['status']) && in_array($d['status'], ['exists', 'not_found', 'success', 'error']);
if ($ok) { $pass++; $results[] = "[PASS] T18 check_user.php — Returns valid status: " . ($d['status'] ?? '?'); }
else     { $fail++; $results[] = "[FAIL] T18 check_user.php — Unexpected: " . substr($r['body'], 0, 100); }

// ─── T19: send_otp.php — LIVE email test (existing working credentials) ───────
$r = callEndpoint('send_otp.php', 'POST', ['email' => 'lakeshlakesh526262@gmail.com', 'action' => 'signup']);
check('T19 send_otp.php — Live email delivery returns success', $r['body'], 'status', 'success');

// ─── T20: DB connectivity — direct SQL query ──────────────────────────────────
$res = $conn->query("SELECT COUNT(*) as cnt FROM doctors");
$row = $res ? $res->fetch_assoc() : null;
if ($row !== null) { $pass++; $results[] = "[PASS] T20 DB doctors table — Contains " . $row['cnt'] . " registered doctors"; }
else               { $fail++; $results[] = "[FAIL] T20 DB doctors table — Query failed: " . $conn->error; }

// ─── T21: DB otp_verifications table ─────────────────────────────────────────
$res = $conn->query("SELECT COUNT(*) as cnt FROM otp_verifications");
$row = $res ? $res->fetch_assoc() : null;
if ($row !== null) { $pass++; $results[] = "[PASS] T21 DB otp_verifications — Contains " . $row['cnt'] . " rows"; }
else               { $fail++; $results[] = "[FAIL] T21 DB otp_verifications — Query failed: " . $conn->error; }

// ─── T22: DB scans table ─────────────────────────────────────────────────────
$res = $conn->query("SELECT COUNT(*) as cnt FROM scans");
$row = $res ? $res->fetch_assoc() : null;
if ($row !== null) { $pass++; $results[] = "[PASS] T22 DB scans table — Contains " . $row['cnt'] . " rows"; }
else               { $fail++; $results[] = "[FAIL] T22 DB scans table — Query failed: " . $conn->error; }

// ─── T23: DB support_tickets table ───────────────────────────────────────────
$res = $conn->query("SELECT COUNT(*) as cnt FROM support_tickets");
$row = $res ? $res->fetch_assoc() : null;
if ($row !== null) { $pass++; $results[] = "[PASS] T23 DB support_tickets — Contains " . $row['cnt'] . " rows"; }
else               { $fail++; $results[] = "[FAIL] T23 DB support_tickets — Query failed: " . $conn->error; }

// ─── T24: DB notifications table ─────────────────────────────────────────────
$res = $conn->query("SELECT COUNT(*) as cnt FROM notifications");
$row = $res ? $res->fetch_assoc() : null;
if ($row !== null) { $pass++; $results[] = "[PASS] T24 DB notifications — Contains " . $row['cnt'] . " rows"; }
else               { $fail++; $results[] = "[FAIL] T24 DB notifications — Query failed: " . $conn->error; }

// ─── T25: submit_ticket.php — Valid submission with unique email ─────────────
$r = callEndpoint('submit_ticket.php', 'POST', [
    'email'    => 'audit_ticket_' . time() . '@gmail.com',
    'category' => 'Technical Issue',
    'message'  => 'This is an automated audit test ticket to verify ticket submission is working correctly.',
    'platform' => 'audit',
    'device'   => 'HemoScan Audit Script v1.0',
]);
check('T25 submit_ticket.php — Valid ticket submission returns success', $r['body'], 'status', 'success');

// ─── T26: AI model files exist ───────────────────────────────────────────────
$models = [
    'models/brain_ct_classifier.tflite',
    'models/hemorrhage_detector.tflite',
    'models/Hemorrhage.tflite',
];
foreach ($models as $m) {
    if (file_exists(__DIR__ . '/' . $m)) {
        $size = round(filesize(__DIR__ . '/' . $m) / 1024 / 1024, 2);
        $pass++;
        $results[] = "[PASS] T26 AI model: $m exists ({$size} MB)";
    } else {
        $fail++;
        $results[] = "[FAIL] T26 AI model: $m NOT FOUND";
    }
}

// ─── T27: Python available ───────────────────────────────────────────────────
exec('python --version 2>&1', $pyOut, $pyCode);
if ($pyCode === 0) {
    $pass++;
    $results[] = "[PASS] T27 Python available: " . trim(implode(' ', $pyOut));
} else {
    $fail++;
    $results[] = "[FAIL] T27 Python not found: " . implode(' ', $pyOut);
}

// ─── T28: inference.py syntax check ──────────────────────────────────────────
exec('python -m py_compile inference.py 2>&1', $pyOut2, $pyCode2);
if ($pyCode2 === 0) {
    $pass++;
    $results[] = "[PASS] T28 inference.py — No Python syntax errors";
} else {
    $fail++;
    $results[] = "[FAIL] T28 inference.py — Syntax error: " . implode(' ', $pyOut2);
}

// ─── T29: delete_account.php — Missing email ─────────────────────────────────
$r = callEndpoint('delete_account.php', 'POST', []);
check('T29 delete_account.php — Missing email returns error', $r['body'], 'status', 'error');

// ─── T30: Security — SQL injection probe on login ─────────────────────────────
$r = callEndpoint('login.php', 'POST', ['email' => "admin' OR 1=1 --", 'password' => 'anything']);
check('T30 Security — SQL injection probe returns error (not success)', $r['body'], 'status', 'error');

// Print summary
echo "\n\n=== HEMOSCAN BACKEND TEST SUITE ===\n";
echo "Passed: $pass | Failed: $fail | Total: " . ($pass + $fail) . "\n";
echo str_repeat("=", 60) . "\n";
foreach ($results as $r) echo $r . "\n";
echo str_repeat("=", 60) . "\n";
$conn->close();
?>
