# SALO Privacy and Security Requirements

**Status:** Phase A requirements only; not a legal opinion, security certification, or implementation.

## Sensitive data and access classification

| Data | Classification | Access rule |
|---|---|---|
| Password hashes, reset tokens, session and invitation tokens | Restricted security secret | Never serialize or log; hash tokens at rest; use secure session cookies and single-use expiring reset/invitation tokens |
| Customer phone, exact delivery address, rider note | Personal / operationally sensitive | Customer and authorized participants only; job board must not expose; restaurant access only for its relevant transaction |
| Driver coordinates | Sensitive location data | Only assigned driver, owning customer, authorized staff for the active related order, and audited admin access; latest point only, short cache TTL, no history |
| Driver/restaurant applications and identity documents | Highly sensitive personal/business information | Private storage; applicant and specifically authorized reviewers; short-lived access URL; never public discovery/download |
| Restaurant menu, public profile, public contact details | Public only after approval | Approved active restaurant data only; private owner/business fields excluded |
| Orders, reservations, payment/cash/remittance details | Confidential transaction data | Customer ownership, restaurant permission and relevant delivery assignment enforced; admin access logged |
| Audit records | Confidential | Least-privilege access; minimize payload and retain only under approved schedule |

## Authentication and authorization controls

- Use Sanctum stateful SPA cookies for the first-party browser client; no browser bearer-token storage. Require CSRF protection on state-changing requests, HTTPS in production, secure/HttpOnly/SameSite cookie settings appropriate to the approved deployment domains, and explicit credentialed CORS origins.
- Apply authentication, status checks, and route-level policy at every request. Never treat hidden navigation or client-supplied role/capability values as authorization.
- Registration assigns customer capability server-side. Driver/admin capabilities and restaurant memberships can only be granted through approved workflows.
- Use a single `PermissionMap` for role grants and apply membership state and permission checks to each nested restaurant request. Re-check ownership/assignment after loading the resource.
- Login, password reset, email verification, invitations, application submissions, and upload endpoints require per-IP and per-account throttling appropriate to the threat model [VERIFY]. Password reset and registration responses must not enable account enumeration.
- Password reset and invitation credentials must be random, single-use, time-limited, securely stored, and invalidated after use or revocation.
- Re-authentication/step-up verification for sensitive account, payout, security, and business identity changes is [VERIFY] policy.

## Validation and application security

- Use FormRequests for shape/range/format validation and policies for object authorization. Use allowlisted editable fields; prohibit mass assignment of status, owner, role, capability, price totals, reviewer, and audit values unless the specific workflow authorizes them.
- Enforce safe API error envelopes, stable status codes, output resources, and no raw exception/provider payload. Avoid success-shaped fallbacks.
- Protect checkout, job claim, reservation creation, invitation acceptance, and discount usage with atomic repository operations. Idempotency must be scoped to authenticated user and normalized request.
- Use parameterized repository operations in future adapters; do not construct SQL from request values. Rate-limit resource enumeration and search.
- Log security-relevant decisions and state transitions with actor, target, time, reason, and correlation ID; redact credentials, full request bodies, uploaded content, private addresses, and location coordinates unless expressly required for incident response.

## File upload and document security

- Accept only explicitly approved upload purposes. Verify file extension, declared MIME, file signature, size, and resource authorization server-side; do not trust browser metadata.
- Store private documents outside public web roots or in a private object bucket. Generate randomized storage names. Scan for malware where supported and quarantine on failure.
- Serve private documents only through authorization-checked, short-lived URLs. Prevent path traversal, public bucket access, content-sniffing, and inline rendering of unsafe formats.
- Track resource association and review state; clean up abandoned uploads based on a confirmed retention schedule. Replacing an upload must not silently erase material needed for an open review or legal hold.

## Delivery location and map providers

- Keep driver location ephemeral: retain only the last point in a short-lived cache value, overwrite on each accepted ping, and delete/expire after completion or cancellation. Never persist location history.
- Collect location only for an active assigned job and only at an approved interval; stop collection when no longer needed. Explain the purpose and request device permission only when required.
- Check authorization on every polling request. Do not rely on obscurity of job IDs. Apply freshness thresholds and avoid returning stale coordinates as current.
- Address/coordinate fields may be sent to a third-party location provider. Disclose this transfer, send only the minimum fields required, and never send SALO user IDs. Keep all provider calls behind the backend and keys in `backend/.env`; never expose or hard-code them.
- Evaluate Geoapify first for PH-limited street/landmark autocomplete, with Photon and LocationIQ as alternatives. For each, verify free-tier limits, terms/attribution, geographic coverage, retention/processing location, and privacy impact [VERIFY]. Do not use any provider for type-ahead unless its terms allow it.
- Nominatim is permitted only for a single reverse-geocoding lookup, never autocomplete. Verify terms/attribution/privacy [VERIFY]; use a custom User-Agent, at most one request per second per application, caching, and timeout.
- [VERIFY] OSM tile-service terms/capacity and visible attribution; [VERIFY] OpenRouteService key handling, plan quotas, commercial-use terms, route profile/ETA behavior, attribution, and fallback; [VERIFY] PSGC upstream availability/terms and operational caching. Re-check provider choices and deployment before release.

## Privacy governance and retention

- Apply data minimization, purpose limitation, access logging, deletion/retention schedules, and documented handling for access/correction/deletion requests.
- Define retention separately for accounts, applications and supporting documents, completed orders/reservations, audit events, uploaded files, and ephemeral location. Do not invent a retention period in code or documents before approval.
- Assess consent/legal basis, privacy notices, data-subject rights, processor/vendor contracts, cross-border transfer, breach detection/reporting, and a Data Privacy Impact Assessment with qualified privacy/legal counsel.
- **[VERIFY]** The impact of the Philippine Data Privacy Act and its implementing requirements on SALO's roles, notices, lawful basis, retention, location collection, incident reporting, and vendor processing must be reviewed by qualified counsel/privacy personnel. This document is not legal advice.
- Document access to sensitive identity documents and privileged admin access. Review admin-access scope and retention regularly.

## Deployment and operations decisions

- **[VERIFY]** Exact local/dev/prod SPA hostnames and ports for Sanctum stateful domains, CORS allowlist, cookie domain/SameSite/Secure settings, and HTTPS termination.
- **[VERIFY]** Secret storage/rotation, backup encryption, restore testing, key access, and production log retention.
- **[VERIFY]** Rate-limit values, upload size/type allowlists, malware scanning service, cache TTLs, tracking polling/ping interval, and incident-response ownership.
- **[VERIFY]** Application and business sensitive-field edits that trigger reapproval, and which actions require step-up authentication.
