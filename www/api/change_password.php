<?php
session_start();
header('Content-Type: application/json');

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/password_validation.php';
require_once IMB_SRC_DIR . '/db.php';

// Check if user is logged in
if (!isset($_SESSION['user'])) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$currentPassword = $data['currentPassword'] ?? '';
$newPassword = $data['newPassword'] ?? '';

if (empty($currentPassword) || empty($newPassword)) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.allFieldsRequired']);
    exit;
}

// Validate new password
$validation = validatePassword($newPassword);
if (!$validation['valid']) {
    http_response_code(400);
    echo json_encode(['error_key' => $validation['error_key']]);
    exit;
}

// Load user data from DB
$username = $_SESSION['user'];
$row = db_row('SELECT password_hash FROM users WHERE username = ?', [$username]);
if ($row === null) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.userDbNotFound']);
    exit;
}

// Verify current password
if (!password_verify($currentPassword, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.currentPasswordIncorrect']);
    exit;
}

// Set new password
db_exec('UPDATE users SET password_hash = ? WHERE username = ?', [
    password_hash($newPassword, PASSWORD_DEFAULT),
    $username
]);
echo json_encode(['success' => true]);