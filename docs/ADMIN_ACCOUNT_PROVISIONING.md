# SALO Admin Account Provisioning

## Initial Admin

Provision the first Admin from a trusted terminal after configuring the Laravel
application for the intended SALO database:

```powershell
Set-Location backend
php artisan salo:admin-provision
```

The command interactively asks for the Admin's name and email, then prompts for
the password twice without echoing it. Use a unique email and a password of at
least eight characters containing a letter and a number. The command creates a
normal `users` record and its related active `platform_admins` record in one
transaction. Laravel's password hasher stores the password as a hash; the
password is not printed or logged.

The command uses a MySQL/MariaDB advisory lock to serialize concurrent
provisioning. It refuses to create an account if **any** `platform_admins`
record already exists, including a suspended record. Re-running it therefore
cannot create duplicate first Admins. If a record exists but no Admin can sign
in, do not try to bypass the one-time check; use the organization's approved
account-recovery procedure.

Before running the command, operators must verify that the application is
connected to the intended installation and database. Do not run it against a
developer, test, or production database by mistake. Never put passwords in
command-line arguments, shell history, source files, or logs.

## Creating and managing additional Admins

An authorized Admin can open **Admin accounts** from the Admin dashboard
navigation at `/admin/admin-accounts`. The page supports listing/searching
accounts, creating an Admin with a name, unique email, optional phone number,
and password, editing name/email/phone, and deactivating or reactivating Admin
access. Sensitive access changes require confirmation.

Creating an Admin creates a normal SALO User and assigns the existing Admin
capability through its related `PlatformAdmin` record. The password is hashed
by Laravel and is never returned by the API. Use the established secure
credential-delivery process for newly created accounts. Admins sign in through
the regular SALO login and may use the existing password-reset flow.

Deactivation suspends the `platform_admins` record without deleting or
deactivating the underlying User account. This removes Admin access while
preserving the User account and any other applicable capabilities. Reactivation
restores Admin capability if the User account itself remains active.

The existing self-service User-account deactivation endpoint also applies the
last-active-Admin protection. If another active Admin remains, deactivating
one's own User account suspends that account's Admin record as well. Admin
access cannot be reactivated while the underlying User account is deactivated;
use the approved account-recovery procedure for that situation.

At least one active Admin must remain. The API checks this inside a database
transaction while locking the active Admin records, including when an Admin
attempts to deactivate their own User account. Generic User-management
endpoints cannot create, edit, suspend, or delete Admin accounts; use the
dedicated Admin-account functionality.

## Authentication and authorization

Admin is a platform capability on the existing `User` model, represented by
`platform_admins`; it is not a separate login system or a restaurant
membership role. The existing login authenticates Admins. Backend Admin routes
require authentication, an active Admin capability, and the existing Admin
active mode. Frontend navigation visibility is not an authorization check.

Public registration only creates the customer capability and rejects
role/capability assignment fields. Sellers, customers, and riders cannot grant
themselves Admin access. Admin-account changes are recorded in the existing
audit log without passwords or password hashes.

## Database and operator safeguards

The authoritative schema in `database/salo_db.sql` already supports this
feature with the unique user email and `platform_admins` relationship/status.
No migration, seeder, DDL, or schema-file change is required. The initial
provisioning command is intended for a trusted operator; it is not exposed as a
public endpoint.
