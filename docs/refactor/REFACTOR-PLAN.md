# Whole-Project Refactoring Plan — `print-link-iraq`

## Context

`print-link-iraq` (Matbaaty / matbaty.com) is a React + TypeScript + Vite SPA — an Arabic/RTL printing-services platform for Iraq — also shipped as a Capacitor 8 Android app, backed by Supabase (Postgres + 15 Deno edge functions). It has grown feature-first over many sessions (auth/OTP/biometric, AI design, design vault, reseller/designer/admin panels, Al-Waseet locations, push). That growth has left predictable debt: a few **god components**, **scattered Supabase calls with no data layer**, **duplicated utilities** (phone normalization, CORS/auth boilerplate, status labels), **type-safety switched off**, **~0% component test coverage**, and a **660 kB main bundle**.

This plan makes the codebase **easier to change safely** without altering product behavior. It is sequenced so each phase lands on a green, releasable state: **Phase 0** builds a verification net, **Phase 1** does low-risk high-ROI consolidation, **Phase 2** restructures the god components behind a data layer, and **Phase 3** layers in the behavioral upgrades (React Query, incremental strict TS, bundle splitting). Per the decisions taken: **full phased roadmap**, **incremental strict TS**, **security tracked separately** (see `SECURITY_AUDIT.md` — out of scope here), and a **test safety net before structural refactors**.

## Verified baseline (2026-06-26)

| Metric | Value | Note |
|---|---|---|
| `npx tsc --noEmit` | **0 errors** | …only because `strict:false` + all strict flags off in `tsconfig.app.json` (this supersedes the old "tsc red" note — tsc is green today) |
| `npx eslint .` | **245 problems (215 err / 30 warn)** | ~209 are `@typescript-eslint/no-explicit-any`; `no-unused-vars` is **disabled** in `eslint.config.js` (masks dead code) |
| `npm run build` | PASS, ~8 s | main chunk **~660 kB** (gzip ~204 kB, > 500 kB warn); AdminPanel chunk ~260 kB; **no `manualChunks`** |
| Tests | **25** (vitest, lib-only) | `src/lib/aiDesign.test.ts`, `designVault.test.ts`, `test/example.test.ts`; **0% component coverage** |
| React Query | installed, **used in 1 file** (`NativeShell.tsx`) | `QueryClient` configured in `App.tsx` but unused for data |
| Supabase calls | `from()` in **26 files**, `invoke()` in **11 files** | no service/data layer; inline `try/catch + toast + setState` |
| Edge functions | **15**, **no `_shared/`** | CORS (15/15), `createClient` (15/15), `json()` (8/15), phone-norm (7/15), auth-check (7/15) duplicated |
| God files (>500 LOC, app code) | AdminPanel 1708, AdminAccounts 1572, AdminTemplates 1170, DesignerOrderDetails 779, AdminServicesSpecs 714, OrderTracking 633, TemplateDetails 626, DesignerOrders 587, AdminAiDesigns 568, ProfilePage 558, AiDesignPage 547 | `components/ui/sidebar.tsx` (637) is shadcn vendor — leave |

## Guiding principles

- **Behavior-preserving.** Refactors must not change product behavior; every step is verified before the next. Web output stays byte-identical where a change is native-only, and vice versa (`src/lib/platform.ts` `isNativeApp`).
- **Small, reversible steps**, each ending green (`npm run build` + `npx tsc --noEmit` + `npm test`). Land as focused commits/PRs, not a big-bang branch.
- **Reuse before create.** Prefer existing helpers (`src/lib/orderPricing.ts`, `aiDesign.ts`, `designVault.ts`, `storage.ts`, `serviceIcons.ts`, `platform.ts`, hooks `useServices.ts`/`useDiscounts.ts`/`useAlwaseetLocations.ts`).
- **Extract once, replace everywhere** for duplicated logic — guard each extraction with a test first.

---

## Phase 0 — Safety net & green baseline (do first)

**Goal:** a clean, committed, green starting point and a regression net for the risky later phases.

1. **Stabilize git state.** The working tree currently carries large multi-feature uncommitted WIP. Organize it into coherent commits on the feature branch (or land it) so refactor diffs are legible. Establish the baseline gate: `npm run build` ✅, `npx tsc --noEmit` ✅ (0), `npm test` ✅ (25).

2. **Dead-code / unused-deps inventory (read-only first).** Add dev tooling and capture a report (do not delete yet):
   - `npx knip` (unused files/exports/deps), `npx ts-prune` (unused exports), `npx depcheck`.
   - Verify the suspected-unused deps flagged in exploration: `embla-carousel-react`, `react-resizable-panels`, `cmdk`, `vaul`.
   - Output → a short `docs/refactor/dead-code-inventory.md`. Deletions happen in Phase 1 (guarded).

3. **Test infrastructure.** `vitest` + jsdom are already configured (`vitest.config.ts`, `src/test/setup.ts`). Add `@testing-library/react` + `@testing-library/user-event`, and a `renderWithProviders()` test util that wraps with `AuthContext`/`CartContext`/`QueryClientProvider`/`MemoryRouter` and a mocked `supabase` client (`vi.mock('@/integrations/supabase/client')`).
   - Files: `src/test/utils.tsx` (new), `src/test/mocks/supabase.ts` (new).

4. **Characterization tests for critical, high-value logic** (locks in current behavior before refactors touch it):
   - **Pricing** — `src/lib/orderPricing.ts` (466 LOC, pure, heavily called): exhaustive unit tests of the pricing snapshot across service/quantity/discount permutations.
   - **Phone normalization** — current behavior of `replace(/\s+/g,'').replace(/^0/,'964')` (guards the Phase-1 `phoneUtils` extraction).
   - **Auth routing** — `src/pages/auth/AuthPage.tsx` `submitPhone` → `route` handling (`staff`/`code`/`otp`) with `send-otp` mocked; the biometric `code`-step branch (`bioForPhone`).
   - **Cart/checkout** — `src/contexts/CartContext.tsx` add/remove/persist; the Checkout submission path with supabase mocked.
   - **One admin mutation** — e.g. `admin-delete-user` invocation path / a status-change handler, supabase mocked.

**Verify Phase 0:** new tests pass; baseline gate still green; dead-code report produced.

---

## Phase 1 — Safe consolidations (high-ROI, low-risk)

**Goal:** remove duplication and dead code, get lint green, split the bundle. No structural rewrites.

1. **Edge-function `_shared/` extraction.** Create `supabase/functions/_shared/helpers.ts` exporting: `CORS_HEADERS`, `json(body,status)`, `normalizePhone(phone)`, `getServiceClient()` (the `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` init), `getAuthUser(req)` (Authorization → `getUser`), `requireRole(user, role)`. Refactor all 15 `supabase/functions/*/index.ts` to import these. Keep each function's behavior identical (esp. `verify_jwt` per `supabase/config.toml`).
   - Representative: `send-otp`, `verify-otp`, `phone-login`, `set-pin`, `admin-delete-user`, `create-admin`, `create-designer`, `create-reseller`, `send-push`, `send-to-telegram`.
   - **Verify:** `deno check` each function if available; deploy one to a preview / boot-check (unauth → 401) before mass-deploy; diff responses against current.

2. **Frontend shared utils** (replace inline copies; guarded by Phase-0 tests):
   - `src/lib/phoneUtils.ts` — `normalizePhone`, `formatPhoneDisplay`, `isSuperAdminPhone`. Replace the 4 copies: `src/components/ChangePhoneDialog.tsx`, `src/lib/biometric.ts` (`normPhone`), `src/pages/admin/AdminPanel.tsx`, `src/components/admin/AdminCustomers.tsx`.
   - `src/lib/constants.ts` — centralize `STATUS_LABELS`/`ORDER_STATUSES`/`ROLE_LABELS`/`PAYMENT_LABELS`/`PAYMENT_COLORS`/`DATE_RANGE_LABELS`, currently spread across `src/data/mockData.ts`, `AdminPanel.tsx`, `src/components/admin/AdminAccounts.tsx`.
   - `src/lib/errors.ts` — `handleSupabaseError(err): string` (Arabic messages, PG codes like `23505`, RLS). Replace ad-hoc `catch → toast` strings.
   - `src/lib/designUtils.ts` — consolidate `isImageUrl` (`designVault.ts`), `getDesignSignedUrl` (`storage.ts`), and the inline image-compression in `AdminTemplates.tsx`.

3. **Dead-code removal** (execute the Phase-0 inventory): delete unused files/exports, remove confirmed-unused deps. Re-run `knip`/`ts-prune` to confirm.

4. **Lint → green.** Enable `@typescript-eslint/no-unused-vars` in `eslint.config.js`; `eslint . --fix` for `react-refresh/only-export-components` (20) and easy fixes; fix the 8 `react-hooks/exhaustive-deps` (`NotificationBell.tsx`, `DesignerOrderDetails.tsx`, `TemplateDetails.tsx`); fix `no-require-imports` (`tailwind.config.ts:123`). The 209 `no-explicit-any` are addressed progressively in Phase 3 (typing) — if "lint green now" is required, add typed fixes here in the worst files (`AdminAccounts.tsx` 22, `DesignerOrderDetails.tsx` 14, `AdminAiDesigns.tsx` 12).

5. **Bundle code-splitting.** Add `build.rollupOptions.output.manualChunks` in `vite.config.ts` (vendor split: `react`+`react-dom`+`react-router-dom`; `@radix-ui/*`; `framer-motion`; `recharts`; `@supabase/supabase-js`). Confirm route-level `lazy()` already covers `/admin` (it does in `App.tsx`); **dynamic-import `recharts`** so it loads only inside admin/accounts. Target: main chunk < ~400 kB gzip, no > 500 kB warning.

**Verify Phase 1:** baseline gate green; lint problems → ~0 (or only the deferred `any`); `npm run build` shows reduced/clean chunks; edge functions boot-check 401; Phase-0 tests still green (proves utils extraction preserved behavior).

---

## Phase 2 — Structural: data layer + god-component decomposition

**Goal:** introduce a centralized data-access layer (behavior-preserving, no caching yet) and break the god components into focused units, refactoring against the Phase-0 net.

1. **Service layer** `src/services/` — pure, typed functions wrapping Supabase, using `handleSupabaseError`:
   - `src/services/orders.ts`, `profiles.ts`, `designs.ts`, `templates.ts`, `admin.ts` (queries + mutations: `listOrders`, `getProfile`, `updateOrderStatus`, `assignDesigner`, `toggleRole`, …).
   - Migrate the 26 `from()` / 11 `invoke()` call sites to these functions incrementally. **No React Query yet** — keep `useEffect`/`setState`, just route through the service. This is the safe seam Phase 3 builds on.

2. **Decompose god components** (one at a time, each behind its own PR, verified against tests + manual):
   - **`AdminPanel.tsx` (1708)** → orchestrator (~300 LOC) + extracted tab components (`AdminOrdersTab`, `AdminDesignersTab`, …); move shared tab/filter state into a small `AdminTabContext`; **lazy-load** the 10 admin sub-panels with `Suspense` instead of static imports.
   - **`AdminAccounts.tsx` (1572)** → split P&L / expenses / revenue panels; move `getDateStart`/date helpers to `src/lib/dateUtils.ts`.
   - **`AdminTemplates.tsx` (1170)** → separate upload/compression (use `designUtils.ts`), the bulk-ops mode, and the edit form.
   - **`DesignerOrderDetails.tsx` (779)`, `OrderTracking.tsx` (633)`, `TemplateDetails.tsx` (626)`** → extract status-rendering lookup tables (from `constants.ts`), file-handling (from `designUtils.ts`), and form/variant sub-components.
   - Reduce form boilerplate with a `useEntityForm(schema, onSubmit)` hook (React Hook Form + Zod — both available) for the admin/designer/expense dialogs.

3. **`isNativeApp` branching tidy-up** (optional within this phase): where native/web render paths diverge heavily, factor into `Native*`/`Web*` component pairs selected once, rather than inline `if (isNativeApp)` scattered through a component.

**Verify Phase 2:** after each component split — Phase-0 + new tests green, `npm run build` + `tsc` green, and a **manual on-device + web pass** of the affected flow (admin orders, accounts, templates, designer order, customer tracking/checkout). Confirm bundle: admin sub-panels now in their own chunks.

---

## Phase 3 — Behavioral upgrades: React Query + incremental strict TS

**Goal:** the higher-churn, higher-value migrations, now safe atop the service layer and tests.

1. **Adopt React Query** on top of `src/services/`:
   - Add query hooks `src/hooks/queries/*` (`useOrders`, `useProfile`, `useTemplates`, `useAdminUsers`, …) wrapping the services; mutations via `useMutation` with `onSuccess` → `invalidateQueries` + toast.
   - Migrate the read-heavy, duplicate-fetch surfaces first (admin tabs re-fetching the same data, `MyOrders.tsx`, `OrderTracking.tsx`, `DesignerOrders.tsx`). Removes manual `loading`/`setState`, dedupes requests, adds cache + refetch-on-focus.
   - Keep Context for **UI state** (`AuthContext`, `CartContext`); React Query owns **server state**.

2. **Incremental strict TypeScript** (per decision — one flag at a time, not big-bang):
   - In `tsconfig.app.json`, enable in order, fixing surfaced errors per area each step: `noImplicitAny` → `strictNullChecks` → `strictFunctionTypes`/`strictBindCallApply` → `noUnusedLocals`/`noUnusedParameters` → finally `strict: true`.
   - Drive the 209 `no-explicit-any` to zero as part of this (worst files first: `AdminAccounts.tsx`, `DesignerOrderDetails.tsx`, `AdminAiDesigns.tsx`, `AiDesignPage.tsx`). Lean on the generated Supabase Row types in `src/integrations/supabase/types.ts`; **regenerate** it from the live schema (`supabase gen types typescript`) and reconcile, since strict will expose nullability the loose types hid.
   - Each flag flip lands only when `tsc` is green again — never leave `tsc` red between sessions.

3. **CI gate** (lock the gains): a workflow running `npm run build`, `npx tsc --noEmit`, `npx eslint .`, `npm test`, and `npx knip` so regressions can't re-enter.

**Verify Phase 3:** `tsc` green after each flag; lint green (0 `any`); React Query DevTools shows cache hits / no duplicate fetches on admin tab switches; full manual regression (web + device) of money/auth/order flows; CI green.

---

## Out of scope (separate tracks)

- **Security remediation** — the 9 High + 12 Medium OPEN items in `SECURITY_AUDIT.md` (coupon drain, order self-approval, file-deletion ACL, admin phone collision, CORS wildcard, etc.) are **behavioral** fixes, tracked separately, not in this plan.
- **Migration history reorg** (84 migrations are fine as-is); optional `docs/SCHEMA.md` is a nice-to-have, not required.
- **Native app rewrite / state-management swap** beyond the Context↔React Query split above.

## Global verification (end-to-end)

- **Per-step gate:** `npm run build` && `npx tsc --noEmit` && `npm test` all green; `npx eslint .` trending to 0.
- **Bundle check:** `npm run build` chunk sizes — main < ~400 kB gzip, no > 500 kB warning, recharts/admin in separate chunks.
- **Edge functions:** `supabase functions deploy <fn>` boot-check (unauth → 401) + response diff vs. pre-refactor for the refactored `_shared` functions.
- **Manual smoke (web + Android device):** login (phone → code/otp, fingerprint), checkout, order tracking, designer order, and each admin tab — after every god-component split and the React Query migration. Use the connected device (`adb install -r` the debug APK + screenshot) and `vercel` preview for web.
- **Regression net:** Phase-0 characterization tests must stay green through every later phase — that is the proof that structural/behavioral refactors preserved behavior.

## Sequencing summary

`Phase 0 (net + green baseline)` → `Phase 1 (consolidate: _shared, utils, constants, dead code, lint-green, bundle)` → `Phase 2 (service layer + god-component splits)` → `Phase 3 (React Query + incremental strict TS + CI)`. Each phase is independently shippable and leaves the app green and releasable.
