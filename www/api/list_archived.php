<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$currentUser = $_SESSION['user'];
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

function sanitize_batch_id($batchId) {
    return preg_replace('/[^a-zA-Z0-9_\-]/', '', $batchId);
}

function list_ref_images_arch($batchId, $owner, $currentUser, $isAdmin) {
    if (!$batchId || (!$isAdmin && $owner !== $currentUser)) return [];
    $safeBatch = sanitize_batch_id($batchId);
    $dir = IMB_IMAGE_DIR . '/refs/' . $safeBatch;
    if (!is_dir($dir)) return [];
    $paths = glob($dir . '/*');
    sort($paths, SORT_NATURAL);
    $out = [];
    foreach ($paths as $p) {
        if (is_file($p)) {
            $out[] = 'images/refs/' . $safeBatch . '/' . basename($p);
        }
    }
    return $out;
}

$params = [];
$where = 'g.deleted = 0 AND g.archived = 1';
if (!$isAdmin) {
    $where .= ' AND u.username = ?';
    $params[] = $currentUser;
}

$rows = db_rows(
    'SELECT g.created_at, g.filename, g.prompt, g.aspect_class, g.quality, g.private, g.ref_image_count, g.batch_id, g.image_number, g.is_main_image, u.username AS user
     FROM generations g
     JOIN users u ON u.id = g.user_id
     WHERE ' . $where . '
     ORDER BY g.created_at DESC, g.id DESC',
    $params
);

$result = [];
foreach ($rows as $r) {
    $filePath = IMB_IMAGE_DIR . '/' . $r['filename'];
    if (!is_file($filePath)) continue;
    $result[] = [
        'file' => 'images/' . $r['filename'],
        'timestamp' => $r['created_at'],
        'prompt' => $r['prompt'],
        'user' => $r['user'],
        'aspect_class' => $r['aspect_class'],
        'quality' => $r['quality'],
        'private' => (string)($r['private'] ? '1' : '0'),
        'ref_image_count' => (string)($r['ref_image_count']),
        'batchId' => $r['batch_id'] ?? '',
        'imageNumber' => (string)($r['image_number'] ?? 1),
        'isMainImage' => (string)($r['is_main_image'] ?? 0),
        'archived' => '1',
        'refImages' => list_ref_images_arch($r['batch_id'] ?? '', $r['user'], $currentUser, $isAdmin)
    ];
}

echo json_encode($result);
?>


