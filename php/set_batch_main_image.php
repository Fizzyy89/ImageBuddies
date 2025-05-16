<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

$input = json_decode(file_get_contents('php://input'), true);
$batchId = $input['batchId'] ?? '';
$imageNumber = $input['imageNumber'] ?? '';

if (!$batchId || !$imageNumber) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.missingParams']);
    exit;
}

$logfile = dirname(__DIR__) . '/database/image_log.csv';
if (!file_exists($logfile)) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.batchMainImage.logNotFound']);
    exit;
}

$lines = file($logfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$header = null;
$newLines = [];
$batchImages = [];

// 1. Sammle alle Batch-Bilder und ihre Zeilennummern
foreach ($lines as $idx => $line) {
    $parts = explode(';', $line);
    $lineBatchId = $parts[8] ?? '';
    $lineImageNumber = $parts[9] ?? '1';
    if ($lineBatchId === $batchId) {
        $batchImages[] = [
            'idx' => $idx,
            'line' => $line,
            'parts' => $parts,
            'imageNumber' => $lineImageNumber
        ];
    }
}

if (count($batchImages) < 2) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.batchTooSmall']);
    exit;
}

// 2. Finde Bild 1 und das gewünschte Bild
$mainIdx = null;
$targetIdx = null;
$mainUser = null;
foreach ($batchImages as $b) {
    if ($b['imageNumber'] == '1') {
        $mainIdx = $b['idx'];
        $mainUser = $b['parts'][3] ?? '';
    }
    if ($b['imageNumber'] == $imageNumber) {
        $targetIdx = $b['idx'];
    }
}
if ($mainIdx === null || $targetIdx === null) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.batchMainImage.imageNotFound']);
    exit;
}
// 3. Berechtigung prüfen: Nur Owner oder Admin
if (!$isAdmin && $mainUser !== $currentUser) {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.batchMainImage.noPermission']);
    exit;
}
// 4. Tausche imageNumber in den Zeilen
$mainParts = explode(';', $lines[$mainIdx]);
$targetParts = explode(';', $lines[$targetIdx]);
$mainParts[9] = $imageNumber;
$targetParts[9] = '1';
$lines[$mainIdx] = implode(';', $mainParts);
$lines[$targetIdx] = implode(';', $targetParts);
// 5. Schreibe Datei neu
file_put_contents($logfile, implode("\n", $lines) . "\n");
echo json_encode(['success' => true]); 