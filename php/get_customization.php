<?php
header('Content-Type: application/json');

// Start session and check authentication
session_start();

// Path to the customization.json file
$file_path = '../database/customization.json';

// Check if the file exists
if (!file_exists($file_path)) {
    http_response_code(404);
    echo json_encode(['error' => 'Customization file not found']);
    exit;
}

// Read the file and return its contents
$content = file_get_contents($file_path);
if ($content === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to read customization file']);
    exit;
}

// Output the file content
echo $content; 