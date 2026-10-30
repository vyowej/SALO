<?php

return [
    'auth' => [
        'login_attempts_per_minute' => (int) env('SALO_LOGIN_ATTEMPTS_PER_MINUTE', 5),
        'recovery_attempts_per_minute' => (int) env('SALO_RECOVERY_ATTEMPTS_PER_MINUTE', 5),
        'otp_requests_per_minute' => (int) env('SALO_OTP_REQUESTS_PER_MINUTE', 5),
        'reset_token_expiry_minutes' => (int) env('SALO_RESET_TOKEN_EXPIRY_MINUTES', 60),
        'otp_validity_minutes' => (int) env('SALO_OTP_VALIDITY_MINUTES', 10),
        'otp_max_attempts' => (int) env('SALO_OTP_MAX_ATTEMPTS', 5),
        'otp_resend_cooldown_seconds' => (int) env('SALO_OTP_RESEND_COOLDOWN_SECONDS', 60),
    ],
    'frontend_url' => env('SALO_FRONTEND_URL', 'http://localhost:5173'),
];
