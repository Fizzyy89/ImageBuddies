<?php
session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed']);
    exit;
}

if (!isset($_SESSION['user']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error_key' => 'error.customization.unauthorized']);
    exit;
}

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/pricing.php';

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload']);
    exit;
}

$unit = isset($data['unit']) && is_string($data['unit']) ? strtolower($data['unit']) : 'cent';

try {
    $normalized = imb_pricing_normalize($data, $unit);
    imb_pricing_save($normalized);
    echo json_encode(['success' => true, 'pricing' => $normalized]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'pricing_save_failed']);
}

