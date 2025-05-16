<?php
session_start();
header('Content-Type: application/json');

// Prüfe Admin-Berechtigung
if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.userManagement.noPermission']);
    exit;
}

$jsonPath = __DIR__ . '/../database/users.json';
if (!file_exists($jsonPath)) {
    http_response_code(500);
    echo json_encode(['error_key' => 'error.userManagement.userDbNotFound']);
    exit;
}

$action = $_GET['action'] ?? '';
$users = json_decode(file_get_contents($jsonPath), true);

switch ($action) {
    case 'list':
        // Liste alle Benutzer auf (ohne Passwörter)
        $userList = [];
        foreach ($users as $username => $data) {
            $userList[$username] = ['role' => $data['role']];
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

        if (isset($users[$username])) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.add.userExists']);
            exit;
        }

        $users[$username] = [
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role
        ];

        file_put_contents($jsonPath, json_encode($users, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        break;

    case 'update':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $newPassword = $data['password'] ?? '';
        $newRole = $data['role'] ?? null;

        if (empty($username) || !isset($users[$username])) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        if (!empty($newPassword)) {
            $users[$username]['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
        }
        
        if ($newRole !== null) {
            $users[$username]['role'] = $newRole;
        }

        file_put_contents($jsonPath, json_encode($users, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        break;

    case 'delete':
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';

        if (empty($username) || !isset($users[$username])) {
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

        unset($users[$username]);
        file_put_contents($jsonPath, json_encode($users, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        break;

    case 'rename':
        $data = json_decode(file_get_contents('php://input'), true);
        $oldUsername = $data['oldUsername'] ?? '';
        $newUsername = $data['newUsername'] ?? '';

        if (empty($oldUsername) || empty($newUsername) || !isset($users[$oldUsername])) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.userNotFound']);
            exit;
        }

        if (isset($users[$newUsername])) {
            http_response_code(400);
            echo json_encode(['error_key' => 'error.userManagement.rename.userExists']);
            exit;
        }

        // Speichere die Benutzerdaten temporär
        $userData = $users[$oldUsername];
        
        // Lösche alten Benutzer und erstelle neuen
        unset($users[$oldUsername]);
        $users[$newUsername] = $userData;

        // Aktualisiere users.json
        file_put_contents($jsonPath, json_encode($users, JSON_PRETTY_PRINT));

        // CSV-Definitionen: Datei => User-Spaltenindex (0-basiert)
        $csvFiles = [
            __DIR__ . '/../database/image_log.csv' => 3, // 4. Spalte
            __DIR__ . '/../database/statistics.csv' => 4  // 5. Spalte
        ];

        foreach ($csvFiles as $csvFile => $userCol) {
            if (file_exists($csvFile)) {
                $lines = file($csvFile, FILE_IGNORE_NEW_LINES);
                $newLines = [];
                foreach ($lines as $i => $line) {
                    // Header nicht ändern
                    if ($i === 0 && strpos($line, 'User') !== false) {
                        $newLines[] = $line;
                        continue;
                    }
                    $cols = explode(';', $line);
                    if (isset($cols[$userCol]) && $cols[$userCol] === $oldUsername) {
                        $cols[$userCol] = $newUsername;
                    }
                    $newLines[] = implode(';', $cols);
                }
                file_put_contents($csvFile, implode("\n", $newLines));
            }
        }

        echo json_encode(['success' => true]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error_key' => 'error.userManagement.invalidAction']);
} 