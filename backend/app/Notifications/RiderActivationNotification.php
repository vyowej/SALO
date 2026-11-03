<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RiderActivationNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly string $code) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Activate your SALO rider account')
            ->line('Your rider application has been approved.')
            ->line('Enter this six-digit code to activate Driver mode:')
            ->line($this->code)
            ->line('This code expires in 10 minutes. If you did not request this, you can ignore this message.');
    }
}
