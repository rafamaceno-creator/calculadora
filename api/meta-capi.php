<?php

declare(strict_types=1);

/* =========================================================
   META — API DE CONVERSÕES (Lead enviado pelo servidor)
   Usado por api/lead.php. O token fica só no api/config.local.php
   do servidor (nunca no repositório).
   ========================================================= */

if (basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

if (!defined('META_PIXEL_ID')) {
    define('META_PIXEL_ID', '4410552279212380');
}
if (!defined('META_GRAPH_VERSION')) {
    define('META_GRAPH_VERSION', 'v26.0');
}

// Minúsculas e só letras (tira espaços, pontos, hífens etc.)
function meta_letras(string $v): string
{
    $v = mb_strtolower(trim($v), 'UTF-8');
    return (string) preg_replace('/[^\p{L}]+/u', '', $v);
}

// IP real do visitante (o site passa pela CDN da Hostinger)
function meta_client_ip(): ?string
{
    $candidatos = [];
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $candidatos[] = trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
    }
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
        $candidatos[] = trim((string) $_SERVER['HTTP_X_REAL_IP']);
    }
    if (!empty($_SERVER['REMOTE_ADDR'])) {
        $candidatos[] = (string) $_SERVER['REMOTE_ADDR'];
    }
    foreach ($candidatos as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $ip;
        }
    }
    return null;
}

/** @return array{0:int,1:string} */
function meta_http_post_json(string $url, array $body): array
{
    $json = (string) json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 5,
        ]);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        return [$code, $resp === false ? curl_error($ch) : (string) $resp];
    }
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $json,
        'timeout' => 5,
        'ignore_errors' => true,
    ]]);
    $resp = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', (string) $http_response_header[0], $m)) {
        $code = (int) $m[1];
    }
    return [$code, (string) $resp];
}

/**
 * Envia o evento Lead para a Meta com o mesmo event_id do pixel,
 * para a Meta juntar os dois e não contar em dobro.
 */
function meta_capi_send_lead(array $lead): void
{
    $token = defined('META_CAPI_TOKEN') ? (string) constant('META_CAPI_TOKEN') : '';
    if ($token === '') {
        return;
    }

    $ud = [];

    $email = mb_strtolower(trim((string) ($lead['email'] ?? '')), 'UTF-8');
    if ($email !== '' && strpos($email, '@') !== false) {
        $ud['em'] = [hash('sha256', $email)];
    }

    $partes = preg_split('/\s+/u', trim((string) ($lead['nome'] ?? '')), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if ($partes) {
        $fn = meta_letras((string) $partes[0]);
        if ($fn !== '') {
            $ud['fn'] = [hash('sha256', $fn)];
        }
        if (count($partes) > 1) {
            $ln = meta_letras((string) $partes[count($partes) - 1]);
            if ($ln !== '') {
                $ud['ln'] = [hash('sha256', $ln)];
            }
        }
    }

    $ip = meta_client_ip();
    if ($ip !== null) {
        $ud['client_ip_address'] = $ip;
    }
    if (!empty($_SERVER['HTTP_USER_AGENT'])) {
        $ud['client_user_agent'] = (string) $_SERVER['HTTP_USER_AGENT'];
    }
    if (!empty($_COOKIE['_fbp'])) {
        $ud['fbp'] = (string) $_COOKIE['_fbp'];
    }
    if (!empty($_COOKIE['_fbc'])) {
        $ud['fbc'] = (string) $_COOKIE['_fbc'];
    }

    // ID vindo do navegador (mesmo do pixel); se não vier, gera um próprio.
    $eventId = (string) ($lead['event_id'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{8,80}$/', $eventId)) {
        $eventId = 'lead-srv-' . bin2hex(random_bytes(8));
    }

    // URL da página sem parâmetros (não manda os números da simulação para a Meta).
    $sourceUrl = 'https://precificacao.rafamaceno.com.br/';
    $pageUrl = (string) ($lead['page_url'] ?? '');
    $parts = $pageUrl !== '' ? parse_url($pageUrl) : false;
    if (is_array($parts) && ($parts['host'] ?? '') === 'precificacao.rafamaceno.com.br') {
        $sourceUrl = 'https://precificacao.rafamaceno.com.br' . ($parts['path'] ?? '/');
    }

    $evento = [
        'event_name' => 'Lead',
        'event_time' => time(),
        'event_id' => $eventId,
        'event_source_url' => $sourceUrl,
        'action_source' => 'website',
        'user_data' => $ud,
    ];

    $body = ['data' => [$evento], 'access_token' => $token];
    $testCode = defined('META_CAPI_TEST_CODE') ? (string) constant('META_CAPI_TEST_CODE') : '';
    if ($testCode !== '') {
        $body['test_event_code'] = $testCode;
    }

    $url = 'https://graph.facebook.com/' . META_GRAPH_VERSION . '/' . META_PIXEL_ID . '/events';
    try {
        [$code, $resp] = meta_http_post_json($url, $body);
        if ($code !== 200) {
            error_log('[Meta CAPI] falha ao enviar Lead: HTTP ' . $code . ' ' . substr($resp, 0, 300));
        }
    } catch (Throwable $e) {
        error_log('[Meta CAPI] erro: ' . $e->getMessage());
    }
}
