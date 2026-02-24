<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/email_sender.php';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function parseBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function formatBrl(float $value): string
{
    return 'R$ ' . number_format($value, 2, ',', '.');
}

$input = parseBody();

$nome = trim((string) ($input['nome'] ?? ''));
$email = trim((string) ($input['email'] ?? ''));
$company = trim((string) ($input['company'] ?? ''));
$marketplace = trim((string) ($input['marketplace'] ?? 'unknown'));
$pageUrl = trim((string) ($input['page_url'] ?? ''));
$userAgent = trim((string) ($input['user_agent'] ?? ''));

$resultado = $input['resultado'] ?? [];
$precoMinimo = (float) ($resultado['precoMinimo'] ?? 0);
$precoIdeal = (float) ($resultado['precoIdeal'] ?? 0);
$utm = $input['utm'] ?? [];

if ($company !== '') {
    respond(['success' => true, 'email_sent' => false]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['success' => false, 'message' => 'invalid_email'], 422);
}

try {
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $stmt = $pdo->prepare(
        'INSERT INTO leads (nome, email, marketplace, preco_minimo, preco_ideal, utm_source, utm_medium, utm_campaign, page_url, user_agent, created_at)
         VALUES (:nome, :email, :marketplace, :preco_minimo, :preco_ideal, :utm_source, :utm_medium, :utm_campaign, :page_url, :user_agent, NOW())'
    );

    $stmt->execute([
        ':nome' => $nome,
        ':email' => $email,
        ':marketplace' => $marketplace,
        ':preco_minimo' => $precoMinimo,
        ':preco_ideal' => $precoIdeal,
        ':utm_source' => (string) ($utm['source'] ?? ''),
        ':utm_medium' => (string) ($utm['medium'] ?? ''),
        ':utm_campaign' => (string) ($utm['campaign'] ?? ''),
        ':page_url' => $pageUrl,
        ':user_agent' => $userAgent,
    ]);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'lead_not_saved'], 500);
}

$summaryBody = buildSummaryEmailBody($nome, $marketplace, $precoMinimo, $precoIdeal);
$subject = 'Seu resumo de precificação — ' . $marketplace;
$pdfContent = buildSummaryPdf($nome, $marketplace, $precoMinimo, $precoIdeal);
$attachments = [[
    'content' => $pdfContent,
    'name' => 'resumo-precificacao.pdf',
    'mime' => 'application/pdf',
]];
$emailStatus = sendEmailWithFallback($email, $nome, $subject, $summaryBody, $attachments);

respond(['success' => true, 'email_sent' => $emailStatus['sent']]);
