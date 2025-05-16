<?php

session_start();
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['imageBase64'], $data['prompt'], $data['timestamp'], $data['size'], $data['quality'])) {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.upload.missingData']);
    exit;
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

// Zielgrößen je nach Seitenverhältnis
switch ($data['size']) {
    case '1024x1024': // 1:1
        $thumbW = 400; $thumbH = 400;
        break;
    case '1024x1536': // 2:3 Hochformat
        $thumbW = 400; $thumbH = 600;
        break;
    case '1536x1024': // 3:2 Querformat
        $thumbW = 600; $thumbH = 400;
        break;
    default:
        $thumbW = 400; $thumbH = 400;
}

$srcImg = imagecreatefrompng($srcPath);
if ($srcImg) {
    $thumbImg = imagecreatetruecolor($thumbW, $thumbH);
    imagealphablending($thumbImg, false);
    imagesavealpha($thumbImg, true);
    imagecopyresampled($thumbImg, $srcImg, 0, 0, 0, 0, $thumbW, $thumbH, imagesx($srcImg), imagesy($srcImg));
    imagepng($thumbImg, $thumbPath);
    imagedestroy($srcImg);
    imagedestroy($thumbImg);
}

// Logfile lokal aktualisieren
$logfile = dirname(__DIR__) . "/database/image_log.csv";
$user = $_SESSION['user'] ?? '';

// Escape semicolons in prompt to prevent CSV injection
$sanitized_prompt = str_replace(["\r", "\n", ";"], [' ', ' ', ','], $data['prompt']);

// Prüfe ob ref_image_count im Request vorhanden ist
$ref_image_count = isset($data['ref_image_count']) ? intval($data['ref_image_count']) : 0;

// Neue Felder für Multi-Generierung
$batchId = isset($data['batchId']) ? $data['batchId'] : '';
$imageNumber = isset($data['imageNumber']) ? intval($data['imageNumber']) : 1;

// CSV Format: timestamp;filename;prompt;user;size;quality;private;ref_image_count;batchId;imageNumber
$logentry = implode(';', [
    $timestamp,
    $filename,
    $sanitized_prompt,
    $user,
    $data['size'],
    $data['quality'],
    '0', // Standard: nicht privat
    $ref_image_count,
    $batchId,
    $imageNumber
]) . "\n";

file_put_contents($logfile, $logentry, FILE_APPEND);

// Statistik-CSV schreiben
$statsfile = dirname(__DIR__) . "/database/statistics.csv";

// Seitenverhältnis aus size extrahieren
$aspect_ratio = $data['size'];

// Wenn die Datei noch nicht existiert, füge eine Kopfzeile hinzu
if (!file_exists($statsfile)) {
    $header = "Date;AspectRatio;Quality;ReferenceImageCount;User;BatchId;ImageNumber\n";
    file_put_contents($statsfile, $header);
}

// Statistik-Eintrag erstellen
$statsentry = implode(';', [
    $timestamp,
    $aspect_ratio,
    $data['quality'],
    $ref_image_count,
    $user,
    $batchId,
    $imageNumber
]) . "\n";

file_put_contents($statsfile, $statsentry, FILE_APPEND);

echo json_encode(['success' => true]);
?>
