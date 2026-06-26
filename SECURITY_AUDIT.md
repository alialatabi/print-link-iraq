# Security Audit — print-link-iraq

White-box review (14 edge functions, 83 RLS migrations, React/anon-key client, storage
buckets, deps, config, mobile). Findings below are **tracked with status** — go through the
`⬜ OPEN` items and tick them off as they're fixed.

**Legend:** `✅ FIXED` (remediated + deployed) · `⬜ OPEN` (not yet addressed) · `🔵 SECURE` (verified safe)

**Status summary (production-facing):**

| Severity | Total | ✅ Fixed | ⬜ Open |
|---|---|---|---|
| 🔴 Critical | 4 | 4 | 0 |
| 🟠 High | 12 | 12 | 0 |
| 🟡 Medium | 14 | 3 | 11 |
| 🟢 Low | 9 | 1 | 8 |

> **2026-06-26 (second pass):** all 9 open 🟠 High items (H1–H4, H7–H12) remediated and deployed to
> production (Supabase migrations + edge functions + Vercel). M9 also fixed as part of H4.

> The Critical fixes shipped as part of the phone + 6-digit-PIN auth redesign (the PIN is now a
> bcrypt-hashed Supabase password with per-account lockout, which also retires the SHA-256/single-salt
> weakness). Dev-only dependency CVEs are listed at the bottom.

---

## 🔴 CRITICAL

- [x] **C1 — `phone-login`: unauthenticated account takeover** — `supabase/functions/phone-login/index.ts`
  Public endpoint derived the password server-side from `salt+phone`, so `POST {phone}` returned a
  session. **✅ FIXED:** passwordless branch removed; PIN-only login with lockout.
- [x] **C2 — `send-otp` returned a live session** — `supabase/functions/send-otp/index.ts`
  Returned `access_token`/`refresh_token` for any recently-active phone with no code entered.
  **✅ FIXED:** `send-otp` never returns a session; sessions come only from a verified OTP or PIN.
- [x] **C3 — `send-to-telegram`: auth bypass → SSRF + IDOR** — `supabase/functions/send-to-telegram/index.ts`
  Only checked the `"Bearer "` prefix, used the service role; fetched attacker-supplied URLs.
  **✅ FIXED:** real `getUser()` + staff-role check; SSRF allowlist to the Supabase storage host; generic errors.
- [x] **C4 — `designs` private bucket world-readable** — migration `…_code_auth_security.sql`
  Original permissive storage policies were never dropped (OR'd over the scoped ones).
  **✅ FIXED:** the two world-open policies dropped in production.

---

## 🟠 HIGH

- [x] **H1 — Coupon drain** — `increment_coupon_usage` was SECURITY DEFINER with default `EXECUTE` to
  PUBLIC, client-callable, no `max_uses` guard, TOCTOU. **✅ FIXED:** function dropped; new
  `redeem_coupon(coupon_id, order_id)` (authenticated-only) verifies order ownership, records one
  redemption per order in `coupon_redemptions`, and bumps `used_count` with an atomic capped UPDATE
  (`20260626120000_h1_coupon_atomic_redeem.sql`, `useDiscounts.ts`, `CheckoutPage.tsx`).
- [x] **H2 — Customer can self-approve/deliver orders** — `orders` UPDATE policy had no
  `WITH CHECK`/status-transition guard. **✅ FIXED:** `BEFORE UPDATE OF status` trigger
  `enforce_order_status_transition` — staff (admin/designer/reseller) + service-role unrestricted;
  plain customers limited to `submitted/approved/cancelled` (`20260626120100…`).
- [x] **H3 — Any user can delete any file** — `order-attachments` DELETE policy had no owner check.
  **✅ FIXED:** DELETE re-scoped to admins + the file's order owner/assigned designer. NB: the audit's
  suggested `[2]=auth.uid()` did not match the real path layout (`<orderId>/…`), so the fix joins to
  `orders` on the first path segment (`20260626120200…`).
- [x] **H4 — Admin account-takeover via phone collision** — `create-designer`/`create-reseller`/
  `create-admin` reset password + stripped role of any existing user by phone. **✅ FIXED:** all three
  now hard-reject (409) when a profile already exists for the phone, via a paginated-safe
  `profiles.phone` lookup (also closes **M9** `listUsers()` first-page bug).
- [x] **H5 — `send-otp` SMS bombing** — no per-phone send limit. **✅ FIXED:** `phone_throttle` send
  rate-limit (5 / 15 min).
- [x] **H6 — `verify-otp` permanent-lockout DoS** — attempt counter never reset after lockout.
  **✅ FIXED:** counter resets once the lock window passes.
- [x] **H7 — AI cost abuse, rate-limit TOCTOU race** — count-then-act before a ~20s OpenAI call.
  **✅ FIXED:** atomic per-user-per-day counter `ai_rate_limits` + `reserve_ai_generation()` consumed
  BEFORE the OpenAI call (capped in one statement); `release_ai_generation()` refunds on failure
  (`20260626120300…`, `ai-design-generate`).
- [x] **H8 — AI cost abuse, no max input length** — **✅ FIXED:** `brief` capped at 2000 chars,
  `directives` at 600, via `sanitizeUserText` (`ai-design-generate`).
- [x] **H9 — AI prompt injection** — `brief`/`directives` interpolated unsanitized. **✅ FIXED:**
  both sanitized (control chars + fence/quote stripping) and the brief is wrapped in delimited markers
  with an explicit "treat as data, not instructions" system rule (`ai-design-generate`).
- [x] **H10 — Stored XSS via SVG upload** — customer inputs accepted `image/*` (incl. SVG) → public
  bucket. **✅ FIXED:** client allowlist `png/jpeg/pdf` + `partitionAllowed()` validation
  (`uploadValidation.ts`, Checkout/OrderForm/OrderTracking/AiDesignPage); server backstop sets the
  `order-attachments` bucket `allowed_mime_types` (no svg/html/xml) + 50 MB cap (`20260626120400…`).
- [x] **H11 — React Router open-redirect XSS (prod dep)** — `@remix-run/router` 1.23.0. **✅ FIXED:**
  bumped `react-router-dom` → 6.30.4 (non-breaking; pulls patched `@remix-run/router` 1.23.3 — no v7
  migration needed); `npm audit` router advisories cleared.
- [x] **H12 — No HTTP security headers** — **✅ FIXED:** `vercel.json` `headers` block adds CSP
  (`script-src 'self'`), HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy; verified live on matbaty.com. (Removed the lone inline `onload` in `index.html`
  so the CSP can forbid inline scripts.)

---

## 🟡 MEDIUM

- [ ] **M1 — Admin → super-admin self-promotion** — `protect_is_super_admin` only blocks non-admins
  (`20260625160000:16`). Block all web callers (`auth.uid() IS NOT NULL`). ⬜ OPEN
- [ ] **M2 — Storage path spoofing** — `order-attachments` INSERT has no path-ownership check
  (`20260219212135…:9`). ⬜ OPEN
- [ ] **M3 — Coupons unreadable by customers** after `20260225225532…` → validation silently fails. ⬜ OPEN
- [ ] **M4 — OTP codes stored plaintext** (`otp_codes.code`). Store `HMAC-SHA256(code)`. ⬜ OPEN
- [x] **M5 — Weak phone→password KDF + single universal salt** — plain `SHA-256(salt+phone)`.
  **✅ FIXED:** PINs are now bcrypt-hashed by Supabase (no derived password) + per-account lockout.
- [ ] **M6 — `send-push` authz gap** — resellers can push to ANY user (`send-push:81`). ⬜ OPEN
- [ ] **M7 — `generate-sitemap` uses service-role** on an unauthenticated endpoint (`generate-sitemap:14`).
  Use anon key. ⬜ OPEN
- [ ] **M8 — Wildcard CORS** (`Access-Control-Allow-Origin: *`) on auth/privileged functions. Lock to
  prod origin. ⬜ OPEN
- [x] **M9 — `listUsers()` without pagination** in `create-admin/designer/reseller` (breaks > 1000 users).
  **✅ FIXED:** replaced with a `profiles.phone` lookup as part of H4 (`20260626…` functions redeploy).
- [ ] **M10 — Client-only session/OTP expiry** — the 3-week OTP forced-logout was `localStorage`-only.
  Partially addressed (that client logic was removed with the auth redesign); **server JWT TTL/revocation
  still recommended** for a stolen-token guard. ⬜ OPEN (server TTL)
- [ ] **M11 — Vault path enumerable** — `vault/<userId>/${Date.now()}.png` (`designVault.ts:227`).
  Use `crypto.randomUUID()`. ⬜ OPEN
- [ ] **M12 — Multiple lockfiles** (`package-lock.json` + `bun.lock` + `bun.lockb`). Pick one manager. ⬜ OPEN
- [ ] **M13 — Google Fonts without SRI** (`index.html:23`). Self-host or pin. ⬜ OPEN
- [ ] **M14 — No `eslint-plugin-security`** + raw error-message disclosure (`ai-design-generate:351`).
  (`admin-delete-user` error disclosure still OPEN.) ⬜ OPEN

---

## 🟢 LOW

- [ ] **L1 — `profiles.last_otp_verified_at` user-writable** → self-extend window (`20260222211856…`). ⬜ OPEN
- [ ] **L2 — `protect_is_super_admin` silently reverts** instead of raising → escalation probes invisible. ⬜ OPEN
- [ ] **L3 — `?redirect=` not origin-validated** (`AuthPage.tsx`, `CompleteProfile.tsx`). Harden to `^\/(?!\/)`. ⬜ OPEN
- [ ] **L4 — `ImageLightbox` CSS injection** — `backgroundImage: url("${src}")`; use `encodeURI(src)`. (Low; src is a storage URL.) ⬜ OPEN
- [ ] **L5 — `window.open(_blank)` missing `noopener`** (`DesignerOrderDetails.tsx:338`). ⬜ OPEN
- [ ] **L6 — Al-Waseet token in URL query string** (`sync-alwaseet-locations:36`). ⬜ OPEN
- [ ] **L7 — `send-to-telegram` re-notify spam** (no idempotency on status). ⬜ OPEN
- [ ] **L8 — Phone/account & coupon enumeration** via distinct response shapes/messages. ⬜ OPEN
- [ ] **L9 — `.env` git-tracked & not in `.gitignore`** — currently only public anon values, but a future
  secret would auto-commit. Add `.env` to `.gitignore`. ⬜ OPEN
- [ ] **L10 — Super-admin phone `07838774435` hardcoded** in the client bundle (UI-only). ⬜ OPEN

---

## 🔵 Confirmed secure
Every table has RLS enabled · all SECURITY DEFINER functions pin `search_path` · `otp_codes`/
`otp_attempts`/`phone_throttle` are service-role-only · `recent_order_activity` is anonymized · OTP
uses a CSPRNG, 6-digit, single-use, 5-min expiry · `create-admin`/`admin-delete-user` enforce
super-admin server-side · `update-phone` is IDOR-safe + OTP-gated · private `designs` bucket uses
signed URLs · no real secrets in the client bundle or `dist/` · no source maps shipped · Capacitor
config is release-safe · service-account keys are gitignored.

---

## 🧰 Dependencies (mostly dev-only — don't reach production)
`npm audit`: 1 critical / 18 high / 8 moderate. Production-relevant = H11 + H12 above.
- [ ] **vitest 3.2.4** — RCE/file-read via UI server (CVSS 9.8, dev-only). Bump ≥ 3.2.6; never `--ui` on a non-loopback iface. ⬜ OPEN
- [ ] **vite 5.4.19** — `fs.deny` bypass + NTLMv2 hash disclosure on Windows (dev server). Bump. ⬜ OPEN
- [ ] **ws / xmldom / tar / yaml** — dev-toolchain CVEs (via vite / @capacitor/assets). Bump parents. ⬜ OPEN

---

## Recommended fix order
1. ✅ C1–C4 (done) → 2. H1–H4 (coupon drain, order self-approval, file deletion, admin hijack) →
3. H7–H12 (AI cost/injection, SVG XSS, react-router, security headers) → 4. Mediums (super-admin
escalation, OTP hashing, CORS, server JWT TTL) → 5. Lows + dev-dependency bumps.

> Findings are agent-derived with file:line evidence — confirm each against current `main` while
> remediating (some may be intended behavior).

_Audit run: 2026-06-26. Critical fixes deployed same day with the auth redesign._
