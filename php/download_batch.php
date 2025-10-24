<?php
session_start();
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$batchId = $_GET['batchId'] ?? '';
if (!$batchId) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.downloadBatch.noBatchId']);
    exit;
}

require_once __DIR__ . '/db.php';

// Finde alle nicht gelöschten Bilder der Batch und hole optional einen Prompt für den Dateinamen
$rows = db_rows('SELECT filename, prompt FROM generations WHERE deleted = 0 AND batch_id = ?', [$batchId]);
if (!$rows || count($rows) === 0) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.downloadBatch.noImagesInBatch']);
    exit;
}

$batchImages = array_map(fn($r) => $r['filename'], $rows);
$prompt = '';
foreach ($rows as $r) { if (!empty($r['prompt'])) { $prompt = $r['prompt']; break; } }

// Erstelle temporäre ZIP-Datei
$zipname = tempnam(sys_get_temp_dir(), 'batch_');
$zip = new ZipArchive();
if ($zip->open($zipname, ZipArchive::CREATE) !== TRUE) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.downloadBatch.zipCreationFailed']);
    exit;
}

// Füge alle Bilder der Batch zur ZIP-Datei hinzu
$imageDir = dirname(__DIR__) . '/images/';
foreach ($batchImages as $image) {
    if (file_exists($imageDir . $image)) {
        $zip->addFile($imageDir . $image, $image);
    }
}

$zip->close();

// Erstelle einen sauberen Dateinamen aus dem Prompt
$cleanPrompt = substr(preg_replace('/[^a-zA-Z0-9_]/', '_', $prompt), 0, 30);
$downloadName = $cleanPrompt ? $cleanPrompt : 'batch';
$downloadName .= '_' . count($batchImages) . '_images.zip';

// Sende die ZIP-Datei
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . filesize($zipname));
readfile($zipname);

// Lösche die temporäre ZIP-Datei
unlink($zipname);