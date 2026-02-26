<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function webhookRespond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function webhookLog(string $message, array $context = []): void
{
    $storageDir = dirname(__DIR__) . '/storage';
    $logsDir = $storageDir . '/logs';

    if (!is_dir($logsDir)) {
        @mkdir($logsDir, 0775, true);
    }

    $line = sprintf(
        "[%s] %s %s\n",
        date('c'),
        $message,
        $context ? json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : ''
    );

    @file_put_contents($logsDir . '/stripe.log', $line, FILE_APPEND);
}

function saveTokenRecord(array $record): bool
{
    $storageDir = dirname(__DIR__) . '/storage';
    if (!is_dir($storageDir)) {
        @mkdir($storageDir, 0775, true);
    }

    $tokensPath = $storageDir . '/tokens.json';
    $fp = fopen($tokensPath, 'c+');
    if ($fp === false) {
        return false;
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }

    $existing = stream_get_contents($fp);
    $tokens = json_decode($existing !== false ? $existing : '[]', true);
    if (!is_array($tokens)) {
        $tokens = [];
    }

    foreach ($tokens as $existingRecord) {
        if (($existingRecord['stripe_session_id'] ?? '') === ($record['stripe_session_id'] ?? '')) {
            flock($fp, LOCK_UN);
            fclose($fp);
            return true;
        }
    }

    $tokens[] = $record;

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($tokens, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return true;
}

$webhookSecret = (string) getenv('STRIPE_WEBHOOK_SECRET');
if ($webhookSecret === '') {
    webhookLog('webhook_missing_secret');
    webhookRespond(['error' => 'Webhook não configurado.'], 500);
}

$payload = file_get_contents('php://input');
$sigHeader = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');

if ($payload === false || $sigHeader === '') {
    webhookLog('webhook_invalid_request', ['has_payload' => $payload !== false, 'has_signature' => $sigHeader !== '']);
    webhookRespond(['error' => 'Assinatura ausente.'], 400);
}

$parts = [];
foreach (explode(',', $sigHeader) as $item) {
    [$key, $value] = array_pad(explode('=', trim($item), 2), 2, '');
    if ($key !== '' && $value !== '') {
        $parts[$key] = $value;
    }
}

if (empty($parts['t']) || empty($parts['v1'])) {
    webhookLog('webhook_signature_malformed');
    webhookRespond(['error' => 'Assinatura inválida.'], 400);
}

$signedPayload = $parts['t'] . '.' . $payload;
$expectedSignature = hash_hmac('sha256', $signedPayload, $webhookSecret);

if (!hash_equals($expectedSignature, $parts['v1'])) {
    webhookLog('webhook_signature_mismatch');
    webhookRespond(['error' => 'Assinatura inválida.'], 400);
}

$event = json_decode($payload, true);
if (!is_array($event)) {
    webhookLog('webhook_json_invalid');
    webhookRespond(['error' => 'Payload inválido.'], 400);
}

$type = (string) ($event['type'] ?? '');
$acceptedEvents = [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
];

if (!in_array($type, $acceptedEvents, true)) {
    webhookRespond(['ok' => true]);
}

$session = $event['data']['object'] ?? [];
$sessionId = (string) ($session['id'] ?? '');
if ($sessionId === '') {
    webhookLog('webhook_missing_session_id', ['event_type' => $type]);
    webhookRespond(['error' => 'Sessão ausente.'], 400);
}

$record = [
    'token' => bin2hex(random_bytes(32)),
    'stripe_session_id' => $sessionId,
    'customer_email' => (string) ($session['customer_details']['email'] ?? $session['customer_email'] ?? ''),
    'created_at' => time(),
    'expires_at' => time() + (48 * 60 * 60),
    'used_at' => null,
];

if (!saveTokenRecord($record)) {
    webhookLog('token_persist_failed', ['session_id' => $sessionId]);
    webhookRespond(['error' => 'Falha ao persistir token.'], 500);
}

webhookLog('token_created', [
    'session_id' => $sessionId,
    'token_prefix' => substr($record['token'], 0, 12),
    'event_type' => $type,
]);

webhookRespond(['ok' => true]);
