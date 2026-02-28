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
    $saudacaoNome = $nomeSeguro !== '' ? ", {$nomeSeguro}" : '';
    $sanitizedPrices = sanitizeMarketplaceSummaries($marketplacePrices);

    // Build table rows with margin badge
    $tableRows = '';
    foreach ($sanitizedPrices as $item) {
        $titulo = htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8');
        $preco  = formatBrl((float) $item['precoIdeal']);
        $lucro  = formatBrl((float) $item['lucro']);
        $margem = (float) $item['margem'];
        $margemFmt = number_format($margem, 1, ',', '.') . '%';

        if ($margem >= 20) {
            $badgeBg = '#dcfce7'; $badgeColor = '#166534'; $badgeLabel = 'Ótima';
        } elseif ($margem >= 8) {
            $badgeBg = '#fef9c3'; $badgeColor = '#854d0e'; $badgeLabel = 'OK';
        } elseif ($margem >= 0) {
            $badgeBg = '#ffedd5'; $badgeColor = '#9a3412'; $badgeLabel = 'Apertada';
        } else {
            $badgeBg = '#fee2e2'; $badgeColor = '#991b1b'; $badgeLabel = 'Prejuízo';
        }

        $badge = '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:' . $badgeBg . ';color:' . $badgeColor . '">' . $badgeLabel . '</span>';

        $tableRows .= '<tr>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;color:#0f172a">' . $titulo . '</td>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:700;color:#0f172a;white-space:nowrap">' . $preco . '</td>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#334155;white-space:nowrap">' . $lucro . '</td>'
            . '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center">' . $badge . '<br><span style="font-size:11px;color:#64748b">' . $margemFmt . '</span></td>'
            . '</tr>';
    }

    $tableHtml = '';
    if ($tableRows !== '') {
        $tableHtml = '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 28px">'
            . '<thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">'
            . '<th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Marketplace</th>'
            . '<th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Vender por</th>'
            . '<th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Lucro</th>'
            . '<th style="text-align:center;padding:10px 12px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Margem</th>'
            . '</tr></thead>'
            . '<tbody>' . $tableRows . '</tbody>'
            . '</table>';
    }

    $toolUrl = 'https://precificacao.rafamaceno.com.br';
    $ctaUrl  = 'https://precificacao.rafamaceno.com.br/a-hora-com-o-especialista';

    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">'

        // Header
        . '<div style="background:#0f172a;padding:28px 32px;text-align:center">'
        . '<p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#14b8a6;letter-spacing:.1em;text-transform:uppercase">Calculadora de Precificação</p>'
        . '<p style="margin:0;font-size:12px;color:#64748b">' . $toolUrl . '</p>'
        . '</div>'

        // Card wrapper
        . '<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.10)">'

        // Hero
        . '<div style="padding:32px 32px 24px;border-bottom:1px solid #f1f5f9">'
        . '<p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;line-height:1.2">Seu relatório está pronto' . $saudacaoNome . '!</p>'
        . '<p style="margin:0;font-size:15px;color:#64748b">Confira os preços calculados para cada marketplace abaixo.</p>'
        . '</div>'

        // Results table
        . '<div style="padding:24px 32px">'
        . ($tableHtml ?: '<p style="color:#64748b;margin:0 0 24px">Acesse a ferramenta para ver seus resultados.</p>')

        // CTA
        . '<div style="background:#f8fafc;border-radius:12px;padding:24px;text-align:center;margin-bottom:8px">'
        . '<p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a">Quer escalar sua operação?</p>'
        . '<p style="margin:0 0 18px;font-size:14px;color:#64748b">Análise estratégica personalizada da sua conta com Rafa Maceno.</p>'
        . '<a href="' . $ctaUrl . '" style="display:inline-block;background:#14b8a6;color:#ffffff;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">Agendar Hora com o Especialista →</a>'
        . '</div>'
        . '</div>'

        // Footer
        . '<div style="padding:20px 32px;border-top:1px solid #f1f5f9;text-align:center">'
        . '<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#334155">Rafa Maceno</p>'
        . '<p style="margin:0 0 12px;font-size:12px;color:#94a3b8">Especialista em Escala para Marketplaces</p>'
        . '<a href="' . $toolUrl . '" style="font-size:12px;color:#14b8a6;text-decoration:none">' . $toolUrl . '</a>'
        . '</div>'

        . '</div>'
        . '</body></html>';
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
