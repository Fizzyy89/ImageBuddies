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
$private = !empty($data['private']) ? 1 : 0;
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

// Batch update by batchId
if (!empty($data['batchId'])) {
    $batchId = $data['batchId'];
    if (!$isAdmin) {
        $batch = db_row('SELECT u.username AS owner FROM batches b JOIN users u ON u.id = b.user_id WHERE b.batch_id = ?', [$batchId]);
        if (!$batch) {
            http_response_code(404);
            echo json_encode(['error_key' => 'error.setPrivate.batchNotFound']);
            exit;
        }
        if ($batch['owner'] !== $currentUser) {
            http_response_code(403);
            echo json_encode(['error_key' => 'error.setPrivate.noPermission']);
            exit;
        }
    }
    db_exec('UPDATE batches SET private = ? WHERE batch_id = ?', [$private, $batchId]);
    echo json_encode(['success' => true]);
    exit;
}

// Single update by filename (set privacy for entire batch via image)
$filename = $data['filename'] ?? '';
if ($filename === '') {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.setPrivate.noFilename']);
    exit;
}

$row = db_row('SELECT g.batch_id, u.username AS owner FROM generations g JOIN batches b ON b.batch_id = g.batch_id JOIN users u ON u.id = b.user_id WHERE g.filename = ?', [$filename]);
if ($row === null) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.setPrivate.imageNotFound']);
    exit;
}
if (!$isAdmin && $row['owner'] !== $currentUser) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.setPrivate.noPermission']);
    exit;
}

db_exec('UPDATE batches SET private = ? WHERE batch_id = ?', [$private, $row['batch_id']]);
echo json_encode(['success' => true]);
?>