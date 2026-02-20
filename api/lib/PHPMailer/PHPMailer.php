<?php

declare(strict_types=1);

namespace PHPMailer\PHPMailer;

class PHPMailer
{
    public const ENCRYPTION_SMTPS = 'ssl';

    public bool $SMTPAuth = false;
    public string $Host = '';
    public string $Username = '';
    public string $Password = '';
    public string $SMTPSecure = self::ENCRYPTION_SMTPS;
    public int $Port = 465;
    public string $Subject = '';
    public string $Body = '';

    private bool $isSmtp = false;
    private bool $isHtml = false;
    private string $from = '';
    private string $fromName = '';
    /** @var array<int, array{email: string, name: string}> */
    private array $to = [];

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

    public function send(): bool
    {
        if (!$this->isSmtp) {
            throw new Exception('Apenas SMTP é suportado nesta implementação.');
        }

        if ($this->from === '' || $this->Host === '' || empty($this->to)) {
            throw new Exception('Configuração de e-mail incompleta.');
        }

        $smtp = new SMTP();
        $smtp->connect($this->Host, $this->Port);
        $smtp->hello(gethostname() ?: 'localhost');

        if ($this->SMTPAuth) {
            $smtp->auth($this->Username, $this->Password);
        }

        $smtp->mailFrom($this->from);
        foreach ($this->to as $recipient) {
            $smtp->rcptTo($recipient['email']);
        }

        $smtp->data($this->buildMessage());
        $smtp->quit();

        return true;
    }

    private function buildMessage(): string
    {
        $boundary = md5((string) microtime(true));
        $toHeader = implode(', ', array_map(static function (array $recipient): string {
            return $recipient['name'] !== ''
                ? sprintf('%s <%s>', $recipient['name'], $recipient['email'])
                : $recipient['email'];
        }, $this->to));

        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . ($this->fromName !== '' ? sprintf('%s <%s>', $this->fromName, $this->from) : $this->from),
            'To: ' . $toHeader,
            'Subject: ' . $this->Subject,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];

        $textBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $this->Body));
        $htmlBody = $this->isHtml ? $this->Body : nl2br(htmlspecialchars($this->Body, ENT_QUOTES, 'UTF-8'));

        $parts = [
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $textBody,
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $htmlBody,
            '--' . $boundary . '--',
        ];

        return implode("\r\n", array_merge($headers, [''], $parts));
    }
}
