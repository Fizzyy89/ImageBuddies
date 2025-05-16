<?php
header('Content-Type: application/json');

$dbPath = __DIR__ . '/../database';
$usersFile = $dbPath . '/users.json';
$customizationFile = $dbPath . '/customization.json';
$envFile = $dbPath . '/.env';

// Handle GET request to check setup status
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $setupRequired = !file_exists($usersFile) || !file_exists($customizationFile) || !file_exists($envFile);
    echo json_encode(['setupRequired' => $setupRequired]);
    exit;
}

// Handle POST request to perform setup
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate input data
    $requiredFields = ['username', 'password', 'passwordConfirm', 'viewOnlyAllowed', 'apiKey', 'language'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field])) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.setup.missingInput']);
            exit;
        }
    }

    // Validate language is supported
    $supportedLanguages = ['en', 'de'];
    $setupLanguage = $data['language'];
    if (!in_array($setupLanguage, $supportedLanguages)) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.setup.unsupportedLanguage']);
        exit;
    }

    // Validate passwords match
    if ($data['password'] !== $data['passwordConfirm']) {
        http_response_code(400);
        echo json_encode(['error_key' => 'error.setup.passwordsMismatch']);
        exit;
    }

    // Create database directory if it doesn't exist
    if (!is_dir($dbPath)) {
        mkdir($dbPath, 0777, true);
    }

    // Create users.json
    $users = [
        $data['username'] => [
            'password' => password_hash($data['password'], PASSWORD_DEFAULT),
            'role' => 'admin'
        ]
    ];
    if (!file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT))) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.setup.createUserFileFailed']);
        exit;
    }

    // Load the selected locale file for default customization texts
    $localeFilePath = __DIR__ . '/../locales/' . $setupLanguage . '.json';
    $localeData = [];
    if (file_exists($localeFilePath)) {
        $localeJson = file_get_contents($localeFilePath);
        $localeData = json_decode($localeJson, true);
    } else { // Fallback to English if locale file not found (should not happen with validation)
        $localeFilePath = __DIR__ . '/../locales/en.json';
        if (file_exists($localeFilePath)) {
            $localeJson = file_get_contents($localeFilePath);
            $localeData = json_decode($localeJson, true);
        }
    }

    // Default configuration using translated texts
    $defaultCustomization = [
        "siteName" => $localeData['setup.default.siteName'] ?? "ImageBuddies",
        "poweredBy" => $localeData['setup.default.poweredBy'] ?? "Powered by OpenAI",
        "mainHeadline" => $localeData['setup.default.mainHeadline'] ?? "Turn your ideas into<br/>breathtaking images",
        "mainSubline" => $localeData['setup.default.mainSubline'] ?? "Use the power of AI to create unique artworks from simple descriptions and reference images. Fast, easy and creative.",
        "features" => [
            $localeData['setup.default.feature.highRes'] ?? "High-resolution images",
            $localeData['setup.default.feature.fastGen'] ?? "Fast generation",
            $localeData['setup.default.feature.secureProc'] ?? "Secure processing"
        ],
        "footerSiteName" => $localeData['setup.default.siteName'] ?? "ImageBuddies", // Reuse siteName
        "footerCompany" => "github.com/fizzyy89", // Not translatable
        "loginContact" => $localeData['setup.default.loginContact'] ?? "Access is granted upon request by <span class=\"font-medium text-indigo-600 dark:text-indigo-400\">the admin</span>.",
        "viewOnlyAllowed" => $data['viewOnlyAllowed'],
        "hideHeader" => false,
        "language" => $setupLanguage // Use the language selected during setup
    ];

    // Create customization.json
    if (!file_put_contents($customizationFile, json_encode($defaultCustomization, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.setup.createCustomizationFileFailed']);
        exit;
    }

    // Create .env with API Key
    if (!file_put_contents($envFile, "OPENAI_KEY=" . trim($data['apiKey']) . "\n")) {
        http_response_code(500);
        echo json_encode(['error_key' => 'error.setup.createEnvFileFailed']);
        exit;
    }

    echo json_encode(['success' => true]);
    exit;
}

// Handle unsupported methods
http_response_code(405);
echo json_encode(['error_key' => 'error.setup.methodNotAllowed']); 