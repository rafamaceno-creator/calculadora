<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/email_sender.php';

function respondEmailTest(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$token = (string) ($_GET['token'] ?? '');
$to = trim((string) ($_GET['to'] ?? ''));

if (!defined('EMAIL_TEST_TOKEN') || $token === '' || !hash_equals((string) EMAIL_TEST_TOKEN, $token)) {
    respondEmailTest(['success' => false, 'message' => 'unauthorized'], 401);
}

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    respondEmailTest(['success' => false, 'message' => 'invalid_to'], 422);
}

$body = '<p>Teste de SMTP concluído.</p><p>Verifique logs para diagnóstico.</p>';
$result = sendEmailWithFallback($to, '', 'Teste de SMTP — Precificação', $body);

respondEmailTest([
    'success' => $result['sent'],
    'mode' => $result['mode'],
    'message' => 'verifique logs',
]);
