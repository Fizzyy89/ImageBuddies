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

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$archived = !empty($data['archived']) ? 1 : 0;
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

// Batch update by batchId
if (!empty($data['batchId'])) {
    $batchId = $data['batchId'];
    if (!$isAdmin) {
        $rows = db_rows('SELECT u.username AS owner FROM generations g JOIN users u ON u.id = g.user_id WHERE g.batch_id = ?', [$batchId]);
        if (empty($rows)) {
            http_response_code(404);
            echo json_encode(['error_key' => 'error.archive.batchNotFound']);
            exit;
        }
        foreach ($rows as $r) {
            if ($r['owner'] !== $currentUser) {
                http_response_code(403);
                echo json_encode(['error_key' => 'error.archive.noPermission']);
                exit;
            }
        }
    }
    db_exec('UPDATE generations SET archived = ? WHERE batch_id = ?', [$archived, $batchId]);
    echo json_encode(['success' => true]);
    exit;
}

// Single update by filename
$filename = $data['filename'] ?? '';
if ($filename === '') {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.archive.noFilename']);
    exit;
}
$basename = basename($filename);

$row = db_row('SELECT g.id, u.username AS owner FROM generations g JOIN users u ON u.id = g.user_id WHERE g.filename = ?', [$basename]);
if ($row === null) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.archive.imageNotFound']);
    exit;
}
if (!$isAdmin && $row['owner'] !== $currentUser) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.archive.noPermission']);
    exit;
}

db_exec('UPDATE generations SET archived = ? WHERE id = ?', [$archived, $row['id']]);
echo json_encode(['success' => true]);
?>


