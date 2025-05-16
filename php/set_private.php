<?php
session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}
$data = json_decode(file_get_contents('php://input'), true);
$filename = $data['filename'] ?? '';
$private = $data['private'] ?? '0';

$logfile = dirname(__DIR__) . '/database/image_log.csv';
if (!file_exists($logfile)) {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.setPrivate.logNotFound']);
    exit;
}
$lines = file($logfile, FILE_IGNORE_NEW_LINES);
$newLines = [];
$found = false;
foreach ($lines as $line) {
    $parts = explode(';', $line);
    if (isset($parts[1]) && $parts[1] === $filename) {
        // Nur Besitzer darf ändern
        if ($parts[3] !== $_SESSION['user']) {
            http_response_code(403);
            echo json_encode(['error_key' => 'error.setPrivate.noPermission']);
            exit;
        }
        // Setze das Feld 'private' (Index 6), fülle ggf. fehlende Felder auf
        while (count($parts) < 7) $parts[] = '';
        $parts[6] = $private ? '1' : '0';
        $newLines[] = implode(';', $parts);
        $found = true;
    } else {
        $newLines[] = $line;
    }
}
if ($found) {
    file_put_contents($logfile, implode("\n", $newLines) . "\n");
    echo json_encode(['success' => true]);
} else {
    http_response_code(404);
    echo json_encode(['error_key' => 'error.setPrivate.imageNotFound']);
}
?> 