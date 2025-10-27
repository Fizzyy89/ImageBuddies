<?php
session_start();
header('Content-Type: application/json');

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/password_validation.php';
require_once IMB_SRC_DIR . '/db.php';

// Check admin permission
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.userManagement.noPermission']);
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'list':
        // List all users (without passwords)
        $rows = db_rows('SELECT username, role FROM users ORDER BY username COLLATE NOCASE');
        $userList = [];
        foreach ($rows as $r) {
            $userList[$r['username']] = ['role' => $r['role']];
        }
        echo json_encode(['success' => true, 'users' => $userList]);
        break;

    case 'add':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';
        $role = $data['role'] ?? 'user';

        if (empty($username) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.add.missingCredentials']);
            exit;
        }

        // Validiere das Passwort
        $validation = validatePassword($password);
        if (!$validation['valid']) {
            http_response_code(400);
            echo json_encode(['error_key' => $validation['error_key']]);
            exit;
        }

        $exists = db_row('SELECT id FROM users WHERE username = ?', [$username]);
        if ($exists) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.add.userExists']);
            exit;
        }
        db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [
            $username,
            password_hash($password, PASSWORD_DEFAULT),
            $role
        ]);
        echo json_encode(['success' => true]);
        break;

    case 'update':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $newPassword = $data['password'] ?? '';
        $newRole = $data['role'] ?? null;

        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        $row = db_row('SELECT id FROM users WHERE username = ?', [$username]);
        if ($row === null) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        if (!empty($newPassword)) {
            // Validiere das neue Passwort
            $validation = validatePassword($newPassword);
            if (!$validation['valid']) {
                http_response_code(400);
                echo json_encode(['error_key' => $validation['error_key']]);
                exit;
            }
            db_exec('UPDATE users SET password_hash = ? WHERE username = ?', [
                password_hash($newPassword, PASSWORD_DEFAULT),
                $username
            ]);
        }
        
        if ($newRole !== null) {
            db_exec('UPDATE users SET role = ? WHERE username = ?', [
                $newRole,
                $username
            ]);
        }

        echo json_encode(['success' => true]);
        break;

    case 'delete':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';

        if (empty($username)) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        $row = db_row('SELECT id FROM users WHERE username = ?', [$username]);
        if ($row === null) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        // Verhindere das Löschen des eigenen Accounts
        if ($username === $_SESSION['user']) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.delete.cannotDeleteSelf']);
            exit;
        }
        // Reassign generations to a dedicated 'archived' user before delete (to satisfy FK)
        $targetUserId = intval($row['id']);
        $genCount = db_row('SELECT COUNT(*) AS c FROM generations WHERE user_id = ?', [$targetUserId]);
        if (intval($genCount['c']) > 0) {
            // Ensure 'archived' user exists
            $arch = db_row('SELECT id FROM users WHERE username = ?', ['archived']);
            if (!$arch) {
                db_exec('INSERT INTO users (username, password_hash, role) VALUES (?,?,?)', [
                    'archived',
                    password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
                    'user'
                ]);
                $arch = db_row('SELECT id FROM users WHERE username = ?', ['archived']);
            }
            $archivedId = intval($arch['id']);
            db_exec('UPDATE generations SET user_id = ? WHERE user_id = ?', [$archivedId, $targetUserId]);
        }
        db_exec('DELETE FROM users WHERE username = ?', [$username]);
        echo json_encode(['success' => true]);
        break;

    case 'rename':
        $data = json_decode(file_get_contents('php://input'), true);
        $oldUsername = $data['oldUsername'] ?? '';
        $newUsername = $data['newUsername'] ?? '';

        if (empty($oldUsername) || empty($newUsername)) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }
        $existsOld = db_row('SELECT id FROM users WHERE username = ?', [$oldUsername]);
        if ($existsOld === null) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }
        $existsNew = db_row('SELECT id FROM users WHERE username = ?', [$newUsername]);
        if ($existsNew !== null) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.rename.userExists']);
            exit;
        }
        db_exec('UPDATE users SET username = ? WHERE username = ?', [$newUsername, $oldUsername]);
        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error_key' => 'error.userManagement.invalidAction']);
} 