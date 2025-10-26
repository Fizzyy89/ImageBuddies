<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

require_once __DIR__ . '/db.php';

$currentUser = $_SESSION['user'];
$row = db_row('SELECT id FROM users WHERE username = ?', [$currentUser]);
if ($row === null) {
    echo json_encode(['totalImages' => 0, 'totalCosts' => 0]);
    exit;
}
$uid = intval($row['id']);

$tot = db_row('SELECT COUNT(*) AS cnt, COALESCE(SUM(cost_total_cents),0) AS cost FROM generations WHERE user_id = ?', [$uid]);
echo json_encode([
    'totalImages' => intval($tot['cnt']),
    'totalCosts' => intval($tot['cost'])
]);
?>