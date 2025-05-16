<?php
// openai_proxy.php
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

$OPENAI_KEY = null;
$envFile = __DIR__ . '/../database/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, 'OPENAI_KEY=') === 0) {
            $OPENAI_KEY = substr($line, strlen('OPENAI_KEY='));
            break;
        }
    }
}
if (!$OPENAI_KEY) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.proxy.apiKeyMissing']);
    exit;
}

$endpoint = $_GET['endpoint'] ?? '';

if ($endpoint === 'generations') {
    $url = 'https://api.openai.com/v1/images/generations';
    $headers = [
        'Authorization: Bearer ' . $OPENAI_KEY,
        'Content-Type: application/json'
    ];
    $body = file_get_contents('php://input');
    
    // Validiere und begrenze den n Parameter
    $data = json_decode($body, true);
    if (isset($data['n'])) {
        $data['n'] = min(max(intval($data['n']), 1), 4); // Begrenze auf 1-4 Bilder
        $body = json_encode($data);
    }
} elseif ($endpoint === 'edits') {
    $url = 'https://api.openai.com/v1/images/edits';
    $headers = [
        'Authorization: Bearer ' . $OPENAI_KEY
    ];
    $body = null; 
    if (isset($_POST['n'])) {
        $n = min(max(intval($_POST['n']), 1), 4);
        $_POST['n'] = $n;
    }
} elseif ($endpoint === 'optimize') {
    $url = 'https://api.openai.com/v1/chat/completions';
    $headers = [
        'Authorization: Bearer ' . $OPENAI_KEY,
        'Content-Type: application/json'
    ];
    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['prompt'])) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.proxy.missingPrompt']);
        exit;
    }
    $body = json_encode([
        'model' => 'gpt-4.1-mini',
        'messages' => [
            ['role' => 'system', 'content' => 'Du bist ein Prompt-Optimierer für KI-Bildgeneratoren. Formuliere den folgenden Prompt so um, dass er möglichst klar, präzise und bildgenerierend ist. Gib nur den optimierten Prompt zurück. Sorge dafür, dass alle Prompts zu meisterhaften Ergebnissen führen.'],
            ['role' => 'user', 'content' => $data['prompt']]
        ],
        'max_tokens' => 400
    ]);
} else {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.proxy.invalidEndpoint']);
    exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($endpoint === 'edits') {
    // multipart/form-data weiterleiten
    $formData = [];
    foreach ($_FILES as $key => $fileArr) {
        if (is_array($fileArr['tmp_name'])) {
            foreach ($fileArr['tmp_name'] as $i => $tmpName) {
                $formData[$key . "[$i]"] = new CURLFile($tmpName, $fileArr['type'][$i], $fileArr['name'][$i]);
            }
        } else {
            $formData[$key] = new CURLFile($fileArr['tmp_name'], $fileArr['type'], $fileArr['name']);
        }
    }
    foreach ($_POST as $k => $v) {
        $formData[$k] = $v;
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, $formData);
} else {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    // Log the specific cURL error for debugging if possible, but return a generic key to the client
    error_log("cURL Error in openai_proxy.php: " . $error); 
    echo json_encode(['error_key' => 'error.proxy.requestFailed']);
    exit;
}

if ($endpoint === 'optimize') {
    $data = json_decode($response, true);
    $optimized = $data['choices'][0]['message']['content'] ?? null;
    echo json_encode(['optimizedPrompt' => trim($optimized)]);
    exit;
}

http_response_code($httpcode);
echo $response; 