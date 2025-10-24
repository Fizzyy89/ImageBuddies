<?php
header('Content-Type: application/json');

// Check if user is logged in and is admin
session_start();
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.customization.unauthorized']);
    exit;
}

require_once __DIR__ . '/db.php';

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.customization.invalidData']);
    exit;
}

// Validate language if it's being updated
if (isset($data['language'])) {
    $supportedLanguages = ['en', 'de'];
    if (!in_array($data['language'], $supportedLanguages)) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.customization.unsupportedLanguage']);
        exit;
    }
}

// Save to settings table
$json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
    'customization',
    $json
]);

echo json_encode(['success' => true]);