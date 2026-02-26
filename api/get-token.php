<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function respondToken(?string $token): void
{
    echo json_encode(['token' => $token], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    respondToken(null);
}

$sessionId = trim((string) ($_GET['session_id'] ?? ''));
if ($sessionId === '') {
    respondToken(null);
}

$tokensPath = dirname(__DIR__) . '/storage/tokens.json';
if (!is_file($tokensPath)) {
    respondToken(null);
}

$fp = fopen($tokensPath, 'r');
if ($fp === false) {
    respondToken(null);
}

if (!flock($fp, LOCK_SH)) {
    fclose($fp);
    respondToken(null);
}

$raw = stream_get_contents($fp);
flock($fp, LOCK_UN);
fclose($fp);

$tokens = json_decode($raw !== false ? $raw : '[]', true);
if (!is_array($tokens)) {
    respondToken(null);
}

$now = time();
foreach ($tokens as $entry) {
    if (!is_array($entry)) {
        continue;
    }

    if ((string) ($entry['stripe_session_id'] ?? '') !== $sessionId) {
        continue;
    }

    $expiresAt = (int) ($entry['expires_at'] ?? 0);
    $usedAt = $entry['used_at'] ?? null;

    if ($expiresAt > $now && $usedAt === null) {
        respondToken((string) ($entry['token'] ?? ''));
    }
}

respondToken(null);
