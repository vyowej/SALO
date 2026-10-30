CONTEXT
SALO is a multi-vendor food ordering + table reservation platform: React frontend in /src, Laravel 11+ backend in /backend, MySQL 8. Plan v2 is APPROVED. Read docs/SALO_PLAN_v2.md first (Sections 4, 5, 6, 10, 11, 14, 15, 17, 18, 19, 23, 25) and treat it as the source of truth. If this prompt and the plan disagree, STOP and ask me.

TASK: Build the BUSINESS SIDE (Phase 2): restaurant application, restaurant page editor with photos, the staff hierarchy (add, search, position), menu, orders, tables and reservations, discounts, calendar, reports, and the owner-only audit history. Frontend AND backend, all backend code in /backend, docs in /docs. Work in PHASES; after each phase show a summary, the files changed, and what you verified, then STOP for my review.

GROUND RULES
- Prerequisite check FIRST (Phase B0): inspect what already exists from Phase 0 and the admin work (auth, email OTP, modes and /me, permissions, audit log, PSGC data, local-disk storage, settings, admin application queue). List what is missing. Build only what is missing; do not duplicate. If a core piece (auth or modes) is missing, STOP and tell me.
- Laravel layered flow: Route > Middleware > FormRequest > thin Controller > Service/Action > Repository (Eloquent) > API Resource. Policies on every endpoint. No business logic in controllers. No raw queries. Migrations are the single source of truth for the schema; any new table or column must first be added to docs/DATABASE_DESIGN.md and shown to me before migrating.
- Restaurant context: all business routes live under /api/v1/restaurants/{restaurant}/... A middleware resolves the user's membership for that restaurant on EVERY request (not cached in the session), so removal, suspension, or a position change takes effect immediately. Permissions come from ONE file (app/Support/PermissionMap.php) used by Policies and exposed through /me as permissions[]. The frontend uses a useCan('permission') helper, not hard-coded role names.
- A suspended restaurant is read-only for every role.
- Files: no Cloudinary. Photos go to the Laravel PUBLIC disk, documents to the PRIVATE disk (signed, authorized URLs only). The database stores only paths. Compress in the browser (about 2 MB), re-validate on the server (real MIME, JPG/PNG/WebP, PDF for documents), strip EXIF, generate server-side filenames, make thumbnail and medium sizes, delete replaced files. localStorage is only for mock mode and unsaved drafts.
- Frontend: tokens only; our design system (one PRIMARY orange button per view; forest green never a primary fill; solid surfaces for data-heavy screens, glass only for light areas); shared components only; TanStack Table (server-side), Recharts, FullCalendar; confirmation dialogs for every destructive or status-changing action; empty, loading, error, and success states on every page; keep config.useMock working for each slice. English UI with at most one short Filipino phrase per screen from src/constants/voice.js, never on buttons, labels, or errors.
- Orders are created by customers in a LATER phase. Here, build order management against seeded sample orders and a dev-only "simulate new order" button (local environment only).
- Secrets only in backend .env. Mark anything uncertain [VERIFY] and ask.

PERMISSION MATRIX (implement in PermissionMap exactly)
Permission: Owner / Manager / Reservation Manager / Staff
- Edit page, photos, hours, description: Y / Y / N / N
- Edit sensitive info (legal name, address, permits): Y / N / N / N
- Publish, unpublish, close restaurant: Y / N / N / N
- Manage menu (items, prices, photos): Y / Y / N / N
- Mark items available or sold out: Y / Y / N / Y
- View orders and update order status: Y / Y / N / Y
- Cancel or reject orders (reason required): Y / Y / N / N
- View and manage reservations and tables: Y / Y / Y / N
- Manage discounts: Y / Y / N / N
- Reports: Owner and Manager = sales + reservations; Reservation Manager = reservations only; Staff = none
- See audit history: Owner only
- Add, change, or remove staff and positions: Owner only (Managers cannot)

PHASE B0 - AUDIT + DOCS (STOP after)
1. Report the prerequisite check above.
2. Write docs/BUSINESS_SIDE.md: every flow in this prompt, the full API contract for business endpoints (method, URL, request, response, required permission), the new or changed tables, scheduler jobs, and a frontend page list. Update docs/DATABASE_DESIGN.md for anything new.
3. Decide the simplest design for "sensitive-field edits need admin re-approval" (for example a RestaurantApplication row of kind "update" holding proposed values) and ask me before migrating.

PHASE B1 - BUSINESS SHELL, MODES, AND APPLICATION (STOP after)
a. Application from Customer mode: "Add your restaurant" wizard, one topic per step, progress bar, save and finish later: 1 About (name, cuisine and category chosen by the restaurant, short description, contact, business email verified by OTP) 2 Location and hours (PSGC search with type-ahead, "use my current location", draggable map pin, hours per weekday or Open 24/7; enforce the rule of at least 4 hours a day and 5 days a week unless 24/7) 3 Documents (business or mayor's permit, DTI or SEC registration, owner's valid ID; photo or PDF, 2 MB) 4 Photos (logo, cover) 5 Review and submit. Statuses: Draft, Submitted, Under Review, Needs Revision, Approved, Rejected, with the admin's notes shown and the ability to fix and resubmit. A Business-mode user cannot start an application from Business mode; they use Customer mode.
b. After approval: the Owner is set on the Restaurant, the mode switcher shows Business with a restaurant switcher (multi-restaurant), and the sidebar shows only items the user's permissions allow.
c. Business dashboard with a "Set up your restaurant" checklist for first-time owners (add photos, set hours, add a category, add the first item, add tables, publish) with progress and links; then today's overview (orders, reservations, sold-out items).
d. If the admin approval screen is missing, add a minimal approve, reject, or request-revision action so the flow can be tested.

PHASE B2 - RESTAURANT PAGE EDITOR + PHOTOS + HOURS (STOP after)
- Profile editor (Owner and Manager): name, description, cuisine and category, contact, address and pin, delivery radius, default prep time, Open 24/7 toggle, with live preview and an unsaved-changes warning. A "View as customer" button shows the public page exactly as customers see it.
- Photos: logo (square), cover (16:9), gallery up to 10 (add, delete, reorder, alt text, set primary). Validate type and size in the browser, compress, upload with progress, handle errors.
- Hours: per weekday with shifts and the overnight flag; Open 24/7; closure dates with a calendar. Show "open now" derived in Asia/Manila time.
- Sensitive fields (legal name, address, permits): editable by Owner only, submitted for admin re-approval; the old value stays live until approved.
- Publish checklist (Owner only): Approved, address with pin, hours or 24/7, at least one category, at least one published and orderable item. Publish, unpublish, and Closed controls with confirmation. Dietary label rules (Halal needs a certificate).

PHASE B3 - TEAM AND HIERARCHY (the core of this prompt; STOP after)
Page: Team (visible to Owner and Manager; ONLY the Owner sees management actions).
1. HIERARCHY VIEW: a clear diagram on the Team page:
   OWNER (highest; one per restaurant)
     MANAGER (runs daily operations)
       RESERVATION MANAGER (reservations and tables only)
       STAFF (orders and sold-out toggles)
   Each position shows its name, a one-line description, and the people currently holding it. A "What can this position do?" preview shows the permission matrix for that position.
2. MEMBERS TABLE: name, email (masked for Managers), position, status (Invited, Active, Suspended, Removed), joined date, last active. Search and filter by position and status. Pending invitations are listed with expiry, "Resend", and "Cancel".
3. ADD A MEMBER (Owner only; three steps with a confirmation dialog at the end):
   Step 1 Enter the person's exact email (nothing else is searchable; there is NO browsable user list).
   Step 2 The system checks the email:
   - If a SALO account exists: show a confirmation card (first name and last initial, masked email, avatar) with "Is this the person?". Sending creates an INVITATION the person must accept; they are never added silently. They get an email and an in-app notification.
   - If no account exists: show "No account yet. We'll create a pending account and email an activation link." The Owner may enter the person's name, but it is optional. The system creates a User with status Invited (cannot log in) and an invitation. Because the users table requires first and last names, missing values use a temporary "Pending Invitee" placeholder. The invitee supplies their own first and last names and sets their password through the single-use activation link; the Owner never creates or sees a password. The account and membership become Active atomically on activation. The token is stored hashed and valid 72 hours; resend and cancel are available.
   Step 3 Choose the position (Manager, Reservation Manager, or Staff) with the permission preview, then confirm.
   Security: rate-limit the email check (for example 10 per minute per owner), audit every check and invitation, and use the same neutral wording to avoid revealing more than needed. Document the privacy trade-off in docs/BUSINESS_SIDE.md.
4. SETTING AND CHANGING POSITIONS (Owner only): change position, suspend, reactivate, remove, each with a confirmation dialog. Rules: staff cannot raise their own role; Managers cannot invite, change, or remove anyone; no one can edit the Owner; one membership per user per restaurant (unique pair); a user can hold different positions at different restaurants; no one can be a member of a restaurant they would order from (the ordering block U12 is enforced in the customer phase, so add the check helper now).
5. OWNERSHIP TRANSFER: the Owner picks an Active Manager, confirms with their password, and ownership moves (the previous Owner becomes a Manager). The last Owner cannot leave without a transfer. Admin can reassign ownership.
6. IMMEDIATE EFFECT: because membership is checked on every request, a removed or suspended member gets a 403 on the next call; the frontend then shows "Your access to this restaurant changed" and returns them to Customer mode. A position change updates their menus on the next request.
7. STAFF EXPERIENCE: a staff member sees Business mode in the switcher labeled with the restaurant and their position, a sidebar limited to their permissions, and a banner showing their position.
8. AUDIT HISTORY (Owner only): a searchable, filterable page of who did what and when (invitations sent or accepted, position changes, removals, price changes, order approvals and updates, publish changes) with before and after values. Managers and others get 403. Retention: 90 days (scheduler job).
9. EMAILS: invitation and activation emails with Laravel Mail; use Mailtrap in development. In local environments only, show a "copy invite link" helper so testing works without email.

PHASE B4 - MENU (STOP after)
Categories (create, edit, reorder, archive) and items (draft, publish, archive; price, description, 4:3 photo, dietary tags, daily quantity with automatic sell-out at zero, availability toggle), search and filter by category, bulk publish, a warning when changing the price of an item that sits in carts. Staff can only toggle availability. Orderable = Published AND Available AND (no quantity limit OR quantity left above 0). Scheduler resets daily quantities at the restaurant's opening time.

PHASE B5 - ORDERS (STOP after)
Order board (Placed, Confirmed, Preparing, Ready, Out for Delivery, Delivered, Completed, Rejected, Cancelled) for Pick-up and Delivery orders. Status changes follow the allowed path only, by permission, with a status history. Reject or cancel needs a reason from a list. Orders in Placed with no response for 10 minutes are auto-cancelled by the scheduler. Pick-up orders end with "Mark collected". New orders appear by polling every 10 to 15 seconds with a toast (and an optional sound toggle). Order detail shows items with their snapshots and the activity log; ONLY the Owner sees who approved or updated an order. Return stock and release discounts on cancel or reject. Delivery assignment is automatic and built in the driver phase; here show "Waiting for rider" as a read-only state.

PHASE B6 - TABLES AND RESERVATIONS (STOP after)
Tables CRUD (number unique per restaurant, capacity, area, status Active, Maintenance, Inactive). Reservation settings (accepts reservations, manual or automatic confirmation default manual, review window, slot interval, dining duration, lead time, months ahead, max party size, grace period, cancellation cutoff). Calendar (FullCalendar day, week, and month) of reservations. Actions: confirm, decline, reschedule (after a free-slot check), cancel with reason, mark No Show after the grace period. An AvailabilityService finds free tables (capacity fits, Active, no overlap, within hours or 24/7, not on a closure date); booking locks the table row inside a transaction so only one request wins. Scheduler expires Pending holds after the review window. Marking a table as Maintenance flags affected future reservations. Customers will use the same service later.

PHASE B7 - DISCOUNTS, REPORTS, CALENDAR (STOP after)
- Discounts (restaurant scope, funded by restaurant): percentage, fixed, free delivery, first order; code, dates, minimum order, maximum discount, total and per-customer limits, active flag; usage count derived from redemptions; validation rules and the messages from the plan.
- Reports (date range, CSV export): sales summary, orders by status, popular items, discount usage, reservations, no-show rate; role-based (Reservation Manager sees reservations only).
- Calendar: closure dates, opening hours, and reservations in one view.

PHASE B8 - QA AND TESTS
Feature tests: staff of restaurant A cannot read or write restaurant B; a Manager cannot invite, change, or remove anyone; staff cannot raise their own role; only the Owner sees the audit history; removing a member blocks their very next request; a user can be Owner of one restaurant and Staff of another; an invitation expires after 72 hours and is single-use; sending an invitation to an existing account requires acceptance; the last Owner cannot leave; ownership transfer needs the password; a suspended restaurant is read-only; Business mode cannot start a customer order; a sold-out or archived item is not orderable; two simultaneous reservations for one table give exactly one winner; auto-cancel and hold expiry jobs run; uploads reject wrong type, oversize, and fake MIME; a restaurant cannot be published without the checklist. Then check every page at 375, 768, 1280, and 1920 px, with keyboard-only use. Final deliverable: a Double-Check Report with every route and its permission, every business rule mapped to its service and test, the scheduler jobs, and anything assumed.

START WITH PHASE B0 AND STOP.