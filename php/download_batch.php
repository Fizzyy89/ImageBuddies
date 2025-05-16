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

// Lese das Logfile, um alle Bilder der Batch zu finden
$logfile = dirname(__DIR__) . '/database/image_log.csv';
if (!file_exists($logfile)) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.downloadBatch.logNotFound']);
    exit;
}

$lines = file($logfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$batchImages = [];
$prompt = '';

foreach ($lines as $line) {
    $parts = explode(';', $line);
    if (isset($parts[8]) && $parts[8] === $batchId) {
        $filename = $parts[1];
        $prompt = $parts[2] ?? '';  // Speichere den Prompt für den ZIP-Namen
        $batchImages[] = $filename;
    }
}

if (empty($batchImages)) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.downloadBatch.noImagesInBatch']);
    exit;
}

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