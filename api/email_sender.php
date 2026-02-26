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



function sanitizeMarketplaceSummaries(array $items): array
{
    $sanitized = [];

    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }

        $title = trim((string) ($item['title'] ?? $item['key'] ?? 'Marketplace'));
        if ($title === '') {
            continue;
        }

        $sanitized[] = [
            'title' => $title,
            'precoIdeal' => (float) ($item['precoIdeal'] ?? 0),
            'lucro' => (float) ($item['lucro'] ?? 0),
            'margem' => (float) ($item['margem'] ?? 0),
        ];
    }

    return $sanitized;
}

function buildSummaryEmailBody(string $nome, string $marketplace, float $precoMinimo, float $precoIdeal, array $marketplacePrices = []): string
{
    $nomeSeguro = $nome !== '' ? htmlspecialchars($nome, ENT_QUOTES, 'UTF-8') : '';
    $saudacao = $nomeSeguro !== '' ? "Olá, {$nomeSeguro}!" : 'Olá!';
    $sanitizedPrices = sanitizeMarketplaceSummaries($marketplacePrices);

    $priceRows = '';
    foreach ($sanitizedPrices as $item) {
        $priceRows .= '<tr>'
            . '<td style="padding:6px 8px;border:1px solid #e5e7eb">' . htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8') . '</td>'
            . '<td style="padding:6px 8px;border:1px solid #e5e7eb">' . formatBrl((float) $item['precoIdeal']) . '</td>'
            . '</tr>';
    }

    $priceListHtml = $priceRows !== ''
        ? '<p style="margin:0 0 10px"><strong>Preço de venda por marketplace:</strong></p>'
            . '<table style="border-collapse:collapse;width:100%;margin:0 0 20px">'
            . '<thead><tr>'
            . '<th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb">Marketplace</th>'
            . '<th style="text-align:left;padding:6px 8px;border:1px solid #e5e7eb;background:#f9fafb">Preço de venda</th>'
            . '</tr></thead><tbody>' . $priceRows . '</tbody></table>'
        : '';

    return '<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111827;line-height:1.5">'
        . '<h2 style="margin:0 0 16px;font-size:22px;color:#111827">Seu resumo de precificação</h2>'
        . '<p style="margin:0 0 16px">' . $saudacao . '</p>'
        . $priceListHtml
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

function buildSummaryPdf(string $nome, string $marketplace, float $precoMinimo, float $precoIdeal, array $marketplacePrices = []): string
{
    $firstLine = $nome !== '' ? sprintf('Ola, %s!', normalizePdfText($nome)) : 'Ola!';
    $sanitizedPrices = sanitizeMarketplaceSummaries($marketplacePrices);

    $lines = [
        'Resumo de precificacao',
        '',
        $firstLine,
        '',
        'Preco de venda por marketplace',
        '',
    ];

    if ($sanitizedPrices !== []) {
        $lines[] = 'Preco de venda por marketplace:';
        foreach ($sanitizedPrices as $item) {
            $lines[] = '- ' . normalizePdfText($item['title']);
            $lines[] = '  Preco de venda: ' . normalizePdfText(formatBrl((float) $item['precoIdeal']));
        }
        $lines[] = '';
    }

    $lines[] = 'https://precificacao.rafamaceno.com.br';
    $lines[] = '';
    $lines[] = 'Rafa Maceno';

    $buildPageStream = static function (array $pageLines): string {
        $y = 780;
        $commands = ['BT', '/F1 12 Tf'];
        foreach ($pageLines as $line) {
            $commands[] = sprintf('1 0 0 1 56 %d Tm (%s) Tj', $y, escapePdfText($line));
            $y -= 20;
        }
        $commands[] = 'ET';

        return implode("\n", $commands) . "\n";
    };

    $linesPerPage = 35;
    $pages = array_chunk($lines, $linesPerPage);
    if ($pages === []) {
        $pages = [['Resumo de precificacao']];
    }

    $pageCount = count($pages);
    $fontObjectNumber = 3 + ($pageCount * 2);

    $objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    ];

    $pageRefs = [];
    for ($i = 0; $i < $pageCount; $i++) {
        $pageObjectNumber = 3 + ($i * 2);
        $contentObjectNumber = $pageObjectNumber + 1;
        $pageRefs[] = $pageObjectNumber . ' 0 R';

        $objects[] = sprintf(
            '%d 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >> endobj',
            $pageObjectNumber,
            $fontObjectNumber,
            $contentObjectNumber
        );

        $stream = $buildPageStream($pages[$i]);
        $objects[] = sprintf("%d 0 obj << /Length %d >> stream\n%sendstream endobj", $contentObjectNumber, strlen($stream), $stream);
    }

    array_splice(
        $objects,
        1,
        0,
        sprintf('2 0 obj << /Type /Pages /Kids [%s] /Count %d >> endobj', implode(' ', $pageRefs), $pageCount)
    );

    $objects[] = sprintf('%d 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj', $fontObjectNumber);

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
