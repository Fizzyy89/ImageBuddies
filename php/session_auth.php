<?php
session_start();
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $user = $data['user'] ?? '';
    $pass = $data['pass'] ?? '';

    // Lade Benutzerliste aus JSON-Datei
    $jsonPath = __DIR__ . '/../database/users.json';
    if (!file_exists($jsonPath)) {
        die(json_encode(['error_key' => 'error.auth.userDbNotFound']));
    }
    $USERS = json_decode(file_get_contents($jsonPath), true);
    if ($USERS === null) {
        die(json_encode(['error_key' => 'error.auth.userDbReadError']));
    }

    // Prüfe Benutzer
    if (!isset($USERS[$user])) {
        echo json_encode(['success' => false, 'error_key' => 'error.auth.unknownUser']);
        exit;
    }
    if (!password_verify($pass, $USERS[$user]['password'])) {
        echo json_encode(['success' => false, 'error_key' => 'error.auth.incorrectPassword']);
        exit;
    }
    $_SESSION['user'] = $user;
    $_SESSION['role'] = $USERS[$user]['role'];
    echo json_encode(['success' => true, 'role' => $USERS[$user]['role']]);
    exit;
} elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
} elseif ($action === 'status') {
    echo json_encode([
        'logged_in' => isset($_SESSION['user']), 
        'user' => $_SESSION['user'] ?? null,
        'role' => $_SESSION['role'] ?? null
    ]);
    exit;
} else {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.auth.invalidAction']);
    exit;
}

// Helper function to check admin status
function isAdmin() {
    return isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
} 