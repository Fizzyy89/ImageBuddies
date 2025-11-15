<?php
/**
 * Web-basierte Version des Reference Images Deduplication Migration Scripts
 * Kann direkt im Browser aufgerufen werden
 */

session_start();

// Nur für eingeloggte Admins
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo "Zugriff verweigert. Nur Admins können diese Migration ausführen.";
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';
require_once IMB_SRC_DIR . '/migrations.php';

$dryRun = isset($_GET['dry_run']) && $_GET['dry_run'] === '1';
$action = $_GET['action'] ?? '';

// Check if main image migration is needed
$mainImageMigrationNeeded = false;
try {
    if (db_table_exists('generations')) {
        $migrationDone = db_row('SELECT value FROM settings WHERE key = ?', ['migration.is_main_image']);
        if (!$migrationDone || $migrationDone['value'] !== 'done') {
            $mainImageMigrationNeeded = true;
        }
    }
} catch (Exception $e) {
    // Ignore errors
}

// Check if batches migration is needed
$batchesMigrationNeeded = false;
try {
    if (db_table_exists('generations')) {
        $migrationDone = db_row('SELECT value FROM settings WHERE key = ?', ['migration.batches']);
        
        // Check if migration was marked as done BUT generations table still has old schema
        $needsRestructure = db_column_exists('generations', 'prompt');
        
        if ($needsRestructure) {
            // Table has old schema, migration incomplete!
            $batchesMigrationNeeded = true;
        } elseif (!$migrationDone || $migrationDone['value'] !== 'done') {
            // Migration not done yet, check if there's data to migrate
            $genCount = db_row('SELECT COUNT(*) as cnt FROM generations');
            if ($genCount && $genCount['cnt'] > 0) {
                $batchesMigrationNeeded = true;
            }
        }
    }
} catch (Exception $e) {
    // Ignore errors
}

// Check if reference images migration is needed
$refImagesMigrationNeeded = false;
try {
    $migrationDone = db_row('SELECT value FROM settings WHERE key = ?', ['migration.ref_deduplication']);
    if (!$migrationDone || $migrationDone['value'] !== 'done') {
        // Check if there are old-style batch directories
        $refsRoot = IMB_IMAGE_DIR . '/refs';
        if (is_dir($refsRoot)) {
            $batchDirs = glob($refsRoot . '/*', GLOB_ONLYDIR);
            $batchDirs = array_filter($batchDirs, function($dir) {
                return basename($dir) !== 'thumbs';
            });
            if (!empty($batchDirs)) {
                $refImagesMigrationNeeded = true;
            }
        }
    }
} catch (Exception $e) {
    // Ignore errors
}

// Check if thumbnail regeneration is needed
$thumbRegenerationNeeded = false;
try {
$usersRoleMigrationNeeded = false;
try {
    if (db_table_exists('users')) {
        $schema = db_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
        if ($schema && stripos((string)$schema['sql'], 'superuser') === false) {
            $usersRoleMigrationNeeded = true;
        }
    }
} catch (Exception $e) {
    // Ignore errors
}
    if (db_table_exists('reference_images')) {
        $migrationDone = db_row('SELECT value FROM settings WHERE key = ?', ['migration.ref_thumbnails']);
        if (!$migrationDone || $migrationDone['value'] !== 'done') {
            // Check if there are reference images without thumbnails
            $refs = db_rows('SELECT file_path, thumb_path FROM reference_images LIMIT 100');
            foreach ($refs as $ref) {
                $thumbFullPath = IMB_PUBLIC_DIR . '/' . $ref['thumb_path'];
                if (!is_file($thumbFullPath)) {
                    $thumbRegenerationNeeded = true;
                    break;
                }
            }
        }
    }
} catch (Exception $e) {
    // Ignore errors
}

?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Migrations-Center - ImageBuddies</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
            color: #e0e0e0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: #252525;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
            color: white;
        }
        .header p {
            font-size: 14px;
            color: rgba(255,255,255,0.9);
        }
        .content {
            padding: 30px;
        }
        .warning {
            background: #3a2a1a;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .warning strong {
            color: #fbbf24;
            display: block;
            margin-bottom: 8px;
        }
        .button-group {
            display: flex;
            gap: 15px;
            margin: 20px 0;
        }
        .btn {
            flex: 1;
            padding: 15px 25px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            background: #3a3a3a;
            color: #e0e0e0;
        }
        .btn-secondary:hover {
            background: #4a4a4a;
        }
        .output {
            background: #1a1a1a;
            border: 1px solid #3a3a3a;
            border-radius: 8px;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            max-height: 600px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .output .success { color: #10b981; }
        .output .error { color: #ef4444; }
        .output .warning { color: #f59e0b; }
        .output .info { color: #3b82f6; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            background: #1a1a1a;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #3a3a3a;
        }
        .stat-card .value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .stat-card .label {
            font-size: 12px;
            color: #9ca3af;
            text-transform: uppercase;
        }
        .back-link {
            display: inline-block;
            margin-top: 20px;
            color: #667eea;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Migrations-Center</h1>
            <p>Datenbank- und System-Migrationen für ImageBuddies</p>
        </div>
        
        <div class="content">
            <?php if ($action === ''): ?>
                <h2 style="margin-bottom: 15px;">Migrations-Status</h2>
                
                <?php if ($usersRoleMigrationNeeded): ?>
                    <div style="background: #2a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #fbbf24; display: block; margin-bottom: 8px;">⚠️ Superuser-Rollen-Migration erforderlich</strong>
                        <p style="margin-bottom: 10px;">Ältere Installationen erlauben nur Admin/User-Rollen. Diese Migration aktualisiert die Users-Tabelle, damit Superuser korrekt gespeichert werden können.</p>
                        <ul style="margin-bottom: 15px; padding-left: 20px; font-size: 14px;">
                            <li>Aktualisiert das Datenbankschema der Users-Tabelle</li>
                            <li>Bewahrt alle vorhandenen Benutzer und Passwörter</li>
                            <li>Stellt die Superuser-Rolle für VideoBuddies bereit</li>
                        </ul>
                        <a href="?action=migrate_user_roles" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            ✅ Migration durchführen
                        </a>
                    </div>
                <?php else: ?>
                    <?php if (db_table_exists('users')): ?>
                        <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #10b981; display: block; margin-bottom: 8px;">✅ Users-Tabelle unterstützt Superuser</strong>
                            <p>Die Superuser-Rolle ist bereits im Datenbankschema verfügbar.</p>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>
                
                <?php if ($mainImageMigrationNeeded): ?>
                    <div style="background: #2a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #fbbf24; display: block; margin-bottom: 8px;">⚠️ Hauptbild-Migration erforderlich</strong>
                        <p style="margin-bottom: 10px;">Die Hauptbild-Flag-Migration wurde noch nicht durchgeführt. Diese sollte VOR der Referenzbilder-Migration ausgeführt werden.</p>
                        <a href="?action=migrate_main_image" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px; margin-top: 10px;">
                            🎯 Hauptbild-Migration durchführen
                        </a>
                    </div>
                <?php else: ?>
                    <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #10b981; display: block; margin-bottom: 8px;">✅ Hauptbild-Migration</strong>
                        <p>Die Hauptbild-Flag-Migration wurde bereits durchgeführt.</p>
                    </div>
                <?php endif; ?>

                <?php if ($batchesMigrationNeeded): ?>
                    <div style="background: #2a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #fbbf24; display: block; margin-bottom: 8px;">⚠️ Batches-Migration erforderlich</strong>
                        <p style="margin-bottom: 10px;">Die Batches-Tabellen-Migration wurde noch nicht durchgeführt. Diese eliminiert redundante Datenspeicherung und verbessert die Performance.</p>
                        
                        <h3 style="margin: 15px 0 10px 0; font-size: 14px;">Batches-Tabellen Migration</h3>
                        <ul style="margin-bottom: 15px; padding-left: 20px; font-size: 14px;">
                            <li>Erstellt dedizierte Batches-Tabelle</li>
                            <li>Eliminiert redundante Datenspeicherung</li>
                            <li>Verbessert Performance bei Batch-Operationen</li>
                            <li>Spart bis zu 75% Speicherplatz bei Batch-Metadaten</li>
                        </ul>
                        
                        <div class="button-group" style="margin-top: 15px;">
                            <a href="?action=migrate_batches&dry_run=1" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px;">
                                🔍 Probelauf (Dry-Run)
                            </a>
                            <a href="?action=migrate_batches&dry_run=0" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                ✅ Migration durchführen
                            </a>
                        </div>
                    </div>
                <?php else: ?>
                    <?php 
                    $batchesDone = false;
                    try {
                        $migCheck = db_row('SELECT value FROM settings WHERE key = ?', ['migration.batches']);
                        $batchesDone = $migCheck && $migCheck['value'] === 'done';
                    } catch (Exception $e) {}
                    ?>
                    <?php if ($batchesDone): ?>
                        <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #10b981; display: block; margin-bottom: 8px;">✅ Batches-Migration</strong>
                            <p>Die Batches-Tabellen-Migration wurde bereits durchgeführt.</p>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>

                <?php if ($refImagesMigrationNeeded): ?>
                    <div style="background: #2a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #fbbf24; display: block; margin-bottom: 8px;">⚠️ Referenzbilder-Deduplizierung erforderlich</strong>
                        <p style="margin-bottom: 10px;">Die Referenzbilder-Deduplizierung wurde noch nicht durchgeführt. Diese konsolidiert Referenzbilder und entfernt Duplikate.</p>
                        
                        <h3 style="margin: 15px 0 10px 0; font-size: 14px;">Referenzbilder-Deduplizierung</h3>
                        <ul style="margin-bottom: 15px; padding-left: 20px; font-size: 14px;">
                            <li>Erstellt neue Datenbank-Tabellen für Referenzbilder</li>
                            <li>Migriert bestehende Referenzbilder</li>
                            <li>Entfernt automatisch Duplikate</li>
                            <li>Generiert fehlende Thumbnails</li>
                            <li>Spart Speicherplatz</li>
                        </ul>
                        
                        <div class="button-group" style="margin-top: 15px;">
                            <a href="?action=migrate&dry_run=1" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px;">
                                🔍 Probelauf (Dry-Run)
                            </a>
                            <a href="?action=migrate&dry_run=0" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                ✅ Migration durchführen
                            </a>
                        </div>
                    </div>
                <?php else: ?>
                    <?php 
                    $refsDone = false;
                    try {
                        $migCheck = db_row('SELECT value FROM settings WHERE key = ?', ['migration.ref_deduplication']);
                        $refsDone = $migCheck && $migCheck['value'] === 'done';
                    } catch (Exception $e) {}
                    ?>
                    <?php if ($refsDone): ?>
                        <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #10b981; display: block; margin-bottom: 8px;">✅ Referenzbilder-Deduplizierung</strong>
                            <p>Die Referenzbilder-Deduplizierung wurde bereits durchgeführt.</p>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>

                <?php if ($thumbRegenerationNeeded): ?>
                    <div style="background: #2a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <strong style="color: #fbbf24; display: block; margin-bottom: 8px;">⚠️ Thumbnail-Regenerierung empfohlen</strong>
                        <p style="margin-bottom: 10px;">Einige Referenzbilder haben keine Thumbnails. Diese können nachträglich generiert werden.</p>
                        
                        <h3 style="margin: 15px 0 10px 0; font-size: 14px;">Thumbnail-Regenerierung</h3>
                        <ul style="margin-bottom: 15px; padding-left: 20px; font-size: 14px;">
                            <li>Prüft alle Referenzbilder auf fehlende Thumbnails</li>
                            <li>Generiert fehlende Thumbnails (400px max)</li>
                            <li>Verbessert Performance in der Galerie</li>
                            <li>Kann gefahrlos mehrfach ausgeführt werden</li>
                        </ul>
                        
                        <div class="button-group" style="margin-top: 15px;">
                            <a href="?action=regenerate_thumbs&dry_run=1" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px;">
                                🔍 Probelauf (Dry-Run)
                            </a>
                            <a href="?action=regenerate_thumbs&dry_run=0" class="btn btn-secondary" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                ✅ Thumbnails generieren
                            </a>
                        </div>
                    </div>
                <?php else: ?>
                    <?php 
                    $thumbsDone = false;
                    try {
                        $migCheck = db_row('SELECT value FROM settings WHERE key = ?', ['migration.ref_thumbnails']);
                        $thumbsDone = $migCheck && $migCheck['value'] === 'done';
                    } catch (Exception $e) {}
                    ?>
                    <?php if ($thumbsDone && db_table_exists('reference_images')): ?>
                        <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                            <strong style="color: #10b981; display: block; margin-bottom: 8px;">✅ Thumbnail-Regenerierung</strong>
                            <p>Alle Referenzbilder haben Thumbnails.</p>
                        </div>
                    <?php endif; ?>
                <?php endif; ?>

                <div class="warning">
                    <strong>⚠️ Wichtig vor der Migration:</strong>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        <li>Erstelle ein Backup deiner Datenbank und Bilder</li>
                        <li>Die Migrationen sind nicht-destruktiv (löschen nichts)</li>
                        <li>Führe zuerst einen Probelauf durch</li>
                    </ul>
                </div>

                <a href="../" class="back-link">← Zurück zur Gallerie</a>

            <?php elseif ($action === 'migrate_user_roles'): ?>
                <h2 style="margin-bottom: 15px;">
                    🛡️ Superuser-Rollen Migration
                </h2>

                <div class="output"><?php
                
                ob_start();
                
                try {
                    echo "<span class='info'>[1/3] Prüfe Users-Tabelle...</span>\n";
                    if (!db_table_exists('users')) {
                        throw new Exception('Tabelle "users" nicht gefunden.');
                    }
                    echo "<span class='success'>  ✓ Tabelle vorhanden</span>\n\n";

                    echo "<span class='info'>[2/3] Analysiere Schema...</span>\n";
                    $schema = db_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
                    $needsMigration = !$schema || stripos((string)$schema['sql'], 'superuser') === false;
                    if ($needsMigration) {
                        echo "  → Schema benötigt Update\n\n";
                        echo "<span class='info'>[3/3] Aktualisiere Tabelle...</span>\n";
                        ensure_users_table_supports_superuser();
                        echo "<span class='success'>  ✓ Users-Tabelle aktualisiert</span>\n";
                    } else {
                        echo "<span class='success'>  ✓ Superuser-Rolle bereits verfügbar</span>\n";
                    }

                    echo "\n<span class='success'>✅ Migration erfolgreich abgeschlossen!</span>\n";
                } catch (Exception $e) {
                    echo "\n<span class='error'>✗ Fehler: " . htmlspecialchars($e->getMessage()) . "</span>\n";
                }
                
                $output = ob_get_clean();
                echo $output;
                
                ?></div>

                <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <strong style="color: #10b981;">Hinweis:</strong><br>
                    Nach der Migration können Admins Superuser anlegen oder Rollen umstellen, ohne dass eine Fehlermeldung erscheint.
                </div>

                <div class="button-group">
                    <a href="?" class="btn btn-secondary">← Zurück</a>
                    <a href="../" class="btn btn-primary">Zur Gallerie →</a>
                </div>

            <?php elseif ($action === 'migrate_main_image'): ?>
                <h2 style="margin-bottom: 15px;">
                    🎯 Hauptbild-Flag Migration
                </h2>

                <div class="output"><?php
                
                ob_start();
                
                try {
                    echo "<span class='info'>[1/4] Überprüfe Tabelle...</span>\n";
                    
                    if (!db_table_exists('generations')) {
                        echo "<span class='error'>✗ Tabelle 'generations' nicht gefunden</span>\n";
                        throw new Exception('Keine Tabelle "generations" gefunden');
                    }
                    
                    echo "<span class='success'>  ✓ Tabelle vorhanden</span>\n\n";
                    
                    echo "<span class='info'>[2/4] Erstelle Spalte 'is_main_image' falls nötig...</span>\n";
                    
                    $columnExists = db_column_exists('generations', 'is_main_image');
                    if (!$columnExists) {
                        db_exec('ALTER TABLE generations ADD COLUMN is_main_image INTEGER NOT NULL DEFAULT 0');
                        echo "<span class='success'>  ✓ Spalte erstellt</span>\n\n";
                    } else {
                        echo "<span class='success'>  ✓ Spalte existiert bereits</span>\n\n";
                    }
                    
                    echo "<span class='info'>[3/4] Analysiere Batches und setze Hauptbilder...</span>\n";
                    
                    $rows = db_rows('SELECT id, batch_id, image_number, deleted FROM generations');
                    $mainIds = [];
                    $batches = [];
                    
                    foreach ($rows as $row) {
                        $id = isset($row['id']) ? (int)$row['id'] : null;
                        if ($id === null) continue;
                        
                        $batchId = isset($row['batch_id']) ? trim((string)$row['batch_id']) : '';
                        $imageNumber = isset($row['image_number']) ? (int)$row['image_number'] : null;
                        $deleted = isset($row['deleted']) ? (int)$row['deleted'] : 0;
                        
                        if ($batchId === '') {
                            if ($deleted === 0) {
                                $mainIds[] = $id;
                            }
                            continue;
                        }
                        
                        if (!isset($batches[$batchId])) {
                            $batches[$batchId] = [];
                        }
                        $batches[$batchId][] = [
                            'id' => $id,
                            'image_number' => $imageNumber,
                            'deleted' => $deleted
                        ];
                    }
                    
                    echo "  → Gefunden: <strong>" . count($batches) . "</strong> Batches mit mehreren Bildern\n";
                    echo "  → Einzelbilder: <strong>" . count($mainIds) . "</strong>\n\n";
                    
                    foreach ($batches as $batchId => $batchRows) {
                        $candidate = null;
                        foreach ($batchRows as $entry) {
                            if ($entry['deleted'] === 0 && $entry['image_number'] === 1) {
                                $candidate = $entry;
                                break;
                            }
                        }
                        if ($candidate === null) {
                            foreach ($batchRows as $entry) {
                                if ($entry['deleted'] === 0) {
                                    if ($candidate === null || $entry['image_number'] < $candidate['image_number']) {
                                        $candidate = $entry;
                                    }
                                }
                            }
                        }
                        if ($candidate !== null && $candidate['deleted'] === 0) {
                            $mainIds[] = $candidate['id'];
                        }
                    }
                    
                    echo "<span class='info'>[4/4] Aktualisiere Datenbank...</span>\n";
                    
                    db_tx(function () use ($mainIds) {
                        db_exec('UPDATE generations SET is_main_image = 0');
                        foreach ($mainIds as $id) {
                            db_exec('UPDATE generations SET is_main_image = 1 WHERE id = ?', [$id]);
                        }
                    });
                    
                    echo "<span class='success'>  ✓ " . count($mainIds) . " Hauptbilder markiert</span>\n\n";
                    
                    db_exec('CREATE INDEX IF NOT EXISTS idx_generations_main_flag ON generations (is_main_image)');
                    db_exec('CREATE INDEX IF NOT EXISTS idx_generations_batch_main_flag ON generations (batch_id, is_main_image)');
                    try {
                        db_exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_batch_main_unique ON generations (batch_id) WHERE batch_id IS NOT NULL AND is_main_image = 1');
                    } catch (Throwable $e) {
                        // Ignore if already exists
                    }
                    
                    if (db_table_exists('settings')) {
                        db_exec(
                            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
                            ['migration.is_main_image', 'done']
                        );
                    }
                    
                    echo "<span class='success'>✅ Migration erfolgreich abgeschlossen!</span>\n";
                    echo "<span class='success'>   " . count($mainIds) . " Hauptbilder wurden markiert</span>\n";
                    
                } catch (Exception $e) {
                    echo "\n<span class='error'>✗ Fehler: " . htmlspecialchars($e->getMessage()) . "</span>\n";
                }
                
                $output = ob_get_clean();
                echo $output;
                
                ?></div>

                <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <strong style="color: #10b981;">✅ Hauptbild-Migration abgeschlossen!</strong><br><br>
                    Du kannst jetzt die Referenzbilder-Migration durchführen.
                </div>

                <div class="button-group">
                    <a href="?" class="btn btn-secondary">← Zurück</a>
                    <a href="?action=migrate&dry_run=1" class="btn btn-primary">Weiter zur Referenzbilder-Migration →</a>
                </div>

            <?php elseif ($action === 'migrate_batches'): ?>
                <?php $dryRunBatches = isset($_GET['dry_run']) && $_GET['dry_run'] === '1'; ?>
                <h2 style="margin-bottom: 15px;">
                    <?php echo $dryRunBatches ? '🔍 Batches-Migration Probelauf' : '🗂️ Batches-Tabellen Migration'; ?>
                </h2>

                <div class="output"><?php
                
                ob_start();
                
                try {
                    if ($dryRunBatches) {
                        echo "<span class='warning'>⚠️  DRY RUN MODE - Keine Änderungen werden vorgenommen</span>\n\n";
                    }
                    
                    echo "<span class='info'>[1/6] Überprüfe Voraussetzungen...</span>\n";
                    
                    if (!db_table_exists('generations')) {
                        throw new Exception('Tabelle "generations" nicht gefunden');
                    }
                    echo "<span class='success'>  ✓ Tabelle 'generations' vorhanden</span>\n";
                    
                    // Check if batches table exists, create if not
                    $batchesTableExists = db_table_exists('batches');
                    if (!$batchesTableExists) {
                        echo "  → Tabelle 'batches' existiert noch nicht\n";
                        if (!$dryRunBatches) {
                            echo "  → Erstelle Tabelle 'batches'...\n";
                            db_tx(function () {
                                db()->exec(
                                    'CREATE TABLE IF NOT EXISTS batches (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        batch_id TEXT NOT NULL UNIQUE,
                                        prompt TEXT NOT NULL,
                                        quality TEXT,
                                        aspect_class TEXT,
                                        mode TEXT NOT NULL CHECK (mode IN (\'openai\',\'gemini\')),
                                        user_id INTEGER NOT NULL,
                                        private INTEGER NOT NULL DEFAULT 0,
                                        archived INTEGER NOT NULL DEFAULT 0,
                                        deleted INTEGER NOT NULL DEFAULT 0,
                                        created_at TEXT NOT NULL,
                                        cost_image_cents INTEGER NOT NULL DEFAULT 0,
                                        cost_ref_cents INTEGER NOT NULL DEFAULT 0,
                                        cost_total_cents INTEGER NOT NULL DEFAULT 0,
                                        pricing_schema TEXT NOT NULL DEFAULT "2025-10",
                                        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
                                    );'
                                );
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_batches_batch_id ON batches (batch_id)');
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_batches_user ON batches (user_id, created_at DESC)');
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_batches_visibility ON batches (deleted, private, archived, created_at DESC)');
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_batches_archived ON batches (archived, created_at DESC)');
                            });
                            echo "<span class='success'>  ✓ Tabelle 'batches' erstellt</span>\n";
                        } else {
                            echo "  → Würde Tabelle 'batches' erstellen\n";
                        }
                    } else {
                        echo "<span class='success'>  ✓ Tabelle 'batches' existiert bereits</span>\n";
                    }
                    echo "\n";
                    
                    echo "<span class='info'>[2/6] Analysiere bestehende Daten...</span>\n";
                    
                    $totalGens = db_row('SELECT COUNT(*) as cnt FROM generations');
                    $totalCount = $totalGens ? $totalGens['cnt'] : 0;
                    
                    echo "  → Gefunden: <strong>$totalCount</strong> Generationen\n\n";
                    
                    if ($totalCount === 0) {
                        echo "<span class='success'>✅ Keine Daten zu migrieren - Migration übersprungen</span>\n";
                        if (!$dryRunBatches) {
                            db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['migration.batches', 'done']);
                        }
                        goto end_batches;
                    }
                    
                    echo "<span class='info'>[3/6] Extrahiere eindeutige Batches...</span>\n";
                    
                    // Find all unique batches with aggregated data
                    $batches = db_rows(
                        'SELECT 
                            batch_id,
                            MAX(created_at) as created_at,
                            MAX(prompt) as prompt,
                            MAX(quality) as quality,
                            MAX(aspect_class) as aspect_class,
                            MAX(mode) as mode,
                            MAX(user_id) as user_id,
                            MAX(private) as private,
                            MAX(archived) as archived,
                            MAX(deleted) as deleted,
                            SUM(cost_image_cents) as cost_image_cents,
                            MAX(cost_ref_cents) as cost_ref_cents,
                            SUM(cost_image_cents) + MAX(cost_ref_cents) as cost_total_cents,
                            MAX(pricing_schema) as pricing_schema,
                            COUNT(*) as image_count
                         FROM generations
                         WHERE batch_id IS NOT NULL AND batch_id != ""
                         GROUP BY batch_id'
                    );
                    
                    // Count batches by size
                    $singleImageBatches = 0;
                    $multiImageBatches = 0;
                    foreach ($batches as $batch) {
                        if ($batch['image_count'] == 1) {
                            $singleImageBatches++;
                        } else {
                            $multiImageBatches++;
                        }
                    }
                    
                    echo "  → Batches (mit batch_id): <strong>" . count($batches) . "</strong>\n";
                    echo "    • Batches mit nur 1 Bild: <strong>$singleImageBatches</strong>\n";
                    echo "    • Batches mit mehreren Bildern: <strong>$multiImageBatches</strong>\n";
                    
                    // Find standalone images (no batch_id)
                    $singles = db_rows(
                        'SELECT id, created_at, prompt, quality, aspect_class, mode, user_id, private, archived, deleted, 
                                cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema
                         FROM generations
                         WHERE batch_id IS NULL OR batch_id = ""'
                    );
                    
                    echo "  → Bilder ohne Batch-ID: <strong>" . count($singles) . "</strong> (werden zu Pseudo-Batches)\n\n";
                    
                    echo "<span class='info'>[4/6] " . ($dryRunBatches ? "Simuliere Batch-Erstellung..." : "Erstelle Batch-Einträge...") . "</span>\n";
                    
                    $batchCount = 0;
                    $migrationStats = [
                        'total_batches' => count($batches),
                        'single_image_batches' => $singleImageBatches,
                        'multi_image_batches' => $multiImageBatches,
                        'total_singles' => count($singles),
                        'sample_batches' => []
                    ];
                    
                    if ($dryRunBatches) {
                        // Dry-Run: Nur analysieren, keine DB-Änderungen
                        foreach (array_slice($batches, 0, 5) as $batch) {
                            $migrationStats['sample_batches'][] = [
                                'batch_id' => $batch['batch_id'],
                                'prompt' => substr($batch['prompt'], 0, 60),
                                'images' => $batch['image_count'],
                                'cost' => $batch['cost_total_cents']
                            ];
                        }
                        $batchCount = count($batches) + count($singles);
                        echo "  → Würde erstellen: <strong>$batchCount</strong> Batch-Einträge in Datenbank\n";
                    } else {
                        db_tx(function () use ($batches, $singles, &$batchCount) {
                        // Insert batches with multiple images
                        foreach ($batches as $batch) {
                            db_exec(
                                'INSERT OR IGNORE INTO batches 
                                (batch_id, prompt, quality, aspect_class, mode, user_id, private, archived, deleted, created_at, 
                                 cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [
                                    $batch['batch_id'],
                                    $batch['prompt'],
                                    $batch['quality'],
                                    $batch['aspect_class'],
                                    $batch['mode'],
                                    $batch['user_id'],
                                    $batch['private'],
                                    $batch['archived'],
                                    $batch['deleted'],
                                    $batch['created_at'],
                                    $batch['cost_image_cents'],
                                    $batch['cost_ref_cents'],
                                    $batch['cost_total_cents'],
                                    $batch['pricing_schema']
                                ]
                            );
                            $batchCount++;
                        }
                        
                        // Create pseudo-batches for standalone images
                        foreach ($singles as $single) {
                            $pseudoBatchId = 'single_' . $single['id'];
                            
                            db_exec(
                                'INSERT OR IGNORE INTO batches 
                                (batch_id, prompt, quality, aspect_class, mode, user_id, private, archived, deleted, created_at, 
                                 cost_image_cents, cost_ref_cents, cost_total_cents, pricing_schema)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [
                                    $pseudoBatchId,
                                    $single['prompt'],
                                    $single['quality'],
                                    $single['aspect_class'],
                                    $single['mode'],
                                    $single['user_id'],
                                    $single['private'],
                                    $single['archived'],
                                    $single['deleted'],
                                    $single['created_at'],
                                    $single['cost_image_cents'],
                                    $single['cost_ref_cents'],
                                    $single['cost_total_cents'],
                                    $single['pricing_schema']
                                ]
                            );
                            
                            // Update generation to link to pseudo-batch
                            db_exec('UPDATE generations SET batch_id = ? WHERE id = ?', [$pseudoBatchId, $single['id']]);
                            $batchCount++;
                        }
                    });
                        
                        echo "<span class='success'>  ✓ $batchCount Batch-Einträge erstellt</span>\n\n";
                    }
                    
                    echo "\n<span class='info'>[5/6] Restructure generations table...</span>\n";
                    
                    if (!$dryRunBatches) {
                        // Check if generations table needs restructuring
                        $needsRestructure = db_column_exists('generations', 'prompt');
                        
                        if ($needsRestructure) {
                            echo "  → Generations-Tabelle muss umstrukturiert werden (alte Spalten entfernen)\n";
                            
                            // Count rows before migration
                            $oldCount = db_row('SELECT COUNT(*) as cnt FROM generations');
                            $totalOldRows = $oldCount ? $oldCount['cnt'] : 0;
                            
                            db_tx(function () {
                                // Rename old table
                                db()->exec('ALTER TABLE generations RENAME TO generations_old');
                                
                                // Create new slim table
                                db()->exec(
                                    'CREATE TABLE generations (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        batch_id TEXT NOT NULL,
                                        image_number INTEGER NOT NULL DEFAULT 1,
                                        filename TEXT NOT NULL,
                                        width INTEGER,
                                        height INTEGER,
                                        is_main_image INTEGER NOT NULL DEFAULT 0,
                                        deleted INTEGER NOT NULL DEFAULT 0,
                                        FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE
                                    );'
                                );
                                
                                // Copy data - skip rows with NULL filename or batch_id (incomplete/broken entries)
                                db()->exec(
                                    'INSERT INTO generations (id, batch_id, image_number, filename, width, height, is_main_image, deleted)
                                     SELECT id, batch_id, image_number, filename, width, height, is_main_image, deleted
                                     FROM generations_old
                                     WHERE batch_id IS NOT NULL AND filename IS NOT NULL AND filename != ""'
                                );
                                
                                // Create indices
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_batch ON generations (batch_id)');
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_main_flag ON generations (is_main_image)');
                                db()->exec('CREATE INDEX IF NOT EXISTS idx_generations_batch_main_flag ON generations (batch_id, is_main_image)');
                                db()->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_batch_main_unique ON generations (batch_id) WHERE batch_id IS NOT NULL AND is_main_image = 1');
                                
                                // Drop old table
                                db()->exec('DROP TABLE generations_old');
                            });
                            
                            // Count rows after migration
                            $newCount = db_row('SELECT COUNT(*) as cnt FROM generations');
                            $totalNewRows = $newCount ? $newCount['cnt'] : 0;
                            $skipped = $totalOldRows - $totalNewRows;
                            
                            echo "<span class='success'>  ✓ Generations-Tabelle umstrukturiert (redundante Spalten entfernt)</span>\n";
                            echo "  → Migriert: <strong>$totalNewRows</strong> Einträge\n";
                            if ($skipped > 0) {
                                echo "  <span class='warning'>→ Übersprungen: <strong>$skipped</strong> unvollständige Einträge (fehlender filename oder batch_id)</span>\n";
                            }
                        } else {
                            echo "  → Generations-Tabelle hat bereits das neue Schema\n";
                        }
                        
                        $orphans = db_row('SELECT COUNT(*) as cnt FROM generations WHERE batch_id IS NULL OR batch_id = ""');
                        if ($orphans && $orphans['cnt'] > 0) {
                            throw new Exception('Migration unvollständig: ' . $orphans['cnt'] . ' Generationen ohne Batch-ID');
                        }
                        
                        $batchesInDb = db_row('SELECT COUNT(*) as cnt FROM batches');
                        echo "  → Batches in Datenbank: <strong>" . ($batchesInDb ? $batchesInDb['cnt'] : 0) . "</strong>\n";
                        echo "<span class='success'>  ✓ Alle Generationen sind Batches zugeordnet</span>\n\n";
                    } else {
                        echo "  → Würde generations-Tabelle umstrukturieren (alte Spalten entfernen)\n";
                        echo "  → Keine Verifikation im Dry-Run-Modus\n\n";
                    }
                    
                    echo "<span class='info'>[6/6] " . ($dryRunBatches ? "Analyse abgeschlossen" : "Markiere Migration als abgeschlossen...") . "</span>\n";
                    
                    if (!$dryRunBatches) {
                        db_exec(
                            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
                            ['migration.batches', 'done']
                        );
                        echo "<span class='success'>  ✓ Migration abgeschlossen</span>\n\n";
                        echo "<span class='success'>✅ Batches-Migration erfolgreich abgeschlossen!</span>\n";
                        echo "<span class='success'>   $batchCount Batch-Einträge wurden erstellt</span>\n";
                    } else {
                        echo "<span class='success'>  ✓ Analyse vollständig</span>\n\n";
                        echo "<span class='success'>✅ Dry-Run abgeschlossen!</span>\n";
                        echo "<span class='success'>   Migration würde $batchCount Batch-Einträge erstellen</span>\n";
                    }
                    
                } catch (Exception $e) {
                    echo "\n<span class='error'>✗ Fehler: " . htmlspecialchars($e->getMessage()) . "</span>\n";
                }
                
                end_batches:
                $output = ob_get_clean();
                echo $output;
                
                ?></div>

                <?php if (isset($migrationStats) && $dryRunBatches): ?>
                <div class="stats">
                    <div class="stat-card">
                        <div class="value"><?php echo $migrationStats['total_batches'] + $migrationStats['total_singles']; ?></div>
                        <div class="label">Gesamt Batch-Einträge</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $migrationStats['single_image_batches']; ?></div>
                        <div class="label">Batches mit 1 Bild</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $migrationStats['multi_image_batches']; ?></div>
                        <div class="label">Batches mit 2+ Bildern</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $migrationStats['total_singles']; ?></div>
                        <div class="label">Bilder ohne Batch-ID</div>
                    </div>
                </div>

                <?php if (!empty($migrationStats['sample_batches'])): ?>
                    <div style="margin: 30px 0;">
                        <h3 style="margin-bottom: 15px; color: #3b82f6;">📋 Beispiel-Batches (erste 5)</h3>
                        <?php foreach ($migrationStats['sample_batches'] as $sample): ?>
                            <div style="background: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                                <div style="font-size: 12px; color: #9ca3af; margin-bottom: 5px;">
                                    <strong>Batch ID:</strong> <?php echo htmlspecialchars($sample['batch_id']); ?>
                                </div>
                                <div style="font-size: 14px; color: #e0e0e0; margin-bottom: 5px;">
                                    <?php echo htmlspecialchars($sample['prompt']); ?><?php echo strlen($sample['prompt']) > 60 ? '...' : ''; ?>
                                </div>
                                <div style="font-size: 12px; color: #9ca3af;">
                                    <strong>Bilder:</strong> <?php echo $sample['images']; ?> | 
                                    <strong>Kosten:</strong> <?php echo number_format($sample['cost'] / 100, 2); ?> €
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
                
                    <div style="background: #3a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        ℹ️ Dies war ein Probelauf. <a href="?action=migrate_batches&dry_run=0" style="color: #fbbf24;">Führe die echte Migration aus</a>
                    </div>
                <?php else: ?>
                    <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <strong style="color: #10b981;">✅ Batches-Migration abgeschlossen!</strong><br><br>
                        Die redundanten Daten wurden in die Batches-Tabelle konsolidiert.<br>
                        Die APIs nutzen nun die optimierte Struktur.
                    </div>
                <?php endif; ?>

                <div class="button-group">
                    <a href="?" class="btn btn-secondary">← Zurück zum Migrations-Center</a>
                    <?php if ($dryRunBatches): ?>
                        <a href="?action=migrate_batches&dry_run=0" class="btn btn-primary">Migration durchführen →</a>
                    <?php else: ?>
                        <a href="../" class="btn btn-primary">Zur Gallerie →</a>
                    <?php endif; ?>
                </div>

            <?php elseif ($action === 'regenerate_thumbs'): ?>
                <?php $dryRunThumbs = isset($_GET['dry_run']) && $_GET['dry_run'] === '1'; ?>
                <h2 style="margin-bottom: 15px;">
                    <?php echo $dryRunThumbs ? '🔍 Thumbnail-Regenerierung Probelauf' : '🖼️ Thumbnail-Regenerierung'; ?>
                </h2>

                <div class="output"><?php
                
                ob_start();
                
                try {
                    if ($dryRunThumbs) {
                        echo "<span class='warning'>⚠️  DRY RUN MODE - Keine Änderungen werden vorgenommen</span>\n\n";
                    }
                    
                    echo "<span class='info'>[1/4] Überprüfe Referenzbilder-Tabelle...</span>\n";
                    
                    if (!db_table_exists('reference_images')) {
                        throw new Exception('Tabelle "reference_images" nicht gefunden. Führe zuerst die Referenzbilder-Migration durch.');
                    }
                    echo "<span class='success'>  ✓ Tabelle vorhanden</span>\n\n";
                    
                    echo "<span class='info'>[2/4] Scanne Referenzbilder...</span>\n";
                    
                    $refs = db_rows('SELECT id, file_path, thumb_path, width, height FROM reference_images');
                    $totalRefs = count($refs);
                    echo "  → Gefunden: <strong>$totalRefs</strong> Referenzbilder\n\n";
                    
                    if ($totalRefs === 0) {
                        echo "<span class='success'>✅ Keine Referenzbilder vorhanden</span>\n";
                        if (!$dryRunThumbs) {
                            db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['migration.ref_thumbnails', 'done']);
                        }
                        goto end_thumbs;
                    }
                    
                    echo "<span class='info'>[3/4] " . ($dryRunThumbs ? "Analysiere fehlende Thumbnails..." : "Generiere fehlende Thumbnails...") . "</span>\n";
                    
                    $stats = [
                        'total' => $totalRefs,
                        'missing' => 0,
                        'generated' => 0,
                        'errors' => 0
                    ];
                    
                    foreach ($refs as $ref) {
                        $thumbFullPath = IMB_PUBLIC_DIR . '/' . $ref['thumb_path'];
                        
                        if (!is_file($thumbFullPath)) {
                            $stats['missing']++;
                            $srcFullPath = IMB_PUBLIC_DIR . '/' . $ref['file_path'];
                            
                            if (!is_file($srcFullPath)) {
                                echo "  <span class='error'>✗ Quelldatei fehlt: " . basename($ref['file_path']) . "</span>\n";
                                $stats['errors']++;
                                continue;
                            }
                            
                            if ($dryRunThumbs) {
                                echo "  → Würde generieren: " . basename($ref['thumb_path']) . "\n";
                            } else {
                                // Generate thumbnail
                                $imageData = @file_get_contents($srcFullPath);
                                if ($imageData === false) {
                                    echo "  <span class='error'>✗ Fehler beim Lesen: " . basename($ref['file_path']) . "</span>\n";
                                    $stats['errors']++;
                                    continue;
                                }
                                
                                $refImg = @imagecreatefromstring($imageData);
                                if (!$refImg) {
                                    echo "  <span class='error'>✗ Fehler beim Laden: " . basename($ref['file_path']) . "</span>\n";
                                    $stats['errors']++;
                                    continue;
                                }
                                
                                // Fix EXIF orientation
                                if (function_exists('exif_read_data')) {
                                    $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($imageData));
                                    if ($exif && isset($exif['Orientation'])) {
                                        switch ($exif['Orientation']) {
                                            case 3: $refImg = imagerotate($refImg, 180, 0); break;
                                            case 6: $refImg = imagerotate($refImg, -90, 0); break;
                                            case 8: $refImg = imagerotate($refImg, 90, 0); break;
                                        }
                                    }
                                }
                                
                                $width = imagesx($refImg);
                                $height = imagesy($refImg);
                                
                                if ($width > 0 && $height > 0) {
                                    $refAspectRatio = $width / $height;
                                    $maxDimension = 400;
                                    if ($refAspectRatio >= 1) {
                                        $refThumbW = $maxDimension;
                                        $refThumbH = max(1, (int)round($refThumbW / $refAspectRatio));
                                    } else {
                                        $refThumbH = $maxDimension;
                                        $refThumbW = max(1, (int)round($refThumbH * $refAspectRatio));
                                    }
                                    
                                    $refThumbImg = imagecreatetruecolor($refThumbW, $refThumbH);
                                    imagealphablending($refThumbImg, false);
                                    imagesavealpha($refThumbImg, true);
                                    imagecopyresampled($refThumbImg, $refImg, 0, 0, 0, 0, $refThumbW, $refThumbH, $width, $height);
                                    
                                    // Ensure directory exists
                                    $thumbDir = dirname($thumbFullPath);
                                    if (!is_dir($thumbDir)) {
                                        mkdir($thumbDir, 0777, true);
                                    }
                                    
                                    imagepng($refThumbImg, $thumbFullPath);
                                    imagedestroy($refThumbImg);
                                    $stats['generated']++;
                                    echo "  <span class='success'>✓ Generiert: " . basename($ref['thumb_path']) . "</span>\n";
                                } else {
                                    echo "  <span class='error'>✗ Ungültige Dimensionen: " . basename($ref['file_path']) . "</span>\n";
                                    $stats['errors']++;
                                }
                                
                                imagedestroy($refImg);
                            }
                        }
                    }
                    
                    echo "\n<span class='info'>[4/4] " . ($dryRunThumbs ? "Analyse abgeschlossen" : "Migration abgeschlossen") . "</span>\n";
                    
                    if (!$dryRunThumbs) {
                        db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['migration.ref_thumbnails', 'done']);
                        echo "<span class='success'>  ✓ Migration abgeschlossen</span>\n\n";
                        echo "<span class='success'>✅ Thumbnail-Regenerierung erfolgreich!</span>\n";
                        echo "<span class='success'>   " . $stats['generated'] . " Thumbnails generiert</span>\n";
                    } else {
                        echo "<span class='success'>  ✓ Analyse vollständig</span>\n\n";
                        echo "<span class='success'>✅ Dry-Run abgeschlossen!</span>\n";
                        echo "<span class='success'>   " . $stats['missing'] . " fehlende Thumbnails gefunden</span>\n";
                    }
                    
                } catch (Exception $e) {
                    echo "\n<span class='error'>✗ Fehler: " . htmlspecialchars($e->getMessage()) . "</span>\n";
                }
                
                end_thumbs:
                $output = ob_get_clean();
                echo $output;
                
                ?></div>

                <?php if (isset($stats)): ?>
                <div class="stats">
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['total']; ?></div>
                        <div class="label">Gesamt</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['missing']; ?></div>
                        <div class="label">Fehlend</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $dryRunThumbs ? $stats['missing'] - $stats['errors'] : $stats['generated']; ?></div>
                        <div class="label"><?php echo $dryRunThumbs ? 'Würde generieren' : 'Generiert'; ?></div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['errors']; ?></div>
                        <div class="label">Fehler</div>
                    </div>
                </div>

                <?php if ($dryRunThumbs): ?>
                    <div style="background: #3a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        ℹ️ Dies war ein Probelauf. <a href="?action=regenerate_thumbs&dry_run=0" style="color: #fbbf24;">Führe die echte Generierung aus</a>
                    </div>
                <?php else: ?>
                    <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <strong style="color: #10b981;">✅ Thumbnails erfolgreich generiert!</strong><br><br>
                        Alle Referenzbilder haben nun Thumbnails.
                    </div>
                <?php endif; ?>
                <?php endif; ?>

                <div class="button-group">
                    <a href="?" class="btn btn-secondary">← Zurück zum Migrations-Center</a>
                    <?php if ($dryRunThumbs): ?>
                        <a href="?action=regenerate_thumbs&dry_run=0" class="btn btn-primary">Thumbnails generieren →</a>
                    <?php else: ?>
                        <a href="../" class="btn btn-primary">Zur Gallerie →</a>
                    <?php endif; ?>
                </div>

            <?php elseif ($action === 'migrate'): ?>
                <h2 style="margin-bottom: 15px;">
                    <?php echo $dryRun ? '🔍 Referenzbilder-Migration Probelauf' : '✅ Referenzbilder-Deduplizierung'; ?>
                </h2>

                <div class="output"><?php
                
                // Capture output
                ob_start();
                
                try {
                    echo $dryRun ? "<span class='warning'>⚠️  DRY RUN MODE - Keine Änderungen werden vorgenommen</span>\n\n" : "";
                    
                    // Step 1: Ensure DB tables exist
                    echo "<span class='info'>[1/5] Überprüfe Datenbank-Tabellen...</span>\n";
                    
                    db_tx(function () {
                        db()->exec(
                            'CREATE TABLE IF NOT EXISTS reference_images (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                file_hash TEXT NOT NULL UNIQUE,
                                file_path TEXT NOT NULL,
                                thumb_path TEXT NOT NULL,
                                file_size INTEGER,
                                width INTEGER,
                                height INTEGER,
                                created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
                            );'
                        );

                        db()->exec(
                            'CREATE TABLE IF NOT EXISTS batch_references (
                                batch_id TEXT NOT NULL,
                                reference_image_id INTEGER NOT NULL,
                                position INTEGER NOT NULL,
                                FOREIGN KEY (reference_image_id) REFERENCES reference_images(id) ON DELETE CASCADE,
                                PRIMARY KEY (batch_id, position)
                            );'
                        );

                        db()->exec('CREATE INDEX IF NOT EXISTS idx_reference_images_hash ON reference_images (file_hash)');
                        db()->exec('CREATE INDEX IF NOT EXISTS idx_batch_references_batch ON batch_references (batch_id)');
                        db()->exec('CREATE INDEX IF NOT EXISTS idx_batch_references_ref ON batch_references (reference_image_id)');
                    });
                    
                    echo "<span class='success'>  ✓ Tabellen existieren oder wurden erstellt</span>\n\n";
                    
                    // Step 2: Scan existing reference images
                    echo "<span class='info'>[2/5] Scanne vorhandene Referenzbilder...</span>\n";
                    
                    $refsRoot = IMB_IMAGE_DIR . '/refs';
                    if (!is_dir($refsRoot)) {
                        echo "<span class='success'>  ✓ Keine Referenzbilder vorhanden.</span>\n";
                        echo "\n<span class='success'>✅ Migration abgeschlossen (keine Daten zu migrieren)</span>";
                        goto end;
                    }
                    
                    $batchDirs = glob($refsRoot . '/*', GLOB_ONLYDIR);
                    $batchDirs = array_filter($batchDirs, function($dir) {
                        return basename($dir) !== 'thumbs';
                    });
                    
                    if (empty($batchDirs)) {
                        echo "<span class='success'>  ✓ Keine Batch-Verzeichnisse gefunden.</span>\n";
                        echo "\n<span class='success'>✅ Migration abgeschlossen (keine Daten zu migrieren)</span>";
                        goto end;
                    }
                    
                    echo "  → Gefunden: <strong>" . count($batchDirs) . "</strong> Batch-Verzeichnisse\n\n";
                    
                    // Step 3: Create directories
                    echo "<span class='info'>[3/5] Stelle Verzeichnisse sicher...</span>\n";
                    
                    $globalDir = $refsRoot;
                    $globalThumbsDir = $refsRoot . '/thumbs';
                    
                    if (!$dryRun) {
                        if (!is_dir($globalDir)) mkdir($globalDir, 0777, true);
                        if (!is_dir($globalThumbsDir)) mkdir($globalThumbsDir, 0777, true);
                        echo "<span class='success'>  ✓ Verzeichnisse vorhanden</span>\n\n";
                    } else {
                        echo "  → Verzeichnisse: $globalDir und $globalThumbsDir\n\n";
                    }
                    
                    // Step 4: Process batches
                    echo "<span class='info'>[4/5] Migriere Referenzbilder...</span>\n";
                    
                    $stats = [
                        'total_images' => 0,
                        'unique_images' => 0,
                        'duplicates' => 0,
                        'errors' => 0,
                        'batches_processed' => 0
                    ];
                    
                    $hashMap = [];
                    $duplicateGroups = []; // Für Bildanzeige im Dry-Run
                    
                    foreach ($batchDirs as $batchDir) {
                        $batchId = basename($batchDir);
                        echo "  <strong>Batch: $batchId</strong>\n";
                        
                        $refFiles = glob($batchDir . '/*');
                        if (empty($refFiles)) {
                            echo "    → Keine Dateien\n";
                            continue;
                        }
                        
                        $position = 1;
                        foreach ($refFiles as $refFile) {
                            if (!is_file($refFile)) continue;
                            
                            $stats['total_images']++;
                            $filename = basename($refFile);
                            $ext = pathinfo($filename, PATHINFO_EXTENSION);
                            
                            $imageData = @file_get_contents($refFile);
                            if ($imageData === false) {
                                echo "    <span class='error'>✗ Fehler beim Lesen: $filename</span>\n";
                                $stats['errors']++;
                                continue;
                            }
                            
                            $fileHash = md5($imageData);
                            $fileSize = strlen($imageData);
                            
                            if (isset($hashMap[$fileHash])) {
                                $stats['duplicates']++;
                                $refImageId = $hashMap[$fileHash]['id'];
                                echo "    <span class='warning'>⊜ Duplikat: $filename (Hash: " . substr($fileHash, 0, 8) . "...)</span>\n";
                                
                                // Für Dry-Run: Sammle Duplikate für Anzeige
                                if ($dryRun) {
                                    if (!isset($duplicateGroups[$fileHash])) {
                                        $duplicateGroups[$fileHash] = [
                                            'hash' => $fileHash,
                                            'original' => $hashMap[$fileHash]['path'] ?? null,
                                            'duplicates' => []
                                        ];
                                    }
                                    $duplicateGroups[$fileHash]['duplicates'][] = [
                                        'path' => str_replace(IMB_IMAGE_DIR, 'images', $refFile),
                                        'batch' => $batchId,
                                        'filename' => $filename
                                    ];
                                }
                            } else {
                                if (!$dryRun) {
                                    $existing = db_row('SELECT id FROM reference_images WHERE file_hash = ?', [$fileHash]);
                                    if ($existing) {
                                        $refImageId = $existing['id'];
                                        $stats['duplicates']++;
                                        echo "    <span class='warning'>⊜ Bereits in DB: $filename</span>\n";
                                    } else {
                                        $newFilename = $fileHash . '.' . $ext;
                                        $newFilePath = $globalDir . '/' . $newFilename;
                                        $newThumbPath = $globalThumbsDir . '/' . $newFilename;
                                        
                                        copy($refFile, $newFilePath);
                                        
                                        // Try to copy existing thumbnail first
                                        $oldThumbPath = $refsRoot . '/thumbs/' . $batchId . '/' . $filename;
                                        $thumbExists = false;
                                        if (is_file($oldThumbPath)) {
                                            copy($oldThumbPath, $newThumbPath);
                                            $thumbExists = true;
                                        }
                                        
                                        // Get dimensions and generate thumbnail if it doesn't exist
                                        $refImg = @imagecreatefromstring($imageData);
                                        $width = null;
                                        $height = null;
                                        
                                        if ($refImg) {
                                            // Fix EXIF orientation if present
                                            if (function_exists('exif_read_data')) {
                                                $exif = @exif_read_data('data://image/jpeg;base64,' . base64_encode($imageData));
                                                if ($exif && isset($exif['Orientation'])) {
                                                    switch ($exif['Orientation']) {
                                                        case 3:
                                                            $refImg = imagerotate($refImg, 180, 0);
                                                            break;
                                                        case 6:
                                                            $refImg = imagerotate($refImg, -90, 0);
                                                            break;
                                                        case 8:
                                                            $refImg = imagerotate($refImg, 90, 0);
                                                            break;
                                                    }
                                                }
                                            }
                                            
                                            $width = imagesx($refImg);
                                            $height = imagesy($refImg);
                                            
                                            // Generate thumbnail if not already copied
                                            if (!$thumbExists && $width > 0 && $height > 0) {
                                                $refAspectRatio = $width / $height;
                                                $maxDimension = 400;
                                                if ($refAspectRatio >= 1) {
                                                    $refThumbW = $maxDimension;
                                                    $refThumbH = max(1, (int)round($refThumbW / $refAspectRatio));
                                                } else {
                                                    $refThumbH = $maxDimension;
                                                    $refThumbW = max(1, (int)round($refThumbH * $refAspectRatio));
                                                }
                                                
                                                $refThumbImg = imagecreatetruecolor($refThumbW, $refThumbH);
                                                imagealphablending($refThumbImg, false);
                                                imagesavealpha($refThumbImg, true);
                                                imagecopyresampled($refThumbImg, $refImg, 0, 0, 0, 0, $refThumbW, $refThumbH, $width, $height);
                                                imagepng($refThumbImg, $newThumbPath);
                                                imagedestroy($refThumbImg);
                                            }
                                            imagedestroy($refImg);
                                        }
                                        
                                        db_exec(
                                            'INSERT INTO reference_images (file_hash, file_path, thumb_path, file_size, width, height) VALUES (?, ?, ?, ?, ?, ?)',
                                            [
                                                $fileHash,
                                                'images/refs/' . $newFilename,
                                                'images/refs/thumbs/' . $newFilename,
                                                $fileSize,
                                                $width,
                                                $height
                                            ]
                                        );
                                        
                                        $refImageId = db()->lastInsertId();
                                        $stats['unique_images']++;
                                        echo "    <span class='success'>✓ Neu: $filename → $newFilename</span>\n";
                                    }
                                    
                                    $hashMap[$fileHash] = ['id' => $refImageId];
                                } else {
                                    // Im Dry-Run: Hash trotzdem speichern für Duplikats-Erkennung
                                    echo "    → Würde migrieren: $filename (Hash: " . substr($fileHash, 0, 8) . "...)\n";
                                    $stats['unique_images']++;
                                    $refImageId = 999; // Dummy
                                    $hashMap[$fileHash] = [
                                        'id' => $refImageId,
                                        'path' => str_replace(IMB_IMAGE_DIR, 'images', $refFile)
                                    ];
                                }
                            }
                            
                            if (!$dryRun && $refImageId > 0) {
                                db_exec(
                                    'INSERT OR IGNORE INTO batch_references (batch_id, reference_image_id, position) VALUES (?, ?, ?)',
                                    [$batchId, $refImageId, $position]
                                );
                            }
                            
                            $position++;
                        }
                        
                        $stats['batches_processed']++;
                        flush();
                    }
                    
                    echo "\n<span class='info'>[5/5] Migration abgeschlossen</span>\n";
                    
                    // Mark migration as done
                    if (!$dryRun) {
                        db_exec('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['migration.ref_deduplication', 'done']);
                        echo "<span class='success'>  ✓ Migration als abgeschlossen markiert</span>\n";
                    }
                    
                } catch (Exception $e) {
                    echo "\n<span class='error'>✗ Fehler: " . htmlspecialchars($e->getMessage()) . "</span>\n";
                }
                
                end:
                $output = ob_get_clean();
                echo $output;
                
                ?></div>

                <?php if (isset($stats)): ?>
                <div class="stats">
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['batches_processed']; ?></div>
                        <div class="label">Batches</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['total_images']; ?></div>
                        <div class="label">Gefunden</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['unique_images']; ?></div>
                        <div class="label">Einzigartig</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['duplicates']; ?></div>
                        <div class="label">Duplikate</div>
                    </div>
                    <div class="stat-card">
                        <div class="value"><?php echo $stats['errors']; ?></div>
                        <div class="label">Fehler</div>
                    </div>
                </div>

                <?php if ($stats['duplicates'] > 0): ?>
                    <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <strong style="color: #10b981;">💾 Geschätzter Speicherplatz:</strong><br>
                        ~<?php echo round(($stats['duplicates'] * 500) / 1024, 1); ?> MB eingespart
                    </div>
                <?php endif; ?>

                <?php if ($dryRun): ?>
                    <?php if (!empty($duplicateGroups)): ?>
                        <div style="margin: 30px 0;">
                            <h3 style="margin-bottom: 15px; color: #f59e0b;">🔍 Gefundene Duplikate (<?php echo count($duplicateGroups); ?> Gruppen)</h3>
                            <?php foreach ($duplicateGroups as $hash => $group): ?>
                                <div style="background: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                                    <div style="margin-bottom: 10px; font-size: 12px; color: #9ca3af;">
                                        <strong>Hash:</strong> <?php echo substr($hash, 0, 16); ?>... 
                                        <strong style="margin-left: 15px;">Duplikate:</strong> <?php echo count($group['duplicates']); ?>
                                    </div>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-start;">
                                        <?php if ($group['original']): ?>
                                            <div style="text-align: center;">
                                                <img src="../<?php echo $group['original']; ?>" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid #10b981;" loading="lazy">
                                                <div style="font-size: 11px; color: #10b981; margin-top: 5px; max-width: 120px; word-wrap: break-word;">Original</div>
                                            </div>
                                        <?php endif; ?>
                                        <?php foreach ($group['duplicates'] as $dup): ?>
                                            <div style="text-align: center;">
                                                <img src="../<?php echo $dup['path']; ?>" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid #f59e0b;" loading="lazy">
                                                <div style="font-size: 10px; color: #9ca3af; margin-top: 5px; max-width: 120px; word-wrap: break-word;">
                                                    Batch: <?php echo $dup['batch']; ?><br>
                                                    <?php echo $dup['filename']; ?>
                                                </div>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    
                    <div style="background: #3a2a1a; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        ℹ️ Dies war ein Probelauf. <a href="?action=migrate&dry_run=0" style="color: #fbbf24;">Führe die echte Migration aus</a>
                    </div>
                <?php else: ?>
                    <div style="background: #1a3a1a; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <strong style="color: #10b981;">✅ Migration erfolgreich!</strong><br><br>
                        Nächste Schritte:<br>
                        1. Überprüfe die Gallerie und "Meine Uploads"<br>
                        2. Wenn alles funktioniert, kannst du die alten Batch-Verzeichnisse manuell löschen
                    </div>
                <?php endif; ?>
                <?php endif; ?>

                <div class="button-group">
                    <a href="?" class="btn btn-secondary">← Zurück</a>
                    <a href="../" class="btn btn-primary">Zur Gallerie →</a>
                </div>

            <?php endif; ?>
        </div>
    </div>
</body>
</html>

