<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

$input = json_decode(file_get_contents('php://input'), true);
$batchId = $input['batchId'] ?? '';
$imageNumber = $input['imageNumber'] ?? '';
$filenameInput = isset($input['filename']) ? basename((string)$input['filename']) : null;

if (!$batchId || ($imageNumber === '' && $filenameInput === null)) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.missingParams']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

// Fetch batch owner from batches table
$batchRow = db_row('SELECT b.user_id, u.username AS owner FROM batches b JOIN users u ON u.id = b.user_id WHERE b.batch_id = ?', [$batchId]);
if (!$batchRow) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.batchMainImage.batchNotFound']);
    exit;
}
$batchOwner = $batchRow['owner'];

// Fetch batch images from DB
$rows = db_rows('SELECT g.id, g.image_number, g.is_main_image, g.filename FROM generations g WHERE g.deleted=0 AND g.batch_id = ?', [$batchId]);
if (count($rows) < 2) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.batchTooSmall']);
    exit;
}

// Permission check (do this early)
if (!$isAdmin && $batchOwner !== $currentUser) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.batchMainImage.noPermission']);
    exit;
}

// Find current main and target
$currentMain = null;
$target = null;
foreach ($rows as $r) {
    if (intval($r['is_main_image']) === 1) {
        $currentMain = $r;
    }
    if ($target === null) {
        if ($filenameInput !== null && isset($r['filename']) && $r['filename'] === $filenameInput) {
            $target = $r;
        } elseif (strval($r['image_number']) === strval($imageNumber)) {
            $target = $r;
        }
    }
}
if (!$currentMain || !$target) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.imageNotFound']);
    exit;
}

// If target is already main, nothing to do
if (intval($target['is_main_image']) === 1) {
    echo json_encode(['success' => true]);
    exit;
}

try {
    db_tx(function () use ($batchId, $target) {
        db_exec('UPDATE generations SET is_main_image = 0 WHERE batch_id = ?', [$batchId]);
        db_exec('UPDATE generations SET is_main_image = 1 WHERE id = ?', [$target['id']]);
    });
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.batchMainImage.swapFailed']);
}