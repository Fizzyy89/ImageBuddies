<?php
header('Content-Type: application/json');

require_once __DIR__ . '/password_validation.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/crypto.php';

$dbPath = __DIR__ . '/../database';

// Handle GET request to check setup status
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $dbExists = file_exists(db_path());
    $hasUsers = $dbExists && db_table_exists('users');
    $hasSettings = $dbExists && db_table_exists('settings');
    $setupRequired = !($dbExists && $hasUsers && $hasSettings);
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
    $supportedLanguages = ['en', 'de', 'es', 'pl', 'fr'];
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

    // Validate password length
    $validation = validatePassword($data['password']);
    if (!$validation['valid']) {
        http_response_code(400);
        echo json_encode(['error_key' => $validation['error_key']]);
        exit;
    }

    try {
        $stage = 'start';
        // Create database directory if it doesn't exist
        if (!is_dir($dbPath)) {
            mkdir($dbPath, 0777, true);
        }

        // Create SQLite schema (idempotent)
        $stage = 'schema';
        db_tx(function () {
            db()->exec(
                'CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN (\'admin\',\'user\')),
                    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
                );'
            );

            db()->exec(
                'CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );'
            );

            db()->exec(
                'CREATE TABLE IF NOT EXISTS generations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    mode TEXT NOT NULL CHECK (mode IN (\'openai\',\'gemini\')),
                    batch_id TEXT,
                    image_number INTEGER NOT NULL DEFAULT 1,
                    user_id INTEGER NOT NULL,
                    filename TEXT,
                    prompt TEXT,
                    quality TEXT,
                    private INTEGER NOT NULL DEFAULT 0,
                    ref_image_count INTEGER NOT NULL DEFAULT 0,
                    width INTEGER,
                    height INTEGER,
                    aspect_class TEXT,
                    deleted INTEGER NOT NULL DEFAULT 0,
                    cost_image_cents INTEGER NOT NULL DEFAULT 0,
                    cost_ref_cents INTEGER NOT NULL DEFAULT 0,
                    cost_total_cents INTEGER NOT NULL DEFAULT 0,
                    pricing_schema TEXT NOT NULL DEFAULT "2025-10",
                    UNIQUE(filename),
                    UNIQUE(batch_id, image_number),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
                );'
            );

            db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_visible ON generations (deleted, private, created_at DESC)');
            db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_user ON generations (user_id, created_at DESC)');
            db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_batch ON generations (batch_id)');
        });

    // Load the selected locale file for default customization texts
    $stage = 'locale';
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

        // Seed admin user and default customization into SQLite
        $stage = 'seed';
        db_tx(function () use ($data, $defaultCustomization) {
            $exists = db_row('SELECT id FROM users WHERE username = ?', [$data['username']]);
            if ($exists === null) {
                db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [
                    $data['username'],
                    password_hash($data['password'], PASSWORD_DEFAULT),
                    'admin'
                ]);
            }
            // Save customization JSON as a settings key
            $customJson = json_encode($defaultCustomization, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($customJson === false) {
                throw new Exception('customization_encode_failed');
            }
            db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
                'customization',
                $customJson
            ]);

            // Store OpenAI key encrypted in DB (optional, may be empty)
            $apiKeyTrim = isset($data['apiKey']) ? trim($data['apiKey']) : '';
            $enc = encrypt_secret($apiKeyTrim);
            if ($enc !== null && $enc !== '') {
                db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
                    'openai_key_enc',
                    $enc
                ]);
            }
            // Init gemini_available = 0
            db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', [
                'gemini_available', '0'
            ]);
        });

        echo json_encode(['success' => true]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'setup_failed', 'stage' => isset($stage)?$stage:'unknown']);
        exit;
    }
}

// Handle unsupported methods
http_response_code(405);
echo json_encode(['error_key' => 'error.setup.methodNotAllowed']); 