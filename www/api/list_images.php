<?php
session_start();
$isLoggedIn = isset($_SESSION['user']);
$currentUser = $isLoggedIn ? $_SESSION['user'] : '';
$isAdmin = $isLoggedIn && isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

function sanitize_batch_id($batchId) {
    return preg_replace('/[^a-zA-Z0-9_\-]/', '', $batchId);
}

function list_ref_images($batchId, $owner, $currentUser, $isAdmin) {
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

// Read view-only flag from DB
$viewOnlyAllowed = false;
$row = db_row('SELECT value FROM settings WHERE key = ?', ['customization']);
if ($row) {
    $cfg = json_decode($row['value'], true);
    $viewOnlyAllowed = isset($cfg['viewOnlyAllowed']) && $cfg['viewOnlyAllowed'];
}

if (!$isLoggedIn && (!isset($_SERVER['HTTP_X_VIEW_ONLY']) || !$viewOnlyAllowed)) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in.']);
    exit;
}

// Query visible images
$params = [];
$where = 'g.deleted = 0 AND g.archived = 0';
if (!$isAdmin) {
    // Private images visible to owner only
    if ($isLoggedIn) {
        $where .= ' AND (g.private = 0 OR u.username = ?)';
        $params[] = $currentUser;
    } else {
        $where .= ' AND g.private = 0';
    }
}

$rows = db_rows(
    'SELECT g.created_at, g.filename, g.prompt, g.aspect_class, g.quality, g.private, g.ref_image_count, g.batch_id, g.image_number, u.username AS user
     FROM generations g
     JOIN users u ON u.id = g.user_id
     WHERE ' . $where . '
     ORDER BY g.created_at DESC, g.id DESC',
    $params
);

$result = [];
foreach ($rows as $r) {
    $filePath = IMB_IMAGE_DIR . '/' . $r['filename'];
    if (!is_file($filePath)) {
        // File missing but row remains in DB; skip for display
        continue;
    }
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
        'refImages' => list_ref_images($r['batch_id'] ?? '', $r['user'], $currentUser, $isAdmin)
    ];
}

header('Content-Type: application/json');
echo json_encode($result);