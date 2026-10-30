<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EmailVerificationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $code,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Verify your SALO email')
            ->line('Enter this code to verify your SALO email address:')
            ->line($this->code)
            ->line('This code expires in 10 minutes. If you did not create this account, you can ignore this message.');
    }
}
