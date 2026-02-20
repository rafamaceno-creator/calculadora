<?php

declare(strict_types=1);

// Banco (mantém compatível com ambiente atual)
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', (int) (getenv('DB_PORT') ?: 3306));
define('DB_NAME', getenv('DB_NAME') ?: 'calculadora');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

define('SMTP_HOST', 'smtp.hostinger.com');
define('SMTP_PORT', 465);
define('SMTP_USER', 'noreply@rafamaceno.com.br');
define('SMTP_PASS', 'SsLg2930##');
define('SMTP_FROM', 'noreply@rafamaceno.com.br');
define('SMTP_FROM_NAME', 'Precificação Marketplaces');
