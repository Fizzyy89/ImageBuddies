<?php
session_start();
$isLoggedIn = isset($_SESSION['user']);
$currentUser = $isLoggedIn ? $_SESSION['user'] : '';
$isAdmin = $isLoggedIn && isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

// Lese customization.json ein, um viewOnlyAllowed zu prüfen
$customizationFile = __DIR__ . '/../database/customization.json';

$viewOnlyAllowed = false;
if (file_exists($customizationFile)) {
    $customization = json_decode(file_get_contents($customizationFile), true);
    $viewOnlyAllowed = isset($customization['viewOnlyAllowed']) && $customization['viewOnlyAllowed'];
}

// Wenn nicht eingeloggt und kein view-only Header, dann Fehler
// UND: View-Only nur erlauben, wenn in customization.json erlaubt
if (!$isLoggedIn && (!isset($_SERVER['HTTP_X_VIEW_ONLY']) || !$viewOnlyAllowed)) {
    http_response_code(401);
    echo json_encode(['error' => 'Nicht eingeloggt.']);
    exit;
}

// Lese zuerst das Logfile ein, um die Timestamps zu haben
$logfile = '../database/image_log.csv';
$meta = [];
if (file_exists($logfile)) {
    $lines = array_reverse(file($logfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
    foreach ($lines as $line) {
        $parts = explode(';', $line);
        $timestamp = $parts[0] ?? '';
        $filename = $parts[1] ?? '';
        $prompt = $parts[2] ?? '';
        $user = $parts[3] ?? '';
        $size = $parts[4] ?? '1024x1024';  
        $quality = $parts[5] ?? 'medium';
        $private = $parts[6] ?? '0'; 
        $ref_image_count = $parts[7] ?? '0'; 
        $batchId = $parts[8] ?? ''; 
        $imageNumber = $parts[9] ?? '1';

        if ($filename) {
            $meta[$filename] = [
                'timestamp' => $timestamp,
                'prompt' => $prompt,
                'user' => $user,
                'size' => $size,
                'quality' => $quality,
                'private' => $private,
                'ref_image_count' => $ref_image_count,
                'batchId' => $batchId,
                'imageNumber' => $imageNumber
            ];
        }
    }
}

// Hole alle Bilddateien
$files = glob('../images/image_*.png');

// Baue sortierte Ausgabe-Array
$result = [];

// Füge zuerst alle Dateien aus dem Log hinzu (diese sind bereits chronologisch sortiert)
foreach ($meta as $filename => $info) {
    // Überspringe private Bilder wenn nicht eingeloggt oder nicht der Besitzer/Admin
    if ($info['private'] === '1' && !$isLoggedIn && !$isAdmin && $info['user'] !== $currentUser) {
        continue;
    }
    
    if (in_array('../images/' . $filename, $files)) {
        $result[] = [
            'file' => 'images/' . $filename,
            'timestamp' => $info['timestamp'],
            'prompt' => $info['prompt'],
            'user' => $info['user'],
            'size' => $info['size'],
            'quality' => $info['quality'],
            'private' => $info['private'],
            'ref_image_count' => $info['ref_image_count'],
            'batchId' => $info['batchId'],
            'imageNumber' => $info['imageNumber']
        ];
    }
}

// Füge alle übrigen Dateien hinzu, die nicht im Log sind
foreach ($files as $file) {
    $basename = basename($file);
    if (!isset($meta[$basename])) {
        $result[] = [
            'file' => $file,
            'timestamp' => '',
            'prompt' => '',
            'user' => '',
            'size' => '1024x1024',
            'quality' => 'medium',
            'private' => '0',
            'ref_image_count' => '0',
            'batchId' => '',
            'imageNumber' => '1'
        ];
    }
}

header('Content-Type: application/json');
echo json_encode($result); 