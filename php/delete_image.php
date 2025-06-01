<?php
session_start();

// Prüfe ob User eingeloggt ist
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
$currentUser = $_SESSION['user'];

$data = json_decode(file_get_contents('php://input'), true);
if (isset($data['batchId'])) {
    // Lösche gesamte Batch
    $batchId = $data['batchId'];
    $logfile = dirname(__DIR__) . '/database/image_log.csv';
    if (!file_exists($logfile)) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logNotFound']);
        exit;
    }
    
    $lines = file($logfile, FILE_IGNORE_NEW_LINES);
    
    // Für normale User: Prüfe ob alle Bilder der Batch ihm gehören
    if (!$isAdmin) {
        $batchOwners = [];
        foreach ($lines as $line) {
            $columns = str_getcsv($line, ';');
            if (count($columns) >= 9 && $columns[8] === $batchId) {
                $batchOwners[] = $columns[3]; // User ist in Spalte 3
            }
        }
        
        // Prüfe ob alle Bilder der Batch dem aktuellen User gehören
        foreach ($batchOwners as $owner) {
            if ($owner !== $currentUser) {
                http_response_code(403);
                echo json_encode(['error_key' => 'error.deleteImage.noPermission']);
                exit;
            }
        }
        
        // Zusätzliche Sicherheit: Mindestens ein Bild muss vorhanden sein
        if (empty($batchOwners)) {
            http_response_code(404);
            echo json_encode(['error_key' => 'error.deleteImage.logNotFound']);
            exit;
        }
    }
    
    $newLines = [];
    $deletedFiles = [];
    foreach ($lines as $line) {
        $columns = str_getcsv($line, ';');
        if (count($columns) >= 9 && $columns[8] === $batchId) {
            // Bilddatei und Thumb löschen
            $basename = $columns[1];
            $imagePath = dirname(__DIR__) . '/images/' . $basename;
            $thumbPath = dirname(__DIR__) . '/images/thumbs/' . $basename;
            if (file_exists($imagePath)) @unlink($imagePath);
            if (file_exists($thumbPath)) @unlink($thumbPath);
            $deletedFiles[] = $basename;
        } else {
            $newLines[] = $line;
        }
    }
    if (!file_put_contents($logfile, implode("\n", $newLines) . "\n")) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logUpdateFailed']);
        exit;
    }
    echo json_encode(['success' => true, 'deletedFiles' => $deletedFiles]);
    exit;
}

if (!isset($data['filename'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.deleteImage.noFilename']);
    exit;
}

$filename = $data['filename'];
$basename = basename($filename);

// Sicherheitscheck: Stelle sicher, dass nur Bilder gelöscht werden können
if (!preg_match('/^image_[0-9T\-]+\.png$/', $basename)) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.deleteImage.invalidFilename']);
    exit;
}

// Prüfe Berechtigung: User darf nur eigene Bilder löschen, Admin darf alle löschen
if (!$isAdmin) {
    $logfile = dirname(__DIR__) . '/database/image_log.csv';
    if (file_exists($logfile)) {
        $lines = file($logfile, FILE_IGNORE_NEW_LINES);
        $imageOwner = null;
        foreach ($lines as $line) {
            $columns = str_getcsv($line, ';');
            if (count($columns) >= 4 && $columns[1] === $basename) {
                $imageOwner = $columns[3]; // User ist in Spalte 3
                break;
            }
        }
        
        // Wenn Bild nicht im Log gefunden oder User nicht der Besitzer ist
        if ($imageOwner === null || $imageOwner !== $currentUser) {
            http_response_code(403);
            echo json_encode(['error_key' => 'error.deleteImage.noPermission']);
            exit;
        }
    } else {
        // Wenn kein Log existiert, erlaube nur Admins das Löschen
        http_response_code(403);
        echo json_encode(['error_key' => 'error.deleteImage.noPermission']);
        exit;
    }
}

// Lösche die Bilddatei
$imagePath = dirname(__DIR__) . '/images/' . $basename;
$thumbPath = dirname(__DIR__) . '/images/thumbs/' . $basename;

$imgOk = true;
$thumbOk = true;

if (file_exists($imagePath) && !unlink($imagePath)) {
    $imgOk = false;
}
if (file_exists($thumbPath) && !unlink($thumbPath)) {
    $thumbOk = false;
}

if (!$imgOk) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.deleteImage.fileDeleteFailed']);
    exit;
}
if (!$thumbOk) {
    // Kein harter Fehler, aber ggf. Hinweis
}

// Aktualisiere die CSV-Datei
$logfile = dirname(__DIR__) . '/database/image_log.csv';
if (file_exists($logfile)) {
    $lines = file($logfile, FILE_IGNORE_NEW_LINES);
    $newLines = [];
    foreach ($lines as $line) {
        $columns = str_getcsv($line, ';');
        if (count($columns) >= 2 && $columns[1] !== $basename) {
            $newLines[] = $line;
        }
    }
    if (!file_put_contents($logfile, implode("\n", $newLines) . "\n")) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.deleteImage.logUpdateFailed']);
        exit;
    }
}

echo json_encode(['success' => true]);
?> 