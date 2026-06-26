# Phone-first login with contextual fingerprint + complete account deletion

**Date:** 2026-06-26
**Status:** Approved (design)

## Problem

The customer login should be phone-first: the customer types their number, and

1. if the number is **already registered and has fingerprint enabled on this
   device**, the app shows fingerprint **instead of** the 6-digit PIN;
2. if the number is **not registered**, the customer is routed into new
   registration (OTP → set PIN);
3. when an **admin deletes a customer**, all of that customer's data is wiped
   (and the on-device fingerprint stops working);
4. the standalone **"login with fingerprint" button must not appear on the
   login page**.

The current `AuthPage.tsx` is also broken: it renders a fingerprint button on
the first screen gated on an **undeclared `bioReady` variable**, and the code
step never actually surfaces fingerprint even though it already computes
`bioForPhone`.

## Current state (verified)

- **Routing** lives in `supabase/functions/send-otp/index.ts`. It returns
  `{ route, isNewUser? }`:
  - `staff` — phone belongs to a designer/admin/reseller → `/staff-login`.
  - `code` — returning customer with `profiles.pin_set_at` set, not a recovery →
    PIN login, no SMS.
  - `otp` — new user, or an existing user without a PIN, or `force` (recovery) →
    OTP is sent. Carries `isNewUser`.
  - **Requirement 2 already works:** an unregistered number has no profile →
    `route: 'otp'`, `isNewUser: true` → OTP → set PIN = new registration.
- **Biometric** is implemented in `src/lib/biometric.ts` (native-only, via
  `@aparajita/capacitor-biometric-auth`). The customer's `phone` + 6-digit `pin`
  are stored in app-private Capacitor `Preferences` and gated by an OS biometric
  prompt on retrieval; `biometricRetrieve()` then performs a normal
  `phone-login`. Helpers: `biometricEnabledForPhone(phone)` (this number is
  enrolled on this device **and** hardware is available), `biometricRetrieve()`,
  `disableBiometric()`. The profile toggle (`ProfilePage.tsx`) enrolls/clears it.
- **`AuthPage.submitPhone`** already calls `biometricEnabledForPhone(phone)` for
  `route === 'code'` and sets `bioForPhone` / `showCodeEntry` — but the render
  never uses them, and the phone step has the broken `bioReady` button.
- **Account delete** (`supabase/functions/admin-delete-user/index.ts`) calls
  `auth.admin.deleteUser(userId)` after admin/super-admin guard checks. Every
  user-owned table references `auth.users(id) ON DELETE CASCADE` (profiles,
  user_roles, orders[customer_id], order_items, vault_designs,
  ai_design_generations, device_tokens, resellers + reseller pricing,
  addresses), so cascade already wipes them. Phone-keyed tables (`otp_codes`,
  `phone_throttle`) are **not** reached by the cascade.

## Design

### 1. `src/pages/auth/AuthPage.tsx` — UI rewire (web behaviour unchanged on non-native; biometric is native-only)

**Phone step:** delete the `{bioReady && ( … )}` block (the standalone
fingerprint button + its "أو" divider). This satisfies requirement 4 and fixes
the undeclared-variable build break. The first screen is phone input → *متابعة*
only.

**Code step:** branch on the already-computed state.

- `bioForPhone && !showCodeEntry` → **fingerprint sub-screen**:
  - Fingerprint icon, heading *"تسجيل الدخول بالبصمة"*, subtext
    *"ضع إصبعك على المستشعر"*.
  - A `useEffect` keyed on entering this state, **guarded by a `useRef`** so it
    fires exactly once per entry, auto-calls `handleBiometric()` → the OS dialog
    opens automatically (no on-screen button needed → still matches "no
    fingerprint button on the login page").
  - An *"إعادة المحاولة"* button to re-trigger `handleBiometric()` after a
    cancel.
  - A *"استخدم الرمز بدلاً من ذلك"* link → `setShowCodeEntry(true)` (falls back
    to PIN).
  - Keep *تغيير الرقم* (→ phone step).
- otherwise → the **existing PIN entry** (unchanged): `PinInput`, *دخول*,
  *تغيير الرقم*, *نسيت الرمز؟*.

**`handleBiometric` behaviour split:**
- `biometricRetrieve()` returns `null` (user cancelled / dismissed): stop the
  spinner and **stay on the fingerprint sub-screen** so they can retry or switch
  to the code. No destructive toast, no auto-loop.
- login error after retrieve (stored PIN no longer valid — e.g. the account was
  deleted): `disableBiometric()` + `setShowCodeEntry(true)` and a toast telling
  them to sign in with the code (current behaviour).
- success: toast + navigate to `redirectTo`.

No change to `submitPhone`, `submitCode`, `submitOtp`, `submitSetPin`, or to the
`otp` / `setpin` steps. Requirement 2 (new registration) is already satisfied by
the existing `route: 'otp'` path.

### 2. `supabase/functions/admin-delete-user/index.ts` — complete wipe

After the existing guard checks (caller is admin; not self; not a super admin;
admin targets require a super-admin caller):

1. Include `phone` in the `targetProfile` select so it's available.
2. `auth.admin.deleteUser(userId)` (unchanged) — FK cascade wipes all
   user-id-owned rows.
3. **Then** explicitly purge phone-keyed rows:
   `delete from otp_codes where phone = <target phone>` and
   `delete from phone_throttle where phone = <target phone>`. Best-effort: log
   errors, do not fail the response (the user is already deleted).

**Biometric note:** the fingerprint credentials live only in the deleted
customer's own device Preferences and are unreachable from the server — no
server action can remove them. The security goal still holds: the stored
phone+PIN can no longer authenticate (`phone-login` rejects the deleted
account), so there is no auth bypass; the credential is dead, single-user, and
app-private. It is not actively wiped at delete time, though — after deletion
the phone routes to new-registration (`route: 'otp'`), so the code-login
fingerprint path (and `disableBiometric()`) does not run. The stale credential
lingers until the *same* phone re-registers and a later biometric login fails,
at which point `AuthPage.handleBiometric` clears it. This residual, access-less
credential is an inherent limitation of device-local storage, not a data leak.

## Error handling

- Auto-prompt `useEffect` is ref-guarded — exactly one OS dialog per entry into
  the fingerprint sub-screen.
- Cancel is distinguished from failure: cancel keeps the fingerprint screen;
  only a real `phone-login` failure falls back to PIN + clears the credential.
- Delete: phone-row purge wrapped so its errors are logged but non-fatal.

## Testing

- `npm run build` and `npx vitest` (lint is red at baseline in this repo — verify
  via build + vitest, not lint).
- Manual device checks (native): enrolled number → auto-prompt → success; cancel
  → retry button works; *"استخدم الرمز"* → PIN entry; unregistered number →
  OTP → set PIN (registration).

## Out of scope

- No change to the profile enrol/disable toggle, `send-otp` routing, `set-pin`,
  `verify-otp`, or `phone-login`.
- No hardware-backed (Keystore/Keychain) secure storage upgrade for the stored
  PIN — tracked separately in `SECURITY_AUDIT.md`.
