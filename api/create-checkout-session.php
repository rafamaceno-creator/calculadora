<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function stripeLog(string $message, array $context = []): void
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

function respondJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function appendQueryToUrl(string $url, string $rawQuery): string
{
    $query = ltrim(trim($rawQuery), '?');
    if ($query === '') {
        return $url;
    }

    $separator = str_contains($url, '?') ? '&' : '?';
    return $url . $separator . $query;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respondJson(['error' => 'Método não permitido.'], 405);
}

$stripeSecret = (string) getenv('STRIPE_SECRET_KEY');
$baseUrl = rtrim((string) getenv('BASE_URL'), '/');

if ($stripeSecret === '' || $baseUrl === '') {
    stripeLog('checkout_config_missing', [
        'has_stripe_secret' => $stripeSecret !== '',
        'has_base_url' => $baseUrl !== '',
    ]);
    respondJson(['error' => 'Configuração incompleta.'], 500);
}

$utmQuery = (string) ($_POST['utm_query'] ?? '');
$successUrl = appendQueryToUrl($baseUrl . '/obrigado?session_id={CHECKOUT_SESSION_ID}', $utmQuery);
$cancelUrl = appendQueryToUrl($baseUrl . '/a-hora-com-o-especialista?cancel=1', $utmQuery);

$postData = [
    'mode' => 'payment',
    'success_url' => $successUrl,
    'cancel_url' => $cancelUrl,
    'line_items[0][quantity]' => 1,
    'line_items[0][price_data][currency]' => 'brl',
    'line_items[0][price_data][unit_amount]' => 99700,
    'line_items[0][price_data][product_data][name]' => 'A Hora com o Especialista',
];

$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($postData),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $stripeSecret,
        'Content-Type: application/x-www-form-urlencoded',
    ],
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $curlError !== '') {
    stripeLog('checkout_curl_error', ['error' => $curlError]);
    respondJson(['error' => 'Erro ao criar checkout.'], 502);
}

$data = json_decode($response, true);
if (!is_array($data) || $httpCode >= 400 || empty($data['url'])) {
    stripeLog('checkout_api_error', [
        'http_code' => $httpCode,
        'response' => is_array($data) ? $data : $response,
    ]);
    respondJson(['error' => 'Não foi possível iniciar o pagamento.'], 502);
}

respondJson(['url' => (string) $data['url']]);
