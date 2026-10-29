<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetNotification extends Notification
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
        $url = rtrim($this->frontendUrl, '/').'/forgot-password?token='.rawurlencode($this->token)
            .'&email='.rawurlencode((string) $notifiable->email);

        return (new MailMessage)
            ->subject('Reset your SALO password')
            ->line('We received a request to reset the password for your SALO account.')
            ->action('Reset password', $url)
            ->line('If you did not request a password reset, you can ignore this message.');
    }
}
