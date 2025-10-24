<?php

session_start();
header('Content-Type: application/json');
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['imageBase64'], $data['prompt'], $data['timestamp'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.upload.missingData']);
    exit;
}

// Mode: 'openai' oder 'gemini'
$mode = $data['mode'] ?? 'openai';
$size = $data['size'] ?? '1024x1024';
$quality = $data['quality'] ?? 'medium';

// Für Gemini eine eigene Qualitäts-Kennzeichnung verwenden
if ($mode === 'gemini') {
    $quality = 'gemini';
}

$timestamp = preg_replace('/[^0-9T\-]/', '', $data['timestamp']);
$filename = "image_{$timestamp}.png";
$image_data = base64_decode($data['imageBase64']);
$imageDir = dirname(__DIR__) . '/images';
if (!is_dir($imageDir)) mkdir($imageDir, 0777, true);
$fullImagePath = $imageDir . '/' . $filename;
file_put_contents($fullImagePath, $image_data);

// --- THUMBNAIL-GENERIERUNG ---
$thumbDir = $imageDir . '/thumbs';
if (!is_dir($thumbDir)) mkdir($thumbDir, 0777, true);

$srcPath = $fullImagePath;
$thumbPath = $thumbDir . '/' . $filename;

// Bild laden um echte Dimensionen zu ermitteln (robust für verschiedene Formate)
$srcContent = @file_get_contents($srcPath);
$srcImg = $srcContent ? @imagecreatefromstring($srcContent) : false;
if (!$srcImg) {
    // Fallback wenn Bild nicht geladen werden kann
    $thumbW = 400;
    $thumbH = 400;
} else {
    $srcW = imagesx($srcImg);
    $srcH = imagesy($srcImg);
    
    // Zielgrößen bestimmen
    if ($mode === 'gemini') {
        // Für Gemini immer dynamisch basierend auf echten Dimensionen
        $aspectRatio = $srcW / $srcH;
        $maxDimension = 600; // maximale Kante
        if ($aspectRatio > 1) {
            // Querformat
            $thumbW = $maxDimension;
            $thumbH = (int)($thumbW / $aspectRatio);
        } else {
            // Hochformat oder Quadrat
            $thumbH = $maxDimension;
            $thumbW = (int)($thumbH * $aspectRatio);
        }
    } else {
        // OpenAI-Modus: auf gewählte Size abbilden
        switch ($size) {
            case '1024x1024': // 1:1
                $thumbW = 400;
                $thumbH = 400;
                break;
            case '1024x1536': // 2:3 Hochformat
                $thumbW = 400;
                $thumbH = 600;
                break;
            case '1536x1024': // 3:2 Querformat
                $thumbW = 600;
                $thumbH = 400;
                break;
            default:
                // Fallback dynamisch
                $aspectRatio = $srcW / $srcH;
                $maxDimension = 600;
                if ($aspectRatio > 1) {
                    $thumbW = $maxDimension;
                    $thumbH = (int)($thumbW / $aspectRatio);
                } else {
                    $thumbH = $maxDimension;
                    $thumbW = (int)($thumbH * $aspectRatio);
                }
                break;
        }
    }
    
    // Erstelle Thumbnail mit berechneten Dimensionen
    $thumbImg = imagecreatetruecolor($thumbW, $thumbH);
    imagealphablending($thumbImg, false);
    imagesavealpha($thumbImg, true);
    imagecopyresampled($thumbImg, $srcImg, 0, 0, 0, 0, $thumbW, $thumbH, $srcW, $srcH);
    imagepng($thumbImg, $thumbPath);
    imagedestroy($srcImg);
    imagedestroy($thumbImg);
}

// Benutzername für DB
$user = $_SESSION['user'] ?? '';

// Escape semicolons in prompt to prevent CSV injection
$sanitized_prompt = str_replace(["\r", "\n", ";"], [' ', ' ', ','], $data['prompt']);

// Prüfe ob ref_image_count im Request vorhanden ist
$ref_image_count = isset($data['ref_image_count']) ? intval($data['ref_image_count']) : 0;

// Neue Felder für Multi-Generierung
$batchId = isset($data['batchId']) ? $data['batchId'] : '';
$imageNumber = isset($data['imageNumber']) ? intval($data['imageNumber']) : 1;

// --- REFERENZBILDER SPEICHERN (einmal pro Batch, bei imageNumber === 1) ---
// Erwartetes Format: $data['refImages'] = [
//   "iVBORw0KGgo..." ODER "data:image/png;base64,iVBORw0KGgo..."
// ]
if (!empty($batchId) && $imageNumber === 1 && isset($data['refImages']) && is_array($data['refImages']) && count($data['refImages']) > 0) {
    $safeBatchId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $batchId);
    $refsRoot = $imageDir . '/refs';
    $refsDir = $refsRoot . '/' . $safeBatchId;
    if (!is_dir($refsDir)) {
        if (!is_dir($refsRoot)) mkdir($refsRoot, 0777, true);
        mkdir($refsDir, 0777, true);
        $idx = 1;
        foreach ($data['refImages'] as $refImg) {
            if (!is_string($refImg) || $refImg === '') continue;
            $ext = 'png';
            $payload = $refImg;
            if (preg_match('/^data:image\/(\w+);base64,/', $refImg, $m)) {
                $mimeExt = strtolower($m[1]);
                $ext = $mimeExt === 'jpeg' ? 'jpg' : $mimeExt;
                $payload = substr($refImg, strpos($refImg, ',') + 1);
            }
            $decoded = base64_decode($payload);
            if ($decoded === false) continue;
            $refFilename = sprintf('ref_%d.%s', $idx, $ext);
            file_put_contents($refsDir . '/' . $refFilename, $decoded);
            $idx++;
        }
    }
}

// Erkenne tatsächliches Seitenverhältnis und mappe auf bekannte Werte
$imgSize = @getimagesize($fullImagePath);
$aspect_class = $size; // Fallback: gewählte/übergebene Größe
if ($imgSize && isset($imgSize[0], $imgSize[1]) && $imgSize[0] > 0 && $imgSize[1] > 0) {
    $w = (float)$imgSize[0];
    $h = (float)$imgSize[1];
    $r = $w / $h;
    $targets = [
        '1024x1024' => 1.0,          // 1:1
        '1024x1536' => (2/3),        // 2:3 (Hochformat)
        '1536x1024' => (3/2)         // 3:2 (Querformat)
    ];
    $bestKey = $aspect_class;
    $bestDiff = PHP_FLOAT_MAX;
    foreach ($targets as $key => $val) {
        $diff = abs($r - $val);
        if ($diff < $bestDiff) {
            $bestDiff = $diff;
            $bestKey = $key;
        }
    }
    $aspect_class = $bestKey;
}

// (CSV-Logging entfernt – Speicherung erfolgt nur noch in SQLite)

// Persistiere in SQLite
require_once __DIR__ . '/db.php';

// Hole/erzeuge user_id
$u = db_row('SELECT id FROM users WHERE username = ?', [$user]);
if ($u === null) {
    // Sicherheitsnetz: lege Benutzer an (sollte durch Setup existieren)
    db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [
        $user,
        password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
        'user'
    ]);
    $u = db_row('SELECT id FROM users WHERE username = ?', [$user]);
}
$user_id = intval($u['id']);

// Kosten berechnen
$imageCost = 0;
$refCost = 0;
if ($mode === 'gemini') {
    $imageCost = 3;                 // 3 Cent Output
    $refCost = $ref_image_count * 15; // 15 Cent je Input-Bild
} else {
    // openai
    $imageCost = ($quality === 'low') ? 3 : (($quality === 'high') ? 25 : 6);
    $refCost = $ref_image_count * 3;  // 3 Cent je Referenz
}
$totalCost = $imageCost + $refCost;

try {
    $batchParam = ($batchId !== '') ? $batchId : null; // avoid UNIQUE(NULL, n) conflicts across batches
    db_exec(
        'INSERT INTO generations (
            created_at, mode, batch_id, image_number, user_id, filename, prompt, size, quality, private,
            ref_image_count, width, height, aspect_class, deleted,
            cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
            $timestamp,
            $mode,
            $batchParam,
            $imageNumber,
            $user_id,
            $filename,
            $sanitized_prompt,
            $aspect_class,
            $quality,
            0,
            $ref_image_count,
            isset($srcW) ? $srcW : null,
            isset($srcH) ? $srcH : null,
            $aspect_class,
            0,
            $imageCost,
            $refCost,
            $totalCost,
            '2025-10'
        ]
    );
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'db_insert_failed']);
}
?>
