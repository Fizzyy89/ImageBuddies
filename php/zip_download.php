<?php
session_start();
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

require_once __DIR__ . '/db.php';

// Supports:
// 1) GET ?batchId=... -> zip all images from that batch
// 2) POST JSON { batches: [batchId,...], files: [filename,...] } -> zip combined selection

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function send_zip_and_cleanup($tmp, $name) {
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . filesize($tmp));
    readfile($tmp);
    unlink($tmp);
    exit;
}

if ($method === 'GET') {
    $batchId = $_GET['batchId'] ?? '';
    if (!$batchId) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.downloadBatch.noBatchId']);
        exit;
    }
    $rows = db_rows('SELECT filename, prompt FROM generations WHERE deleted = 0 AND batch_id = ?', [$batchId]);
    if (!$rows || count($rows) === 0) {
        http_response_code(404);
        echo json_encode(['error_key' => 'error.downloadBatch.noImagesInBatch']);
        exit;
    }
    $filenames = array_map(fn($r) => $r['filename'], $rows);
    $prompt = '';
    foreach ($rows as $r) { if (!empty($r['prompt'])) { $prompt = $r['prompt']; break; } }

    $zipname = tempnam(sys_get_temp_dir(), 'zip_');
    $zip = new ZipArchive();
    if ($zip->open($zipname, ZipArchive::CREATE) !== TRUE) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.downloadBatch.zipCreationFailed']);
        exit;
    }
    $imageDir = dirname(__DIR__) . '/images/';
    foreach ($filenames as $f) {
        if (file_exists($imageDir . $f)) {
            $zip->addFile($imageDir . $f, $f);
        }
    }
    $zip->close();

    $cleanPrompt = substr(preg_replace('/[^a-zA-Z0-9_]/', '_', $prompt), 0, 30);
    $downloadName = ($cleanPrompt ?: 'batch') . '_' . count($filenames) . '_images.zip';
    send_zip_and_cleanup($zipname, $downloadName);
}

// POST JSON
$raw = file_get_contents('php://input');
if (strlen($raw) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'No request body']);
    exit;
}
$data = json_decode($raw, true);
$batches = $data['batches'] ?? [];
$files = $data['files'] ?? [];

$allFiles = [];
if (!empty($batches)) {
    $placeholders = implode(',', array_fill(0, count($batches), '?'));
    $rows = db_rows('SELECT filename FROM generations WHERE deleted = 0 AND batch_id IN (' . $placeholders . ')', $batches);
    foreach ($rows as $r) $allFiles[] = $r['filename'];
}
foreach ($files as $f) $allFiles[] = basename($f);
$allFiles = array_values(array_unique($allFiles));
if (empty($allFiles)) {
    http_response_code(400);
    echo json_encode(['error' => 'No files selected']);
    exit;
}

$zipname = tempnam(sys_get_temp_dir(), 'zip_');
$zip = new ZipArchive();
if ($zip->open($zipname, ZipArchive::CREATE) !== TRUE) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.downloadBatch.zipCreationFailed']);
    exit;
}
$imageDir = dirname(__DIR__) . '/images/';
foreach ($allFiles as $f) {
    if (file_exists($imageDir . $f)) {
        $zip->addFile($imageDir . $f, $f);
    }
}
$zip->close();

$downloadName = 'my_images_' . count($allFiles) . '.zip';
send_zip_and_cleanup($zipname, $downloadName);


