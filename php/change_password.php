<?php
session_start();
header('Content-Type: application/json');

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

// Lade Benutzerdaten
$jsonPath = __DIR__ . '/../database/users.json';
if (!file_exists($jsonPath)) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.userDbNotFound']);
    exit;
}

$users = json_decode(file_get_contents($jsonPath), true);
$username = $_SESSION['user'];

// Prüfe ob aktuelles Passwort korrekt ist
if (!password_verify($currentPassword, $users[$username]['password'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.currentPasswordIncorrect']);
    exit;
}

// Setze neues Passwort
$users[$username]['password'] = password_hash($newPassword, PASSWORD_DEFAULT);

// Speichere Änderungen
file_put_contents($jsonPath, json_encode($users, JSON_PRETTY_PRINT));
echo json_encode(['success' => true]); 