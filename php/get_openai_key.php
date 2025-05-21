<?php
session_start();
header('Content-Type: application/json');

// Prüfe ob Admin
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.apiKey.unauthorized']);
    exit;
}

$envFile = __DIR__ . '/../database/.env';
if (!file_exists($envFile)) {
    echo json_encode(['success' => true, 'key' => '']);
    exit;
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES);
$key = '';
foreach ($lines as $line) {
    if (strpos($line, 'OPENAI_KEY=') === 0) {
        $key = substr($line, strlen('OPENAI_KEY='));
        break;
    }
}

echo json_encode(['success' => true, 'key' => $key]); 