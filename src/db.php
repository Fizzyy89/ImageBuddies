<?php
// Simple SQLite DB layer for ImageBuddies

function db_path() {
    // Use centralized bootstrap-defined data directory
    if (!defined('IMB_DATA_DIR')) {
        require_once __DIR__ . '/bootstrap.php';
    }
    return IMB_DATA_DIR . '/app.sqlite3';
}

function db() {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $dbDir = dirname(db_path());
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0777, true);
    }

    $pdo = new PDO('sqlite:' . db_path());
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    // Pragmas for better concurrency and integrity
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    return $pdo;
}

function db_exec($sql, $params = []) {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function db_row($sql, $params = []) {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function db_rows($sql, $params = []) {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function db_tx(callable $fn) {
    $pdo = db();
    try {
        $pdo->beginTransaction();
        $result = $fn($pdo);
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function db_table_exists($name) {
    $row = db_row("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [$name]);
    return $row !== null;
}


function db_column_exists($table, $column) {
    static $cache = [];
    $tableKey = strtolower((string)$table);
    $columnKey = strtolower((string)$column);
    $cacheKey = $tableKey . '.' . $columnKey;
    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    if (!preg_match('/^[A-Za-z0-9_]+$/', $tableKey)) {
        return false;
    }

    $rows = db_rows('PRAGMA table_info(' . $tableKey . ')');
    $exists = false;
    foreach ($rows as $row) {
        if (isset($row['name']) && strtolower((string)$row['name']) === $columnKey) {
            $exists = true;
            break;
        }
    }

    $cache[$cacheKey] = $exists;
    return $exists;
}
