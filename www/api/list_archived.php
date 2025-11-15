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
    
    // Try new DB-based system first
    $refs = db_rows(
        'SELECT ri.file_path, ri.thumb_path 
         FROM batch_references br
         JOIN reference_images ri ON ri.id = br.reference_image_id
         WHERE br.batch_id = ?
         ORDER BY br.position ASC',
        [$safeBatch]
    );
    
    if (!empty($refs)) {
        // DB system is active, use it
        $out = [];
        foreach ($refs as $ref) {
            $out[] = [
                'src' => $ref['file_path'],
                'thumb' => $ref['thumb_path']
            ];
        }
        return $out;
    }
    
    // Fallback to old filesystem-based system for backwards compatibility
    $dir = IMB_IMAGE_DIR . '/refs/' . $safeBatch;
    if (!is_dir($dir)) return [];
    $paths = glob($dir . '/*');
    sort($paths, SORT_NATURAL);
    $out = [];
    foreach ($paths as $p) {
        if (is_file($p)) {
            $basename = basename($p);
            $refPath = 'images/refs/' . $safeBatch . '/' . $basename;
            $thumbPath = 'images/refs/thumbs/' . $safeBatch . '/' . $basename;
            $thumbFullPath = IMB_IMAGE_DIR . '/refs/thumbs/' . $safeBatch . '/' . $basename;
            
            // Use thumbnail if available, otherwise use original
            $displayPath = is_file($thumbFullPath) ? $thumbPath : $refPath;
            
            $out[] = [
                'src' => $refPath,
                'thumb' => $displayPath
            ];
        }
    }
    return $out;
}

$params = [];
$where = 'g.deleted = 0 AND b.archived = 1';
if (!$isAdmin) {
    $where .= ' AND u.username = ?';
    $params[] = $currentUser;
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
    if (!is_file($filePath)) continue;
    
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
        'archived' => '1',
        'refImages' => list_ref_images_arch($r['batch_id'] ?? '', $r['user'], $currentUser, $isAdmin)
    ];
}

echo json_encode($result);
?>


