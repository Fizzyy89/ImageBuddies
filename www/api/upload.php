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

// Mode: 'openai' or 'gemini'
$mode = $data['mode'] ?? 'openai';
$size = $data['size'] ?? '1024x1024';
$quality = $data['quality'] ?? 'medium';

// Use a dedicated quality label for Gemini
if ($mode === 'gemini') {
    $quality = 'gemini';
}

$timestamp = preg_replace('/[^0-9T\-]/', '', $data['timestamp']);
$filename = "image_{$timestamp}.png";
$image_data = base64_decode($data['imageBase64']);
require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/pricing.php';
$pricingSchema = IMB_PRICING_SCHEMA;
$imageDir = IMB_IMAGE_DIR;
if (!is_dir($imageDir)) mkdir($imageDir, 0777, true);
$fullImagePath = $imageDir . '/' . $filename;
file_put_contents($fullImagePath, $image_data);

// --- THUMBNAIL GENERATION ---
$thumbDir = $imageDir . '/thumbs';
if (!is_dir($thumbDir)) mkdir($thumbDir, 0777, true);

$srcPath = $fullImagePath;
$thumbPath = $thumbDir . '/' . $filename;

// Load image to determine true dimensions (robust across formats)
$srcContent = @file_get_contents($srcPath);
$srcImg = $srcContent ? @imagecreatefromstring($srcContent) : false;
if (!$srcImg) {
    // Fallback if image cannot be loaded
    $thumbW = 400;
    $thumbH = 400;
} else {
    $srcW = imagesx($srcImg);
    $srcH = imagesy($srcImg);

    if ($srcW > 0 && $srcH > 0) {
        // Dynamische Skalierung für alle Modi
        $aspectRatio = $srcW / $srcH;
        $maxDimension = 600; // maximale Kante
        if ($aspectRatio >= 1) {
            // Landscape oder Quadrat
            $thumbW = $maxDimension;
            $thumbH = max(1, (int)round($thumbW / $aspectRatio));
        } else {
            // Portrait
            $thumbH = $maxDimension;
            $thumbW = max(1, (int)round($thumbH * $aspectRatio));
        }
    } else {
        $thumbW = 400;
        $thumbH = 400;
    }

    // Create thumbnail with computed dimensions
    $thumbImg = imagecreatetruecolor($thumbW, $thumbH);
    imagealphablending($thumbImg, false);
    imagesavealpha($thumbImg, true);
    imagecopyresampled($thumbImg, $srcImg, 0, 0, 0, 0, $thumbW, $thumbH, $srcW, $srcH);
    imagepng($thumbImg, $thumbPath);
    imagedestroy($srcImg);
    imagedestroy($thumbImg);
}

// Username for DB
$user = $_SESSION['user'] ?? '';

// Escape semicolons in prompt to prevent CSV injection
$sanitized_prompt = str_replace(["\r", "\n", ";"], [' ', ' ', ','], $data['prompt']);

// Check if ref_image_count is present in the request
$ref_image_count = isset($data['ref_image_count']) ? intval($data['ref_image_count']) : 0;

// New fields for multi-generation
$batchId = isset($data['batchId']) ? $data['batchId'] : '';
$imageNumber = isset($data['imageNumber']) ? intval($data['imageNumber']) : 1;

// --- SAVE REFERENCE IMAGES (once per batch when imageNumber === 1) ---
// Expected format: $data['refImages'] = [
//   "iVBORw0KGgo..." OR "data:image/png;base64,iVBORw0KGgo..."
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

// Detect actual aspect ratio and map to known ratio strings
$imgSize = @getimagesize($fullImagePath);
$aspect_class = $size; // Fallback: übergebener Wert (kann Dimension oder Ratio sein)

// Allowed ratio targets (numeric)
$allowedRatios = [
    '1:1'   => 1.0,
    '2:3'   => 2/3,
    '3:2'   => 3/2,
    '3:4'   => 3/4,
    '4:3'   => 4/3,
    '4:5'   => 4/5,
    '5:4'   => 5/4,
    '9:16'  => 9/16,
    '16:9'  => 16/9,
    '21:9'  => 21/9
];

$pickNearestRatio = function(float $ratio) use ($allowedRatios) {
    $bestKey = '1:1';
    $bestDiff = PHP_FLOAT_MAX;
    foreach ($allowedRatios as $key => $val) {
        $diff = abs($ratio - $val);
        if ($diff < $bestDiff) {
            $bestDiff = $diff;
            $bestKey = $key;
        }
    }
    return $bestKey;
};

if ($imgSize && isset($imgSize[0], $imgSize[1]) && $imgSize[0] > 0 && $imgSize[1] > 0) {
    $w = (float)$imgSize[0];
    $h = (float)$imgSize[1];
    $r = $w / $h;
    $aspect_class = $pickNearestRatio($r);
} else {
    // Fallback: try to derive from $size
    if (is_string($size) && strpos($size, 'x') !== false) {
        // Format WxH
        $parts = explode('x', strtolower($size));
        $w = floatval($parts[0]);
        $h = floatval($parts[1] ?? 0);
        if ($w > 0 && $h > 0) {
            $aspect_class = $pickNearestRatio($w / $h);
        } else {
            $aspect_class = '1:1';
        }
    } elseif (is_string($size) && strpos($size, ':') !== false) {
        // Already a ratio a:b
        $aspect_class = $size;
    } else {
        $aspect_class = '1:1';
    }
}



// Persist to SQLite
require_once IMB_SRC_DIR . '/db.php';

// Load pricing
$pricingData = imb_pricing_load();
$pricingSchema = $pricingData['schema'] ?? IMB_PRICING_SCHEMA;

// Get/create user_id
$u = db_row('SELECT id FROM users WHERE username = ?', [$user]);
if ($u === null) {
    // Safety net: create user (should exist from setup)
    db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [
        $user,
        password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
        'user'
    ]);
    $u = db_row('SELECT id FROM users WHERE username = ?', [$user]);
}
$user_id = intval($u['id']);

// Calculate costs based on pricing table
$imageCost = 0;
$refCost = 0;
if ($mode === 'gemini') {
    $geminiPricing = $pricingData['gemini'] ?? [];
    $imageCost = isset($geminiPricing['output']) ? (int)$geminiPricing['output'] : 0;
    $refUnit = isset($geminiPricing['input']) ? (int)$geminiPricing['input'] : 0;
    $refCost = $ref_image_count * $refUnit;
} else {
    $openaiPricing = $pricingData['openai'] ?? [];
    $qualityKey = in_array($quality, ['low', 'medium', 'high'], true) ? $quality : 'medium';
    $defaultOpenAi = imb_pricing_defaults();
    $imageCost = isset($openaiPricing[$qualityKey]) ? (int)$openaiPricing[$qualityKey] : (int)$defaultOpenAi['openai'][$qualityKey];
    $refUnit = isset($openaiPricing['input']) ? (int)$openaiPricing['input'] : (int)$defaultOpenAi['openai']['input'];
    $refCost = $ref_image_count * $refUnit;
}
$totalCost = $imageCost + $refCost;

try {
    $batchParam = ($batchId !== '') ? $batchId : null; // avoid UNIQUE(NULL, n) conflicts across batches
    db_exec(
        'INSERT INTO generations (
            created_at, mode, batch_id, image_number, user_id, filename, prompt, quality, private,
            ref_image_count, width, height, aspect_class, deleted,
            cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
            $timestamp,
            $mode,
            $batchParam,
            $imageNumber,
            $user_id,
            $filename,
            $sanitized_prompt,
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
            $pricingSchema
        ]
    );
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'db_insert_failed']);
}
?>
