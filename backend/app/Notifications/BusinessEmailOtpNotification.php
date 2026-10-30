<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BusinessEmailOtpNotification extends Notification
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
            ->subject('Verify your restaurant business email')
            ->line('Enter this code to verify the business email for your SALO restaurant application:')
            ->line($this->code)
            ->line('This code expires in 10 minutes. If you did not request it, you can ignore this message.');
    }
}
