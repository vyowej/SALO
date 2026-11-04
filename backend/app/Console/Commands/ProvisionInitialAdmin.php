<?php

namespace App\Console\Commands;

use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ProvisionInitialAdmin extends Command
{
    protected $signature = 'salo:admin-provision';

    protected $description = 'Interactively provision SALO’s first Admin account';

    private const LOCK_NAME = 'salo:initial-admin-provisioning';

    public function handle(): int
    {
        $name = trim((string) $this->ask('Admin name'));
        $email = trim((string) $this->ask('Admin email address'));
        $password = $this->secret('Password');
        $passwordConfirmation = $this->secret('Confirm password');

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $passwordConfirmation,
        ], [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:190'],
            'password' => ['required', 'string', 'confirmed', 'min:8', 'regex:/[A-Za-z]/', 'regex:/\d/'],
            'password_confirmation' => ['required', 'string'],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $connection = DB::connection();
        if (! in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->error('Initial Admin provisioning requires the configured MySQL or MariaDB database.');

            return self::FAILURE;
        }

        $lock = $connection->selectOne('SELECT GET_LOCK(?, 10) AS acquired', [self::LOCK_NAME]);
        if ((int) ($lock->acquired ?? 0) !== 1) {
            $this->error('Could not acquire the initial Admin provisioning lock. No account was created.');

            return self::FAILURE;
        }

        try {
            if (PlatformAdmin::query()->exists()) {
                $this->error('An Admin record already exists. Initial provisioning was refused.');

                return self::FAILURE;
            }

            $normalizedEmail = mb_strtolower($email);
            if (User::withTrashed()->where('email', $normalizedEmail)->exists()) {
                $this->error('That email address already belongs to a user. No account was created.');

                return self::FAILURE;
            }

            DB::transaction(function () use ($name, $normalizedEmail, $password): void {
                if (PlatformAdmin::query()->exists()) {
                    throw ValidationException::withMessages([
                        'admin' => ['An Admin record already exists. Initial provisioning was refused.'],
                    ]);
                }

                $parts = preg_split('/\s+/', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
                $user = User::query()->create([
                    'email' => $normalizedEmail,
                    'password_hash' => Hash::make($password),
                    'first_name' => array_shift($parts) ?? '',
                    'last_name' => implode(' ', $parts),
                    'status' => 'active',
                ]);
                $user->platformAdmin()->create([
                    'admin_level' => 'super',
                    'status' => 'active',
                ]);
            });
        } catch (ValidationException $exception) {
            foreach ($exception->errors()['admin'] ?? [] as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        } finally {
            $connection->selectOne('SELECT RELEASE_LOCK(?) AS released', [self::LOCK_NAME]);
        }

        $this->info('Initial Admin account provisioned. The password was not displayed.');

        return self::SUCCESS;
    }
}
