<?php

declare(strict_types=1);

$configLocalPath = __DIR__ . '/config.local.php';
$configExamplePath = __DIR__ . '/config.example.php';

if (is_file($configLocalPath)) {
    require_once $configLocalPath;
} else {
    require_once $configExamplePath;
}

if (!defined('DB_PORT')) {
    define('DB_PORT', 3306);
}

if (!defined('SMTP_MODE')) {
    define('SMTP_MODE', 'SMTPS_465');
}
