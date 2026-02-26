<?php

declare(strict_types=1);

namespace PHPMailer\PHPMailer;

class PHPMailer
{
    public const ENCRYPTION_STARTTLS = 'tls';
    public const ENCRYPTION_SMTPS = 'ssl';
    public const ENCODING_BASE64 = 'base64';

    public bool $SMTPAuth = true;
    public string $Host = '';
    public string $Username = '';
    public string $Password = '';
    public string $SMTPSecure = '';
    public int $Port = 25;
    public string $Subject = '';
    public string $Body = '';

    private bool $isSmtp = false;
    private bool $isHtml = false;
    private string $from = '';
    private string $fromName = '';

    /** @var array<int, array{email: string, name: string}> */
    private array $to = [];

    /** @var array<int, array{content: string, name: string, encoding: string, type: string}> */
    private array $attachments = [];

    public function isSMTP(): void
    {
        $this->isSmtp = true;
    }

    public function setFrom(string $address, string $name = ''): void
    {
        $this->from = $address;
        $this->fromName = $name;
    }

    public function addAddress(string $address, string $name = ''): void
    {
        $this->to[] = ['email' => $address, 'name' => $name];
    }

    public function isHTML(bool $isHtml = true): void
    {
        $this->isHtml = $isHtml;
    }

    public function addStringAttachment(string $string, string $filename, string $encoding = self::ENCODING_BASE64, string $type = 'application/octet-stream'): void
    {
        $this->attachments[] = [
            'content' => $string,
            'name' => $filename,
            'encoding' => $encoding,
            'type' => $type,
        ];
    }

    public function send(): bool
    {
        if (!$this->isSmtp) {
            throw new Exception('Only SMTP mode is supported');
        }

        if ($this->Host === '' || $this->from === '' || empty($this->to)) {
            throw new Exception('SMTP host, from and recipient are required');
        }

        $smtp = new SMTP();

        try {
            $smtp->connect($this->Host, $this->Port, $this->SMTPSecure);
            $smtp->hello($this->detectClientHost());

            if ($this->SMTPSecure === self::ENCRYPTION_STARTTLS) {
                $smtp->startTLS();
                $smtp->hello($this->detectClientHost());
            }

            if ($this->SMTPAuth) {
                $smtp->authenticate($this->Username, $this->Password);
            }

            $smtp->sendMessage($this->from, $this->to, $this->buildMessage());
            $smtp->quit();

            return true;
        } catch (\Throwable $exception) {
            $smtp->close();
            throw $exception;
        }
    }

    private function detectClientHost(): string
    {
        $host = gethostname();
        return is_string($host) && $host !== '' ? $host : 'localhost';
    }

    private function buildMessage(): string
    {
        $toHeader = [];
        foreach ($this->to as $recipient) {
            $toHeader[] = $this->formatAddress($recipient['email'], $recipient['name']);
        }

        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $this->formatAddress($this->from, $this->fromName),
            'To: ' . implode(', ', $toHeader),
            'Subject: ' . $this->encodeHeader($this->Subject),
            'MIME-Version: 1.0',
        ];

        if ($this->attachments === []) {
            $headers[] = 'Content-Type: ' . ($this->isHtml ? 'text/html' : 'text/plain') . '; charset=UTF-8';
            $headers[] = 'Content-Transfer-Encoding: 8bit';
            return implode("\r\n", $headers) . "\r\n\r\n" . $this->Body;
        }

        $boundary = 'b=' . bin2hex(random_bytes(16));
        $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

        $parts = [];
        $parts[] = '--' . $boundary;
        $parts[] = 'Content-Type: ' . ($this->isHtml ? 'text/html' : 'text/plain') . '; charset=UTF-8';
        $parts[] = 'Content-Transfer-Encoding: 8bit';
        $parts[] = '';
        $parts[] = $this->Body;

        foreach ($this->attachments as $attachment) {
            $filename = addcslashes($attachment['name'], '"\\');
            $encodedContent = chunk_split(base64_encode($attachment['content']), 76, "\r\n");

            $parts[] = '--' . $boundary;
            $parts[] = 'Content-Type: ' . $attachment['type'] . '; name="' . $filename . '"';
            $parts[] = 'Content-Transfer-Encoding: base64';
            $parts[] = 'Content-Disposition: attachment; filename="' . $filename . '"';
            $parts[] = '';
            $parts[] = rtrim($encodedContent, "\r\n");
        }

        $parts[] = '--' . $boundary . '--';
        $parts[] = '';

        return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $parts);
    }

    private function formatAddress(string $email, string $name = ''): string
    {
        if ($name === '') {
            return $email;
        }

        return sprintf('"%s" <%s>', addcslashes($name, '"\\'), $email);
    }

    private function encodeHeader(string $value): string
    {
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }
}
