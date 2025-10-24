<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/password_validation.php';
require_once __DIR__ . '/db.php';

// Prüfe ob User eingeloggt ist
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

// Validiere das neue Passwort
$validation = validatePassword($newPassword);
if (!$validation['valid']) {
    http_response_code(400);
    echo json_encode(['error_key' => $validation['error_key']]);
    exit;
}

// Lade Benutzerdaten aus DB
$username = $_SESSION['user'];
$row = db_row('SELECT password_hash FROM users WHERE username = ?', [$username]);
if ($row === null) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.userDbNotFound']);
    exit;
}

// Prüfe ob aktuelles Passwort korrekt ist
if (!password_verify($currentPassword, $row['password_hash'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.currentPasswordIncorrect']);
    exit;
}

// Setze neues Passwort
db_exec('UPDATE users SET password_hash = ? WHERE username = ?', [
    password_hash($newPassword, PASSWORD_DEFAULT),
    $username
]);
echo json_encode(['success' => true]);