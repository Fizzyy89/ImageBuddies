<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once IMB_SRC_DIR . '/db.php';

const IMB_PRICING_SCHEMA = '2025-11';

/**
 * Rückgabe der Standardpreise in US-Cent.
 */
function imb_pricing_defaults(): array
{
    return [
        'schema' => IMB_PRICING_SCHEMA,
        'currency' => 'USD',
        'unit' => 'cent',
        'openai' => [
            'low' => 1,
            'medium' => 4,
            'high' => 17,
            'input' => 3,
        ],
        'gemini' => [
            'output' => 4,
            'input' => 0,
        ],
    ];
}

/**
 * Lädt Preise aus der Datenbank und sorgt für Fallback auf Defaults.
 */
function imb_pricing_load(): array
{
    $row = db_row('SELECT value FROM settings WHERE key = ?', ['pricing']);
    if ($row !== null) {
        $decoded = json_decode($row['value'], true);
        if (is_array($decoded) && isset($decoded['schema'])) {
            return $decoded;
        }
    }

    $defaults = imb_pricing_defaults();
    imb_pricing_save($defaults);
    return $defaults;
}

/**
 * Speichert die Preise in der Datenbank.
 */
function imb_pricing_save(array $pricing): void
{
    if (!isset($pricing['schema'])) {
        $pricing['schema'] = IMB_PRICING_SCHEMA;
    }

    $json = json_encode($pricing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('pricing_encode_failed');
    }

    db_exec(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['pricing', $json]
    );
}

/**
 * Normalisiert Eingaben (USD oder Cent) und stellt Pflichtfelder sicher.
 */
function imb_pricing_normalize(array $pricing, string $unit = 'cent'): array
{
    $defaults = imb_pricing_defaults();
    $normalized = $defaults;

    $sourceUnit = strtolower($pricing['unit'] ?? $unit);

    foreach ($defaults['openai'] as $tier => $value) {
        if (isset($pricing['openai'][$tier])) {
            $normalized['openai'][$tier] = imb_pricing_to_cents($pricing['openai'][$tier], $sourceUnit);
        }
    }

    foreach ($defaults['gemini'] as $tier => $value) {
        if (isset($pricing['gemini'][$tier])) {
            $normalized['gemini'][$tier] = imb_pricing_to_cents($pricing['gemini'][$tier], $sourceUnit);
        }
    }

    if (isset($pricing['schema']) && is_string($pricing['schema']) && $pricing['schema'] !== '') {
        $normalized['schema'] = $pricing['schema'];
    }

    return $normalized;
}

function imb_pricing_to_cents($value, string $unit): int
{
    if ($unit === 'usd') {
        $floatVal = is_string($value) ? floatval(str_replace(',', '.', $value)) : floatval($value);
        $cents = (int)round($floatVal * 100);
    } else {
        $cents = is_string($value) ? intval($value) : (int)round($value);
    }

    if ($cents < 0) {
        $cents = 0;
    }

    return $cents;
}


