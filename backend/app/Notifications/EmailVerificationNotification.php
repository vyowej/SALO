<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailVerificationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $token,
        private readonly string $frontendUrl,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim($this->frontendUrl, '/').'/verify-email?token='.rawurlencode($this->token);

        return (new MailMessage)
            ->subject('Verify your SALO email')
            ->line('Confirm your email address to keep your SALO account details current.')
            ->action('Verify email', $url)
            ->line('If you did not create this account, you can ignore this message.');
    }
}
