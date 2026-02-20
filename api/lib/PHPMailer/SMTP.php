<?php

declare(strict_types=1);

namespace PHPMailer\PHPMailer;

class SMTP
{
    /** @var resource|null */
    private $socket;

    public function connect(string $host, int $port, int $timeout = 15): void
    {
        $context = stream_context_create();
        $this->socket = @stream_socket_client(
            sprintf('ssl://%s:%d', $host, $port),
            $errno,
            $errstr,
            $timeout,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if (!is_resource($this->socket)) {
            throw new Exception(sprintf('Falha ao conectar SMTP: %s (%d)', $errstr ?: 'erro desconhecido', $errno));
        }

        $this->readCode(220);
    }

    public function hello(string $hostName): void
    {
        $this->command('EHLO ' . $hostName, 250);
    }

    public function auth(string $username, string $password): void
    {
        $this->command('AUTH LOGIN', 334);
        $this->command(base64_encode($username), 334);
        $this->command(base64_encode($password), 235);
    }

    public function mailFrom(string $from): void
    {
        $this->command('MAIL FROM:<' . $from . '>', 250);
    }

    public function rcptTo(string $to): void
    {
        $this->command('RCPT TO:<' . $to . '>', [250, 251]);
    }

    public function data(string $data): void
    {
        $this->command('DATA', 354);
        $this->write($this->normalizeData($data) . "\r\n.\r\n");
        $this->readCode(250);
    }

    public function quit(): void
    {
        if (is_resource($this->socket)) {
            $this->command('QUIT', 221);
            fclose($this->socket);
            $this->socket = null;
        }
    }

    private function normalizeData(string $data): string
    {
        $lines = preg_split('/\r\n|\r|\n/', $data) ?: [];
        foreach ($lines as &$line) {
            if (str_starts_with($line, '.')) {
                $line = '.' . $line;
            }
        }

        return implode("\r\n", $lines);
    }

    /** @param int|int[] $expected */
    private function command(string $command, $expected): void
    {
        $this->write($command . "\r\n");
        $this->readCode($expected);
    }

    private function write(string $payload): void
    {
        if (!is_resource($this->socket)) {
            throw new Exception('Conexão SMTP indisponível');
        }

        fwrite($this->socket, $payload);
    }

    /** @param int|int[] $expected */
    private function readCode($expected): void
    {
        if (!is_resource($this->socket)) {
            throw new Exception('Conexão SMTP indisponível');
        }

        $expectedCodes = is_array($expected) ? $expected : [$expected];
        $response = '';
        do {
            $line = fgets($this->socket, 515);
            if ($line === false) {
                break;
            }
            $response .= $line;
        } while (isset($line[3]) && $line[3] === '-');

        $code = (int) substr(trim($response), 0, 3);
        if (!in_array($code, $expectedCodes, true)) {
            throw new Exception('Erro SMTP: ' . trim($response));
        }
    }
}
