<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

$data = json_decode(file_get_contents('php://input'), true);
$filename = $data['filename'] ?? '';
$private = !empty($data['private']) ? 1 : 0;

// Prüfe Besitz (oder Admin)
$row = db_row('SELECT g.id, u.username AS owner FROM generations g JOIN users u ON u.id = g.user_id WHERE g.filename = ?', [$filename]);
if ($row === null) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.setPrivate.imageNotFound']);
    exit;
}
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
if (!$isAdmin && $row['owner'] !== $_SESSION['user']) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.setPrivate.noPermission']);
    exit;
}

db_exec('UPDATE generations SET private = ? WHERE id = ?', [$private, $row['id']]);
echo json_encode(['success' => true]);
?>