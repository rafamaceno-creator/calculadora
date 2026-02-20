<?php

declare(strict_types=1);

namespace PHPMailer\PHPMailer;

class SMTP
{
    /** @var resource|null */
    private $socket = null;

    public function connect(string $host, int $port, string $security = ''): void
    {
        $prefix = strtolower($security) === 'ssl' ? 'ssl://' : '';
        $remote = $prefix . $host . ':' . $port;

        $this->socket = @stream_socket_client($remote, $errno, $errstr, 20);
        if (!is_resource($this->socket)) {
            throw new Exception(sprintf('SMTP connect failed: %s (%d)', $errstr ?: 'unknown', (int) $errno));
        }

        stream_set_timeout($this->socket, 20);
        $this->expectCode([220]);
    }

    public function hello(string $host): void
    {
        $this->write('EHLO ' . $host);
        $this->expectCode([250]);
    }

    public function startTLS(): void
    {
        $this->write('STARTTLS');
        $this->expectCode([220]);

        $ok = @stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if ($ok !== true) {
            throw new Exception('SMTP STARTTLS failed');
        }
    }

    public function authenticate(string $username, string $password): void
    {
        $this->write('AUTH LOGIN');
        $this->expectCode([334]);

        $this->write(base64_encode($username));
        $this->expectCode([334]);

        $this->write(base64_encode($password));
        $this->expectCode([235]);
    }

    /**
     * @param array<int, array{email: string, name: string}> $recipients
     */
    public function sendMessage(string $from, array $recipients, string $payload): void
    {
        $this->write('MAIL FROM:<' . $from . '>');
        $this->expectCode([250]);

        foreach ($recipients as $recipient) {
            $this->write('RCPT TO:<' . $recipient['email'] . '>');
            $this->expectCode([250, 251]);
        }

        $this->write('DATA');
        $this->expectCode([354]);

        $data = preg_replace('/\r\n|\r|\n/', "\r\n", $payload);
        $data = preg_replace('/^\./m', '..', (string) $data);
        $this->write($data . "\r\n.");
        $this->expectCode([250]);
    }

    public function quit(): void
    {
        if (!is_resource($this->socket)) {
            return;
        }

        $this->write('QUIT');
        $this->close();
    }

    public function close(): void
    {
        if (is_resource($this->socket)) {
            fclose($this->socket);
        }

        $this->socket = null;
    }

    private function write(string $line): void
    {
        if (!is_resource($this->socket)) {
            throw new Exception('SMTP socket not connected');
        }

        fwrite($this->socket, $line . "\r\n");
    }

    /** @param array<int, int> $expected */
    private function expectCode(array $expected): void
    {
        $response = $this->readResponse();
        $code = (int) substr($response, 0, 3);

        if (!in_array($code, $expected, true)) {
            throw new Exception('SMTP unexpected response: ' . trim($response));
        }
    }

    private function readResponse(): string
    {
        if (!is_resource($this->socket)) {
            throw new Exception('SMTP socket not connected');
        }

        $response = '';
        while (($line = fgets($this->socket, 515)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }

        if ($response === '') {
            throw new Exception('SMTP empty response');
        }

        return $response;
    }
}
