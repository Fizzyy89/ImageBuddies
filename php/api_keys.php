<?php
session_start();
header('Content-Type: application/json');

// Admin-Prüfung
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error_key' => 'error.apiKey.unauthorized']);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $provider = $_GET['provider'] ?? '';
    if ($provider !== 'openai' && $provider !== 'gemini') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error_key' => 'error.apiKey.invalidProvider']);
        exit;
    }

    $keyName = $provider === 'openai' ? 'openai_key_enc' : 'gemini_key_enc';
    $row = db_row('SELECT value FROM settings WHERE key = ?', [$keyName]);
    $key = '';
    if ($row) {
        $key = decrypt_secret($row['value']);
        if ($key === null) {
            $key = '';
        }
    }
    echo json_encode(['key' => $key]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $provider = $input['provider'] ?? ($_GET['provider'] ?? '');
    if ($provider !== 'openai' && $provider !== 'gemini') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error_key' => 'error.apiKey.invalidProvider']);
        exit;
    }

    $newKey = isset($input['key']) ? trim($input['key']) : '';

    // Entfernen, wenn leer
    if ($newKey === '') {
        $keyName = $provider === 'openai' ? 'openai_key_enc' : 'gemini_key_enc';
        db_exec('DELETE FROM settings WHERE key = ?', [$keyName]);
        if ($provider === 'gemini') {
            db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
                'gemini_available', '0'
            ]);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    $enc = encrypt_secret($newKey);
    if ($enc === null) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error_key' => 'error.apiKey.encryptError']);
        exit;
    }

    $keyName = $provider === 'openai' ? 'openai_key_enc' : 'gemini_key_enc';
    db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
        $keyName,
        $enc
    ]);

    if ($provider === 'gemini') {
        db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
            'gemini_available', '1'
        ]);
    }

    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error_key' => 'error.apiKey.invalidMethod']);


