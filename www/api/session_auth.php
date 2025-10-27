<?php
session_start();
header('Content-Type: application/json');

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $user = $data['user'] ?? '';
    $pass = $data['pass'] ?? '';

    // Prüfe Benutzer aus SQLite
    $row = db_row('SELECT id, username, password_hash, role FROM users WHERE username = ?', [$user]);
    if ($row === null) {
        echo json_encode(['success' => false, 'error_key' => 'error.auth.unknownUser']);
        exit;
    }
    if (!password_verify($pass, $row['password_hash'])) {
        echo json_encode(['success' => false, 'error_key' => 'error.auth.incorrectPassword']);
        exit;
    }
    $_SESSION['user'] = $row['username'];
    $_SESSION['role'] = $row['role'];
    echo json_encode(['success' => true, 'role' => $row['role']]);
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