<?php
session_start();
header('Content-Type: application/json');

require_once dirname(__DIR__) . '/../src/bootstrap.php';
require_once IMB_SRC_DIR . '/pricing.php';

try {
    $pricing = imb_pricing_load();
    echo json_encode($pricing);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'pricing_load_failed']);
}

