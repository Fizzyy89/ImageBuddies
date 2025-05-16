<?php
session_start();

// Prüfe ob User eingeloggt und Admin ist
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.deleteImage.adminOnly']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (isset($data['batchId'])) {
    // Lösche gesamte Batch
    $batchId = $data['batchId'];
    $logfile = dirname(__DIR__) . '/database/image_log.csv';
    if (!file_exists($logfile)) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logNotFound']);
        exit;
    }
    $lines = file($logfile, FILE_IGNORE_NEW_LINES);
    $newLines = [];
    $deletedFiles = [];
    foreach ($lines as $line) {
        $columns = str_getcsv($line, ';');
        if (count($columns) >= 9 && $columns[8] === $batchId) {
            // Bilddatei und Thumb löschen
            $basename = $columns[1];
            $imagePath = dirname(__DIR__) . '/images/' . $basename;
            $thumbPath = dirname(__DIR__) . '/images/thumbs/' . $basename;
            if (file_exists($imagePath)) @unlink($imagePath);
            if (file_exists($thumbPath)) @unlink($thumbPath);
            $deletedFiles[] = $basename;
        } else {
            $newLines[] = $line;
        }
    }
    if (!file_put_contents($logfile, implode("\n", $newLines) . "\n")) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logUpdateFailed']);
        exit;
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

// Aktualisiere die CSV-Datei
$logfile = dirname(__DIR__) . '/database/image_log.csv';
if (file_exists($logfile)) {
    $lines = file($logfile, FILE_IGNORE_NEW_LINES);
    $newLines = [];
    foreach ($lines as $line) {
        $columns = str_getcsv($line, ';');
        if (count($columns) >= 2 && $columns[1] !== $basename) {
            $newLines[] = $line;
        }
    }
    if (!file_put_contents($logfile, implode("\n", $newLines) . "\n")) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logUpdateFailed']);
        exit;
    }
}

echo json_encode(['success' => true]);
?> 