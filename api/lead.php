<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib/PHPMailer/Exception.php';
require_once __DIR__ . '/lib/PHPMailer/SMTP.php';
require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';

use PHPMailer\PHPMailer\PHPMailer;

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

function writeEmailError(string $message): void
{
    $logLine = sprintf("[%s] %s\n", date('Y-m-d H:i:s'), $message);
    @file_put_contents(__DIR__ . '/email_errors.log', $logLine, FILE_APPEND);
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
    respond(['success' => true]);
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

try {
    $saudacaoNome = $nome !== '' ? htmlspecialchars($nome, ENT_QUOTES, 'UTF-8') : '';
    $marketplaceSeguro = htmlspecialchars($marketplace, ENT_QUOTES, 'UTF-8');

    $body = '<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">';
    $body .= '<h2 style="margin:0 0 16px;font-size:22px;color:#111827">Seu resumo de precificação</h2>';
    $body .= '<p style="margin:0 0 16px">' . ($saudacaoNome !== '' ? "Olá, {$saudacaoNome}!" : 'Olá!') . '</p>';
    $body .= '<p style="margin:0 0 12px">Seu cálculo foi registrado com sucesso. Segue seu resumo:</p>';
    $body .= '<ul style="padding-left:18px;margin:0 0 20px">';
    $body .= '<li><strong>Marketplace:</strong> ' . $marketplaceSeguro . '</li>';
    $body .= '<li><strong>Preço mínimo:</strong> ' . formatBrl($precoMinimo) . '</li>';
    $body .= '<li><strong>Preço ideal:</strong> ' . formatBrl($precoIdeal) . '</li>';
    $body .= '</ul>';
    $body .= '<p style="margin:0 0 20px"><a href="https://precificacao.rafamaceno.com.br" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px">Abrir calculadora</a></p>';
    $body .= '<p style="margin:24px 0 0">Rafa Maceno<br><span style="color:#4b5563">Especialista em Marketplaces</span></p>';
    $body .= '</div>';

    $mail = new PHPMailer();
    $mail->isSMTP();
    $mail->Host = SMTP_HOST;
    $mail->SMTPAuth = true;
    $mail->Username = SMTP_USER;
    $mail->Password = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port = SMTP_PORT;

    $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
    $mail->addAddress($email, $nome !== '' ? $nome : '');
    $mail->isHTML(true);
    $mail->Subject = 'Seu resumo de precificação — ' . $marketplace;
    $mail->Body = $body;
    $mail->send();
} catch (Throwable $exception) {
    writeEmailError($exception->getMessage());
}

respond(['success' => true]);
