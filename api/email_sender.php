<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/PHPMailer/Exception.php';
require_once __DIR__ . '/lib/PHPMailer/SMTP.php';
require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';

use PHPMailer\PHPMailer\PHPMailer;

function emailLogPath(string $name): string
{
    return __DIR__ . '/' . $name;
}

function appendLog(string $fileName, string $line): void
{
    $entry = sprintf("[%s] %s\n", date('Y-m-d H:i:s'), $line);
    @file_put_contents(emailLogPath($fileName), $entry, FILE_APPEND);
}

function smtpConfigPresent(): bool
{
    $required = [SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM];
    foreach ($required as $item) {
        if (!is_string($item) || trim($item) === '' || str_starts_with($item, 'CHANGE_')) {
            return false;
        }
    }

    return true;
}

function buildSummaryEmailBody(string $nome, string $marketplace, float $precoMinimo, float $precoIdeal): string
{
    $nomeSeguro = $nome !== '' ? htmlspecialchars($nome, ENT_QUOTES, 'UTF-8') : '';
    $marketplaceSeguro = htmlspecialchars($marketplace, ENT_QUOTES, 'UTF-8');

    $saudacao = $nomeSeguro !== '' ? "Olá, {$nomeSeguro}!" : 'Olá!';

    return '<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">'
        . '<h2 style="margin:0 0 16px;font-size:22px;color:#111827">Seu resumo de precificação</h2>'
        . '<p style="margin:0 0 16px">' . $saudacao . '</p>'
        . '<ul style="padding-left:18px;margin:0 0 20px">'
        . '<li><strong>Marketplace:</strong> ' . $marketplaceSeguro . '</li>'
        . '<li><strong>Preço mínimo:</strong> ' . formatBrl($precoMinimo) . '</li>'
        . '<li><strong>Preço ideal:</strong> ' . formatBrl($precoIdeal) . '</li>'
        . '</ul>'
        . '<p style="margin:0 0 20px"><a href="https://precificacao.rafamaceno.com.br">https://precificacao.rafamaceno.com.br</a></p>'
        . '<p style="margin:24px 0 0">Rafa Maceno</p>'
        . '</div>';
}

function normalizePdfText(string $value): string
{
    $normalized = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $normalized = $normalized !== false ? $normalized : $value;
    return preg_replace('/[^\x20-\x7E]/', '', $normalized) ?? '';
}

function escapePdfText(string $value): string
{
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $value);
}

function buildSummaryPdf(string $nome, string $marketplace, float $precoMinimo, float $precoIdeal): string
{
    $firstLine = $nome !== '' ? sprintf('Ola, %s!', normalizePdfText($nome)) : 'Ola!';
    $lines = [
        'Resumo de precificacao',
        '',
        $firstLine,
        '',
        'Marketplace: ' . normalizePdfText($marketplace),
        'Preco minimo: ' . normalizePdfText(formatBrl($precoMinimo)),
        'Preco ideal: ' . normalizePdfText(formatBrl($precoIdeal)),
        '',
        'https://precificacao.rafamaceno.com.br',
        '',
        'Rafa Maceno',
    ];

    $y = 780;
    $commands = ['BT', '/F1 14 Tf'];
    foreach ($lines as $line) {
        $commands[] = sprintf('1 0 0 1 56 %d Tm (%s) Tj', $y, escapePdfText($line));
        $y -= 24;
    }
    $commands[] = 'ET';

    $stream = implode("\n", $commands) . "\n";

    $objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
        sprintf("5 0 obj << /Length %d >> stream\n%sendstream endobj", strlen($stream), $stream),
    ];

    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object . "\n";
    }

    $xrefOffset = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }

    $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
    $pdf .= "startxref\n" . $xrefOffset . "\n%%EOF";

    return $pdf;
}

/**
 * @return array{sent: bool, mode: string}
 */
function sendEmailWithFallback(string $toEmail, string $toName, string $subject, string $htmlBody, array $attachments = []): array
{
    if (!smtpConfigPresent()) {
        appendLog('email_errors.log', sprintf('destinatario=%s tentativa=none erro=smtp_config_missing', $toEmail));
        return ['sent' => false, 'mode' => 'disabled'];
    }

    $attempts = [
        ['mode' => 'SMTPS_465', 'host' => SMTP_HOST !== '' ? SMTP_HOST : 'smtp.hostinger.com', 'port' => 465, 'secure' => PHPMailer::ENCRYPTION_SMTPS],
        ['mode' => 'TLS_587', 'host' => SMTP_HOST !== '' ? SMTP_HOST : 'smtp.hostinger.com', 'port' => 587, 'secure' => PHPMailer::ENCRYPTION_STARTTLS],
    ];

    foreach ($attempts as $attempt) {
        try {
            $mail = new PHPMailer();
            $mail->isSMTP();
            $mail->Host = $attempt['host'];
            $mail->SMTPAuth = true;
            $mail->Username = SMTP_USER;
            $mail->Password = SMTP_PASS;
            $mail->SMTPSecure = $attempt['secure'];
            $mail->Port = $attempt['port'];

            $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
            $mail->addAddress($toEmail, $toName);
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            foreach ($attachments as $attachment) {
                if (!is_array($attachment)) {
                    continue;
                }

                $content = isset($attachment['content']) ? (string) $attachment['content'] : '';
                $name = isset($attachment['name']) ? (string) $attachment['name'] : 'anexo.bin';
                $mime = isset($attachment['mime']) ? (string) $attachment['mime'] : 'application/octet-stream';
                if ($content === '') {
                    continue;
                }

                $mail->addStringAttachment($content, $name, PHPMailer::ENCODING_BASE64, $mime);
            }

            $mail->send();

            appendLog('email_success.log', sprintf('destinatario=%s modo=%s', $toEmail, $attempt['mode']));
            return ['sent' => true, 'mode' => $attempt['mode']];
        } catch (\Throwable $exception) {
            appendLog(
                'email_errors.log',
                sprintf(
                    'destinatario=%s tentativa=%s erro=%s',
                    $toEmail,
                    $attempt['mode'],
                    substr(preg_replace('/\s+/', ' ', trim($exception->getMessage())) ?? 'unknown_error', 0, 220)
                )
            );
        }
    }

    return ['sent' => false, 'mode' => 'failed'];
}
