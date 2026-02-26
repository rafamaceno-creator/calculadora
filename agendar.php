<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';

$token = trim((string) ($_GET['t'] ?? ''));
$calendarUrl = trim((string) getenv('CALENDAR_EMBED_URL'));

function renderInvalidAccess(): void
{
    http_response_code(403);
    ?>
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Acesso inválido | A Hora com o Especialista</title>
      <style>
        body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Inter,system-ui,sans-serif; background:#020617; color:#e2e8f0; padding:20px; }
        .box { max-width:600px; border:1px solid #334155; border-radius:14px; background:#0f172a; padding:24px; }
        a { display:inline-block; margin-top:16px; padding:12px 16px; border-radius:10px; background:#22c55e; color:#052e16; font-weight:700; text-decoration:none; }
      </style>
    </head>
    <body>
      <main class="box">
        <p>Seu acesso expirou ou já foi usado. Clique abaixo para liberar um novo agendamento.</p>
        <a href="/a-hora-com-o-especialista">Comprar acesso</a>
      </main>
    </body>
    </html>
    <?php
    exit;
}

if ($token === '' || $calendarUrl === '') {
    renderInvalidAccess();
}

$tokensPath = __DIR__ . '/storage/tokens.json';
if (!is_file($tokensPath)) {
    renderInvalidAccess();
}

$fp = fopen($tokensPath, 'c+');
if ($fp === false) {
    renderInvalidAccess();
}

if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    renderInvalidAccess();
}

$raw = stream_get_contents($fp);
$tokens = json_decode($raw !== false ? $raw : '[]', true);
if (!is_array($tokens)) {
    $tokens = [];
}

$now = time();
$found = false;

foreach ($tokens as $index => $entry) {
    if (!is_array($entry) || (string) ($entry['token'] ?? '') !== $token) {
        continue;
    }

    $found = true;
    $isExpired = (int) ($entry['expires_at'] ?? 0) <= $now;
    $alreadyUsed = ($entry['used_at'] ?? null) !== null;

    if ($isExpired || $alreadyUsed) {
        flock($fp, LOCK_UN);
        fclose($fp);
        renderInvalidAccess();
    }

    $tokens[$index]['used_at'] = $now;

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($tokens, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    ?>
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Agende sua sessão | A Hora com o Especialista</title>
      <style>
        html, body { margin:0; padding:0; height:100%; background:#020617; }
        iframe { width:100%; height:100vh; border:0; display:block; }
      </style>
    </head>
    <body>
      <iframe src="<?= htmlspecialchars($calendarUrl, ENT_QUOTES, 'UTF-8'); ?>" allow="fullscreen"></iframe>
    </body>
    </html>
    <?php
    exit;
}

flock($fp, LOCK_UN);
fclose($fp);

if (!$found) {
    renderInvalidAccess();
}
