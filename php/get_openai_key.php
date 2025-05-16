<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['error' => 'Unauthorized']);
    http_response_code(403);
    exit;
}

$key = '';
$envFile = __DIR__ . '/../database/.env';
$dbDir = dirname($envFile);
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}
if (!file_exists($envFile)) {
    file_put_contents($envFile, "OPENAI_KEY=YOUR_KEY_HERE\n");
}
$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    if (strpos($line, 'OPENAI_KEY=') === 0) {
        $key = substr($line, strlen('OPENAI_KEY='));
        break;
    }
}
echo json_encode(['key' => $key]); 