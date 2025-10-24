<?php
session_start();

// Prüfe ob User eingeloggt ist
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

$data = json_decode(file_get_contents('php://input'), true);
require_once __DIR__ . '/db.php';
if (isset($data['batchId'])) {
    // Lösche gesamte Batch
    $batchId = $data['batchId'];
    // Besitz prüfen
    if (!$isAdmin) {
        $rows = db_rows('SELECT g.id, g.filename, u.username AS owner FROM generations g JOIN users u ON u.id = g.user_id WHERE g.batch_id = ?', [$batchId]);
        if (empty($rows)) {
            http_response_code(404);
            echo json_encode(['error_key' => 'error.deleteImage.logNotFound']);
            exit;
        }
        foreach ($rows as $r) {
            if ($r['owner'] !== $currentUser) {
                http_response_code(403);
                echo json_encode(['error_key' => 'error.deleteImage.noPermission']);
                exit;
            }
        }
    }

    $rows = db_rows('SELECT id, filename FROM generations WHERE batch_id = ?', [$batchId]);
    $deletedFiles = [];
    foreach ($rows as $r) {
        $basename = $r['filename'];
        $imagePath = dirname(__DIR__) . '/images/' . $basename;
        $thumbPath = dirname(__DIR__) . '/images/thumbs/' . $basename;
        if (file_exists($imagePath)) @unlink($imagePath);
        if (file_exists($thumbPath)) @unlink($thumbPath);
        $deletedFiles[] = $basename;
    }
    db_exec('UPDATE generations SET deleted = 1 WHERE batch_id = ?', [$batchId]);
    // Referenz-Ordner der Batch löschen
    $safeBatch = preg_replace('/[^a-zA-Z0-9_\-]/', '', $batchId);
    $refsDir = dirname(__DIR__) . '/images/refs/' . $safeBatch;
    if (is_dir($refsDir)) {
        $entries = scandir($refsDir);
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $p = $refsDir . '/' . $entry;
            if (is_file($p)) @unlink($p);
        }
        @rmdir($refsDir);
    }
    echo json_encode(['success' => true, 'deletedFiles' => $deletedFiles]);
    exit;
}

if (!isset($data['filename'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.deleteImage.noFilename']);
    exit;
}

$filename = $data['filename'];
$basename = basename($filename);

// Sicherheitscheck: Stelle sicher, dass nur Bilder gelöscht werden können
if (!preg_match('/^image_[0-9T\-]+\.png$/', $basename)) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.deleteImage.invalidFilename']);
    exit;
}

// Prüfe Berechtigung: User darf nur eigene Bilder löschen, Admin darf alle löschen
if (!$isAdmin) {
    $row = db_row('SELECT u.username AS owner FROM generations g JOIN users u ON u.id = g.user_id WHERE g.filename = ?', [$basename]);
    if ($row === null || $row['owner'] !== $currentUser) {
        http_response_code(403);
        echo json_encode(['error_key' => 'error.deleteImage.noPermission']);
        exit;
    }
}

// Lösche die Bilddatei
$imagePath = dirname(__DIR__) . '/images/' . $basename;
$thumbPath = dirname(__DIR__) . '/images/thumbs/' . $basename;

$imgOk = true;
$thumbOk = true;

if (file_exists($imagePath) && !unlink($imagePath)) {
    $imgOk = false;
}
if (file_exists($thumbPath) && !unlink($thumbPath)) {
    $thumbOk = false;
}

if (!$imgOk) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.deleteImage.fileDeleteFailed']);
    exit;
}
if (!$thumbOk) {
    // Kein harter Fehler, aber ggf. Hinweis
}

// Markiere als gelöscht in DB
db_exec('UPDATE generations SET deleted = 1 WHERE filename = ?', [$basename]);

echo json_encode(['success' => true]);
?> 