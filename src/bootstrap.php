<?php
declare(strict_types=1);

// Central bootstrap defining canonical paths for the app
// Root is two levels up from here: project root contains `src/` and `www/`

if (!defined('IMB_ROOT_DIR')) {
    define('IMB_ROOT_DIR', realpath(__DIR__ . '/..'));
}

if (!defined('IMB_SRC_DIR')) {
    define('IMB_SRC_DIR', IMB_ROOT_DIR . '/src');
}

if (!defined('IMB_PUBLIC_DIR')) {
    define('IMB_PUBLIC_DIR', IMB_ROOT_DIR . '/www');
}

// Data directory lives next to `www/` in production; created on first setup.
// The runtime will ensure it exists.
if (!defined('IMB_DATA_DIR')) {
    define('IMB_DATA_DIR', IMB_ROOT_DIR . '/data');
}

// Public images directory (served by web server)
if (!defined('IMB_IMAGE_DIR')) {
    define('IMB_IMAGE_DIR', IMB_PUBLIC_DIR . '/images');
}

// Public locales directory
if (!defined('IMB_LOCALES_DIR')) {
    define('IMB_LOCALES_DIR', IMB_PUBLIC_DIR . '/locales');
}


