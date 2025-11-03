<?php
// openai_proxy.php
session_start();
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

header('Content-Type: application/json');

// Allow POST only
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error_key' => 'error.proxy.postOnly']);
    exit;
}

$OPENAI_KEY = null;
require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';
require_once IMB_SRC_DIR . '/crypto.php';
$row = db_row('SELECT value FROM settings WHERE key = ?', ['openai_key_enc']);
if ($row) {
    $OPENAI_KEY = decrypt_secret($row['value']);
}
if (!$OPENAI_KEY) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.proxy.apiKeyMissing']);
    exit;
}

$endpoint = $_GET['endpoint'] ?? '';
// Flag for streaming endpoints
$isStream = ($endpoint === 'generations_stream');

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
} elseif ($endpoint === 'generations_stream') {
    // Streaming (SSE) for image generations
    // Note: streaming is currently limited to n=1
    $url = 'https://api.openai.com/v1/images/generations';
    $headers = [
        'Authorization: Bearer ' . $OPENAI_KEY,
        'Content-Type: application/json',
        'Accept: text/event-stream'
    ];
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    // Force streaming parameters
    $data['stream'] = true;
    $data['n'] = 1; // Streaming zunächst nur für ein Bild
    $partialImages = isset($data['partial_images']) ? intval($data['partial_images']) : 3;
    $data['partial_images'] = min(max($partialImages, 0), 3);
    // Ensure expected fields remain (model, prompt, size, quality, moderation)
    $body = json_encode($data);
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
            ['role' => 'system', 'content' => 'You are a prompt optimizer for AI image generators. Rephrase the following prompt to make it as clear, precise and image-generating as possible. Only return the optimized prompt. Add creativity and ensure all prompts lead to masterful results. Write the optimized prompt in the language of the user input.'],
            ['role' => 'user', 'content' => $data['prompt']]
        ],
    ]);
} elseif ($endpoint === 'random') {
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
            ['role' => 'system', 'content' => 'You are a creative prompt generator for AI image generation. Create an optimized prompt for image generation. You may discard elements of the user prompt if they don\t fit together and write a better alternative. Only return the generated prompt.'],
            ['role' => 'user', 'content' => $data['prompt']]
        ],
    ]);
} else {
    http_response_code(400);
    echo json_encode(['error_key' => 'error.proxy.invalidEndpoint']);
    exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($isStream) {
    // Set Server-Sent Events headers for client
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    // Disable proxy/server buffering where possible
    header('X-Accel-Buffering: no');
    // Release session to avoid blocking
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }
    // Clear output buffers
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @ob_implicit_flush(true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
    // Stream forwarding: pass incoming SSE data directly to client
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $chunk) {
        echo $chunk;
        @flush();
        return strlen($chunk);
    });
} else {
    header('Content-Type: application/json');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
}

if ($endpoint === 'edits') {
    // Forward multipart/form-data
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

if ($isStream) {
    // Streaming exec: output has already been streamed
    $ok = curl_exec($ch);
    if ($ok === false) {
        // Send error as SSE event
        $err = curl_error($ch);
        echo "event: error\n";
        echo 'data: ' . json_encode(['message' => 'stream_failed', 'detail' => $err]) . "\n\n";
    }
    curl_close($ch);
    exit;
} else {
    $response = curl_exec($ch);
    $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
}

if (!$isStream && $error) {
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

if ($endpoint === 'random') {
    $data = json_decode($response, true);
    $randomPrompt = $data['choices'][0]['message']['content'] ?? null;
    echo json_encode(['randomPrompt' => trim($randomPrompt)]);
    exit;
}

http_response_code($httpcode);
echo $response; 