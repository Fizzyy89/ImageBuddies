<?php
session_start();
$isLoggedIn = isset($_SESSION['user']);
$currentUser = $isLoggedIn ? $_SESSION['user'] : '';
$isAdmin = $isLoggedIn && isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

require_once __DIR__ . '/db.php';

function sanitize_batch_id($batchId) {
    return preg_replace('/[^a-zA-Z0-9_\-]/', '', $batchId);
}

function list_ref_images($batchId, $owner, $currentUser, $isAdmin) {
    if (!$batchId || (!$isAdmin && $owner !== $currentUser)) return [];
    $safeBatch = sanitize_batch_id($batchId);
    $dir = dirname(__DIR__) . '/images/refs/' . $safeBatch;
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

// View-only Flag aus DB lesen
$viewOnlyAllowed = false;
$row = db_row('SELECT value FROM settings WHERE key = ?', ['customization']);
if ($row) {
    $cfg = json_decode($row['value'], true);
    $viewOnlyAllowed = isset($cfg['viewOnlyAllowed']) && $cfg['viewOnlyAllowed'];
}

if (!$isLoggedIn && (!isset($_SERVER['HTTP_X_VIEW_ONLY']) || !$viewOnlyAllowed)) {
    http_response_code(401);
    echo json_encode(['error' => 'Nicht eingeloggt.']);
    exit;
}

// Query sichtbare Bilder
$params = [];
$where = 'g.deleted = 0';
if (!$isAdmin) {
    // private Bilder nur für Owner sichtbar
    if ($isLoggedIn) {
        $where .= ' AND (g.private = 0 OR u.username = ?)';
        $params[] = $currentUser;
    } else {
        $where .= ' AND g.private = 0';
    }
}

$rows = db_rows(
    'SELECT g.created_at, g.filename, g.prompt, g.size, g.quality, g.private, g.ref_image_count, g.batch_id, g.image_number, u.username AS user
     FROM generations g
     JOIN users u ON u.id = g.user_id
     WHERE ' . $where . '
     ORDER BY g.created_at DESC, g.id DESC',
    $params
);

$result = [];
foreach ($rows as $r) {
    $filePath = dirname(__DIR__) . '/images/' . $r['filename'];
    if (!is_file($filePath)) {
        // Datei fehlt, aber Eintrag bleibt in DB. Überspringen für Anzeige.
        continue;
    }
    $result[] = [
        'file' => 'images/' . $r['filename'],
        'timestamp' => $r['created_at'],
        'prompt' => $r['prompt'],
        'user' => $r['user'],
        'size' => $r['size'],
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