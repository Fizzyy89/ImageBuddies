<?php
session_start();

// Prüfe Admin-Berechtigung
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.statistics.noPermission']);
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

if (!file_exists($statsFile)) {
    echo json_encode(['error_key' => 'error.statistics.noData']);
    exit;
}

// Lese die CSV-Datei
$lines = file($statsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$header = array_shift($lines); // Entferne Header

// Initialisiere Statistiken
$stats = [
    'totalImages' => 0,
    'totalCosts' => 0,
    'qualityDistribution' => ['low' => 0, 'medium' => 0, 'high' => 0],
    'aspectRatioDistribution' => [],
    'userDistribution' => [],
    'costsPerMonth' => [],
    'imagesPerDay' => [],
    'imagesPerMonth' => [],
    'referenceImageStats' => [
        'withRefs' => 0,
        'withoutRefs' => 0,
        'totalRefs' => 0
    ],
    'costsPerDay' => [],
    'batchStats' => [
        'single' => 0,
        'batches' => [] 
    ]
];

// Sammle die Daten
$firstDate = null;
$lastDate = null;

// Erste Durchlauf: Sammle alle BatchIds und ihre Bilder
$batchCounts = [];
foreach ($lines as $line) {
    $data = str_getcsv($line, ';');
    $batchId = $data[5] ?? '';
    if ($batchId !== '') {
        if (!isset($batchCounts[$batchId])) {
            $batchCounts[$batchId] = 0;
        }
        $batchCounts[$batchId]++;
    }
}

// Zweiter Durchlauf: Normale Statistiken + korrekte Batch-Zählung
foreach ($lines as $line) {
    $data = str_getcsv($line, ';');
    
    // CSV Format: Datum;Seitenverhältnis;Qualität;AnzahlReferenzbilder;User;BatchId;ImageNumber
    $date = $data[0];
    $size = $data[1];
    $quality = $data[2];
    $refCount = intval($data[3]);
    $user = $data[4];
    $batchId = $data[5] ?? '';
    $imageNumber = intval($data[6] ?? 1);
    
    // Batch-Statistiken (nur für erste Bilder eines Batches)
    if ($imageNumber === 1) {
        if ($batchId === '') {
            // Einzelbild
            $stats['batchStats']['single']++;
        } else {
            // Speichere die tatsächliche Batch-Größe
            $stats['batchStats']['batches'][$batchId] = $batchCounts[$batchId];
        }
    }
    
    // Setze erste und letzte Datum
    if (!$firstDate || $date < $firstDate) $firstDate = $date;
    if (!$lastDate || $date > $lastDate) $lastDate = $date;
    
    // Zähle Gesamtbilder
    $stats['totalImages']++;
    
    // Qualitätsverteilung
    if (isset($stats['qualityDistribution'][$quality])) {
        $stats['qualityDistribution'][$quality]++;
    }
    
    // Seitenverhältnis
    if (!isset($stats['aspectRatioDistribution'][$size])) {
        $stats['aspectRatioDistribution'][$size] = 0;
    }
    $stats['aspectRatioDistribution'][$size]++;
    
    // Benutzerverteilung
    if (!isset($stats['userDistribution'][$user])) {
        $stats['userDistribution'][$user] = 0;
    }
    $stats['userDistribution'][$user]++;
    
    // Bilder pro Tag
    $dayKey = substr($date, 0, 10); // Format: YYYY-MM-DD
    if (!isset($stats['imagesPerDay'][$dayKey])) {
        $stats['imagesPerDay'][$dayKey] = 0;
    }
    $stats['imagesPerDay'][$dayKey]++;
    
    // Bilder pro Monat
    $monthKey = substr($date, 0, 7); // Format: YYYY-MM
    if (!isset($stats['imagesPerMonth'][$monthKey])) {
        $stats['imagesPerMonth'][$monthKey] = 0;
    }
    $stats['imagesPerMonth'][$monthKey]++;
    
    // Berechne Kosten für dieses Bild
    $imageCost = $PRICES[$quality];
    $refCost = $refCount * $REFERENCE_IMAGE_PRICE;
    $totalImageCost = $imageCost + $refCost;
    
    // Kosten pro Tag
    if (!isset($stats['costsPerDay'][$dayKey])) {
        $stats['costsPerDay'][$dayKey] = 0;
    }
    $stats['costsPerDay'][$dayKey] += $totalImageCost;
    
    // Kosten pro Monat
    if (!isset($stats['costsPerMonth'][$monthKey])) {
        $stats['costsPerMonth'][$monthKey] = 0;
    }
    $stats['costsPerMonth'][$monthKey] += $totalImageCost;
    $stats['totalCosts'] += $totalImageCost;
    
    // Referenzbild-Statistiken
    if ($refCount > 0) {
        $stats['referenceImageStats']['withRefs']++;
        $stats['referenceImageStats']['totalRefs'] += $refCount;
    } else {
        $stats['referenceImageStats']['withoutRefs']++;
    }
}

// Berechne Durchschnitt Bilder pro Tag
if ($firstDate && $lastDate) {
    $datetime1 = new DateTime(substr($firstDate, 0, 10));
    $datetime2 = new DateTime(substr($lastDate, 0, 10));
    $interval = $datetime1->diff($datetime2);
    $daysDiff = $interval->days + 1; // +1 weil wir auch den ersten Tag mitzählen
    $stats['avgImagesPerDay'] = round($stats['totalImages'] / $daysDiff, 1);
}

// Sortiere die Arrays chronologisch
ksort($stats['costsPerMonth']);
ksort($stats['imagesPerDay']);
ksort($stats['costsPerDay']);
ksort($stats['imagesPerMonth']);

// Kosten als Zahlen (in Cents) belassen für JS-Formatierung
$stats['totalCostsRaw'] = $stats['totalCosts'];
$stats['avgCostPerImageRaw'] = $stats['totalImages'] > 0 ? ($stats['totalCosts'] / $stats['totalImages']) : 0;

// Die Schlüssel totalCosts und avgCostPerImage werden nun die Rohwerte in Cents enthalten
// Die benannten Schlüssel totalCostsRaw und avgCostPerImageRaw werden verwendet, um Verwirrung zu vermeiden,
// aber wir überschreiben die Originale für die JS-Seite.
$stats['totalCosts'] = $stats['totalCosts']; // Bleibt als Cent-Wert
$stats['avgCostPerImage'] = $stats['totalImages'] > 0 ? round($stats['totalCosts'] / $stats['totalImages']) : 0; // Als Cent-Wert

foreach ($stats['costsPerMonth'] as &$cost) {
    $cost = round($cost / 100, 2);
}
foreach ($stats['costsPerDay'] as &$cost) {
    $cost = round($cost / 100, 2);
}

echo json_encode($stats);
?> 