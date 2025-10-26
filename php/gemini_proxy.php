<?php
// gemini_proxy.php - Proxy für Gemini API (Nano Banana Bildbearbeitung)
session_start();
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

header('Content-Type: application/json');

// Nur POST zulassen
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error_key' => 'error.proxy.postOnly']);
    exit;
}

// Gemini API Key aus DB (verschlüsselt) laden
$GEMINI_KEY = null;
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';
$row = db_row('SELECT value FROM settings WHERE key = ?', ['gemini_key_enc']);
if ($row) {
    $GEMINI_KEY = decrypt_secret($row['value']);
}

if (!$GEMINI_KEY) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.proxy.geminiKeyMissing']);
    exit;
}

$endpoint = $_GET['endpoint'] ?? '';

if ($endpoint === 'edit') {
    // Bildbearbeitung mit gemini-2.5-flash-image
    $model = 'gemini-2.5-flash-image';
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$GEMINI_KEY}";
    
    // Prüfe ob Prompt vorhanden ist
    if (!isset($_POST['prompt']) || empty(trim($_POST['prompt']))) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.proxy.missingPrompt']);
        exit;
    }
    
    $prompt = trim($_POST['prompt']);
    
    // Prüfe ob mindestens ein Bild hochgeladen wurde
    if (!isset($_FILES['image']) || empty($_FILES['image']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.proxy.missingImage']);
        exit;
    }
    
    // Verarbeite das/die Bilder
    $images = [];
    if (is_array($_FILES['image']['tmp_name'])) {
        // Multiple images
        foreach ($_FILES['image']['tmp_name'] as $idx => $tmpName) {
            if (!empty($tmpName) && $_FILES['image']['error'][$idx] === UPLOAD_ERR_OK) {
                $imageData = file_get_contents($tmpName);
                if ($imageData !== false) {
                    $images[] = [
                        'data' => base64_encode($imageData),
                        'mime_type' => $_FILES['image']['type'][$idx]
                    ];
                }
            }
        }
    } else {
        // Single image
        if ($_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $imageData = file_get_contents($_FILES['image']['tmp_name']);
            if ($imageData !== false) {
                $images[] = [
                    'data' => base64_encode($imageData),
                    'mime_type' => $_FILES['image']['type']
                ];
            }
        }
    }
    
    if (empty($images)) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.proxy.imageReadFailed']);
        exit;
    }
    
    // Begrenze auf maximal 3 Bilder
    if (count($images) > 3) {
        $images = array_slice($images, 0, 3);
    }
    
    // Erstelle die API-Anfrage
    $parts = [
        ['text' => $prompt]
    ];
    
    // Füge alle Bilder hinzu
    foreach ($images as $image) {
        $parts[] = [
            'inlineData' => [
                'mimeType' => $image['mime_type'],
                'data' => $image['data']
            ]
        ];
    }
    
    $requestPayload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => $parts
            ]
        ],
        'generationConfig' => [
            'responseModalities' => ['IMAGE']
        ]
    ];

    // Optional: Seitenverhältnis übergeben
    $aspectRatio = $_POST['aspect_ratio'] ?? '';
    if ($aspectRatio) {
        $requestPayload['generationConfig']['imageConfig'] = [
            'aspectRatio' => $aspectRatio
        ];
    }
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestPayload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        http_response_code(500);
        error_log("cURL Error in gemini_proxy.php: " . $error);
        echo json_encode(['error_key' => 'error.proxy.requestFailed']);
        exit;
    }
    
    if ($httpcode !== 200) {
        http_response_code($httpcode);
        echo $response;
        exit;
    }
    
    // Verarbeite die Antwort
    $data = json_decode($response, true);
    
    // Extrahiere das bearbeitete Bild
    $editedBase64Image = null;
    $editedMimeType = null;
    
    if (isset($data['candidates'][0]['content']['parts'])) {
        foreach ($data['candidates'][0]['content']['parts'] as $part) {
            if (isset($part['inlineData'])) {
                $editedBase64Image = $part['inlineData']['data'];
                $editedMimeType = $part['inlineData']['mimeType'];
                break;
            }
        }
    }
    
    if (!$editedBase64Image) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.proxy.noImageInResponse']);
        exit;
    }
    
    // Gib das Bild im OpenAI-kompatiblen Format zurück
    echo json_encode([
        'data' => [
            [
                'b64_json' => $editedBase64Image,
                'revised_prompt' => $prompt
            ]
        ]
    ]);
    
} else {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.proxy.invalidEndpoint']);
    exit;
}

