<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error_key' => 'error.notLoggedIn']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

$currentUser = $_SESSION['user'];
$row = db_row('SELECT id FROM users WHERE username = ?', [$currentUser]);
if ($row === null) {
    echo json_encode(['totalImages' => 0, 'totalCosts' => 0]);
    exit;
}
$uid = intval($row['id']);

// Count images from generations, costs from batches (per-batch data)
$imageCount = db_row('
    SELECT COUNT(*) AS cnt 
    FROM generations g 
    JOIN batches b ON b.batch_id = g.batch_id 
    WHERE b.user_id = ?
', [$uid]);

$batchCosts = db_row('
    SELECT COALESCE(SUM(cost_total_cents), 0) AS cost 
    FROM batches 
    WHERE user_id = ?
', [$uid]);

echo json_encode([
    'totalImages' => intval($imageCount['cnt']),
    'totalCosts' => intval($batchCosts['cost'])
]);
?>