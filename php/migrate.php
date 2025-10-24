<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

// Nur für Admins
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// Idempotentes Schema anlegen
db_tx(function () {
    db()->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ("admin","user")),
            created_at TEXT NOT NULL DEFAULT (strftime("%Y-%m-%dT%H:%M:%fZ","now"))
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
            mode TEXT NOT NULL CHECK (mode IN ("openai","gemini")),
            batch_id TEXT,
            image_number INTEGER NOT NULL DEFAULT 1,
            user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
            filename TEXT,
            prompt TEXT,
            size TEXT,
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
            UNIQUE(batch_id, image_number)
        );'
    );

    db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_visible ON generations (deleted, private, created_at DESC)');
    db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_user ON generations (user_id, created_at DESC)');
    db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_batch ON generations (batch_id)');
});

function upsert_user($username, $passwordHash = null, $role = 'user') {
    $row = db_row('SELECT id FROM users WHERE username = ?', [$username]);
    if ($row) return intval($row['id']);
    $hash = $passwordHash ?: password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [$username, $hash, $role]);
    $row = db_row('SELECT id FROM users WHERE username = ?', [$username]);
    return intval($row['id']);
}

function safe_int($v, $def = 0) {
    $i = intval($v);
    return is_nan($i) ? $def : $i;
}

$summary = [
    'usersInserted' => 0,
    'customizationImported' => false,
    'fromImageLog' => 0,
    'fromStatistics' => 0,
    'skippedDuplicates' => 0
];

// users.json
$usersFile = __DIR__ . '/../database/users.json';
if (file_exists($usersFile)) {
    $users = json_decode(file_get_contents($usersFile), true) ?: [];
    foreach ($users as $username => $data) {
        $role = isset($data['role']) ? $data['role'] : 'user';
        $hash = isset($data['password']) ? $data['password'] : null;
        $exists = db_row('SELECT id FROM users WHERE username = ?', [$username]);
        if (!$exists) {
            upsert_user($username, $hash, $role);
            $summary['usersInserted']++;
        }
    }
}

// customization.json
$customizationFile = __DIR__ . '/../database/customization.json';
if (file_exists($customizationFile)) {
    $json = file_get_contents($customizationFile);
    if ($json !== false && $json !== '') {
        db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
            'customization',
            $json
        ]);
        $summary['customizationImported'] = true;
    }
}

// ensure gemini_available key exists based on encrypted key
$gk = db_row('SELECT value FROM settings WHERE key = ?', ['gemini_key_enc']);
if ($gk) {
    db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [
        'gemini_available', '1'
    ]);
} else {
    db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', [
        'gemini_available', '0'
    ]);
}

// image_log.csv
$logfile = __DIR__ . '/../database/image_log.csv';
if (file_exists($logfile)) {
    $lines = file($logfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $parts = explode(';', $line);
        if (count($parts) < 2) continue;
        $timestamp = $parts[0] ?? '';
        $filename = $parts[1] ?? '';
        $prompt = $parts[2] ?? '';
        $user = $parts[3] ?? '';
        $size = $parts[4] ?? '1024x1024';
        $quality = $parts[5] ?? 'medium';
        $private = ($parts[6] ?? '0') === '1' ? 1 : 0;
        $refCount = safe_int($parts[7] ?? 0);
        $batchId = $parts[8] ?? '';
        $batchId = ($batchId === '') ? null : $batchId;
        $imageNumber = safe_int($parts[9] ?? 1, 1);
        $mode = $parts[10] ?? 'openai';

        $user_id = upsert_user($user);
        $imagePath = __DIR__ . '/../images/' . $filename;
        $deleted = is_file($imagePath) ? 0 : 1;

        // Kosten
        if ($mode === 'gemini' || $quality === 'gemini') {
            $imageCost = 3; // Cent
            $refCost = $refCount * 15;
        } else {
            $imageCost = ($quality === 'low') ? 3 : (($quality === 'high') ? 25 : 6);
            $refCost = $refCount * 3;
        }
        $totalCost = $imageCost + $refCost;

        // Skip bei bestehendem filename
        $exists = db_row('SELECT id FROM generations WHERE filename = ?', [$filename]);
        if ($filename !== '' && $exists) { $summary['skippedDuplicates']++; continue; }

        db_exec(
            'INSERT OR IGNORE INTO generations (
                created_at, mode, batch_id, image_number, user_id, filename, prompt, size, quality, private,
                ref_image_count, width, height, aspect_class, deleted,
                cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $timestamp,
                ($mode === 'gemini' ? 'gemini' : 'openai'),
                $batchId,
                $imageNumber,
                $user_id,
                $filename,
                $prompt,
                $size,
                $quality,
                $private,
                $refCount,
                null,
                null,
                $size,
                $deleted,
                $imageCost,
                $refCost,
                $totalCost,
                '2025-10'
            ]
        );
        $summary['fromImageLog']++;
    }
}

// statistics.csv (für evtl. gelöschte Bilder, die nicht mehr im Log stehen)
$statsfile = __DIR__ . '/../database/statistics.csv';
if (file_exists($statsfile)) {
    $lines = file($statsfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines && count($lines) > 0) {
        if (strpos($lines[0], ';') !== false && stripos($lines[0], 'date') !== false) {
            array_shift($lines);
        }
    }
    foreach ($lines as $line) {
        $data = str_getcsv($line, ';');
        if (count($data) < 5) continue;
        $date = $data[0] ?? '';
        $size = $data[1] ?? '';
        $quality = $data[2] ?? 'medium';
        $refCount = safe_int($data[3] ?? 0);
        $user = $data[4] ?? '';
        $batchId = $data[5] ?? '';
        $batchId = ($batchId === '') ? null : $batchId;
        $imageNumber = safe_int($data[6] ?? 1, 1);

        $user_id = upsert_user($user);

        // Duplicate detection: existiert Eintrag für gleiche (batch_id, image_number)?
        $dup = null;
        if (!is_null($batchId)) {
            $dup = db_row('SELECT id FROM generations WHERE batch_id = ? AND image_number = ?', [$batchId, $imageNumber]);
        }
        if ($dup) { $summary['skippedDuplicates']++; continue; }

        // Kosten
        if ($quality === 'gemini') {
            $imageCost = 3;
            $refCost = $refCount * 15;
            $mode = 'gemini';
        } else {
            $imageCost = ($quality === 'low') ? 3 : (($quality === 'high') ? 25 : 6);
            $refCost = $refCount * 3;
            $mode = 'openai';
        }
        $totalCost = $imageCost + $refCost;

        db_exec(
            'INSERT OR IGNORE INTO generations (
                created_at, mode, batch_id, image_number, user_id, filename, prompt, size, quality, private,
                ref_image_count, width, height, aspect_class, deleted,
                cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $date,
                $mode,
                $batchId,
                $imageNumber,
                $user_id,
                null,
                null,
                $size,
                $quality,
                0,
                $refCount,
                null,
                null,
                $size,
                1,
                $imageCost,
                $refCost,
                $totalCost,
                '2025-10'
            ]
        );
        $summary['fromStatistics']++;
    }
}

echo json_encode(['success' => true, 'summary' => $summary]);


