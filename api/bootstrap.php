<?php

declare(strict_types=1);

$configLocalPath = __DIR__ . '/config.local.php';
$configExamplePath = __DIR__ . '/config.example.php';
$usingExampleConfig = !is_file($configLocalPath);

if ($usingExampleConfig) {
    require_once $configExamplePath;
} else {
    require_once $configLocalPath;
}

if ($usingExampleConfig) {
    $requiredConfigValues = [
        'DB_HOST',
        'DB_NAME',
        'DB_USER',
        'DB_PASS',
        'SMTP_HOST',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_FROM',
        'EMAIL_TEST_TOKEN',
        'HEALTH_TOKEN',
    ];

    $isIncomplete = false;

    foreach ($requiredConfigValues as $constantName) {
        if (!defined($constantName) || trim((string) constant($constantName)) === '') {
            $isIncomplete = true;
            break;
        }
    }

    if ($isIncomplete) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Configuração do servidor incompleta.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!defined('DB_PORT')) {
    define('DB_PORT', 3306);
}

if (!defined('SMTP_MODE')) {
    define('SMTP_MODE', 'SMTPS_465');
}
