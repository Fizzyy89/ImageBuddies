<?php
session_start();

// Prüfe ob User eingeloggt ist
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

// Preise für die Berechnung
$PRICES = [
    'low' => 3,    // 3 Cent
    'medium' => 6,  // 6 Cent
    'high' => 25    // 25 Cent
];
$REFERENCE_IMAGE_PRICE = 3; // 3 Cent pro Referenzbild

$statsFile = dirname(__DIR__) . '/database/statistics.csv';

// Initialisiere User-Statistiken
$userStats = [
    'totalImages' => 0,
    'totalCosts' => 0
];

if (file_exists($statsFile)) {
    $lines = file($statsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $header = array_shift($lines); // Entferne Header
    
    $currentUser = $_SESSION['user'];
    
    foreach ($lines as $line) {
        $data = str_getcsv($line, ';');
        
        // CSV Format: Datum;Seitenverhältnis;Qualität;AnzahlReferenzbilder;User;BatchId;ImageNumber
        $user = $data[4] ?? '';
        
        // Nur Bilder des aktuellen Users zählen
        if ($user === $currentUser) {
            $quality = $data[2] ?? 'medium';
            $refCount = intval($data[3] ?? 0);
            
            // Zähle Bilder
            $userStats['totalImages']++;
            
            // Berechne Kosten für dieses Bild
            $imageCost = $PRICES[$quality] ?? $PRICES['medium'];
            $refCost = $refCount * $REFERENCE_IMAGE_PRICE;
            $totalImageCost = $imageCost + $refCost;
            
            $userStats['totalCosts'] += $totalImageCost;
        }
    }
}

header('Content-Type: application/json');
echo json_encode($userStats);
?> 