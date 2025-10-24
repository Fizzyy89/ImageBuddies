<?php

function secret_key_path() {
    return __DIR__ . '/../database/.secret.key';
}

function load_secret_key() {
    $path = secret_key_path();
    if (!file_exists($path)) {
        $dir = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0777, true);
        $raw = random_bytes(32);
        file_put_contents($path, base64_encode($raw));
        @chmod($path, 0600);
        return $raw;
    }
    $b64 = trim(file_get_contents($path));
    if ($b64 === '') return random_bytes(32);
    $raw = base64_decode($b64, true);
    if ($raw === false || strlen($raw) !== 32) return random_bytes(32);
    return $raw;
}

function encrypt_secret($plaintext) {
    // Treat empty as no-op
    if ($plaintext === null || $plaintext === '') return null;
    $key = load_secret_key();
    if (function_exists('sodium_crypto_secretbox') && extension_loaded('sodium')) {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = sodium_crypto_secretbox($plaintext, $nonce, $key);
        return json_encode([
            'algo' => 'sodium_secretbox',
            'nonce' => base64_encode($nonce),
            'cipher' => base64_encode($cipher)
        ]);
    } elseif (function_exists('openssl_encrypt')) {
        // OpenSSL AES-256-GCM
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) return null;
        return json_encode([
            'algo' => 'aes-256-gcm',
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'cipher' => base64_encode($cipher)
        ]);
    } else {
        // No crypto available; do not store
        return null;
    }
}

function decrypt_secret($blob) {
    if ($blob === null || $blob === '') return '';
    $data = json_decode($blob, true);
    if (!is_array($data) || !isset($data['algo'])) return '';
    $key = load_secret_key();
    if ($data['algo'] === 'sodium_secretbox' && function_exists('sodium_crypto_secretbox_open') && extension_loaded('sodium')) {
        $nonce = base64_decode($data['nonce'] ?? '', true);
        $cipher = base64_decode($data['cipher'] ?? '', true);
        if ($nonce === false || $cipher === false) return '';
        $plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);
        return $plain === false ? '' : $plain;
    }
    if ($data['algo'] === 'aes-256-gcm' && function_exists('openssl_decrypt')) {
        $iv = base64_decode($data['iv'] ?? '', true);
        $tag = base64_decode($data['tag'] ?? '', true);
        $cipher = base64_decode($data['cipher'] ?? '', true);
        if ($iv === false || $tag === false || $cipher === false) return '';
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return $plain === false ? '' : $plain;
    }
    return '';
}


