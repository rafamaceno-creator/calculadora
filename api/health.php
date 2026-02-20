<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/email_sender.php';

function respondHealth(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function readLastSanitizedLine(string $path): string
{
    if (!is_file($path)) {
        return '';
    }

    $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines) || count($lines) === 0) {
        return '';
    }

    $line = (string) $lines[count($lines) - 1];
    $line = preg_replace('/(pass(word)?|senha|token)=([^\s]+)/i', '$1=[redacted]', $line) ?? $line;
    return substr($line, 0, 240);
}

$token = (string) ($_GET['token'] ?? '');
if (!defined('HEALTH_TOKEN') || $token === '' || !hash_equals((string) HEALTH_TOKEN, $token)) {
    respondHealth(['success' => false, 'message' => 'unauthorized'], 401);
}

$dbOk = false;
try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $exception) {
    $dbOk = false;
}

$phpmailerPresent = is_file(__DIR__ . '/lib/PHPMailer/Exception.php')
    && is_file(__DIR__ . '/lib/PHPMailer/SMTP.php')
    && is_file(__DIR__ . '/lib/PHPMailer/PHPMailer.php');

respondHealth([
    'db_ok' => $dbOk,
    'smtp_config_present' => smtpConfigPresent(),
    'phpmailer_present' => $phpmailerPresent,
    'last_email_error_line' => readLastSanitizedLine(__DIR__ . '/email_errors.log'),
]);
