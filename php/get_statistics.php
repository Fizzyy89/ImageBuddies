<?php
session_start();
header('Content-Type: application/json');

// Prüfe Admin-Berechtigung
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.statistics.noPermission']);
    exit;
}

require_once __DIR__ . '/db.php';

try {
// Initialisiere Statistiken
$stats = [
    'totalImages' => 0,
    'totalCosts' => 0,
    'qualityDistribution' => ['low' => 0, 'medium' => 0, 'high' => 0, 'gemini' => 0],
    'aspectRatioDistribution' => [],
    'userDistribution' => [],
    'costsPerUser' => [],
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

// Gesamtsummen (nur nicht-gelöschte Bilder zählen? Im CSV wurden gelöschte Bilder nicht mehr gezählt; Einträge blieben. Wir zählen nur deleted=0)
$rows = db_rows('SELECT g.created_at, g.size, g.quality, g.ref_image_count, g.batch_id, g.image_number, g.cost_total_cents, u.username FROM generations g JOIN users u ON u.id=g.user_id');

$firstDate = null;
$lastDate = null;
$batchCounts = [];
foreach ($rows as $r) {
    $batchId = $r['batch_id'] ?? '';
    if ($batchId !== '') {
        if (!isset($batchCounts[$batchId])) $batchCounts[$batchId] = 0;
        $batchCounts[$batchId]++;
    }
}

foreach ($rows as $r) {
    $date = isset($r['created_at']) ? (string)$r['created_at'] : '';
    if ($date === '') {
        // Skip invalid date rows
        continue;
    }
    $size = $r['size'];
    $quality = $r['quality'];
    $refCount = intval($r['ref_image_count']);
    $user = $r['username'];
    $batchId = $r['batch_id'] ?? '';
    $imageNumber = intval($r['image_number'] ?? 1);
    $totalImageCost = intval($r['cost_total_cents']);

    if ($imageNumber === 1) {
        if ($batchId === '') {
            $stats['batchStats']['single']++;
        } else {
            $stats['batchStats']['batches'][$batchId] = $batchCounts[$batchId];
        }
    }

    if (!$firstDate || $date < $firstDate) $firstDate = $date;
    if (!$lastDate || $date > $lastDate) $lastDate = $date;

    $stats['totalImages']++;

    if (!isset($stats['qualityDistribution'][$quality])) $stats['qualityDistribution'][$quality] = 0;
    $stats['qualityDistribution'][$quality]++;

    if (!isset($stats['aspectRatioDistribution'][$size])) $stats['aspectRatioDistribution'][$size] = 0;
    $stats['aspectRatioDistribution'][$size]++;

    if (!isset($stats['userDistribution'][$user])) $stats['userDistribution'][$user] = 0;
    $stats['userDistribution'][$user]++;

    if (!isset($stats['costsPerUser'][$user])) $stats['costsPerUser'][$user] = 0;
    $stats['costsPerUser'][$user] += $totalImageCost;

    $dayKey = (strlen($date) >= 10) ? substr($date, 0, 10) : null;
    if ($dayKey) {
        if (!isset($stats['imagesPerDay'][$dayKey])) $stats['imagesPerDay'][$dayKey] = 0;
        $stats['imagesPerDay'][$dayKey]++;
        if (!isset($stats['costsPerDay'][$dayKey])) $stats['costsPerDay'][$dayKey] = 0;
        $stats['costsPerDay'][$dayKey] += $totalImageCost;
    }

    $monthKey = (strlen($date) >= 7) ? substr($date, 0, 7) : null;
    if ($monthKey) {
        if (!isset($stats['imagesPerMonth'][$monthKey])) $stats['imagesPerMonth'][$monthKey] = 0;
        $stats['imagesPerMonth'][$monthKey]++;
        if (!isset($stats['costsPerMonth'][$monthKey])) $stats['costsPerMonth'][$monthKey] = 0;
        $stats['costsPerMonth'][$monthKey] += $totalImageCost;
    }

    if ($refCount > 0) {
        $stats['referenceImageStats']['withRefs']++;
        $stats['referenceImageStats']['totalRefs'] += $refCount;
    } else {
        $stats['referenceImageStats']['withoutRefs']++;
    }
}

if ($firstDate && $lastDate && strlen($firstDate) >= 10 && strlen($lastDate) >= 10) {
    $datetime1 = new DateTime(substr($firstDate, 0, 10));
    $datetime2 = new DateTime(substr($lastDate, 0, 10));
    $interval = $datetime1->diff($datetime2);
    $daysDiff = $interval->days + 1;
    $stats['avgImagesPerDay'] = round($stats['totalImages'] / $daysDiff, 1);
}

ksort($stats['costsPerMonth']);
ksort($stats['imagesPerDay']);
ksort($stats['costsPerDay']);
ksort($stats['imagesPerMonth']);

$stats['totalCostsRaw'] = array_sum(array_values($stats['costsPerUser']));
$stats['totalCosts'] = $stats['totalCostsRaw'];
$stats['avgCostPerImageRaw'] = $stats['totalImages'] > 0 ? ($stats['totalCostsRaw'] / $stats['totalImages']) : 0;
$stats['avgCostPerImage'] = $stats['totalImages'] > 0 ? round($stats['totalCostsRaw'] / $stats['totalImages']) : 0;

foreach ($stats['costsPerMonth'] as &$cost) { $cost = round($cost / 100, 2); }
foreach ($stats['costsPerDay'] as &$cost) { $cost = round($cost / 100, 2); }

echo json_encode($stats);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'stats_failed']);
}
?>