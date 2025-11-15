<?php

require_once __DIR__ . '/db.php';

/**
 * Ensures that the users.role CHECK constraint allows the superuser role.
 * Older installations created the users table with CHECK (role IN ('admin','user')),
 * which blocks promoting accounts to superuser and triggers SQL constraint errors.
 */
function ensure_users_table_supports_superuser(): void
{
    static $checked = false;
    if ($checked) {
        return;
    }
    $checked = true;

    $row = db_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
    if (!$row) {
        return;
    }

    $createSql = (string)($row['sql'] ?? '');
    if (stripos($createSql, 'superuser') !== false) {
        return; // already migrated
    }

    $pdo = db();
    $pdo->exec('PRAGMA foreign_keys = OFF');

    try {
        db_tx(function () {
            db()->exec(
                'CREATE TABLE users_migrated (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN (\'admin\', \'superuser\', \'user\')),
                    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
                )'
            );

            db()->exec(
                'INSERT INTO users_migrated (id, username, password_hash, role, created_at)
                 SELECT id,
                        username,
                        password_hash,
                        CASE
                            WHEN role IN (\'admin\', \'superuser\', \'user\') THEN role
                            ELSE \'user\'
                        END,
                        created_at
                 FROM users'
            );

            db()->exec('DROP TABLE users');
            db()->exec('ALTER TABLE users_migrated RENAME TO users');
        });
    } finally {
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
}

