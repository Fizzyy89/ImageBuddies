<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'forbidden']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

try {
    if (!db_table_exists('generations')) {
        echo json_encode(['success' => true, 'message' => 'Keine Tabelle "generations" gefunden – nichts zu tun.']);
        exit;
    }

    $columnExists = db_column_exists('generations', 'is_main_image');
    if (!$columnExists) {
        db_exec('ALTER TABLE generations ADD COLUMN is_main_image INTEGER NOT NULL DEFAULT 0');
        $columnExists = true;
    }

    if (!$columnExists) {
        throw new RuntimeException('Spalte is_main_image konnte nicht angelegt werden.');
    }

    $rows = db_rows('SELECT id, batch_id, image_number, deleted FROM generations');
    $mainIds = [];
    $batches = [];

    foreach ($rows as $row) {
        $id = isset($row['id']) ? (int)$row['id'] : null;
        if ($id === null) {
            continue;
        }
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

    db_tx(function () use ($mainIds) {
        db_exec('UPDATE generations SET is_main_image = 0');
        foreach ($mainIds as $id) {
            db_exec('UPDATE generations SET is_main_image = 1 WHERE id = ?', [$id]);
        }
    });

    db_exec('CREATE INDEX IF NOT EXISTS idx_generations_main_flag ON generations (is_main_image)');
    db_exec('CREATE INDEX IF NOT EXISTS idx_generations_batch_main_flag ON generations (batch_id, is_main_image)');
    try {
        db_exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_batch_main_unique ON generations (batch_id) WHERE batch_id IS NOT NULL AND is_main_image = 1');
    } catch (Throwable $e) {
        // kann ignoriert werden, falls temporär verletzt
    }

    if (db_table_exists('settings')) {
        db_exec(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['migration.is_main_image', 'done']
        );
    }

    echo json_encode([
        'success' => true,
        'updatedRecords' => count($mainIds),
        'message' => 'Hauptbild-Flag erfolgreich aktualisiert.'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'migration_failed',
        'message' => $e->getMessage()
    ]);
}

