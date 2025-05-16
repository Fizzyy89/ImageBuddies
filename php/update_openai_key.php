<?php
session_start();
header('Content-Type: application/json');

// Prüfe ob Admin
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.apiKey.unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!isset($input['key'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.apiKey.noKeyProvided']);
    exit;
}

$newKey = trim($input['key']);
if ($newKey === '') {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.apiKey.keyEmpty']);
    exit;
}

$envFile = __DIR__ . '/../database/.env';
$dbDir = dirname($envFile);
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}
if (!file_exists($envFile)) {
    file_put_contents($envFile, "OPENAI_KEY=YOUR_KEY_HERE\n");
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES);
$found = false;
foreach ($lines as &$line) {
    if (strpos($line, 'OPENAI_KEY=') === 0) {
        $line = 'OPENAI_KEY=' . $newKey;
        $found = true;
    }
}
if (!$found) {
    $lines[] = 'OPENAI_KEY=' . $newKey;
}
if (file_put_contents($envFile, implode(PHP_EOL, $lines)) === false) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.apiKey.writeError']);
    exit;
}
echo json_encode(['success' => true]); 