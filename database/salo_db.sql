-- =====================================================================
-- SALO schema v3.1 (clean merge: base v3 + [ADDRESS] patch applied in place)
-- MySQL 8.0.16+ (CHECK constraints), InnoDB, utf8mb4.
-- Source of truth: SALO_PLAN_v2.md (section 19 entities), then
-- DATABASE_DESIGN.md. STANDALONE blueprint: run once on an empty database.
-- Do not run it on top of the Laravel migrations.
--
-- Conventions
--   * Integer auto-increment PKs named `id`. Public reference codes
--     (orders, reservations, checkout groups) are non-sequential.
--   * Instants are stored in UTC; schedules are evaluated in Asia/Manila.
--     Set Laravel's DB connection timezone to '+00:00' so TIMESTAMP and
--     DATETIME columns agree (TIMESTAMP converts by session timezone).
--   * Files: photo columns (logo_path, cover_path, image_path, photo
--     path/thumb_path/medium_path) hold EITHER a generated storage path
--     ('restaurants/12/logo.webp') OR an absolute https URL (seeded demo
--     photos). The app resolves it: starts with 'http' -> use as-is,
--     otherwise -> prefix the public disk URL. Photo columns are
--     VARCHAR(500) so long URLs fit. Documents and delivery proofs are
--     private-disk PATHS only, never URLs, never client filenames.
--   * Foreign keys are RESTRICT (default). Nothing here hard-deletes history;
--     rows are archived/soft-deleted (plan section 24). CASCADE is used only
--     on pure junction rows.
--   * MySQL has no partial unique indexes, so "only one open row" rules use
--     a STORED generated column that is NULL unless the row is open, with a
--     UNIQUE key on it (NULLs do not collide).
--   * Never store card numbers, bank account numbers, or e-wallet
--     credentials (plan P3). Payout is a method name / account name only.
--   * Laravel also creates its own framework tables (sessions,
--     personal_access_tokens, jobs, cache, migrations). Not here.
--   * Roles are DERIVED (platform_admins, restaurants.owner_user_id,
--     restaurant_staff, rider_profiles); there is no users.role column.
--     The rule "a business owner cannot hold the rider role at the same
--     time" is enforced in the service layer.
--   * COD cash truth: deliveries.cash_collected / cash_remitted. The
--     payments row only tracks payment state (unpaid/paid/...).
--
-- Phase tags: 0 foundation, 1 admin, 2 business, 3 customer, 4 driver,
-- 5 online payment (enum values reserved now so no redesign is needed).
-- [PROPOSED] = my addition where the plan is silent; confirm or change.
-- [ADDRESS]  = address model: PH only, barangay-level PSGC code, required
--              street, formatted_address, optional house_no.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

DROP DATABASE IF EXISTS salo;
CREATE DATABASE salo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE salo;

-- =====================================================================
-- PHASE 0: FOUNDATION
-- =====================================================================

CREATE TABLE users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email             VARCHAR(190) NOT NULL,                 -- unique, case-insensitive collation
  password_hash     VARCHAR(255) NOT NULL,
  first_name        VARCHAR(80)  NOT NULL,
  middle_name       VARCHAR(80)  NULL,
  last_name         VARCHAR(80)  NOT NULL,
  suffix            VARCHAR(20)  NULL,
  mobile            VARCHAR(20)  NULL,
  birthday          DATE         NULL,
  status            ENUM('invited','active','suspended','deactivated') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME     NULL,
  last_login_at     DATETIME     NULL,
  deleted_at        TIMESTAMP    NULL,                     -- soft delete / anonymization marker
  created_at        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE platform_admins (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  admin_level ENUM('super') NOT NULL DEFAULT 'super',      -- Verifier/Support split is Future
  status      ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_user (user_id),
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- Six-digit email OTPs (hashed, single use, 10 min, max 5 attempts, 60 s
-- resend cooldown are enforced in code and read from platform_settings).
-- target_email [PROPOSED]: the address the code was sent to (needed for
-- business-email verification and email change).
CREATE TABLE auth_tokens (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  purpose      ENUM('email_verification','business_email','rider_activation','email_change') NOT NULL,
  token_hash   CHAR(64) NOT NULL,                          -- never the raw code
  target_email VARCHAR(190) NULL,
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at   DATETIME NOT NULL,
  used_at      DATETIME NULL,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tokens_lookup (user_id, purpose, expires_at),
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- [ADDRESS] Official PSGC hierarchy, self-referencing on parent_code.
-- full_name lets "zamboan" search as you type (e.g. 'Zamboanga City,
-- Zamboanga del Sur'); fill it during the import. FULLTEXT prefix search
-- needs boolean mode: MATCH(name, full_name) AGAINST ('zamboan*' IN
-- BOOLEAN MODE). Plain LIKE 'zamboan%' uses idx_psgc_name.
-- IMPORT ORDER: parents before children (region, province/district, city,
-- sub-municipality, barangay), or SET FOREIGN_KEY_CHECKS = 0 during the
-- import and = 1 afterwards. 'district' (NCR) and 'submunicipality'
-- (Manila) levels exist so those rows import with their real parents.
-- ---------------------------------------------------------------------
CREATE TABLE psgc_locations (
  code        VARCHAR(12)  NOT NULL,
  parent_code VARCHAR(12)  NULL,
  name        VARCHAR(150) NOT NULL,
  level       ENUM('region','province','district','city','submunicipality','barangay') NOT NULL,
  full_name   VARCHAR(300) NOT NULL,
  PRIMARY KEY (code),
  KEY idx_psgc_parent (parent_code),
  KEY idx_psgc_name (name),
  FULLTEXT KEY ft_psgc (name, full_name),
  CONSTRAINT fk_psgc_parent FOREIGN KEY (parent_code) REFERENCES psgc_locations (code)
) ENGINE=InnoDB;

CREATE TABLE platform_settings (
  setting_key VARCHAR(60)  NOT NULL,
  value       VARCHAR(255) NOT NULL,
  updated_by  BIGINT UNSIGNED NULL,
  updated_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- =====================================================================
-- PHASE 2 (part 1): RESTAURANT CORE  (needed early by audit_logs)
-- =====================================================================

CREATE TABLE cuisine_types (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60) NOT NULL,
  is_filipino TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cuisine_name (name)
) ENGINE=InnoDB;

-- Created ONLY when an initial application is approved, so status never
-- holds Pending/Rejected (that lives on restaurant_applications).
-- Suspended = admin only. Closed = owner's temporary state. Inactive =
-- deactivation. Published is a separate flag. One user may own several
-- restaurants (branches are separate rows, plan R7); no unique on owner.
-- [ADDRESS] country_code, required barangay code + street, house_no,
-- formatted_address (safe as required because rows exist only after approval).
-- Photos: logo_path / cover_path hold a storage path OR an https URL.
CREATE TABLE restaurants (
  id                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id              BIGINT UNSIGNED NOT NULL,
  name                       VARCHAR(120) NOT NULL,
  branch_label               VARCHAR(80)  NULL,
  description                TEXT NULL,
  legal_name                 VARCHAR(160) NULL,            -- sensitive: changes need admin approval
  contact_number             VARCHAR(20)  NULL,
  business_email             VARCHAR(190) NULL,
  business_email_verified_at DATETIME NULL,
  country_code               CHAR(2)      NOT NULL DEFAULT 'PH',
  psgc_code                  VARCHAR(12)  NOT NULL,        -- barangay level
  street                     VARCHAR(190) NOT NULL,
  house_no                   VARCHAR(40)  NULL,
  formatted_address          VARCHAR(300) NOT NULL,
  latitude                   DECIMAL(9,6) NULL,
  longitude                  DECIMAL(9,6) NULL,
  logo_path                  VARCHAR(500) NULL,            -- path or https URL
  cover_path                 VARCHAR(500) NULL,            -- path or https URL
  delivery_radius_km         DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  prep_minutes               SMALLINT UNSIGNED NOT NULL DEFAULT 20,
  is_24_7                    TINYINT(1) NOT NULL DEFAULT 0,
  status                     ENUM('approved','suspended','inactive','closed') NOT NULL DEFAULT 'approved',
  is_published               TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at                 TIMESTAMP NULL,
  created_at                 TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rest_owner (owner_user_id),
  KEY idx_rest_status (status, is_published),
  KEY idx_rest_psgc (psgc_code),
  CONSTRAINT chk_rest_radius CHECK (delivery_radius_km > 0),
  CONSTRAINT chk_rest_country CHECK (country_code = 'PH'),
  CONSTRAINT fk_rest_owner FOREIGN KEY (owner_user_id) REFERENCES users (id),
  CONSTRAINT fk_rest_psgc  FOREIGN KEY (psgc_code) REFERENCES psgc_locations (code)
) ENGINE=InnoDB;

-- Audit history. Owner reads own restaurant's rows; Admin reads all.
-- Purged after 90 days by a scheduled job; order/reservation histories are
-- separate tables and are NOT purged.
CREATE TABLE audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,                      -- NULL = system
  restaurant_id BIGINT UNSIGNED NULL,
  action        VARCHAR(60) NOT NULL,
  entity_type   VARCHAR(60) NOT NULL,
  entity_id     BIGINT UNSIGNED NULL,
  before_value  JSON NULL,
  after_value   JSON NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_restaurant (restaurant_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_user_id, created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id),
  CONSTRAINT fk_audit_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  type              VARCHAR(60) NOT NULL,
  message           VARCHAR(255) NOT NULL,
  related_reference VARCHAR(60) NULL,
  read_at           DATETIME NULL,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, read_at, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- =====================================================================
-- PHASE 2 (part 2): APPLICATIONS, PAGE, STAFF, HOURS
-- =====================================================================

-- One table for the initial application and for sensitive-field updates.
-- Initial: restaurant_id is NULL until approval (then linked); draft fields
-- live in draft_details. sensitive_update: restaurant_id is required and the
-- proposed values stay in proposed_changes; live restaurant values do NOT
-- change until an Admin approves.
-- NOTE: uq_one_open_initial allows ONE open initial application per user
-- at a time (a second branch can be applied for once the first is decided).
CREATE TABLE restaurant_applications (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id     BIGINT UNSIGNED NULL,
  submitted_by      BIGINT UNSIGNED NOT NULL,
  reviewed_by       BIGINT UNSIGNED NULL,
  application_type  ENUM('initial','sensitive_update') NOT NULL DEFAULT 'initial',
  status            ENUM('draft','submitted','under_review','needs_revision','approved','rejected')
                    NOT NULL DEFAULT 'draft',
  draft_details     JSON NULL,
  proposed_changes  JSON NULL,
  declared_bir_2303 TINYINT(1) NOT NULL DEFAULT 0,         -- self-declared checkbox only
  submitted_at      DATETIME NULL,
  reviewed_at       DATETIME NULL,
  review_notes      TEXT NULL,
  open_update_key   BIGINT UNSIGNED GENERATED ALWAYS AS (
      IF(application_type = 'sensitive_update'
         AND status IN ('draft','submitted','under_review','needs_revision'),
         restaurant_id, NULL)) STORED,
  open_initial_key  BIGINT UNSIGNED GENERATED ALWAYS AS (
      IF(application_type = 'initial'
         AND status IN ('draft','submitted','under_review','needs_revision'),
         submitted_by, NULL)) STORED,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_one_open_update (open_update_key),
  UNIQUE KEY uq_one_open_initial (open_initial_key),
  KEY idx_app_queue (status, submitted_at),
  CONSTRAINT chk_app_update_needs_restaurant
    CHECK (application_type = 'initial' OR restaurant_id IS NOT NULL),
  CONSTRAINT fk_app_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT fk_app_submitter  FOREIGN KEY (submitted_by) REFERENCES users (id),
  CONSTRAINT fk_app_reviewer   FOREIGN KEY (reviewed_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- Private disk. Permits carry an expiry date (flagged to admin).
-- Documents of rejected applications are deleted after 30 days (job).
CREATE TABLE application_documents (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  doc_type       ENUM('business_permit','dti_sec_registration','owner_valid_id','halal_certificate') NOT NULL,
  private_path   VARCHAR(255) NOT NULL,
  expiry_date    DATE NULL,
  verified       TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_docs_app (application_id),
  KEY idx_docs_expiry (expiry_date),
  CONSTRAINT fk_docs_app FOREIGN KEY (application_id) REFERENCES restaurant_applications (id)
) ENGINE=InnoDB;

-- Gallery only (max 10, enforced in the service). Logo and cover are on
-- restaurants. thumb_path / medium_path [PROPOSED] hold generated variants.
-- path / thumb_path / medium_path: storage path OR https URL.
CREATE TABLE restaurant_photos (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  path          VARCHAR(500) NOT NULL,
  thumb_path    VARCHAR(500) NULL,
  medium_path   VARCHAR(500) NULL,
  alt_text      VARCHAR(160) NULL,
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_primary    TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_rest (restaurant_id, sort_order),
  CONSTRAINT fk_photos_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

-- The Owner is NOT here: restaurants.owner_user_id is the only owner record.
-- Re-adding a removed member or transferring ownership REUSES the existing
-- row (unique pair), it never inserts a duplicate.
CREATE TABLE restaurant_staff (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  staff_role    ENUM('manager','reservation_manager','staff') NOT NULL DEFAULT 'staff',
  status        ENUM('invited','active','suspended','removed') NOT NULL DEFAULT 'invited',
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_member (restaurant_id, user_id),
  KEY idx_staff_user (user_id, status),
  CONSTRAINT fk_staff_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- Invitation owns token + expiry + invitation status; restaurant_staff owns
-- membership state. Acceptance flips both in one transaction. A new email
-- creates an 'invited' user, so user_id and staff_id are always known.
-- Link valid 72 hours, single use, token stored hashed.
CREATE TABLE invitations (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  staff_id      BIGINT UNSIGNED NOT NULL,                  -- [PROPOSED] link to the membership row
  user_id       BIGINT UNSIGNED NOT NULL,
  invited_by    BIGINT UNSIGNED NOT NULL,
  invited_email VARCHAR(190) NOT NULL,                     -- normalized
  staff_role    ENUM('manager','reservation_manager','staff') NOT NULL,
  token_hash    CHAR(64) NOT NULL,
  status        ENUM('pending','accepted','cancelled','expired') NOT NULL DEFAULT 'pending',
  expires_at    DATETIME NOT NULL,
  accepted_at   DATETIME NULL,
  pending_key   VARCHAR(255) GENERATED ALWAYS AS (
      IF(status = 'pending', CONCAT(restaurant_id, ':', invited_email), NULL)) STORED,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite_token (token_hash),
  UNIQUE KEY uq_one_pending_invite (pending_key),
  KEY idx_invite_expiry (status, expires_at),
  CONSTRAINT fk_invite_rest  FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT fk_invite_staff FOREIGN KEY (staff_id) REFERENCES restaurant_staff (id),
  CONSTRAINT fk_invite_user  FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_invite_by    FOREIGN KEY (invited_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE restaurant_cuisines (
  restaurant_id BIGINT UNSIGNED NOT NULL,
  cuisine_id    BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (restaurant_id, cuisine_id),
  CONSTRAINT fk_rc_rest    FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_rc_cuisine FOREIGN KEY (cuisine_id) REFERENCES cuisine_types (id)
) ENGINE=InnoDB;

-- weekday: 1 = Monday ... 7 = Sunday. Several shifts per day allowed.
-- Overlap between shifts of the same day is checked in the service.
CREATE TABLE operating_hours (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id    BIGINT UNSIGNED NOT NULL,
  weekday          TINYINT UNSIGNED NOT NULL,
  shift_order      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  open_time        TIME NOT NULL,
  close_time       TIME NOT NULL,
  crosses_midnight TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hours_shift (restaurant_id, weekday, shift_order),
  CONSTRAINT chk_hours_weekday CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_hours_order CHECK (crosses_midnight = 1 OR close_time > open_time),
  CONSTRAINT fk_hours_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

CREATE TABLE closure_dates (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  closure_date  DATE NOT NULL,
  reason        VARCHAR(120) NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_closure_day (restaurant_id, closure_date),
  CONSTRAINT fk_closure_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

CREATE TABLE reservation_settings (
  restaurant_id         BIGINT UNSIGNED NOT NULL,
  accepts_reservations  TINYINT(1) NOT NULL DEFAULT 0,
  confirm_mode          ENUM('manual','automatic') NOT NULL DEFAULT 'manual',
  review_window_hours   SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  slot_minutes          SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  dining_minutes        SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  min_lead_hours        SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  max_months_ahead      TINYINT UNSIGNED NOT NULL DEFAULT 2,
  max_party_size        SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  grace_minutes         SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  cancel_cutoff_hours   SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  updated_at            TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_rs_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

-- =====================================================================
-- PHASE 2 (part 3): MENU
-- =====================================================================

CREATE TABLE menu_categories (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(80) NOT NULL,
  sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status        ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_name (restaurant_id, name),
  CONSTRAINT fk_cat_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

-- Restaurant is derived through the category (no duplicate FK).
-- Orderable = published AND is_available AND (quantity_left IS NULL OR > 0).
-- image_path: storage path OR https URL.
CREATE TABLE menu_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id      BIGINT UNSIGNED NOT NULL,
  name             VARCHAR(120) NOT NULL,
  description      TEXT NULL,
  price            DECIMAL(10,2) NOT NULL,
  image_path       VARCHAR(500) NULL,                      -- path or https URL
  lifecycle_status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  is_available     TINYINT(1) NOT NULL DEFAULT 1,
  daily_quantity   INT UNSIGNED NULL,                      -- NULL = unlimited
  quantity_left    INT UNSIGNED NULL,
  prep_minutes     SMALLINT UNSIGNED NULL,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_category (category_id, lifecycle_status),
  CONSTRAINT chk_item_price CHECK (price > 0),
  CONSTRAINT chk_item_qty CHECK (quantity_left IS NULL OR daily_quantity IS NOT NULL),
  CONSTRAINT fk_items_cat FOREIGN KEY (category_id) REFERENCES menu_categories (id)
) ENGINE=InnoDB;

CREATE TABLE dietary_tags (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name      VARCHAR(60) NOT NULL,
  tag_type  VARCHAR(30) NOT NULL DEFAULT 'dietary',
  PRIMARY KEY (id),
  UNIQUE KEY uq_tag_name (name)
) ENGINE=InnoDB;

CREATE TABLE menu_item_dietary_tags (
  item_id BIGINT UNSIGNED NOT NULL,
  tag_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (item_id, tag_id),
  CONSTRAINT fk_midt_item FOREIGN KEY (item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_midt_tag  FOREIGN KEY (tag_id) REFERENCES dietary_tags (id)
) ENGINE=InnoDB;

-- =====================================================================
-- PHASE 3: CUSTOMER (ordering, tables, reservations, feedback)
-- =====================================================================

-- [ADDRESS] country_code, required barangay code + street, formatted_address.
-- Mapping: Home/Work/Church = address_type; School = other + label 'School';
-- Other = other + label 'Other' + custom_label.
-- default_owner_id lets the database refuse a second default per user; the
-- app must still keep exactly one default.
CREATE TABLE user_addresses (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  country_code      CHAR(2)      NOT NULL DEFAULT 'PH',
  psgc_code         VARCHAR(12)  NOT NULL,                 -- barangay level
  label             VARCHAR(40)  NOT NULL DEFAULT 'Home',
  address_type      ENUM('home','work','church','other') NOT NULL DEFAULT 'home',
  custom_label      VARCHAR(60)  NULL,
  street            VARCHAR(190) NOT NULL,
  house_no          VARCHAR(40)  NULL,
  formatted_address VARCHAR(300) NOT NULL,
  latitude          DECIMAL(9,6) NULL,
  longitude         DECIMAL(9,6) NULL,
  delivery_note     VARCHAR(255) NULL,
  is_default        TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at        TIMESTAMP NULL,
  default_owner_id  BIGINT UNSIGNED GENERATED ALWAYS AS
                      (IF(is_default = 1 AND deleted_at IS NULL, user_id, NULL)) STORED,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_addr_one_default (default_owner_id),
  KEY idx_addr_user (user_id, is_default),
  CONSTRAINT chk_addr_country CHECK (country_code = 'PH'),
  CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_addr_psgc FOREIGN KEY (psgc_code) REFERENCES psgc_locations (code)
) ENGINE=InnoDB;

CREATE TABLE carts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  expires_at    DATETIME NULL,                             -- 7 days of inactivity
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_pair (user_id, restaurant_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_cart_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id  BIGINT UNSIGNED NOT NULL,
  item_id  BIGINT UNSIGNED NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  note     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_item (cart_id, item_id),
  CONSTRAINT chk_cartitem_qty CHECK (quantity > 0),
  CONSTRAINT fk_ci_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_item FOREIGN KEY (item_id) REFERENCES menu_items (id)
) ENGINE=InnoDB;

-- One checkout can include several restaurants. The customer is stored
-- here, NOT on orders (no orders.user_id). Grand total is derived.
CREATE TABLE checkout_groups (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED NOT NULL,
  reference_code  CHAR(12) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  placed_at       DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_ref (reference_code),
  UNIQUE KEY uq_group_idem (user_id, idempotency_key),
  CONSTRAINT fk_group_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- Money columns and address text are deliberate snapshots (history must not
-- change when settings or addresses change). [ADDRESS] delivery_country_code;
-- delivery_address_text + coordinates are the immutable snapshot; they are
-- NULL for pick-up orders.
CREATE TABLE orders (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  checkout_id           BIGINT UNSIGNED NOT NULL,
  restaurant_id         BIGINT UNSIGNED NOT NULL,
  delivery_address_id   BIGINT UNSIGNED NULL,
  reference_code        CHAR(12) NOT NULL,
  order_type            ENUM('delivery','pickup') NOT NULL,
  scheduled_for         DATETIME NULL,
  status                ENUM('placed','confirmed','preparing','ready','out_for_delivery',
                             'delivered','completed','rejected','cancelled','delivery_failed')
                        NOT NULL DEFAULT 'placed',
  recipient_name        VARCHAR(120) NOT NULL,
  recipient_phone       VARCHAR(20)  NOT NULL,
  delivery_address_text VARCHAR(300) NULL,
  delivery_country_code CHAR(2)      NULL,
  delivery_lat          DECIMAL(9,6) NULL,
  delivery_lng          DECIMAL(9,6) NULL,
  subtotal              DECIMAL(10,2) NOT NULL,
  delivery_fee          DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_fee           DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount          DECIMAL(10,2) NOT NULL,
  cancelled_by_type     ENUM('customer','restaurant','admin','system') NULL,
  cancelled_by_user_id  BIGINT UNSIGNED NULL,
  cancel_reason         VARCHAR(255) NULL,
  placed_at             DATETIME NOT NULL,
  completed_at          DATETIME NULL,
  customer_confirmed_at DATETIME NULL,
  confirmation_method   ENUM('customer','auto') NULL,
  created_at            TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_ref (reference_code),
  KEY idx_order_rest (restaurant_id, status, placed_at),
  KEY idx_order_group (checkout_id),
  CONSTRAINT chk_order_money CHECK (subtotal >= 0 AND delivery_fee >= 0 AND service_fee >= 0
                                    AND discount_amount >= 0 AND total_amount >= 0),
  CONSTRAINT chk_order_country CHECK (delivery_country_code IS NULL OR delivery_country_code = 'PH'),
  CONSTRAINT fk_order_group FOREIGN KEY (checkout_id) REFERENCES checkout_groups (id),
  CONSTRAINT fk_order_rest  FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT fk_order_addr  FOREIGN KEY (delivery_address_id) REFERENCES user_addresses (id),
  CONSTRAINT fk_order_cancel_user FOREIGN KEY (cancelled_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id            BIGINT UNSIGNED NOT NULL,
  item_id             BIGINT UNSIGNED NOT NULL,
  item_name_snapshot  VARCHAR(120) NOT NULL,
  unit_price_snapshot DECIMAL(10,2) NOT NULL,
  quantity            SMALLINT UNSIGNED NOT NULL,
  note                VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_oi_order (order_id),
  CONSTRAINT chk_oi_qty CHECK (quantity > 0),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_oi_item  FOREIGN KEY (item_id) REFERENCES menu_items (id)
) ENGINE=InnoDB;

-- changed_by NULL = system (e.g. auto-cancel after 10 minutes).
CREATE TABLE order_status_histories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    BIGINT UNSIGNED NOT NULL,
  changed_by  BIGINT UNSIGNED NULL,
  from_status VARCHAR(20) NULL,
  to_status   VARCHAR(20) NOT NULL,
  reason      VARCHAR(255) NULL,
  changed_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_osh_order (order_id, changed_at),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_osh_user  FOREIGN KEY (changed_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- First build: cod and pay_at_pickup. The others are reserved for Phase 5.
-- Only a provider reference is stored, never card/bank/e-wallet numbers.
CREATE TABLE payments (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id           BIGINT UNSIGNED NOT NULL,
  method             ENUM('cod','pay_at_pickup','online_bank','gcash') NOT NULL,
  status             ENUM('unpaid','pending','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
  amount             DECIMAL(10,2) NOT NULL,
  provider           VARCHAR(40) NULL,
  provider_reference VARCHAR(100) NULL,
  paid_at            DATETIME NULL,
  created_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pay_order (order_id),
  CONSTRAINT chk_pay_amount CHECK (amount >= 0),
  CONSTRAINT fk_pay_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB;

-- Discounts. restaurant_id NULL = platform-wide (admin only). Code is stored
-- normalized (uppercase). scope_key makes the code unique per restaurant
-- AND unique among platform-wide codes (NULL would not collide otherwise).
CREATE TABLE discounts (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id      BIGINT UNSIGNED NULL,
  created_by         BIGINT UNSIGNED NOT NULL,
  funded_by          ENUM('platform','restaurant') NOT NULL DEFAULT 'restaurant',
  code               VARCHAR(40) NOT NULL,
  name               VARCHAR(120) NOT NULL,
  description        VARCHAR(255) NULL,
  type               ENUM('percentage','fixed','free_delivery','first_order') NOT NULL,
  value              DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount       DECIMAL(10,2) NULL,
  starts_at          DATETIME NOT NULL,
  ends_at            DATETIME NOT NULL,
  usage_limit        INT UNSIGNED NULL,
  per_customer_limit INT UNSIGNED NULL,
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  scope_key          BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(restaurant_id, 0)) STORED,
  created_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_code (scope_key, code),
  KEY idx_disc_rest (restaurant_id, is_active, ends_at),
  CONSTRAINT chk_disc_dates CHECK (ends_at > starts_at),
  CONSTRAINT chk_disc_value CHECK (value >= 0 AND (type <> 'percentage' OR value <= 100)),
  CONSTRAINT fk_disc_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT fk_disc_by   FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- Usage counts are derived from rows with status 'applied'.
CREATE TABLE discount_redemptions (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  discount_id    BIGINT UNSIGNED NOT NULL,
  order_id       BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  amount_applied DECIMAL(10,2) NOT NULL,
  status         ENUM('applied','released') NOT NULL DEFAULT 'applied',
  created_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_redemption_order (order_id),               -- one discount per order
  KEY idx_redeem_discount (discount_id, status),
  CONSTRAINT fk_redeem_discount FOREIGN KEY (discount_id) REFERENCES discounts (id),
  CONSTRAINT fk_redeem_order    FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_redeem_user     FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- Free / reserved / occupied are derived from reservations, never stored.
CREATE TABLE restaurant_tables (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  table_number  VARCHAR(20) NOT NULL,
  capacity      SMALLINT UNSIGNED NOT NULL,
  area          VARCHAR(60) NULL,
  status        ENUM('active','maintenance','inactive') NOT NULL DEFAULT 'active',
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_table_number (restaurant_id, table_number),
  CONSTRAINT chk_table_capacity CHECK (capacity > 0),
  CONSTRAINT fk_table_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

-- The restaurant is found through the table. End time is derived
-- (start_at + duration_minutes), not stored. Booking locks the table row,
-- then checks overlap inside one transaction. Overlap query:
--   start_at < :new_end AND start_at + INTERVAL duration_minutes MINUTE > :new_start
-- counting 'pending' (until expires_at) and 'confirmed' rows.
-- Tables moved to maintenance: notify the restaurant and derive the
-- "needs attention" list (future active reservations on a non-active table).
CREATE TABLE reservations (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  table_id          BIGINT UNSIGNED NOT NULL,
  responded_by      BIGINT UNSIGNED NULL,
  reference_code    CHAR(12) NOT NULL,
  start_at          DATETIME NOT NULL,
  duration_minutes  SMALLINT UNSIGNED NOT NULL,
  guest_count       SMALLINT UNSIGNED NOT NULL,
  reserved_for_name VARCHAR(120) NOT NULL,
  contact_phone     VARCHAR(20) NOT NULL,
  special_request   VARCHAR(255) NULL,
  status            ENUM('pending','confirmed','declined','expired','cancelled','completed','no_show')
                    NOT NULL DEFAULT 'pending',
  expires_at        DATETIME NULL,
  cancelled_by      BIGINT UNSIGNED NULL,
  cancel_reason     VARCHAR(255) NULL,
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resv_ref (reference_code),
  KEY idx_resv_table (table_id, start_at, status),
  KEY idx_resv_user (user_id, start_at),
  CONSTRAINT chk_resv_guests CHECK (guest_count > 0),
  CONSTRAINT chk_resv_duration CHECK (duration_minutes > 0),
  CONSTRAINT fk_resv_user  FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_resv_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id),
  CONSTRAINT fk_resv_resp  FOREIGN KEY (responded_by) REFERENCES users (id),
  CONSTRAINT fk_resv_canc  FOREIGN KEY (cancelled_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE restaurant_reviews (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id    BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  comment     VARCHAR(500) NULL,
  reply       VARCHAR(500) NULL,
  replied_at  DATETIME NULL,
  is_hidden   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_order (order_id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_review_user  FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE favorite_restaurants (
  user_id       BIGINT UNSIGNED NOT NULL,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  created_at    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, restaurant_id),
  CONSTRAINT fk_favr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_favr_rest FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
) ENGINE=InnoDB;

CREATE TABLE favorite_menu_items (
  user_id    BIGINT UNSIGNED NOT NULL,
  item_id    BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, item_id),
  CONSTRAINT fk_favi_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_favi_item FOREIGN KEY (item_id) REFERENCES menu_items (id)
) ENGINE=InnoDB;

CREATE TABLE support_tickets (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  order_id          BIGINT UNSIGNED NULL,
  assigned_admin_id BIGINT UNSIGNED NULL,
  subject           VARCHAR(160) NOT NULL,
  body              TEXT NOT NULL,
  status            ENUM('open','in_review','resolved','closed') NOT NULL DEFAULT 'open',
  created_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ticket_status (status, created_at),
  CONSTRAINT fk_ticket_user  FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ticket_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_ticket_admin FOREIGN KEY (assigned_admin_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE ticket_messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tm_ticket (ticket_id, created_at),
  CONSTRAINT fk_tm_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets (id),
  CONSTRAINT fk_tm_user   FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- =====================================================================
-- PHASE 1/4: ZONES, SHIFTS, RIDERS, DELIVERY
-- =====================================================================

CREATE TABLE zones (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  psgc_code  VARCHAR(12) NULL,
  name       VARCHAR(100) NOT NULL,
  center_lat DECIMAL(9,6) NOT NULL,
  center_lng DECIMAL(9,6) NOT NULL,
  radius_km  DECIMAL(5,2) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_zone_name (name),
  CONSTRAINT chk_zone_radius CHECK (radius_km > 0),
  CONSTRAINT fk_zone_psgc FOREIGN KEY (psgc_code) REFERENCES psgc_locations (code)
) ENGINE=InnoDB;

CREATE TABLE shifts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(40) NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shift_name (name),
  CONSTRAINT chk_shift_time CHECK (end_time > start_time)   -- Evening ends 23:59 for this reason
) ENGINE=InnoDB;

-- Capacity per zone per shift (e.g. Pasonanca morning = 50). Free slots are
-- derived by counting assignments.
CREATE TABLE zone_shift_capacities (
  zone_id    BIGINT UNSIGNED NOT NULL,
  shift_id   BIGINT UNSIGNED NOT NULL,
  max_riders SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (zone_id, shift_id),
  CONSTRAINT chk_zsc_max CHECK (max_riders > 0),
  CONSTRAINT fk_zsc_zone  FOREIGN KEY (zone_id) REFERENCES zones (id),
  CONSTRAINT fk_zsc_shift FOREIGN KEY (shift_id) REFERENCES shifts (id)
) ENGINE=InnoDB;

-- The plan has no separate rider-application entity, so the application
-- lifecycle lives here as application_status [PROPOSED]; status stays NULL
-- until approval. Rider activation uses auth_tokens (rider_activation).
-- ewallet_account_name is a NAME only; no account numbers (plan P3).
-- Clearance/TIN are self-declared checkboxes (no upload).
-- [ADDRESS] home address columns are NULLABLE because the row is created
-- when the rider STARTS the application ('draft'); the CHECK makes the
-- address required once the application is no longer a draft.
CREATE TABLE rider_profiles (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id                BIGINT UNSIGNED NOT NULL,
  approved_by            BIGINT UNSIGNED NULL,
  application_status     ENUM('draft','submitted','under_review','needs_revision','approved','rejected')
                         NOT NULL DEFAULT 'draft',
  status                 ENUM('pending_activation','active','suspended','resigned') NULL,
  availability           ENUM('offline','online','busy') NOT NULL DEFAULT 'offline',
  vehicle_type           ENUM('motorcycle','bicycle','e_scooter','walker') NULL,
  plate_number           VARCHAR(20) NULL,
  country_code           CHAR(2)      NOT NULL DEFAULT 'PH',
  psgc_code              VARCHAR(12)  NULL,                -- barangay level
  street                 VARCHAR(190) NULL,
  house_no               VARCHAR(40)  NULL,
  formatted_address      VARCHAR(300) NULL,
  home_lat               DECIMAL(9,6) NULL,
  home_lng               DECIMAL(9,6) NULL,
  ewallet_account_name   VARCHAR(120) NULL,
  declared_clearance_tin TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at           DATETIME NULL,
  approved_at            DATETIME NULL,
  resigned_at            DATETIME NULL,
  review_notes           TEXT NULL,
  created_at             TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rider_user (user_id),
  KEY idx_rider_dispatch (status, availability),
  CONSTRAINT chk_rider_country CHECK (country_code = 'PH'),
  CONSTRAINT chk_rider_address_when_submitted
    CHECK (application_status = 'draft'
           OR (psgc_code IS NOT NULL AND street IS NOT NULL AND formatted_address IS NOT NULL)),
  CONSTRAINT chk_rider_approved_has_status
    CHECK (application_status <> 'approved' OR status IS NOT NULL),
  CONSTRAINT fk_rider_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_rider_approver FOREIGN KEY (approved_by) REFERENCES users (id),
  CONSTRAINT fk_rider_psgc FOREIGN KEY (psgc_code) REFERENCES psgc_locations (code)
) ENGINE=InnoDB;

-- Private disk. Motorcycle riders add drivers_license and or_cr.
CREATE TABLE rider_documents (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rider_id     BIGINT UNSIGNED NOT NULL,
  doc_type     ENUM('profile_photo','id_photo','drivers_license','or_cr') NOT NULL,
  private_path VARCHAR(255) NOT NULL,
  verified     TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rider_doc (rider_id, doc_type),
  CONSTRAINT fk_rdoc_rider FOREIGN KEY (rider_id) REFERENCES rider_profiles (id)
) ENGINE=InnoDB;

-- Preferred shifts chosen in the wizard [PROPOSED junction].
CREATE TABLE rider_preferred_shifts (
  rider_id BIGINT UNSIGNED NOT NULL,
  shift_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (rider_id, shift_id),
  CONSTRAINT fk_rps_rider FOREIGN KEY (rider_id) REFERENCES rider_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rps_shift FOREIGN KEY (shift_id) REFERENCES shifts (id)
) ENGINE=InnoDB;

CREATE TABLE rider_shift_assignments (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rider_id            BIGINT UNSIGNED NOT NULL,
  zone_id             BIGINT UNSIGNED NULL,                -- NULL only while waitlisted
  shift_id            BIGINT UNSIGNED NOT NULL,
  status              ENUM('assigned','waitlisted') NOT NULL,
  assigned_by         ENUM('system','admin') NOT NULL DEFAULT 'system',
  assigned_by_user_id BIGINT UNSIGNED NULL,
  reason              VARCHAR(255) NULL,                   -- required for admin overrides
  created_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assign_rider_shift (rider_id, shift_id),
  KEY idx_assign_capacity (zone_id, shift_id, status),
  CONSTRAINT chk_rsa_zone CHECK (status = 'waitlisted' OR zone_id IS NOT NULL),
  CONSTRAINT fk_rsa_rider FOREIGN KEY (rider_id) REFERENCES rider_profiles (id),
  CONSTRAINT fk_rsa_zone  FOREIGN KEY (zone_id) REFERENCES zones (id),
  CONSTRAINT fk_rsa_shift FOREIGN KEY (shift_id) REFERENCES shifts (id),
  CONSTRAINT fk_rsa_user  FOREIGN KEY (assigned_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- Delivered requires a camera photo with timestamp and location (private
-- disk). The plan stores one proof on the Delivery; a separate pickup proof
-- is NOT in the plan. cash_collected / cash_remitted are the COD source of truth.
CREATE TABLE deliveries (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         BIGINT UNSIGNED NOT NULL,
  rider_id         BIGINT UNSIGNED NULL,
  status           ENUM('offered','accepted','picked_up','delivered','failed','cancelled')
                   NOT NULL DEFAULT 'offered',
  accepted_at      DATETIME NULL,
  picked_up_at     DATETIME NULL,
  delivered_at     DATETIME NULL,
  proof_photo_path VARCHAR(255) NULL,
  proof_lat        DECIMAL(9,6) NULL,
  proof_lng        DECIMAL(9,6) NULL,
  distance_km      DECIMAL(6,2) NULL,
  rider_earning    DECIMAL(10,2) NULL,
  cash_collected   DECIMAL(10,2) NULL,
  cash_remitted    TINYINT(1) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_order (order_id),
  KEY idx_delivery_rider (rider_id, status),
  CONSTRAINT fk_del_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_del_rider FOREIGN KEY (rider_id) REFERENCES rider_profiles (id)
) ENGINE=InnoDB;

CREATE TABLE delivery_offers (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_id  BIGINT UNSIGNED NOT NULL,
  rider_id     BIGINT UNSIGNED NOT NULL,
  offered_at   DATETIME NOT NULL,
  response     ENUM('accepted','declined','timeout') NULL,
  responded_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_offer_delivery (delivery_id, offered_at),
  CONSTRAINT fk_offer_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries (id),
  CONSTRAINT fk_offer_rider    FOREIGN KEY (rider_id) REFERENCES rider_profiles (id)
) ENGINE=InnoDB;

CREATE TABLE rider_reviews (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_id BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  comment     VARCHAR(500) NULL,
  created_at  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rreview_delivery (delivery_id),
  CONSTRAINT chk_rreview_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_rreview_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries (id),
  CONSTRAINT fk_rreview_user     FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

-- =====================================================================
-- STARTER SETTINGS (plan values; all admin-adjustable)
-- The second group is [PROPOSED]: values the plan mentions but did not fix.
-- =====================================================================

INSERT INTO platform_settings (setting_key, value) VALUES
  ('otp_valid_minutes',           '10'),
  ('otp_max_attempts',            '5'),
  ('otp_resend_cooldown_seconds', '60'),
  ('receipt_autoconfirm_hours',   '24'),
  ('rider_ack_seconds',           '60'),
  ('placed_autocancel_minutes',   '10'),
  ('commission_percent',          '15'),
  ('rider_share_percent',         '80'),
  ('delivery_base_fee',           '35'),
  ('delivery_free_km',            '2'),
  ('delivery_fee_per_km',         '10'),
  ('service_fee_percent',         '5'),
  ('max_delivery_radius_km',      '10'),
  ('default_prep_minutes',        '20'),
  ('handoff_buffer_minutes',      '3'),
  ('avg_speed_kmh',               '20'),
  ('detour_factor',               '1.3'),
  ('cart_expiry_days',            '7'),
  ('max_zone_distance_km',        '10'),
  ('delivery_proof_retention_days', '30'),
  ('audit_retention_days',        '90');

INSERT INTO shifts (name, start_time, end_time) VALUES
  ('Morning',   '06:00:00', '12:00:00'),
  ('Afternoon', '12:00:00', '18:00:00'),
  ('Evening',   '18:00:00', '23:59:00');