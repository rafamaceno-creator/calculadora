<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'has_stripe_secret' => trim((string) getenv('STRIPE_SECRET_KEY')) !== '',
    'has_webhook_secret' => trim((string) getenv('STRIPE_WEBHOOK_SECRET')) !== '',
    'has_base_url' => trim((string) getenv('BASE_URL')) !== '',
    'has_calendar_url' => trim((string) getenv('CALENDAR_EMBED_URL')) !== '',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
