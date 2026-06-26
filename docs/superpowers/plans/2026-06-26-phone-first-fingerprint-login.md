# Phone-first Fingerprint Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make customer login phone-first — after a registered number is entered, auto-prompt the device fingerprint instead of the PIN; remove the standalone fingerprint button from the login page; and make admin account deletion wipe every trace of the customer (including the phone-keyed rows the FK cascade misses).

**Architecture:** Pure UI rewire of `src/pages/auth/AuthPage.tsx` (the phone-first routing in `send-otp` already exists and is unchanged) plus a small server-side addition to the `admin-delete-user` edge function. Biometric remains native-only via the existing `src/lib/biometric.ts` helpers; on web everything is a no-op and the PIN flow is untouched.

**Tech Stack:** React + TypeScript (Vite), framer-motion (`m as motion`), lucide-react icons, Capacitor (`@capacitor/preferences`, `@aparajita/capacitor-biometric-auth`), Supabase Edge Functions (Deno), supabase-js.

## Global Constraints

- **Verification gate:** lint and `tsc` are RED at baseline in this repo — DO NOT use them to judge success. Verify via `npm run build` and `npm test` (`vitest run`), plus the manual device steps in each task. (Copied from the project's verification-gate note.)
- **Biometric is native-only:** every `biometric.ts` helper is a no-op when `!isNativeApp`. Web behaviour (PIN flow) must remain byte-identical — guard all new biometric UI behind the already-computed `bioForPhone` state, which is only ever true on native.
- **No new test infrastructure:** the repo's tests are pure-logic `src/lib/*.test.ts` files; there is no React-component or Deno test harness. Do not add one for this change. The regression gate is "all existing tests still pass + build succeeds".
- **Arabic UI copy**, RTL. Icons already imported in `AuthPage.tsx`: `Fingerprint`, `ArrowRight`, `Loader2`, `KeyRound`, `Phone`, etc.
- **Phone normalization** (server + client): `phone.replace(/\s+/g, '').replace(/^0/, '964')`. Stored `profiles.phone`, `otp_codes.phone`, `phone_throttle.phone` are all the normalized form (e.g. `9647…`).

---

### Task 1: Remove the broken standalone fingerprint button (fixes the build break)

The phone step renders `{bioReady && ( … )}`, but `bioReady` is never declared. `vite build` (esbuild, no identifier resolution) does NOT catch this — it passes — but at runtime the phone step throws `bioReady is not defined`, crashing the login page (and `tsc` would error, though `tsc` is red at baseline here). This block is also the "fingerprint button on the login page" the spec says to remove (requirement 4).

**Files:**
- Modify: `src/pages/auth/AuthPage.tsx` (the `bioReady` block, currently lines ~228–237, inside `step === 'phone'`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new. After this task the phone step is just the phone `<form>` + the privacy-policy line.

- [ ] **Step 1: Confirm the undeclared `bioReady` reference exists**

Run: `grep -n "bioReady" src/pages/auth/AuthPage.tsx`
Expected: exactly one match, on the `{bioReady && (` line inside the `step === 'phone'` block. `bioReady` is never declared (no `useState`/`const` for it) — so it throws at runtime when the phone step renders. (`npm run build` passes regardless — esbuild doesn't resolve identifiers — so build is not the signal here.)

- [ ] **Step 2: Delete the broken block**

In `src/pages/auth/AuthPage.tsx`, inside the `step === 'phone'` motion block, remove the entire fragment that starts with `{bioReady && (` and ends with its closing `)}` — i.e. the "أو" divider and the "تسجيل الدخول بالبصمة" outline button:

```tsx
{bioReady && (
  <>
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> أو <span className="h-px flex-1 bg-border" />
    </div>
    <Button onClick={handleBiometric} variant="outline" size="lg" disabled={submitting} className="w-full h-12 gap-2 rounded-xl">
      <Fingerprint className="w-5 h-5 text-primary" /> تسجيل الدخول بالبصمة
    </Button>
  </>
)}
```

Leave the `<form>` above it and the privacy-policy `<p>` below it in place.

- [ ] **Step 3: Verify `bioReady` is gone and the build still succeeds**

Run: `grep -n "bioReady" src/pages/auth/AuthPage.tsx`
Expected: no matches.

Run: `npm run build`
Expected: PASS. (`Fingerprint` is still imported and used in Task 2, so the import stays.)

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: PASS — all existing `src/lib/*.test.ts` suites green (no behaviour change).

- [ ] **Step 5: Commit**

```bash
git add src/pages/auth/AuthPage.tsx
git commit -m "fix(auth): remove broken standalone fingerprint button from login page"
```

---

### Task 2: Auto-prompt fingerprint on the code step for enrolled numbers

When a registered number that is fingerprint-enrolled on this device is entered, `submitPhone` already sets `bioForPhone = true` and `showCodeEntry = false` for `route === 'code'`. This task makes the code step render a fingerprint sub-screen (auto-prompting the OS dialog once) instead of the PIN, with a "use the code" fallback (requirement 1).

**Files:**
- Modify: `src/pages/auth/AuthPage.tsx` — import (`useRef`), a `bioStep` derived flag, the header text/icon, `handleBiometric`, a new auto-prompt `useEffect`, and the `step === 'code'` render branch.

**Interfaces:**
- Consumes from Task 1: the cleaned phone step (no `bioReady`).
- Consumes existing state (already declared, do not re-add): `bioForPhone` / `setBioForPhone`, `showCodeEntry` / `setShowCodeEntry`, `submitting`, `phone`, `pin` / `setPin`.
- Consumes existing helpers: `biometricRetrieve()`, `disableBiometric()` (from `@/lib/biometric`), `phoneLogin(phone, pin)` (from `useAuth`).
- Produces: a derived `const bioStep = step === 'code' && bioForPhone && !showCodeEntry;` used by the header and render branch, and a one-shot auto-prompt effect.

- [ ] **Step 1: Add the `useRef` import**

Change line 1 of `src/pages/auth/AuthPage.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 2: Replace `handleBiometric` so cancel ≠ failure**

Replace the existing `handleBiometric` (currently lines ~157–177) with:

```tsx
  const handleBiometric = async () => {
    setSubmitting(true);
    const cred = await biometricRetrieve();
    if (!cred) {
      // User cancelled / dismissed the OS dialog — stay on the fingerprint screen
      // so they can retry or switch to the code. No error toast, no auto-loop.
      setSubmitting(false);
      return;
    }
    const { error } = await phoneLogin(cred.phone, cred.pin);
    setSubmitting(false);
    if (error) {
      // The stored login no longer works (e.g. the account was deleted) → drop the
      // biometric credentials and fall back to the PIN.
      await disableBiometric();
      setBioForPhone(false);
      setShowCodeEntry(true);
      toast({ title: 'تعذّر تسجيل الدخول بالبصمة', description: 'سجّل الدخول بالرمز', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تسجيل الدخول بنجاح!' });
    navigate(redirectTo);
  };
```

- [ ] **Step 3: Add the one-shot auto-prompt effect (immediately AFTER `handleBiometric`)**

```tsx
  // Auto-open the OS fingerprint dialog once when we land on the fingerprint sub-screen.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (step === 'code' && bioForPhone && !showCodeEntry) {
      if (!autoPromptedRef.current) {
        autoPromptedRef.current = true;
        handleBiometric();
      }
    } else {
      autoPromptedRef.current = false; // reset when leaving the sub-screen
    }
    // handleBiometric is stable for this screen's purposes; deps intentionally limited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bioForPhone, showCodeEntry]);
```

- [ ] **Step 4: Add the `bioStep` flag and update the header (icon + h1 + subtext)**

Just above the existing `const headerIcon =` line, add:

```tsx
  const bioStep = step === 'code' && bioForPhone && !showCodeEntry;
```

Change `headerIcon` so the fingerprint sub-screen gets a fingerprint icon — replace the existing `headerIcon` assignment with:

```tsx
  const headerIcon =
    bioStep ? <Fingerprint className="w-7 h-7 text-primary" />
    : step === 'phone' ? <TrendingUp className="w-7 h-7 text-primary" />
    : step === 'code' ? <KeyRound className="w-7 h-7 text-primary" />
    : step === 'setpin' ? <KeyRound className="w-7 h-7 text-primary" />
    : <Shield className="h-7 w-7 text-primary" />;
```

In the header `<h1>` (the `step === 'phone' ? … : step === 'code' ? 'أدخل رمزك' …` ternary), make the `code` arm depend on `bioStep`:

```tsx
              {step === 'phone' ? 'تسجيل الدخول'
                : step === 'code' ? (bioStep ? 'تسجيل الدخول بالبصمة' : 'أدخل رمزك')
                : step === 'otp' ? 'التحقق من الرقم'
                : (mode === 'recovery' ? 'تعيين رمز جديد' : 'أنشئ رمز الدخول')}
```

In the header `<p>` subtext ternary, make the `code` arm depend on `bioStep`:

```tsx
              {step === 'phone' ? 'أدخل رقم هاتفك للدخول إلى حسابك'
                : step === 'code' ? (bioStep ? 'ضع إصبعك على المستشعر لتسجيل الدخول' : 'أدخل رمزك المكوّن من 6 أرقام')
                : step === 'otp' ? 'أدخل رمز التحقق المُرسَل إلى هاتفك'
                : 'اختر رمزاً من 6 أرقام تستخدمه لتسجيل الدخول'}
```

- [ ] **Step 5: Split the `step === 'code'` render into fingerprint vs PIN**

Replace the body of the `step === 'code'` motion block (currently the single `<div className="mb-6"><PinInput …/></div>` + the actions `<div>`) with a `bioStep` branch:

```tsx
                {bioStep ? (
                  <div className="space-y-5 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      ضع إصبعك على المستشعر لتسجيل الدخول، أو استخدم رمزك.
                    </p>
                    <Button onClick={handleBiometric} disabled={submitting} size="lg" className="h-12 w-full text-base font-bold gap-2">
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Fingerprint className="h-5 w-5" /> تسجيل الدخول بالبصمة</>}
                    </Button>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep('phone'); setPin(''); }}>
                        <ArrowRight className="ml-1 h-4 w-4" /> تغيير الرقم
                      </Button>
                      <span className="h-4 w-px bg-border" aria-hidden />
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => { setShowCodeEntry(true); setPin(''); }}>
                        استخدم الرمز
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6"><PinInput value={pin} onChange={setPin} autoFocus /></div>
                    <div className="space-y-4">
                      <Button onClick={submitCode} disabled={pin.length < 6 || submitting} size="lg" className="h-12 w-full text-base font-bold">
                        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'دخول'}
                      </Button>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep('phone'); setPin(''); }}>
                          <ArrowRight className="ml-1 h-4 w-4" /> تغيير الرقم
                        </Button>
                        <span className="h-4 w-px bg-border" aria-hidden />
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => submitPhone(true)} disabled={submitting}>
                          نسيت الرمز؟
                        </Button>
                      </div>
                    </div>
                  </>
                )}
```

- [ ] **Step 6: Verify build + existing tests**

Run: `npm run build`
Expected: PASS.

Run: `npm test`
Expected: PASS — existing suites green; web PIN flow unchanged.

- [ ] **Step 7: Manual device verification (native build)**

Build/run the Android app (`npm run cap:android`, or rebuild+`adb install -r` per the project notes) and confirm:
1. **Enrolled number** → after *متابعة*, the OS fingerprint dialog opens automatically; a successful scan logs in and navigates to `redirectTo`.
2. **Cancel the dialog** → no error toast; the screen shows *"تسجيل الدخول بالبصمة"* (retry) and *"استخدم الرمز"*; tapping retry re-opens the dialog.
3. **"استخدم الرمز"** → switches to the 6-digit PIN entry; *دخول* works.
4. **Phone step has no fingerprint button** (only phone input + متابعة).
5. **Web (browser)** → enrolled state never triggers (native-only); PIN flow identical to before.

- [ ] **Step 8: Commit**

```bash
git add src/pages/auth/AuthPage.tsx
git commit -m "feat(auth): auto-prompt fingerprint on the code step for enrolled numbers"
```

---

### Task 3: Wipe phone-keyed rows on admin account deletion

`auth.admin.deleteUser` already cascades all user-id-owned tables. This task adds the two phone-keyed tables the cascade can't reach (`otp_codes`, `phone_throttle`) so deletion leaves no trace (requirement 3). The on-device fingerprint is unreachable from the server and self-clears via Task 2's `handleBiometric` failure path — no server action for it.

**Files:**
- Modify: `supabase/functions/admin-delete-user/index.ts`

**Interfaces:**
- Consumes: existing `supabaseAdmin` (service-role client), `userId`, and the existing guard checks (caller is admin; not self; not super-admin target; admin target requires super-admin caller).
- Produces: no new exports. Side effect: after `deleteUser`, rows in `otp_codes` and `phone_throttle` for the target's phone are removed.

- [ ] **Step 1: Include `phone` in the target profile lookup**

In `supabase/functions/admin-delete-user/index.ts`, the target inspection currently selects only `is_super_admin`:

```ts
      supabaseAdmin.from('profiles').select('is_super_admin').eq('user_id', userId).maybeSingle(),
```

Change it to also fetch the phone:

```ts
      supabaseAdmin.from('profiles').select('is_super_admin, phone').eq('user_id', userId).maybeSingle(),
```

- [ ] **Step 2: Purge the phone-keyed rows after a successful delete**

Replace the existing delete + success return:

```ts
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
```

with:

```ts
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    // Cascade (ON DELETE CASCADE) already removed every user-id-owned row (profile, orders,
    // designs, vault, addresses, device_tokens, reseller data). The phone-keyed OTP tables are
    // not reached by the cascade — purge them too so no trace of the customer remains.
    // Best-effort: the account is already gone, so a cleanup error must not fail the request.
    const targetPhone = targetProfile?.phone;
    if (targetPhone) {
      const [otpDel, throttleDel] = await Promise.all([
        supabaseAdmin.from('otp_codes').delete().eq('phone', targetPhone),
        supabaseAdmin.from('phone_throttle').delete().eq('phone', targetPhone),
      ]);
      if (otpDel.error) console.error('otp_codes cleanup failed:', otpDel.error.message);
      if (throttleDel.error) console.error('phone_throttle cleanup failed:', throttleDel.error.message);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
```

- [ ] **Step 3: Static review of the change**

Confirm by reading the file:
- `targetProfile` is the same destructured variable used by the super-admin guard (`targetProfile?.is_super_admin`), so `targetProfile?.phone` is in scope.
- The purge runs only after `deleteUser` succeeded (the `if (error) return` above it).
- Cleanup errors are logged, never thrown, and never change the `200 { success: true }` response.

- [ ] **Step 4: Deploy and boot-check the function**

Run: `supabase functions deploy admin-delete-user`
Expected: deploy succeeds. Then a boot/guard check — an unauthenticated call returns 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://<project-ref>.functions.supabase.co/admin-delete-user" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `401` (the auth guard runs before any deletion). (Use the project ref from `supabase/config.toml` / the dashboard.)

- [ ] **Step 5: Manual end-to-end check (staging / a throwaway customer)**

Create a throwaway customer (sign up with a spare number, set a PIN, place a trivial order), then delete it from the Admin → Customers UI and confirm:
1. The customer disappears from the list; their profile/orders are gone (cascade).
2. `select count(*) from otp_codes where phone = '<normalized phone>'` → `0`, and the same for `phone_throttle` (the purge worked).
3. On that customer's device, the next biometric attempt fails the `phone-login` and falls back to the PIN screen (Task 2's self-clear path) — credentials are cleared.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-delete-user/index.ts
git commit -m "feat(admin): purge phone-keyed OTP rows on customer deletion"
```

---

## Self-Review

**Spec coverage:**
- Requirement 1 (registered + enrolled → fingerprint instead of PIN): Task 2 (auto-prompt sub-screen on the code step, gated by `bioForPhone`). ✓
- Requirement 2 (not registered → new registration): no code needed — the existing `send-otp` `route: 'otp'` / `isNewUser` path already does this; documented in the spec and the plan's Architecture note. ✓
- Requirement 3 (admin delete wipes biometric + all customer data): Task 3 (cascade + phone-row purge) for data; the on-device biometric self-clears via Task 2's `handleBiometric` failure path. ✓
- Requirement 4 (no fingerprint button on the login page): Task 1 (removes the standalone button). ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code step shows full code. ✓

**Type/name consistency:** `bioStep`, `bioForPhone`/`setBioForPhone`, `showCodeEntry`/`setShowCodeEntry`, `autoPromptedRef`, `handleBiometric`, `targetProfile?.phone`, table names `otp_codes`/`phone_throttle` are used identically across tasks and match the actual source (`AuthPage.tsx`, `send-otp/index.ts`, `admin-delete-user/index.ts`). ✓

**TDD adaptation (deliberate):** the repo has only pure-logic `src/lib/*.test.ts` tests and no React-component or Deno harness; adding one for a native-only UI rewire + a Deno edge function is disproportionate. The gate is `npm run build` + `npm test` (regression) + the explicit manual device/staging steps in Tasks 2 and 3, consistent with the project's verification-gate note. ✓
