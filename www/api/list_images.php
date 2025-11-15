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
    
    $refs = db_rows(
        'SELECT ri.file_path, ri.thumb_path 
         FROM batch_references br
         JOIN reference_images ri ON ri.id = br.reference_image_id
         WHERE br.batch_id = ?
         ORDER BY br.position ASC',
        [$safeBatch]
    );
    
    $out = [];
    foreach ($refs as $ref) {
        $out[] = [
            'src' => $ref['file_path'],
            'thumb' => $ref['thumb_path']
        ];
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

// Query visible images with batch data
$params = [];
$where = 'g.deleted = 0 AND b.archived = 0';
if (!$isAdmin) {
    // Private images visible to owner only
    if ($isLoggedIn) {
        $where .= ' AND (b.private = 0 OR u.username = ?)';
        $params[] = $currentUser;
    } else {
        $where .= ' AND b.private = 0';
    }
}

$rows = db_rows(
    'SELECT b.batch_id, b.prompt, b.quality, b.aspect_class, b.mode, b.private, b.archived, b.created_at, b.cost_total_cents,
            g.id, g.filename, g.image_number, g.is_main_image, g.width, g.height, g.deleted,
            u.username AS user
     FROM generations g
     JOIN batches b ON b.batch_id = g.batch_id
     JOIN users u ON u.id = b.user_id
     WHERE ' . $where . '
     ORDER BY b.created_at DESC, g.id DESC',
    $params
);

$result = [];
foreach ($rows as $r) {
    $filePath = IMB_IMAGE_DIR . '/' . $r['filename'];
    if (!is_file($filePath)) {
        // File missing but row remains in DB; skip for display
        continue;
    }
    
    // Count ref images for this batch
    $refCount = db_row('SELECT COUNT(*) as cnt FROM batch_references WHERE batch_id = ?', [$r['batch_id']]);
    $refImageCount = $refCount ? $refCount['cnt'] : 0;
    
    $result[] = [
        'file' => 'images/' . $r['filename'],
        'timestamp' => $r['created_at'],
        'prompt' => $r['prompt'],
        'user' => $r['user'],
        'aspect_class' => $r['aspect_class'],
        'quality' => $r['quality'],
        'private' => (string)($r['private'] ? '1' : '0'),
        'ref_image_count' => (string)$refImageCount,
        'batchId' => $r['batch_id'] ?? '',
        'imageNumber' => (string)($r['image_number'] ?? 1),
        'isMainImage' => (string)($r['is_main_image'] ?? 0),
        'refImages' => list_ref_images($r['batch_id'] ?? '', $r['user'], $currentUser, $isAdmin)
    ];
}

header('Content-Type: application/json');
echo json_encode($result);