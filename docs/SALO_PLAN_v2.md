# SALO — System Analysis and Database Design Plan (v2)

*Order. Reserve. Gather.* · Prepared for Cass · Planning stage · Updated October 30, 2026 (replaces the October 28 version)

This is the working plan for **SALO: An Online Food Ordering and Restaurant Table Reservation Management System**. It follows the Information Management sequence: requirements, information requirements, business rules, roles, CRUD, entities, relationships, ERD, normalization, integrity, blueprint, flows, and only then backend and MySQL.

Tags: **\[DECIDED\]** you chose it · **\[PROPOSED\]** my recommendation, change it if your instructor says otherwise · **\[VERIFY\]** a real-world or legal fact to confirm from a cited source before relying on it.

## Schema authority and owner decisions (2026-10-30)

- [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql) is the authoritative physical schema and overrides this plan, the other design documents, and unapplied migration/model code wherever they differ. The owner will edit v3; do not modify it or infer that any table exists in a live database. No migrations have been applied and no database exists.
- Product ownership rule: one restaurant may have several Owners. An Owner cannot transfer ownership; an Owner may add another Owner. The Manager ownership-change request feature is removed.
- **[VERIFY — owner schema update required]:** current v3 has one required `restaurants.owner_user_id`, no Owner membership role in `restaurant_staff`, and no owner invitation relation. Therefore it cannot represent several Owners or add-owner invitations. Keep this product rule in the plan, but do not implement it until the owner updates v3 and approves the corresponding code work.
- For Customer and Business features, use v3 tables/columns and service-level invariants where they suffice. Do not invent extra columns/tables. Where v3 does not represent a documented behavior, mark that behavior **[VERIFY]** and hold it rather than silently proposing schema changes.

## What changed in v2

- Backend is **Laravel** (replaces plain PHP/PDO). **No Cloudinary**: files go on the local disk.
- Order types are **Delivery** and **Pick-up** only. Walk-in is not an order type.
- One checkout can include several restaurants (**CheckoutGroup**); `Order.user_id` is dropped for strict 3NF.
- Riders are assigned to **zones with capacity limits** automatically, and orders are **dispatched automatically**.
- Business hierarchy: **Owner(s), Manager, Reservation Manager, Staff**. Only an Owner manages staff and may add another Owner, subject to the schema gate above.
- Business-mode users cannot order or apply as riders; they switch to Customer mode.
- Join requirements are trimmed for a school project; delivery proof is a camera photo; the customer confirms receipt before rating.
- Location search uses PSGC data plus an autocomplete provider; maps use OpenStreetMap.
- Build order: Foundation, Admin, Business, Customer, Driver, Online payment.

## 1. Locked decisions

| # | Decision | Status |
| --- | --- | --- |
| 1 | Design everything now; build in phases | \[DECIDED\] |
| 2 | Table-based reservations (restaurant defines tables and capacities) | \[DECIDED\] |
| 3 | First build payment: Cash on Delivery and pay-at-pick-up. Online banks and GCash later, in test mode (for example PayMongo) | \[DECIDED\] / \[VERIFY\] |
| 4 | Backend: **Laravel** with **MySQL 8** (InnoDB, utf8mb4). Get your instructor's approval in writing | \[DECIDED\] / \[VERIFY\] |
| 5 | Images and documents: **Laravel local disk** (public folder for photos, private folder for documents and delivery proofs). The database stores only file paths. localStorage is used only for mock mode and unsaved drafts. The project is not deployed | \[DECIDED\] |
| 6 | Discounts can be funded by the platform or by the restaurant | \[DECIDED\] |
| 7 | ERD notation: Chen | \[DECIDED\] |
| 8 | One account per person with active modes: Customer, Business, Driver, Admin | \[DECIDED\] |
| 9 | A Business-mode user cannot order or apply as a rider; they switch to Customer mode | \[DECIDED\] |
| 10 | Order types: **Delivery** and **Pick-up** (order in the app, collect at the restaurant). **Walk-in** means ordering at the shop itself and is not an app order; SALO shows it only as an information badge and directions | \[DECIDED\] |
| 11 | Every restaurant offers Delivery and Pick-up; some restaurants are open 24/7 | \[DECIDED\] |
| 12 | One order belongs to one restaurant; orders placed together share a CheckoutGroup; drop `Order.user_id` | \[DECIDED\] |
| 13 | Riders are scheduled into zones automatically and orders are dispatched automatically | \[DECIDED\] |
| 14 | Email OTP is required. Google sign-in is optional and not in the first build | \[DECIDED\] / \[PROPOSED\] |
| 15 | Timeouts: customer receipt auto-confirms after 24 hours; rider must acknowledge an assignment within 60 seconds; both are admin settings | \[DECIDED\] |
| 16 | Build order: Foundation, Admin, Business, Customer, Driver, Online payment | \[DECIDED\] |
| 17 | Admin UI: TanStack Table (server-side), Recharts, FullCalendar | \[PROPOSED\] |

Still open: instructor approval of Laravel and the required deliverables; MySQL version at school; all \[VERIFY\] items in Section 29.

## 2. Scope and phases

A phase is an order of building, not a separate project. The ERD, rules, and tables cover all phases now, so later phases add code but do not force a redesign. A feature does not start until the previous one works and is tested.

| Phase | Contents | Done when |
| --- | --- | --- |
| 0 Foundation | Database and migrations, authentication, email OTP, modes and permissions, local-disk storage, PSGC location data, audit log, platform settings | A user can register, verify email, log in, and switch modes |
| 1 Admin | Dashboard graphs, users and restaurants (CRUD, view all), application queues with document viewer, rider delivery photos, reports, history, calendar, settings, automatic rider zone scheduling | Admin can govern the platform |
| 2 Business | Restaurant page editor and photos, staff hierarchy, menu, orders, tables and reservations, discounts, calendar, reports, audit history | A restaurant can run itself |
| 3 Customer | Location, browse and search, favorites, multi-restaurant cart and checkout, per-order addresses, order tracking with map, receipt confirmation and rating, reservations, account settings | A customer can order and reserve end to end |
| 4 Driver | Application and OTP activation, zones and shifts, automatic dispatch, navigation map, camera proof, earnings, resign | An order is delivered by an automatically assigned rider |
| 5 Online payment | Online banks and GCash in test mode | Payment works in test mode |
| Future | Loyalty points, multi-branch brands, inventory, kitchen display, real-time WebSockets, advanced analytics, Google sign-in, priority delivery surcharge | Not part of this build |

## 3. Information Management concepts applied to SALO

| Concept | In SALO |
| --- | --- |
| Data vs information | Data: one row saying item 12, quantity 2, price ₱120. Information: "today's sales are ₱4,300 and the top seller is sinigang." Reports turn stored data into information for decisions |
| DBMS / MySQL | Stores the data and enforces keys, constraints, and transactions even when the application has a bug |
| Entity and attribute | Entity: User, Restaurant, Order. Attributes may be simple, composite (name, address), derived (age, line total), or multivalued (a restaurant's cuisines, which becomes a junction table) |
| Primary and foreign key | Auto-increment integer keys, plus a public non-sequential reference code for orders and reservations. A foreign key such as `order.restaurant_id` points to another table's primary key |
| Cardinality | One restaurant has many tables; one checkout group has many orders |
| CRUD | Create, Read, Update, Delete per entity per role (Section 11). Most deletes are status changes |
| Business rules | Policies the data must obey (Section 10); they become constraints, validation, and transactions |
| Integrity | Entity (unique, not null keys), referential (foreign keys), domain (price > 0), business (no double-booked table) |
| Validation | Frontend for friendliness, backend for security and correctness; the backend always repeats every check |
| Normalization | Each fact stored once (1NF, 2NF, 3NF) to avoid update, insert, and delete anomalies (Section 21) |
| Transaction | A group of steps that fully succeeds or fully fails: checkout, reservation, rider assignment (Section 23) |
| Authentication vs authorization | Who you are vs what you may do |
| RBAC and least privilege | Permissions come from roles per restaurant; each role gets the minimum it needs; a restaurant never sees another restaurant's data |
| Data flow | How information moves between customer, restaurant, rider, admin, and database (Section 26) |

## 4. Users, roles, and the account model

### 4.1 One role per user, or several capabilities?

|  | Option A: one role per user | Option B: multiple capabilities |
| --- | --- | --- |
| ERD | A `role` column on User | User plus membership tables (restaurant staff, rider profile, admin) |
| Customer opens a restaurant | Must change role or create a second account | Stays a customer and gains an owner link |
| Authorization | "What is your role?" | "Do you belong to this restaurant, with which permission?" |
| Security | Easy to over-grant | Per-restaurant control; natural data isolation |

**Recommendation \[DECIDED, Option B\]:** capabilities are derived from data, not stored as a flag.

### 4.2 How the system knows what a user can do

| Capability | How the system knows |
| --- | --- |
| Customer | Every Active user |
| Business (Owner) | An approved Owner relationship for that restaurant. **[VERIFY]** v3 currently represents only `restaurants.owner_user_id`; do not treat it as a complete multi-owner design. |
| Business (Manager, Reservation Manager, Staff) | An Active `RestaurantStaff` membership for that restaurant |
| Driver | An Approved, not Resigned `RiderProfile` |
| Admin | A `PlatformAdmin` row |

### 4.3 Active mode

After login the user picks or is shown a **mode**: Customer, Business (with a restaurant switcher), Driver, or Admin. The mode only decides which menus the frontend shows; it is kept in the session, not the database. The backend still checks permission on **every request**, whatever mode the frontend claims.

Business-mode restrictions, enforced by the backend:

- A Business-mode user cannot create orders and cannot submit a rider application. To do either they switch to Customer mode.
- No one can order from a restaurant they own or work at, in any mode.
- Admin mode does not place orders.

### 4.4 Business hierarchy

```
OWNER(S) (highest; several may belong to one restaurant)
  MANAGER                 runs daily operations
    RESERVATION MANAGER   reservations and tables only
    STAFF                 kitchen/counter: orders and sold-out toggles
```

| Permission | Owner | Manager | Reservation Manager | Staff |
| --- | --- | --- | --- | --- |
| Edit restaurant page, photos, hours, description | Yes | Yes | No | No |
| Edit sensitive info (legal name, address, permits) | Yes | No | No | No |
| Publish, unpublish, close the restaurant | Yes | No | No | No |
| Manage menu (items, prices, photos) | Yes | Yes | No | No |
| Mark items available or sold out | Yes | Yes | No | Yes |
| View orders and update order status | Yes | Yes | No | Yes |
| Cancel or reject orders (reason required) | Yes | Yes | No | No |
| View and manage reservations and tables | Yes | Yes | Yes | No |
| Manage discounts | Yes | Yes | No | No |
| Reports | Sales and reservations | Sales and reservations | Reservations | No |
| See audit history (who approved or updated an order) | Yes | No | No | No |
| Add, change, or remove staff and positions | Yes | No | No | No |

A suspended restaurant is read-only for every role. All Owners have the Owner permission set; one Owner cannot transfer ownership, but an Owner may add another Owner after the schema supports that membership. The Manager ownership-change request flow is removed.

### 4.5 Admin

One admin level (Super) for now; a Verifier and Support split is a future option. The admin can view and manage everything, but admin actions are written to the audit log. Orders, payments, and reviews are never hard-deleted; v3 provides no soft-delete column for these records, so use only existing status/moderation fields where applicable. The admin can never see passwords.

### 4.6 Statuses

| Record | Statuses |
| --- | --- |
| Account | Invited, Active, Suspended, Deactivated |
| Staff membership | Invited, Active, Suspended, Removed |
| Restaurant | Pending, Approved, Rejected, Suspended, Inactive, Closed (plus Published or not) |
| Applications (restaurant, rider) | Draft, Submitted, Under Review, Needs Revision, Approved, Rejected |
| Rider | Approved, Suspended, Resigned; availability Offline, Online, Busy |

## 5. Accounts and authentication

### 5.1 Registration

1. Email and password (hashed; minimum 8 characters).
2. Name (first, middle optional, last, suffix optional) and Philippine mobile number.
3. Email OTP verification. Unverified accounts can browse but cannot order or reserve.
4. First address is optional until the first delivery order. Birthday is optional, except riders must be 18 or older.

Result: Active account with the Customer capability.

### 5.2 Login

1. User enters email and password; the frontend checks the format.
2. The backend verifies the password hash. A wrong email and a wrong password give the same message ("Incorrect email or password").
3. Rate limit: after repeated failures (for example 5) wait a cooling-off period (for example 15 minutes) \[PROPOSED\].
4. Check account status: Active continues; Suspended shows a support message; Deactivated offers reactivation; Invited routes to activation.
5. Create a session (Sanctum cookie, session ID regenerated; httpOnly, Secure, SameSite).
6. Compute capabilities and available modes from data and send them to the frontend.
7. Logout destroys the session. Password change, deactivation, or staff removal revokes sessions.

### 5.3 Forgot password

User enters email, the system always answers "If that email exists, we sent a link", a single-use token (stored hashed, valid 30 to 60 minutes) lets the user set a new password, all sessions are revoked, and a confirmation email is sent.

### 5.4 Email OTP and email delivery

- Six digits, stored hashed, valid 10 minutes, at most 5 attempts, single use, 60-second resend cooldown \[PROPOSED\]. Admin-adjustable.
- Purposes: email verification, business email verification, rider activation after approval, and email change.
- Delivery: Laravel Mail with Mailtrap in development. For a real demo use Gmail SMTP with an app password or a free mail service \[VERIFY\]. Email only; no SMS.
- Google sign-in (Laravel Socialite) is optional and not in the first build.

### 5.5 Adding staff and Owners (Owner only)

- **New person:** the Owner enters an email and a position; the invitee gets a single-use link (valid 72 hours), sets their own password, and the membership moves from Invited to Active. The Owner never creates a password for someone else.
- **Existing user:** the Owner searches by **exact email** (there is no browsable user list, to protect privacy); the user receives an invitation to accept.
- Any Owner may change or remove staff positions; staff cannot raise their own role. One restaurant may have several Owners. An Owner may add another Owner but cannot transfer ownership or silently change an existing person's role to Owner.
- **[VERIFY — v3 update required]:** the current invitation and membership schema only represents Manager, Reservation Manager, and Staff. Before adding another Owner, the owner must update v3 to represent Owner membership and an invitation/acceptance path. The eventual flow must use exact-email lookup, require acceptance for an existing account, and let a new invitee activate their own account; the Owner never sets or receives a password.
- Manager ownership-change requests, owner-initiated transfer, and ownership reassignment are not part of the approved workflow.

### 5.6 Sensitive changes

Changing name, email, password, or addresses, or deactivating the account, always shows an "Are you sure?" confirmation. Changing email requires a new OTP; changing password requires the current password.

## 6. Restaurant onboarding

**Flow:** user chooses "Add your restaurant" (from Customer mode), fills a short wizard, verifies the business email by OTP, submits, status becomes Submitted, the admin reviews, then Approved, Needs Revision, or Rejected. After approval the owner prepares the page and chooses Publish.

**Application steps (wizard, one topic per step, save and finish later):**

1. About: restaurant name, cuisine and category (the restaurant chooses), short description, contact number, business email.
2. Location and hours: address with map pin (PSGC search plus pin); opening hours per weekday, or **Open 24/7**.
3. Documents (three only): business or mayor's permit, DTI or SEC registration, and the owner's valid ID. Each can be a photo or PDF, up to 2 MB.
4. Photos: logo and cover (dish photos can be added later).
5. Review and submit.

**Trimmed for a school project:** no BIR 2303 upload (a self-declared checkbox only), no device field, no sanitary or food-handler papers, no menu PDF, no bank proofs, no monthly device fee. Payout is only a method type and account name. Commission is a single admin setting \[PROPOSED 15%\].

**Hours rule \[PROPOSED, from the delivery-platform reference\]:** a restaurant must be open at least 4 hours a day and 5 days a week unless it is Open 24/7.

**Document handling:** files go to the private disk; permits carry an expiry date that is flagged to the admin; documents of rejected applications are deleted after 30 days.

**Approved is not Published.** Approved means SALO trusts the business. Published means the owner chose to show it. Publishing requires an Approved status, an address with pin, hours (or 24/7), at least one category, and at least one published, orderable item. The owner can unpublish or set Closed at any time.

**Editing the restaurant page:** the Owner and Manager can edit description, photos (logo, cover, gallery of up to 10, one photo per menu item), hours, closure dates, and contact. A "View as customer" preview shows the public page. Changes to sensitive fields (legal name, address, permits) go to the admin for re-approval and the old value stays live until approved \[PROPOSED\].

**Branches:** each branch is its own Restaurant record under the same owner; a brand entity is Future.

## 7. Rider onboarding, zones, and dispatch

### 7.1 Application (from Customer mode)

Flow: user chooses "Become a rider", a short wizard, submit, admin review, Approved, then an acceptance email with an OTP that activates the rider side.

| Vehicle | Required |
| --- | --- |
| Everyone | 18 or older, phone, profile photo, ID photo, home location, preferred shifts, e-wallet name for payout, checkbox that a valid NBI or police clearance and a TIN exist (no upload) |
| Motorcycle | Professional driver's license photo, OR/CR photo, plate number |
| Bicycle, e-scooter, walker | Nothing more |

The wizard asks the vehicle question first so bicycle riders and walkers skip the motorcycle steps. Removed from the reference: uniform, delivery bag, insurance, and uploads of clearances and TIN. Files are private. Business-mode users cannot apply.

### 7.2 Zones and automatic scheduling

An admin defines **Zones** (name, center point, radius) and **Shifts** (for example morning, afternoon, evening) and sets a **capacity per zone per shift** (example: Pasonanca 50 riders).

1. When a rider is approved, the system reads the rider's home location and preferred shifts.
2. For each shift it finds the **nearest zone** with free capacity and assigns the rider.
3. If that zone is full, it tries the next nearest zone within a maximum distance.
4. If none has space, the rider is **waitlisted**; a scheduled job rechecks the waitlist whenever capacity frees up (resignation, suspension, capacity increase).
5. The admin sees the result on a calendar and can override with a reason; every override is audited.

### 7.3 Automatic order dispatch

1. When an order is Ready (or close to it), the system looks at riders who are Online, on shift in the restaurant's zone, and have no active delivery.
2. It picks the nearest by last known location and assigns the order inside a transaction that locks the rider row.
3. The rider must acknowledge within **60 seconds** (admin setting). If not, the offer goes to the next nearest rider.
4. If the zone has none, it widens to the neighboring zone; if still none, the restaurant, customer, and admin are notified.
5. The rider navigates to the restaurant, then the customer; marks Picked Up and Delivered; Delivered requires a **camera photo with timestamp and location** (private disk, viewable by admin, the order's customer, and restaurant staff with order permission).

### 7.4 Earnings, cash, and resigning

- The rider's earning for a delivery is the delivery fee times the rider share (admin setting) \[PROPOSED 80%\], stored on the Delivery when it completes. "Today, this week, total" are calculated from deliveries.
- Cash on delivery: the Delivery stores `cash_collected` and a `cash_remitted` flag; the rider sees cash on hand to remit.
- A rider may resign only with no active delivery and cash settled; resigning frees zone capacity and keeps history.
- A rider's live location lives in the cache only and is deleted when the delivery ends.

## 8. Location

Location must actually work:

- **Use my current location:** the browser reads the position (needs HTTPS or localhost), the system reverse-geocodes it to an address, and shows a draggable pin so the user can correct it.
- **Manual search, not dropdowns:** typing "Zamboanga" instantly suggests Zamboanga City, Zamboanga del Norte, Zamboanga del Sur, and Zamboanga Sibugay. Suggestions come from the official **PSGC** list of regions, provinces, cities, and barangays stored in the database (instant, no per-search limit), shown with their hierarchy, for example "Pasonanca, Zamboanga City, Zamboanga Peninsula". Independent cities sit directly under their region.
- **Streets and landmarks:** an autocomplete provider limited to the Philippines (for example Geoapify) \[VERIFY free limits\]. Nominatim's public service forbids type-ahead use, so it is used only for single lookups.
- **Map:** Leaflet with OpenStreetMap tiles \[VERIFY usage policy\]. **Routes, distance, and ETA:** OpenRouteService through the Laravel backend \[VERIFY limits\]. Keys stay in the backend `.env`.
- Coordinates must be inside the Philippines. Only coordinates and formatted text are stored; orders snapshot the address text.
- Addresses are personal data sent to third parties, so the privacy section says so \[VERIFY under the Data Privacy Act\].

## 9. Information requirements

| Role | Needs to know | Why it matters |
| --- | --- | --- |
| Customer | Restaurant info, hours, 24/7 status; menu, prices, availability, dietary tags; fees and discounts; table availability; live order status, map, and ETA; rider details; favorites; history | Choose confidently and know the true total before paying |
| Owner and Manager | Incoming orders, order items, reservations calendar, tables, sold-out items, discount usage, sales, popular items, reviews, audit history (Owner) | Prepare food, avoid overbooking, decide promotions and staffing |
| Staff | Orders to prepare and their status, item availability | Cook and update status |
| Reservation Manager | Reservation calendar, tables, party sizes | Seat guests and avoid conflicts |
| Driver | Assigned order, pickup and drop-off locations, customer contact for the active order only, route and ETA, earnings, cash to remit, shifts and zone | Deliver and track income |
| Admin | Users, applications and documents, restaurants, platform orders and reservations, rider delivery photos, zones and capacity, sales, audit history, calendar | Keep the platform trustworthy and spot problems |

## 10. Business rules

Business rules are the policies the database and backend must enforce. Numbers marked \[PROPOSED\] are defaults that live in a settings table so they can change without rewriting code.

### 10.1 Users and accounts (U)

- **U1** An email is unique across all users (case-insensitive).
- **U2** One person has one account. Capabilities come from membership and profile records, never from duplicate accounts.
- **U3** Passwords are stored only as hashes, minimum 8 characters.
- **U4** A user reads and edits only their own private information. Others see only what a transaction requires (a rider sees the customer's name, address, and phone for the active delivery only).
- **U5** Suspended, Deactivated, and Invited accounts cannot log in.
- **U6** Unverified emails can browse but cannot place orders or reservations.
- **U7** A user may save several addresses using v3 `address_type`, `label`, and `custom_label`; encode School as `address_type=other` and `label=School`. Exactly one address is default when the user has addresses; enforce this in a transaction because v3's index is non-unique.
- **U8** Birthday is optional; age is derived. Riders must be 18 or older.
- **U9** Mobile numbers use a Philippine format.
- **U10** Account removal is deactivation, with anonymization after a retention period. Orders and reservations are never hard-deleted.
- **U11** A Business-mode user cannot create orders or rider applications; they switch to Customer mode.
- **U12** No one can order from a restaurant they own or work at.
- **U13** Changing name, email, password, or addresses needs confirmation; email change needs a new OTP; password change needs the current password.

### 10.2 Restaurants and staff (R, S)

- **R1** A restaurant may have several Owners. An Owner cannot transfer ownership, but may add another Owner. Current v3 stores only one `owner_user_id`; multi-owner storage and invitations are **[VERIFY]** pending the owner's schema update.
- **R2** A restaurant is public only when Approved and Published.
- **R3** Suspended, Inactive, Closed, and unpublished restaurants cannot receive new orders or reservations.
- **R4** Hours are defined per weekday with one or more shifts; overnight shifts must be flagged.
- **R5** Closure dates block new orders and reservations for that date.
- **R6** Only an admin suspends or reinstates a restaurant; only the Owner publishes, unpublishes, or manages staff.
- **R7** Each branch is a separate restaurant record under the same owner.
- **R8** Dietary labels are self-declared; a Halal label requires an uploaded certificate.
- **R9** Reservation service is opt-in per restaurant.
- **R10** Permit documents have an expiry date; expired permits are flagged to the admin.
- **R11** A restaurant must be open at least 4 hours a day and 5 days a week unless it is Open 24/7 \[PROPOSED\].
- **R12** Every restaurant offers Delivery and Pick-up. Walk-in is shown as information only.
- **R13** A 24/7 restaurant skips the closed-hours check for orders and reservations.
- **R14** Edits to sensitive fields need admin re-approval; the old value stays live until approved \[PROPOSED\].
- **S1** Staff roles are Manager, Reservation Manager, and Staff. Owner is a separate capability/membership, not a staff position. V3 does not yet represent multiple Owner memberships **[VERIFY]**.
- **S2** Only the Owner adds, changes, or removes staff and positions. Managers cannot.
- **S3** One user may work at several restaurants; permissions are checked per restaurant.
- **S4** Membership is checked on every request, so removal or suspension takes effect immediately.
- **S5** Staff cannot remove or change an Owner. No Owner may transfer ownership. Adding an Owner requires the approved Owner-only add flow; any Owner-removal/deactivation rule that could leave no active Owner is **[VERIFY]**.
- **S6** Key actions (accept or reject orders, change prices, change roles) are written to an audit log that only the Owner (own restaurant) and Admin can read.
- **S7** A suspended restaurant is read-only for all roles.

### 10.3 Menu (M)

- **M1** Every item belongs to one restaurant and one category.
- **M2** Price is greater than zero, two decimals.
- **M3** Items are Draft, Published, or Archived. Draft and Archived items are never visible or orderable.
- **M4** An item is orderable only if Published, marked available, and (if a daily quantity is set) quantity left is above zero.
- **M5** Daily quantity: empty means unlimited; reaching zero makes the item sold out automatically; cancelled or rejected orders return stock; the count resets at opening time \[PROPOSED\].
- **M6** "Delete" means Archive. Past orders keep their own copy of item name and price.
- **M7** Category names are unique within a restaurant.
- **M8** Photos are JPG, PNG, or WebP, compressed in the browser to about 2 MB, re-validated by the server, EXIF removed, and stored under server-generated filenames.
- **M9** Dietary tags attach to items; the restaurant-level badge is derived.

### 10.4 Cart, checkout, and orders (C, O)

- **C1** V3 permits one persistent cart row per customer/restaurant pair (unique `(user_id,restaurant_id)`), not multiple cart lifecycles. Reuse that row; derive an active cart from its items and `expires_at`, and clear its items after expiry or checkout. Touch the parent cart's `updated_at` whenever a cart item changes; set `expires_at` to seven days after activity while nonempty and clear it when empty/expired/checked out. Multiple restaurants can coexist.
- **C2 (replaced)** One checkout may include several carts. Each cart becomes its own order, and orders placed together share a CheckoutGroup.
- **C3** A cart does not reserve stock; availability and prices are re-checked at checkout.
- **C4** Carts expire after 7 days of inactivity \[PROPOSED\], using v3 `updated_at` and `expires_at`; no cart status or last-activity column is assumed.
- **O1** An order belongs to one restaurant and (through its group) one customer, has at least one item, and each quantity is above zero and under a set limit.
- **O2** The backend computes all totals; totals from the frontend are ignored.
- **O3** Delivery orders need an address with coordinates inside the restaurant's delivery radius. Pick-up orders have no delivery fee.
- **O4** A scheduled order must fall inside operating hours and meet the minimum lead time.
- **O5** Status moves only along the allowed path (Section 15); every change is logged with who, when, and why.
- **O6** Completed, cancelled, and rejected orders cannot be modified.
- **O7** A customer may cancel only while the order is Placed.
- **O8** Submitting the same checkout twice creates one group (idempotency key on the group).
- **O9** The order stores snapshots of item names, prices, fees, discount, and delivery address text.
- **O10** Orders have a readable reference code, not a sequential ID.
- **O11** Each order has its own address, fee, discount, payment, and status. The default address is preselected and can be changed per order. The rule is one address per order, not per item.
- **O12** Placing a group is all-or-nothing: validate every order first; if one fails, create none and say which restaurant failed.
- **O13** The group's grand total is derived, never stored.
- **O14** A Pick-up order shows the restaurant's location and directions.
- **O15** When the rider marks Delivered, the customer is asked "Did you receive your order?". Yes completes the order and opens the rating modal. No creates a support ticket for admin review. No answer within 24 hours auto-confirms \[admin setting\].

### 10.5 Fees and payment (F, P)

- **F1** Fee values come from a settings table and are copied onto each order.
- **F2** Delivery fee = base fee plus a per-kilometre rate beyond a free distance, from a routing API \[PROPOSED\].
- **F3** The service fee is a flat or percent amount set by the admin.
- **F4** Delivery without a set pin shows no fee and blocks checkout.
- **P1** First build: Cash on Delivery for delivery and pay-at-pick-up for pick-up.
- **P2** Payment status is separate from order status (Unpaid, Pending, Paid, Failed, Refunded).
- **P3** The system never stores card numbers, bank account numbers, or e-wallet credentials; Phase 5 stores only provider reference and status.
- **P4** For COD the Delivery records cash collected and remitted.

### 10.6 Discounts (D)

- **D1** A discount is platform-wide or restaurant-specific and records who funds it.
- **D2** It must be active, inside its dates, meet the minimum order, and be under its total and per-customer limits; a null v3 `per_customer_limit` means no per-customer cap.
- **D3** Percent is 1 to 100 with an optional maximum; a fixed discount cannot exceed the eligible subtotal.
- **D4** Types: percentage, fixed, free delivery, first order.
- **D5** One discount per order; the total never goes below zero.
- **D6** Redemption is recorded inside the order transaction and released if the order is cancelled or rejected.
- **D7** Restaurants create discounts only for their own restaurant; platform-wide discounts are admin-only.
- **D8** A restaurant discount applies only to that restaurant's order in a group. A platform discount applies to one order in the group (the customer chooses; default the largest) \[PROPOSED\].

### 10.7 Tables and reservations (T, V)

- **T1** A table belongs to one restaurant, the number is unique within it, and capacity is above zero.
- **T2** Stored table status is Active, Maintenance, or Inactive. Free, reserved, and occupied are derived from reservations.
- **V1** A reservation belongs to one customer, one table, a start time, and a duration. The restaurant is found through the table.
- **V2** Guests are at least 1 and at most the table's capacity.
- **V3** Two reservations on one table cannot overlap.
- **V4** A reservation must fall inside operating hours (any time for 24/7), not on a closure date, and within the booking window.
- **V5** The first request holds the slot. A Pending request expires if the restaurant does not respond within the review window \[PROPOSED 24 hours\].
- **V6** Maintenance or Inactive tables cannot be booked; affected future reservations are flagged to the restaurant.
- **V7** Late arrival is allowed up to a grace period \[PROPOSED 15 minutes\]; after that the reservation may be marked No Show.
- **V8** Rescheduling needs a free slot and restaurant approval.
- **V9** Each restaurant sets a cancellation cutoff within an admin range; the policy is shown before booking.
- **V10** A customer may hold at most 3 active reservations \[PROPOSED\].

### 10.8 Riders, zones, and deliveries (L, Z)

- **L1** Only Approved, Online, on-shift riders receive orders.
- **L2** Dispatch is automatic: nearest eligible rider first, assignment atomic (row lock), rider acknowledges within 60 seconds or the order moves on.
- **L3** A rider carries one active delivery at a time \[PROPOSED\].
- **L4** Delivered requires a camera photo with timestamp and location.
- **L5** The rider's earning is stored on the Delivery when it completes.
- **L6** If a rider is suspended or goes offline mid-delivery, the order returns to dispatch.
- **L7** A rider can resign only with no active delivery and cash settled; resigning frees zone capacity.
- **L8** Live location is kept in cache only (expires in about 2 minutes), deleted when the delivery ends, and visible only to that order's customer, authorized restaurant staff, and admin.
- **Z1** Each zone has a capacity per shift.
- **Z2** Riders are assigned to the nearest zone with free capacity, then the next nearest within a maximum distance, then a waitlist rechecked by a scheduled job.
- **Z3** Admin may override an assignment with a reason, and it is audited.
- **Z4** Lowering a capacity does not automatically evict assigned riders.

### 10.9 Reviews, support, location, and platform (W, G, A, X)

- **W1** A review is allowed only after the customer confirms receipt, once per order per target (restaurant, rider).
- **W2** A restaurant may reply; admin may hide abusive content.
- **W3** Staff and owners cannot review their own restaurant.
- **W4** Help requests create a support ticket visible to admins.
- **G1** Coordinates must be inside the Philippines.
- **G2** Addresses use the PSGC hierarchy plus a map pin; GPS readings show a draggable pin for correction.
- **A1** Every admin action is audited. **A2** Orders, payments, and reviews are never hard-deleted. V3 provides no soft-delete column for these records; use only existing status/moderation fields where applicable, and preserve payment/order history. **A3** Admins never see passwords and do not place orders.
- **X1** Retention \[PROPOSED\]: audit log 90 days; rejected-application documents 30 days; delivery proof photos 30 days; notifications 60 days; orders, payments, and reviews kept.
- **X2** Uploads: JPG, PNG, WebP (and PDF for documents), at most 2 MB, validated by real file type, never by the client's name.

## 11. CRUD and permission matrix

C create, R read, U update, D delete (mostly archive). "own" means the person's records, "rest." means their restaurant, "all" means platform-wide. Anything not listed is denied.

| Entity | Customer | Owner | Manager | Reservation Mgr | Staff | Rider | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User profile | R U own | R U own | R U own | R U own | R U own | R U own | R all; suspend |
| Address | C R U D own | own | own | own | own | own | R all (support) |
| Restaurant application | C R own | C R U own |  |  |  |  | R all; approve, reject, revise |
| Restaurant page and photos | R public | R U rest. | R U rest. | R | R |  | R U D all |
| Staff membership |  | C R U D |  |  |  |  | R all; override |
| Hours and closures | R | C R U D | C R U D | R | R |  | R U all |
| Menu category and item | R | C R U D | C R U D |  | R; toggle sold out |  | R U D all |
| Cart | C R U D own |  |  |  |  |  |  |
| Checkout group and order | C R own; cancel while Placed | R U status | R U status |  | R U status | R assigned | R all; force-cancel |
| Table | R availability | C R U D | C R U D | C R U D |  |  | R U D all |
| Reservation | C R own; cancel | R U | R U | R U |  |  | R all |
| Discount | Apply, R valid | C R U D | C R U D |  |  |  | C R U D all |
| Favorite | C R D own |  |  |  |  |  |  |
| Review | C R own; R public | R; reply | R; reply |  |  | R own | R all; hide |
| Rider profile and documents |  |  |  |  |  | C R U own; resign | R all; approve, suspend |
| Zone, shift, capacity |  |  |  |  |  | R own | C R U D |
| Delivery and proof photo | R own order | R rest. | R rest. |  |  | R U assigned | R all |
| Payment | R own | R rest. | R rest. |  |  |  | R all |
| Audit log |  | R rest. |  |  |  |  | R all |
| Platform settings | R fees |  |  |  |  |  | C R U D |
| Reports | Own history | Own restaurant | Own restaurant | Reservations |  | Own earnings | Platform-wide |

## 12. Functional requirements

Tags: P0 foundation, P1 admin, P2 business, P3 customer, P4 driver, P5 online payment.

**Accounts and access**

- FR-01 \[P0\] Register with email and password, then complete a profile.
- FR-02 \[P0\] Verify email by OTP.
- FR-03 \[P0\] Log in and out; block suspended, deactivated, or inactive accounts.
- FR-04 \[P0\] Reset a forgotten password by single-use token.
- FR-05 \[P0\] Determine capabilities and modes, and let a user switch mode.
- FR-06 \[P0\] Show only the features each mode and role permits.
- FR-07 \[P3\] Let a user manage profile, password, and many categorized addresses, with confirmation on every sensitive change.
- FR-08 \[P3\] Let a user request account deactivation after confirming the password.

**Location**

- FR-09 \[P3\] Use the current location and show an adjustable pin.
- FR-10 \[P3\] Search places with instant type-ahead suggestions across the Philippines (region to barangay, plus streets and landmarks).
- FR-11 \[P3\] Show routes, distance, delivery fee, and ETA on a map.

**Admin**

- FR-12 \[P1\] Show a dashboard with graphs and a date range.
- FR-13 \[P1\] List, search, filter, view, create, edit, suspend, and soft-delete users and restaurants.
- FR-14 \[P1\] Review restaurant and rider applications with a document viewer; approve, reject, or request revision.
- FR-15 \[P1\] View rider delivery proof photos by rider and by order.
- FR-16 \[P1\] Provide reports with date range and CSV export.
- FR-17 \[P1\] Provide an audit history and a calendar (reservations, rider shifts, restaurant schedules).
- FR-18 \[P1\] Manage platform settings and zones, shifts, and capacities.
- FR-19 \[P1\] Assign riders to zones automatically with waitlist and logged overrides.

**Restaurant and menu**

- FR-20 \[P2\] Submit a restaurant application with documents.
- FR-21 \[P2\] Edit the restaurant page: description, category, photos, hours, Open 24/7, closure dates, contact, with a customer preview.
- FR-22 \[P2\] Publish, unpublish, or close the restaurant.
- FR-23 \[P2\] Let an Owner add staff by invitation or exact-email search and set or change staff positions; an Owner may add another Owner, subject to the v3 schema update gate.
- FR-24 \[P2\] Enforce role permissions and write an audit history only the Owner can read.
- FR-25 \[P2\] Manage categories and items (draft, publish, archive), prices, photos, and dietary tags.
- FR-26 \[P2\] Mark items available or sold out, with an optional daily quantity.
- FR-27 \[P2\] Manage orders: confirm, reject, prepare, mark ready, mark collected.
- FR-28 \[P2\] Define tables, reservation settings, and manage reservations on a calendar.
- FR-29 \[P2\] Create and manage discounts.
- FR-30 \[P2\] Provide restaurant reports and history.

**Customer**

- FR-31 \[P3\] Search and filter restaurants (name, cuisine, Filipino-only, dietary, Open 24/7) and menu items.
- FR-32 \[P3\] Prevent ordering unavailable, sold-out, or archived items.
- FR-33 \[P3\] Keep a saved cart per restaurant and add items to favorites.
- FR-34 \[P3\] Check out several carts at once, choosing Delivery or Pick-up and an address per order, with a default address on top.
- FR-35 \[P3\] Compute subtotal, fees, discount, and total on the backend and show a full breakdown.
- FR-36 \[P3\] Create all orders in a group atomically.
- FR-37 \[P3\] Validate discount codes and explain any failure.
- FR-38 \[P3\] Track each order with a live map, rider details, status, and ETA.
- FR-39 \[P3\] Cancel an order while Placed.
- FR-40 \[P3\] Ask the customer to confirm receipt, then show the rating and comment modal.
- FR-41 \[P3\] Show order and reservation history.
- FR-42 \[P3\] Find available tables, reserve, and cancel under the restaurant's policy.
- FR-43 \[P3\] Apply as a rider or as a partner restaurant from Customer mode.
- FR-44 \[P3\] Send help requests.

**Driver**

- FR-45 \[P4\] Apply with a short, vehicle-based wizard; activate the rider side by email OTP after approval.
- FR-46 \[P4\] Set Online or Offline and see zone and shift.
- FR-47 \[P4\] Receive automatic assignments and acknowledge within the time limit.
- FR-48 \[P4\] Navigate to the restaurant and the customer on a map with ETA.
- FR-49 \[P4\] Take a camera proof photo to complete delivery.
- FR-50 \[P4\] Show earnings (today, week, total) and cash to remit.
- FR-51 \[P4\] Resign under the resignation rule.

**Payment, notifications**

- FR-52 \[P1\] Record COD and pay-at-pick-up payments.
- FR-53 \[P5\] Support online banks and GCash in test mode.
- FR-54 \[P0\] Send email notifications for key events.

## 13. Non-functional requirements

| Area | Requirement (realistic for a student project) |
| --- | --- |
| Security | Hashed passwords, parameterized queries, server-side authorization on every endpoint, rate limits on login and OTP, private storage for documents and proofs, no secrets in frontend code |
| Privacy | Follow Data Privacy Act principles \[VERIFY\]: collect only what is needed, ask consent, protect IDs and addresses, define retention |
| Performance | Typical pages return within about 2 seconds; lists are paginated; searched columns are indexed; location suggestions answer from local data |
| Reliability | Orders, reservations, and assignments are transactional; no partial records; regular database backups; friendly errors |
| Availability | Reasonable uptime for demos; graceful messages when maps, email, or routing fail |
| Usability | A first-time user knows the next step on every screen; one primary button per view; consistent design system; empty, loading, error, and success states; Filipino flavor words only in friendly moments |
| Accessibility | Contrast of at least 4.5:1 for text, visible focus, labeled fields, large tap targets, status never shown by color alone |
| Responsiveness | Phones to desktops without sideways scrolling |
| Maintainability | Layered backend (route, request, controller, service, repository, resource), docs for the API and database, tokens-only styling |
| Scalability | More restaurants, riders, and orders add rows, not new structure |
| Portability | Config in an environment file; migrations rebuild the database on any MySQL 8 server |
| Compatibility | GPS and camera need HTTPS or localhost |

## 14. Menu management

Owners and Managers can add, edit, search, and archive categories and items, filter by category, change price, description, and photo, mark items available or sold out, set an optional daily quantity, attach dietary tags, and publish drafts. Staff can only toggle availability.

### 14.1 One status field or several?

| Design | Advantages | Disadvantages |
| --- | --- | --- |
| One status column (Draft, Available, SoldOut, Archived) | Simple to read | The states are independent: an item can be published and sold out today and available tomorrow. One column forces awkward combinations, and automatic sell-out at zero cannot be expressed cleanly |
| **Separate fields \[DECIDED\]** | Each question has one clear answer; no impossible combinations; easy to query | A few more columns; the "orderable" rule combines them |

| Field | Values | Meaning |
| --- | --- | --- |
| Lifecycle | Draft, Published, Archived | Does the item exist for customers? Archived items are kept for history |
| Availability | Available or Not available | The restaurant's manual sold-out switch |
| Daily quantity and quantity left | Empty (unlimited) or a number | At 0 the item behaves as sold out automatically |

**Orderable = Published AND Available AND (no limit OR quantity left above 0).** Customers see Published items; sold-out items appear greyed out with a label; Draft and Archived items do not appear. Editing a price warns the owner when the item sits in customers' carts.

**Dietary labels:** tags such as contains pork, halal-certified, vegetarian, and allergens attach to items; the restaurant's "pork-free" badge is derived (no published item contains pork). Customers can filter by tag and by Filipino cuisine.

## 15. Order workflow and cancellation

### 15.1 Checkout

Carts, choose Delivery or Pick-up and an address for each delivery order (the default address is preselected), review each restaurant's section and the grand total, then place.

Backend validation for the whole group, in order: each restaurant is Approved, Published, and open (or 24/7, or the scheduled time is valid), each item is Published, available, and in stock, prices are re-read from the database, the delivery address and radius are valid, the discount is valid, and totals are computed. If any order fails, none is created and the customer sees which restaurant failed. If all pass, every order, its items, stock changes, and discount redemption are created in **one transaction**.

### 15.2 Statuses

| Status | Meaning | Who changes it | Customer can cancel? |
| --- | --- | --- | --- |
| Placed | Submitted, waiting for the restaurant | System | Yes |
| Confirmed | Restaurant accepted | Owner, Manager, Staff | No (may send a cancel request) |
| Preparing | Being cooked | Owner, Manager, Staff | No |
| Ready | Ready for pick-up or a rider | Owner, Manager, Staff | No |
| Out for Delivery | Rider picked it up (Delivery only) | Rider | No |
| Delivered | Rider uploaded proof; awaiting the customer's confirmation (Delivery only) | Rider | No |
| Completed | Collected, or receipt confirmed (customer or after 24 hours) | Restaurant (Pick-up), customer, or system | Final |
| Rejected | Restaurant declined at Placed | Restaurant | Final |
| Cancelled | Stopped before completion | Customer (at Placed), restaurant, or admin | Final |
| Delivery Failed | Could not be delivered (unreachable, wrong address) | Rider with admin review | Final |

- **Pick-up path:** Placed, Confirmed, Preparing, Ready, Completed.
- **Delivery path:** Placed, Confirmed, Preparing, Ready, Out for Delivery, Delivered, Completed.
- Each order in a group has its own status. Every transition is stored in an order status history (who, when, from, to, reason), which feeds the tracking screen and the audit history.

### 15.3 Receipt confirmation and rating

When the rider marks Delivered, the customer sees a confirmation pop-up. Yes: the order is Completed and the rating pop-up opens (restaurant rating with comment, and rider rating). No: a support ticket opens and the admin reviews the proof photo. No answer in 24 hours: the order is Completed automatically and rating stays available \[PROPOSED\].

### 15.4 Cancellation policy \[PROPOSED\]

| Actor | Allowed when | Required | Effects |
| --- | --- | --- | --- |
| Customer | While Placed | Optional reason | Cancelled; stock returned; discount released |
| Restaurant | Placed (as Rejected) or later (as Cancelled) | Reason from a list | Same effects; repeated late cancellations are reported |
| Admin | Any non-final status | Reason | Same effects; used for disputes and suspended restaurants |
| System | Placed with no restaurant response in 10 minutes | Automatic reason | Cancelled |

Before confirmation the restaurant has spent nothing, so free cancellation is fair. After confirmation the restaurant has committed, so customer cancellation becomes a request. Orders are never deleted. Cancelling withdraws any rider assignment and, with online payment later, moves the payment to Refunded. A cancelled order inside a group does not cancel the others.

## 16. Fees, pricing, payment, and money flow

| Component | Meaning |
| --- | --- |
| Subtotal | Sum of item price times quantity, from the database |
| Delivery fee | Base fee plus a per-kilometre rate beyond a free distance; zero for Pick-up; unavailable until the delivery pin is set |
| Service fee | Platform fee, flat or percent |
| Discount | Reduction from a valid code, split by who funds it |
| Total | Subtotal plus delivery plus service minus discount, never below zero |

Each component is stored on its order as a snapshot. The grand total of a group is derived and never stored. Every value lives in an admin settings table.

**Proposed starting values (all admin-editable) \[PROPOSED\]:** base fee ₱35 up to 2 km, plus ₱10 per extra km, maximum delivery radius 10 km, service fee 5%, default preparation time 20 minutes, handoff buffer 3 minutes, average speed 20 km/h, detour factor 1.3, rider share 80% of the delivery fee, platform commission 15%.

**ETA** = remaining preparation time plus rider-to-restaurant travel plus handoff buffer plus restaurant-to-customer travel, shown as a range and a clock time. If the routing service is down, fall back to straight-line distance times the detour factor divided by average speed and label it an estimate.

| Method | Phase | What is stored |
| --- | --- | --- |
| Cash on Delivery | First build | Method and status; cash collected and remitted on the Delivery |
| Pay at pick-up | First build | Method and status |
| Online banks, GCash, card through a provider (for example PayMongo) | Phase 5, test mode | Provider reference, status, amount, timestamps; never card or bank numbers \[VERIFY\] |

**Who earns what (design now, build later):** restaurant earnings are food sales minus restaurant-funded discounts minus commission; platform revenue is commission plus service fee minus platform-funded discounts; the rider earns the rider share of the delivery fee. In the first build only collected cash and a remitted flag are stored; a full payout ledger is later. V3 relates payments to individual orders and does not make `payments.order_id` unique; the plan therefore treats payment attempts as one-to-many per order. A single payment covering an entire group is not part of the current design.

## 17. Discount system

| Field | Needed? | Notes |
| --- | --- | --- |
| Restaurant | Optional | Empty means platform-wide (admin-created) |
| Funded by | Yes | Platform or Restaurant |
| Code | Yes | Unique within its scope |
| Name and description | Yes | Shown to customers |
| Type | Yes | Percentage, Fixed, Free Delivery, First Order |
| Value | Yes | Percent or pesos |
| Minimum order | Optional | Default 0 |
| Maximum discount | Optional | Cap for percentage |
| Start and end | Yes | Validity window |
| Total limit and per-customer limit | Optional | Default per-customer 1 |
| Active flag | Yes | Manual switch |
| Usage count | Derived | Counted from redemptions |

**Validation:** find the code in scope (this restaurant or platform-wide), then check active, dates, minimum order, total limit, and per-customer limit (First Order means the customer has no completed orders). Compute the discount (percentage capped by the maximum, fixed capped by the eligible subtotal, free delivery equal to the delivery fee), then the final total. The check repeats inside the checkout transaction.

| Problem | Message |
| --- | --- |
| Unknown or wrong restaurant | "This code isn't valid for this order." |
| Inactive | "This code is not available right now." |
| Expired or not started | "This code is expired" or "starts on \<date>." |
| Limit reached | "This code has been fully claimed." |
| Already used | "You've already used this code." |
| Below minimum | "Add ₱X more to use this code." |

In a multi-restaurant checkout, a restaurant's code applies only to that restaurant's order; a platform code applies to one order in the group (the customer chooses, default the largest) \[PROPOSED\]. One discount per order. Item-specific discounts are Future.

## 18. Tables and reservations

| Table status | Stored? | Reason |
| --- | --- | --- |
| Active | Yes | Can be reserved |
| Maintenance | Yes | Temporarily unavailable |
| Inactive | Yes | Out of use, kept for history |
| Available, Reserved, Occupied | Derived | These depend on date and time, so they are computed from reservations |

**Reservation settings per restaurant:** accepts reservations, confirmation mode (manual or automatic), review window, slot interval, default dining duration, minimum lead time, maximum months ahead, maximum party size, grace period, cancellation cutoff. 24/7 restaurants accept reservations at any hour; others follow operating hours and closure dates.

**Finding availability:** given restaurant, date, time, and guests, take Active tables whose capacity fits, remove tables with a Pending or Confirmed reservation overlapping the request, check hours and closures, and offer the smallest fitting free table. Customers see only that a slot is free or not, never other customers' bookings.

| Reservation status | Meaning |
| --- | --- |
| Pending | Requested; slot held; waiting for the restaurant |
| Confirmed | Accepted |
| Declined | Refused; slot released |
| Expired | Hold timed out; slot released |
| Cancelled | Cancelled by customer, restaurant, or admin (who and why recorded) |
| Completed | Customer was seated and finished |
| No Show | Did not arrive within the grace period |

**Manual or automatic confirmation:** manual keeps the restaurant in control but is slower and needs an expiry; automatic is instant but risks no-shows and mistakes. **Restaurant-selectable, default manual, with a hold and expiry \[PROPOSED\].**

**First come, first served:** two customers may press Book at the same moment, so the database decides. The booking step locks the table row, checks for overlap, and creates the reservation inside one transaction; the loser sees "this slot was just taken" with other times offered.

**Cancellation, no-show, rescheduling \[PROPOSED policy\]:** customers cancel up to a cutoff chosen by the restaurant (for example 2 hours before) within an admin range; later cancellation is recorded as late. The restaurant or admin may cancel with a reason and the customer is notified. Cancelling releases the table immediately. A no-show is marked after the grace period (default 15 minutes) and repeated no-shows are reported. V3 has no separate reschedule-request state/table; a customer-facing approval request is **[VERIFY]** and is not included until represented in the approved schema. If a restaurant adds a closure date over bookings, affected customers are notified and offered a new date. Deposits and a per-reservation message thread are Future.

## 19. Entities, attributes, and keys — v3 schema authority

The entity tables formerly listed in this section describe the earlier Plan v2 proposal and are **superseded**. Do not use their PK names, columns, enum values, or relationship cardinalities to generate code or migrations. The exact table definitions, PKs, FKs, indexes, checks, enums, and seed values are in [DATABASE_SCHEMA_V3.sql](./DATABASE_SCHEMA_V3.sql); the inventory and code comparison are in [SCHEMA_GAP_REPORT.md](./SCHEMA_GAP_REPORT.md). V3 is a standalone schema blueprint and currently contains a destructive database drop/create preamble; it has not been executed.

V3's 49 application tables are:

- Identity and platform: `users`, `platform_admins`, `auth_tokens`, `psgc_locations`, `platform_settings`, `audit_logs`, `notifications`.
- Restaurant and menu: `restaurants`, `restaurant_applications`, `application_documents`, `restaurant_photos`, `restaurant_staff`, `invitations`, `cuisine_types`, `restaurant_cuisines`, `operating_hours`, `closure_dates`, `reservation_settings`, `menu_categories`, `menu_items`, `dietary_tags`, `menu_item_dietary_tags`, `restaurant_tables`, `reservations`.
- Customer and orders: `user_addresses`, `carts`, `cart_items`, `checkout_groups`, `orders`, `order_items`, `order_status_histories`, `payments`, `discounts`, `discount_redemptions`, `restaurant_reviews`, `favorite_restaurants`, `favorite_menu_items`, `support_tickets`, `ticket_messages`.
- Rider and dispatch: `zones`, `shifts`, `zone_shift_capacities`, `rider_profiles`, `rider_documents`, `rider_preferred_shifts`, `rider_shift_assignments`, `deliveries`, `delivery_offers`, `rider_reviews`.

The current v3 owner representation is a known exception to the product rule above: `restaurants.owner_user_id` is one required FK and there is no Owner membership/owner invitation or manager request table. Multi-owner behavior remains **[VERIFY]** until the owner updates v3. Other product rules must fit v3; use service-level validation for cross-row behavior and mark unrepresented behavior **[VERIFY]** rather than adding undocumented schema.

V3 uses auto-increment IDs where specified, plus natural and composite keys; public orders and reservations have non-sequential reference codes. Exact key and table names are defined only by v3. Laravel-managed framework tables are separate and must be created only when required by the selected drivers. Phase tags: 0 foundation, 1 admin, 2 business, 3 customer, 4 driver, 5 payment.

Legacy note: the preceding Plan v2 entity rows were designed around a single `owner_user_id`. They are superseded by the v3 schema authority above and must not be used as the current data dictionary.

### 19.1 Identity and access (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived (not stored) |
| --- | --- | --- | --- | --- | --- |
| User | 0 | user\_id |  | email (unique), password\_hash, first\_name, middle\_name, last\_name, suffix, mobile, birthday (optional), status, email\_verified\_at, created\_at, last\_login\_at | full name, age |
| UserAddress | 3 | address\_id | user\_id, psgc\_code | label, custom\_label, street, house\_no, latitude, longitude, delivery\_note, is\_default | formatted address |
| PlatformAdmin | 0 | admin\_id | user\_id (unique) | admin\_level, status, created\_at |  |
| AuthToken | 0 | token\_id | user\_id | purpose, token\_hash, expires\_at, used\_at, attempts, created\_at | is\_expired |
| Invitation | 2 | invitation\_id | invited\_by, restaurant\_id | invited\_email, staff\_role, token\_hash, expires\_at, accepted\_at, status |  |
| AuditLog | 0 | log\_id | actor\_user\_id, restaurant\_id (optional) | action, entity\_type, entity\_id, before\_value, after\_value, created\_at |  |
| PsgcLocation | 0 | code | parent\_code | name, level (region, province, city, barangay) |  |

### 19.2 Restaurant (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived |
| --- | --- | --- | --- | --- | --- |
| Restaurant | 2 | restaurant\_id | owner\_user\_id, psgc\_code | name, branch\_label, description, contact\_number, business\_email, email\_verified\_at, street, latitude, longitude, logo\_path, cover\_path, delivery\_radius\_km, prep\_minutes, is\_24\_7, status, is\_published, created\_at, updated\_at | average rating, pork-free badge, open now |
| RestaurantPhoto | 2 | photo\_id | restaurant\_id | path, alt\_text, sort\_order, is\_primary (maximum 10) |  |
| RestaurantApplication | 2 | application\_id | restaurant\_id, submitted\_by, reviewed\_by | declared\_bir\_2303, status, submitted\_at, reviewed\_at, review\_notes |  |
| ApplicationDocument | 2 | document\_id | application\_id | doc\_type, private\_path, expiry\_date, verified | is\_expired |
| RestaurantStaff | 2 | staff\_id | restaurant\_id, user\_id (unique pair) | staff\_role (Manager, Reservation Manager, Staff), status, created\_at |  |
| OperatingHours | 2 | hours\_id | restaurant\_id | weekday, open\_time, close\_time, crosses\_midnight |  |
| ClosureDate | 2 | closure\_id | restaurant\_id | closure\_date, reason |  |
| CuisineType | 2 | cuisine\_id |  | name, is\_filipino |  |
| RestaurantCuisine | 2 | (restaurant\_id, cuisine\_id) | both |  |  |
| ReservationSetting | 2 | restaurant\_id | restaurant\_id | accepts\_reservations, confirm\_mode, review\_window\_hours, slot\_minutes, dining\_minutes, min\_lead\_hours, max\_months\_ahead, max\_party\_size, grace\_minutes, cancel\_cutoff\_hours |  |

### 19.3 Menu (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived |
| --- | --- | --- | --- | --- | --- |
| MenuCategory | 2 | category\_id | restaurant\_id | name (unique per restaurant), sort\_order, status |  |
| MenuItem | 2 | item\_id | category\_id | name, description, price, image\_path, lifecycle\_status, is\_available, daily\_quantity, quantity\_left, prep\_minutes, created\_at, updated\_at | is\_orderable; restaurant (via category) |
| DietaryTag | 2 | tag\_id |  | name, tag\_type |  |
| MenuItemDietaryTag | 2 | (item\_id, tag\_id) | both |  |  |

### 19.4 Ordering and payment (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived |
| --- | --- | --- | --- | --- | --- |
| Cart | 3 | cart\_id | user\_id, restaurant\_id (unique pair) | updated\_at, expires\_at | totals |
| CartItem | 3 | cart\_item\_id | cart\_id, item\_id (unique pair) | quantity, note | line total |
| CheckoutGroup | 3 | checkout\_id | user\_id | reference\_code, idempotency\_key, placed\_at | grand total |
| Order | 3 | order\_id | checkout\_id, restaurant\_id, delivery\_address\_id (optional) | reference\_code, order\_type (Delivery or Pick-up), scheduled\_for, status, recipient\_name, recipient\_phone, delivery\_address\_text, delivery\_lat, delivery\_lng, subtotal, delivery\_fee, service\_fee, discount\_amount, total\_amount (snapshots), cancelled\_by, cancel\_reason, placed\_at, completed\_at, customer\_confirmed\_at, confirmation\_method | estimated time; customer (via group) |
| OrderItem | 3 | order\_item\_id | order\_id, item\_id | item\_name\_snapshot, unit\_price\_snapshot, quantity, note | line total |
| OrderStatusHistory | 3 | history\_id | order\_id, changed\_by | from\_status, to\_status, reason, changed\_at |  |
| Payment | 3 | payment\_id | order\_id | method, status, amount, provider, provider\_reference, paid\_at |  |

### 19.5 Riders, zones, and delivery (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived |
| --- | --- | --- | --- | --- | --- |
| RiderProfile | 4 | rider\_id | user\_id (unique), approved\_by | vehicle\_type, plate\_number, home\_lat, home\_lng, ewallet\_account\_name, status, availability, approved\_at, resigned\_at | total earned, deliveries done |
| RiderDocument | 4 | document\_id | rider\_id | doc\_type, private\_path, verified |  |
| Zone | 1 | zone\_id | psgc\_code (optional) | name, center\_lat, center\_lng, radius\_km, is\_active | riders assigned |
| Shift | 1 | shift\_id |  | name, start\_time, end\_time |  |
| ZoneShiftCapacity | 1 | (zone\_id, shift\_id) | both | max\_riders | free slots |
| RiderShiftAssignment | 4 | assignment\_id | rider\_id, zone\_id, shift\_id | status (Assigned or Waitlisted), assigned\_by (system or admin), reason |  |
| Delivery | 4 | delivery\_id | order\_id (unique), rider\_id | status, accepted\_at, picked\_up\_at, delivered\_at, proof\_photo\_path, proof\_lat, proof\_lng, distance\_km, rider\_earning, cash\_collected, cash\_remitted |  |
| DeliveryOffer | 4 | offer\_id | delivery\_id, rider\_id | offered\_at, response (Accepted, Declined, Timeout), responded\_at |  |

### 19.6 Discounts, reservations, feedback, system (legacy v2 list; superseded by v3)

| Entity | Phase | PK | Foreign keys | Main attributes | Derived |
| --- | --- | --- | --- | --- | --- |
| Discount | 2 | discount\_id | restaurant\_id (optional), created\_by | funded\_by, code, name, type, value, min\_order\_amount, max\_discount, starts\_at, ends\_at, usage\_limit, per\_customer\_limit, is\_active | usage count, running or expired |
| DiscountRedemption | 3 | redemption\_id | discount\_id, order\_id (unique), user\_id | amount\_applied, status (Applied or Released), created\_at |  |
| RestaurantTable | 2 | table\_id | restaurant\_id | table\_number (unique per restaurant), capacity, area, status | free or booked at a time |
| Reservation | 3 | reservation\_id | user\_id, table\_id, responded\_by | reference\_code, start\_at, duration\_minutes, guest\_count, reserved\_for\_name, contact\_phone, special\_request, status, expires\_at, cancelled\_by, cancel\_reason, created\_at | end time; restaurant (via table) |
| RestaurantReview | 3 | review\_id | order\_id (unique), user\_id | rating, comment, reply, replied\_at, is\_hidden, created\_at | average |
| RiderReview | 4 | review\_id | delivery\_id (unique), user\_id | rating, comment, created\_at | average |
| FavoriteRestaurant, FavoriteMenuItem | 3 | composite | user\_id and restaurant\_id or item\_id | created\_at |  |
| SupportTicket, TicketMessage | 1 | ticket\_id, message\_id | user\_id, order\_id (optional), assigned\_admin | subject, body, status, created\_at |  |
| Notification | 0 | notification\_id | user\_id | type, message, related\_reference, read\_at, created\_at |  |
| PlatformSetting | 1 | setting\_key | updated\_by | value, updated\_at |  |

Removed from v1: LoginAttempt (Laravel's rate limiter handles it) and FavoriteRider (not requested). Stored versus calculated: age, full name, averages, line totals, table availability, discount usage count, rider earning totals, zone free slots, group grand total, and "open now" are calculated. The only deliberate stored copies of calculated values are the order money and address snapshots, because history must not change when settings change. Images and documents are files; only their paths are stored.

## 20. Relationships, cardinality, and the Chen ERD

Logical relationships must not be mistaken for declared v3 foreign keys: for example, `psgc_locations.parent_code` has no FK constraint. V3's declared keys are authoritative. Multiple-Owner cardinality is a product rule pending the owner schema update.

| Relationship | Cardinality | Implementation |
| --- | --- | --- |
| User owns Restaurant | M : N product rule | Owner association is **[VERIFY]**; current v3 has only the required `restaurants.owner_user_id` FK and cannot encode multiple Owners. |
| User works at Restaurant | M : N | RestaurantStaff |
| User has Addresses | 1 : M | UserAddress.user\_id |
| User may be a Rider / an Admin | 1 : 0..1 | unique user\_id on RiderProfile / PlatformAdmin |
| User places CheckoutGroups | 1 : M | CheckoutGroup.user\_id |
| CheckoutGroup contains Orders | 1 : M | Order.checkout\_id |
| Restaurant receives Orders | 1 : M | Order.restaurant\_id |
| Order contains Menu Items | M : N | OrderItem |
| Order has Status History and Payments | 1 : M, 1 : M | `order_status_histories.order_id`; `payments.order_id` (not unique in v3) |
| Order has Delivery | 1 : 0..1 | Delivery.order\_id unique |
| Rider performs Deliveries | 1 : M | Delivery.rider\_id |
| Rider is assigned to Zone and Shift | M : N : N | RiderShiftAssignment |
| Zone has capacity per Shift | M : N | ZoneShiftCapacity |
| Restaurant has Photos, Hours, Closures, Tables, Categories, Discounts, Applications | 1 : M | restaurant\_id on each |
| Restaurant has Reservation Settings | 1 : 1 | keyed by restaurant\_id |
| Restaurant serves Cuisines | M : N | RestaurantCuisine |
| Category contains Items; Item has Tags | 1 : M; M : N | category\_id; MenuItemDietaryTag |
| User has one reusable Cart per restaurant; Cart contains Items | 1 : M; 1 : M | Unique `(user_id,restaurant_id)`; reuse row and clear items on expiry/checkout |
| Table holds Reservations; User makes Reservations | 1 : M each | table\_id, user\_id |
| Discount is redeemed in Orders | M : N, at most one per order | DiscountRedemption |
| Order has one Restaurant Review; Delivery has one Rider Review | 1 : 0..1 | unique order\_id, delivery\_id |
| User favorites Restaurants and Items | M : N | favorite tables |
| Location is parent of Location; Address, Restaurant, Zone refer to a Location | 1 : M | PsgcLocation.parent\_code, psgc\_code |

**Drawing the Chen ERD (draw.io):** rectangles for entities, ovals for attributes, diamonds for relationships, a double oval for multivalued attributes (cuisines, dietary tags), a dashed oval for derived attributes (age, line total, usage count), a composite oval for name and address, a double rectangle for weak entities (OrderItem, CartItem, OperatingHours, ClosureDate), 1, M, or N beside the lines, and a double line for total participation. Each diamond reads as a sentence, for example: USER 1 — places — M CHECKOUT GROUP; CHECKOUT GROUP 1 — contains — M ORDER; ORDER M — contains — N MENU ITEM (attributes on the diamond: quantity, unit price snapshot); RESTAURANT 1 — has — M TABLE 1 — is booked in — M RESERVATION; ORDER 1 — is fulfilled by — 0..1 DELIVERY M — is done by — 1 RIDER; ZONE M — has capacity for — N SHIFT; RIDER M — is assigned to — N ZONE. After the Chen ERD is approved, convert it into the relational tables above and draw a second diagram in MySQL Workbench.

## 21. Normalization

**Unnormalized example:** one order sheet with customer name and address, restaurant name and address, dish1/price1, dish2/price2, dish3/price3, discount code and percent. Problems: repeating groups, repeated customer and restaurant details, repeated discount percent.

**1NF (atomic values, no repeating groups):** name and address are split into parts; dishes become OrderItem rows; cuisines and dietary tags become junction rows; hours become rows per weekday and shift.

**2NF (no partial dependency on part of a composite key):** junction tables (RestaurantCuisine, MenuItemDietaryTag, ZoneShiftCapacity) carry only attributes that depend on the whole key. Association rows with data (OrderItem, CartItem) have their own key plus a unique pair.

**3NF (no transitive dependency):**

- Restaurant details live only in Restaurant. MenuItem has no restaurant\_id (item, category, restaurant), and Reservation has no restaurant\_id (reservation, table, restaurant).
- **`Order.user_id` is dropped.** Order belongs to a CheckoutGroup and the group belongs to the user, so the customer is found through the group. Keeping `user_id` on both would store one fact twice and allow a mismatch (an order showing one customer while its group shows another).
- Zone capacity is stored in ZoneShiftCapacity, not repeated on Zone; riders in a zone are counted from assignments.
- Age, usage count, table availability, rider totals, and the group grand total are calculated.
- **Intentional controlled copies:** OrderItem item name and unit price, Order fee and total snapshots, and the delivery address text. They record historical facts, are written once at order creation, and are never updated.

| Anomaly | Unnormalized design | SALO design |
| --- | --- | --- |
| Update | Changing a restaurant phone edits every order row | One edit in Restaurant |
| Insert | A restaurant or dish cannot exist until an order uses it | Restaurants, categories, and items exist independently |
| Delete | Deleting the only order for a dish removes the dish's details | Orders and menu are separate; items are archived, not deleted |
| Inconsistency | An item whose restaurant differs from its category's restaurant | Restaurant is derived only through the category |

## 22. Data integrity

- **Entity integrity:** every primary key is unique and not null.
- **Referential integrity:** foreign keys must reference existing rows; deletes are restricted where v3 defines them. Preserve history-bearing records; use soft deletion only on tables with a v3 `deleted_at` column.
- **Domain integrity:** price above 0; quantity above 0; capacity above 0; guests at least 1; discount percent between 1 and 100; rating between 1 and 5; coordinates inside the Philippines; enumerated statuses; unique email, table number per restaurant, category name per restaurant, one cart per user and restaurant.
- **Business integrity:** sold-out food cannot be ordered; a table cannot be double-booked; expired or exhausted discounts cannot be used; a restaurant cannot be managed by non-members; a suspended restaurant cannot receive orders; a business-mode user cannot order; nobody orders from their own restaurant; a zone cannot exceed its capacity.

Checks that need several tables live in the service layer and transactions, and simple ones also become database constraints.

## 23. Transactions and concurrency

| Operation | Steps inside one transaction | Concurrency protection |
| --- | --- | --- |
| Place a checkout group | Validate every order, lock and reduce stock, create the group, orders, items, status history, payment record, and discount redemptions | Idempotency key on the group; lock stock rows; all-or-nothing |
| Create a reservation | Lock the table row, check overlap, check hours, create the reservation | Row lock so only one booking wins |
| Assign a rider | Lock the rider row, check no active delivery, create the delivery and offer | Row lock prevents two orders on one rider |
| Assign riders to zones | Count assignments, assign or waitlist | Lock the zone-shift row so capacity is never exceeded |
| Complete a delivery | Save proof, set Delivered, record earning and cash | Single writer per delivery |
| Cancel or reject an order | Set status, return stock, release the discount, withdraw the offer | Status check inside the transaction |
| Approve an application | Set status and create the membership or rider profile, and send the OTP | Atomic so no half-approved state exists |

Failures of external services (email, maps, routing) never leave partial records; the operation fails cleanly or retries.

## 24. Account, restaurant, and rider deactivation

| Approach | Meaning | Fit for SALO |
| --- | --- | --- |
| Hard delete | Removes the row and related data | Not used; it would destroy orders, reservations, reviews, and reports |
| **Soft delete or deactivation** | Row stays, status becomes inactive | Used where v3 provides status/`deleted_at`; not every table has a soft-delete column |

- **Customer deactivation:** settings, confirm password, show consequences, status Deactivated. Order and reservation history stays; personal data is anonymized after the retention period.
- **Owner deactivation:** if another active Owner remains, do not automatically deactivate the restaurant solely because one Owner deactivates. If deactivation would leave no active Owner, the behavior is **[VERIFY]**; an Owner cannot transfer ownership, and an additional Owner must be added through the approved schema-backed flow first.
- An Owner may reactivate a restaurant they deactivated (Inactive) from Business Settings; it returns to Approved and remains unpublished until the Owner publishes it again. A restaurant suspended by Admin is reinstated only by Admin.
- **Restaurant deletion:** an owner cannot hard-delete a restaurant. The owner can close or deactivate it; only the status changes.
- **Staff removal:** membership becomes Removed and access ends on the next request.
- **Rider resign:** allowed with no active delivery and settled cash; status Resigned; capacity is freed; history stays.
- **Admin removal/moderation:** never hard-delete order/payment history. Use v3 `deleted_at` only where present; use `restaurant_reviews.is_hidden` for review moderation and valid order statuses for order resolution. Every action is audited.

## 25. Security and validation

- Password hashing, Sanctum cookie authentication with CORS and CSRF configured, matching dev hostnames, and rate limits on login and OTP.
- Role and membership checks through Policies on every endpoint; least privilege; restaurant data isolation.
- Form Requests validate every write on the backend; the frontend validates only for friendliness.
- Prepared statements through the ORM; mass-assignment protection; no raw queries.
- Uploads: type, size, and real MIME checks; EXIF removed; server-generated names; private files served only through authorized signed URLs; public and private disks separated.
- Secrets and API keys only in the backend `.env`, never in React or VITE\_ variables.
- Rider live location in cache with a short expiry; visible only to those involved in that order.
- Standard JSON error envelope; no stack traces in responses; audit log for sensitive actions.
- Frontend route guards are only for user experience; the backend is the real enforcement.

## 26. Data flow and reports

**Ordering:** Customer, Restaurants and Menu, Cart, Checkout Group, Orders, Database, Restaurant staff, Order Status, Customer.

**Delivery:** Order Ready, Dispatch (nearest eligible rider), Rider acknowledges, Pickup, Navigation, Delivered with proof photo, Customer confirms receipt, Completed, Rating.

**Reservation:** Customer, Restaurant, Table Availability, Reservation, Database, Reservation Manager, Status, Customer.

**Restaurant application:** User, Application and Documents, Database, Admin, Approval or Rejection, Restaurant, Owner publishes.

**Rider application:** User, Application and Documents, Admin, Approval, Zone and Shift assignment, Email OTP, Rider side active.

| Role | MVP reports | Optional |
| --- | --- | --- |
| Customer | Order history, reservation history, current orders and reservations | Spending summary |
| Owner and Manager | Today's orders, pending and completed orders, today's reservations, sold-out items, discount usage, sales summary, popular items | Peak hours, review summary |
| Reservation Manager | Today's and upcoming reservations, table usage | No-show rate |
| Rider | Earnings by day, week, and total; deliveries; cash to remit | Ratings summary |
| Admin | Users, restaurants by status, applications, platform orders and reservations, sales, riders per zone versus capacity, cancellation rate | Trends, exports to PDF |

## 27. Edge cases

| Case | Expected behavior | Rule |
| --- | --- | --- |
| Two customers book the same table | The table row is locked; the first wins, the second sees other times | V3, T. 23 |
| Item sells out during checkout | Group placement fails, nothing is created, the customer sees which restaurant and item | O12, M4 |
| Menu price changes | Orders keep their snapshot; the cart shows the change before placing | O9, C3 |
| Discount expires or runs out during checkout | Validated again inside the transaction; the customer is told | D2, D6 |
| Customer cancels | Allowed only while Placed; stock and discount released | O7 |
| Restaurant cancels | Reason required; same releases; reported if repeated | 15.4 |
| Customer does not show for a reservation | Marked No Show after the grace period; table released | V7 |
| Restaurant closes or is suspended | No new orders or reservations; existing ones are resolved or cancelled with notice | R3, S7 |
| Table goes to maintenance | Future bookings flagged to the restaurant | V6 |
| Staff of one restaurant tries to open another | Denied by Policy and logged | S3 |
| Owner deactivates their account | Restaurants become Inactive; history kept | Section 24 |
| Order from an inactive restaurant, or a reservation outside hours | Rejected with a clear message | R3, V4 |
| Business-mode user tries to order | Blocked; prompt to switch to Customer mode | U11 |
| User orders from their own restaurant | Blocked | U12 |
| Zone is full when a rider is approved | Next nearest zone, otherwise the waitlist | Z2 |
| No rider available | Widen to neighboring zone; then notify restaurant, customer, and admin | 7.3 |
| Rider does not acknowledge in 60 seconds | Offer goes to the next rider | L2 |
| Rider goes offline mid-delivery | Order returns to dispatch | L6 |
| Customer says the order was not received | Support ticket; admin reviews the proof photo | O15 |
| Customer never answers receipt confirmation | Auto-confirmed after 24 hours | O15 |
| GPS or camera permission denied | Manual address entry; camera upload fallback; clear message | G2, L4 |
| Pin outside the Philippines or beyond delivery radius | Rejected with a clear message | G1, O3 |
| Delivery pin not set | Fee not shown; checkout blocked | F4 |

## 28. MVP scope and readiness gates

| Priority | Features |
| --- | --- |
| Must have | Accounts and OTP, modes and permissions, admin panel with graphs, applications, reports, history, settings, zones, restaurant page editor with photos, hierarchy and staff, menu, orders, tables and reservations, discounts, customer browse, location, cart and multi-restaurant checkout, tracking with map, receipt confirmation, ratings, COD and pay-at-pick-up, driver application, automatic dispatch, camera proof, earnings |
| Should have | Calendar views, CSV export, favorites, support tickets, notifications by email, resign flow |
| Could have | PDF exports, review replies, spending summaries |
| Future | Online payment in test mode, Google sign-in, priority delivery surcharge, loyalty, multi-branch brands, inventory, kitchen display, WebSockets, advanced analytics |

**Readiness gates before database and backend code:**

1. Instructor approval of Laravel and the deliverables list.
2. Business rules and CRUD matrix reviewed and signed off.
3. Chen ERD and relational tables approved, with the data dictionary.
4. Normalization and integrity checked.
5. API contract written before controllers.
6. Only then migrations, seeders, and backend code.

## 29. Open decisions and items to verify

**Open decisions \[PROPOSED defaults shown\]:**

- Priority delivery surcharge moved to Future to keep the scope small (scheduled orders stay optional).
- A platform discount in a group applies to one order the customer chooses.
- An approved rider may also later add a restaurant; modes keep the roles separate.
- Rider share 80%, commission 15%, retention periods, and the other numbers in Section 16 are starting values.
- Staff may be Staff at one restaurant and Manager at another.

**\[VERIFY\] list:** Laravel approval by the instructor; Data Privacy Act obligations for storing IDs, addresses, and photos; current business and rider requirements of delivery platforms; OpenStreetMap tile and Nominatim usage policies; Geoapify and OpenRouteService free limits; PSGC API endpoints and the data import; Gmail SMTP or another mail service; PayMongo test mode; license and permission for any photo used on the site; MySQL version available at school.

Additional schema-dependent items: Owner membership/add-owner invitation in v3; rules for removing/deactivating an Owner without leaving a restaurant ownerless; Admin ownership changes; address `School` encoding and service-enforced default invariant; customer reschedule requests; account/document retention; and nullable v3 fields required by delivery/order flows.
