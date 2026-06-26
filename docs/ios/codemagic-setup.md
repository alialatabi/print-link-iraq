# iOS build via Codemagic — runbook

The Matbaaty app is a **Capacitor** wrapper around the Vite/React web build. iOS apps can only be
compiled, signed, and submitted from **macOS + Xcode**, and this repo is developed on Windows — so
the Mac part runs on **Codemagic** (a cloud macOS CI). No Mac hardware required.

The iOS native project (`ios/`) is **not committed**. It cannot be generated on Windows, so
Codemagic regenerates it from `capacitor.config.ts` on every build and applies all native tweaks
via `scripts/ios-configure.sh`. Config lives in [`codemagic.yaml`](../../codemagic.yaml).

There are two workflows:

| Workflow | Needs Apple account? | Output | Use it to… |
|---|---|---|---|
| `ios-unsigned` | ❌ No | `App.app` (unsigned) | Prove the app compiles end-to-end |
| `ios-testflight` | ✅ Yes | signed `.ipa` → TestFlight | Ship a testable build to your phone |

---

## Phase 1 — Validate the pipeline (no Apple account needed)

1. Create a free account at **codemagic.io** and sign in with the GitHub account that owns
   `alialatabi/print-link-iraq`.
2. **Add application** → pick the `print-link-iraq` repo. Codemagic auto-detects `codemagic.yaml`.
3. Make sure `codemagic.yaml` is pushed to GitHub (`git push origin <branch>`).
4. Start a build → select workflow **`iOS – build (unsigned, pipeline check)`**.
5. Watch it run: `npm ci` → `npm run build` → `cap add ios` → `cap sync ios` → icons → `xcodebuild`.
   A green build means the Capacitor → Xcode pipeline works. (The `.app` artifact is unsigned and
   can't be installed on a device — that's Phase 2.)

> First runs are slow (CocoaPods + first `cap add ios`). Budget ~10–15 min.

---

## Phase 2 — Signed build to TestFlight

### 2a. Apple Developer account
- Enroll in the **Apple Developer Program** ($99/yr) at developer.apple.com.

### 2b. Register the app
- **Certificates, Identifiers & Profiles → Identifiers → +** → App ID, bundle ID **`com.matbaaty.app`**
  (must match `capacitor.config.ts`). Enable the **Push Notifications** capability here if/when you do
  iOS push (see Phase 3).
- **App Store Connect → My Apps → +** → create the app with that bundle ID. Note its **numeric
  Apple ID** (App Store Connect → App → App Information → "Apple ID").

### 2c. App Store Connect API key (lets Codemagic sign + upload)
- **App Store Connect → Users and Access → Integrations → App Store Connect API → +**
  - Access: **App Manager**
  - Download the **`.p8`** key file (one-time download), and copy the **Issuer ID** and **Key ID**.

### 2d. Add the key to Codemagic
- Codemagic → **Teams → Integrations → Developer Portal → Connect** (or App settings → Code signing
  identities). Add the App Store Connect API key, and **name it exactly `matbaaty_asc`** — that name
  is referenced in `codemagic.yaml` (`integrations.app_store_connect: matbaaty_asc`).

### 2e. Fill in the numeric app id
- In `codemagic.yaml`, set `APP_STORE_APPLE_ID` (under `ios-testflight → environment → vars`) to the
  numeric Apple ID from step 2b. Commit + push.

### 2f. Run it
- Start a build → workflow **`iOS – TestFlight (signed)`**. Codemagic fetches managed provisioning
  profiles (`xcode-project use-profiles`), bumps the build number, builds a signed `.ipa`, and
  uploads to **TestFlight**. Add yourself as an internal tester in App Store Connect to install via
  the **TestFlight** app on your iPhone.

---

## Phase 3 — iOS push notifications (follow-up, not in the first build)

Push is **not wired for iOS yet**, and it's not just config — there's a token-format mismatch:

- The backend (`send-push` edge function) sends via **FCM HTTP v1**, i.e. it needs **FCM
  registration tokens** (that's what Android's `@capacitor/push-notifications` returns).
- On **iOS**, `@capacitor/push-notifications` returns the raw **APNs** token, *not* an FCM token.
  Sending an APNs token to FCM won't deliver.

To make iOS push work you must add the **Firebase iOS SDK (FirebaseMessaging)** so the device
exchanges its APNs token for an FCM token, then store *that* in `device_tokens`. Concretely:

1. Apple side: create an **APNs Auth Key (.p8)** (Keys → +, enable Apple Push Notifications service)
   and upload it to **Firebase → Project settings → Cloud Messaging → Apple app configuration**
   (Firebase project `matbaty-32922`).
2. Add an **iOS app** to that Firebase project (bundle `com.matbaaty.app`) and download
   **`GoogleService-Info.plist`**. Provide it to CI as a Codemagic secure file / env var and have a
   build step drop it into `ios/App/App/` (do **not** commit it).
3. Integrate FirebaseMessaging (e.g. the `@capacitor-firebase/messaging` plugin) and switch the iOS
   registration path to return the FCM token.
4. Add the **Push Notifications** + **Background Modes → Remote notifications** capabilities (extend
   `scripts/ios-configure.sh` to write the entitlement + `UIBackgroundModes`).

Until then, the iOS app builds and runs fully — only push is deferred.

---

## Notes
- **Instance type:** `mac_mini_m2`. If your plan's free minutes are tied to a specific instance,
  adjust `instance_type` in `codemagic.yaml`.
- **Env vars:** the web build reads `VITE_SUPABASE_*` from the committed `.env` (anon/publishable
  values, safe to ship), so nothing extra is needed in Codemagic for the web layer.
- **Re-running after web changes:** just push — Codemagic rebuilds the web bundle and re-syncs iOS.
- **App icon / splash:** generated from `assets/` by `npx capacitor-assets generate --ios` during the
  build (same sources as Android).
