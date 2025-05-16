<?php
header('Content-Type: application/json');

// Check if user is logged in and is admin
session_start();
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.customization.unauthorized']);
    exit;
}

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

// Update customization.json
$customizationFile = __DIR__ . '/../database/customization.json';
if (!file_put_contents($customizationFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.customization.updateFailed']);
    exit;
}

echo json_encode(['success' => true]); 