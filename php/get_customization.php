<?php
header('Content-Type: application/json');

// Start session and check authentication
session_start();

require_once __DIR__ . '/db.php';

// Read customization from settings table
$row = db_row('SELECT value FROM settings WHERE key = ?', ['customization']);
if ($row === null) {
    http_response_code(404);
    echo json_encode(['error' => 'Customization not found']);
    exit;
}
$cfg = json_decode($row['value'], true);
if (!is_array($cfg)) {
    echo $row['value'];
    exit;
}
// Add geminiAvailable flag from settings
$flag = db_row('SELECT value FROM settings WHERE key = ?', ['gemini_available']);
$cfg['geminiAvailable'] = ($flag && $flag['value'] === '1');
echo json_encode($cfg);