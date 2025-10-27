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

if (!$batchId || !$imageNumber) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.missingParams']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

// Fetch batch images from DB
$rows = db_rows('SELECT g.id, g.image_number, u.username AS owner FROM generations g JOIN users u ON u.id=g.user_id WHERE g.deleted=0 AND g.batch_id = ?', [$batchId]);
if (count($rows) < 2) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.batchTooSmall']);
    exit;
}

// Find current main (image_number=1) and target
$currentMain = null;
$target = null;
foreach ($rows as $r) {
    if (intval($r['image_number']) === 1) $currentMain = $r;
    if (strval($r['image_number']) === strval($imageNumber)) $target = $r;
}
if (!$currentMain || !$target) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.imageNotFound']);
    exit;
}
// Permission check
if (!$isAdmin && $currentMain['owner'] !== $currentUser) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.batchMainImage.noPermission']);
    exit;
}

// If target is already 1, nothing to do
if (intval($imageNumber) === 1) {
    echo json_encode(['success' => true]);
    exit;
}

// Three-step swap with a temporary value to avoid UNIQUE constraint violations
try {
    $targetNumber = intval($imageNumber);
    $batchIdParam = $batchId;
    $maxRow = db_row('SELECT COALESCE(MAX(image_number),0) AS m FROM generations WHERE batch_id = ?', [$batchIdParam]);
    $tmpNumber = intval($maxRow['m']) + 100000; // garantiert frei

    db_tx(function () use ($currentMain, $target, $targetNumber, $tmpNumber) {
        // 1) current main -> tmp
        db_exec('UPDATE generations SET image_number = ? WHERE id = ?', [$tmpNumber, $currentMain['id']]);
        // 2) target -> 1
        db_exec('UPDATE generations SET image_number = 1 WHERE id = ?', [$target['id']]);
        // 3) tmp (former main) -> targetNumber
        db_exec('UPDATE generations SET image_number = ? WHERE id = ?', [$targetNumber, $currentMain['id']]);
    });
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.batchMainImage.swapFailed']);
}