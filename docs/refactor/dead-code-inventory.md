# Dead-Code / Unused-Dependency Inventory

**Generated:** 2026-06-26  
**Phase:** 0 (read-only analysis — no deletions performed)  
**Tools:** `npx knip` (v5.x), `npx ts-prune`, `npx depcheck`

---

## Raw Tool Summaries

### knip (custom config: `entry=src/main.tsx,src/App.tsx`, `project=src/**/*.{ts,tsx}`, ignoring `android/`, `dist/`, `src/integrations/supabase/types.ts`)

```
Unused files (25)          — all src/components/ui/* or src/hooks/use-mobile.tsx
Unused dependencies (22)   — see table below
Unused devDependencies (4) — @capacitor/assets, @tailwindcss/typography,
                             @testing-library/react, @testing-library/user-event
Unused exports (40)        — mostly shadcn barrel exports + a few app symbols
Unused exported types (7)  — mostly shadcn + 2 lib false-positives
```

> Note: knip also reported ~277 "unused files" from `android/app/build/` and
> `android/app/src/main/assets/` — all build artifacts, confirmed false positives,
> excluded from this report.

### ts-prune

No output. ts-prune produced zero findings, likely because the `@/*` path alias
is not resolved by ts-prune without additional configuration, so it reports
nothing rather than false positives.

### depcheck

```
Unused dependencies:   @capacitor/android, @capacitor/ios, @hookform/resolvers, zod
Unused devDependencies: @capacitor/assets, @tailwindcss/typography,
                        @testing-library/react, @testing-library/user-event,
                        autoprefixer, postcss
Missing dependencies:  @emotion/is-prop-valid (referenced in android build artifact only)
```

---

## Suspect-Dep Verification (from REFACTOR-PLAN.md Phase 0.2)

| Package | shadcn wrapper file | Wrapper imported by app? | Import location | Verdict |
|---|---|---|---|---|
| `embla-carousel-react` | `src/components/ui/carousel.tsx` | **No** — 0 non-UI imports | — | **UNUSED** |
| `react-resizable-panels` | `src/components/ui/resizable.tsx` | **No** — 0 non-UI imports | — | **UNUSED** |
| `cmdk` | `src/components/ui/command.tsx` | **Yes** — 1 import | `src/components/LocationSelect.tsx:6` | **USED** |
| `vaul` | `src/components/ui/drawer.tsx` | **No** — 0 non-UI imports | — | **UNUSED** |

`cmdk` is NOT safe to remove — `LocationSelect.tsx` uses `Command`, `CommandEmpty`,
`CommandGroup`, `CommandInput`, `CommandItem`, `CommandList` from `command.tsx`.

---

## Category A — Safe to Remove (High Confidence)

### A1. npm Dependencies (runtime)

These packages have zero reachable import paths from `src/main.tsx`. Because there
are no barrel/index files in `src/components/ui/`, Vite/Rollup already excludes them
from the built bundle; removing them cleans `node_modules` and `package.json`.

| Package | Only consumer | Consumer imported? | Approx. install size |
|---|---|---|---|
| `embla-carousel-react` | `carousel.tsx` | No | ~1.5 MB |
| `react-resizable-panels` | `resizable.tsx` | No | ~0.6 MB |
| `vaul` | `drawer.tsx` | No | ~0.5 MB |
| `recharts` | `chart.tsx` | No | ~4.5 MB |
| `react-day-picker` | `calendar.tsx` | No | ~1.2 MB |
| `date-fns` | `calendar.tsx` (only) | No | ~3.5 MB |
| `react-hook-form` | `form.tsx` | No | ~0.8 MB |
| `@hookform/resolvers` | Not imported anywhere in src/ | — | ~0.2 MB |
| `@capacitor/ios` | No `ios/` directory exists | — | ~80 MB |
| `@radix-ui/react-accordion` | `accordion.tsx` | No | ~0.1 MB |
| `@radix-ui/react-aspect-ratio` | `aspect-ratio.tsx` | No | ~0.05 MB |
| `@radix-ui/react-avatar` | `avatar.tsx` | No | ~0.1 MB |
| `@radix-ui/react-collapsible` | `collapsible.tsx` | No | ~0.1 MB |
| `@radix-ui/react-context-menu` | `context-menu.tsx` | No | ~0.2 MB |
| `@radix-ui/react-hover-card` | `hover-card.tsx` | No | ~0.1 MB |
| `@radix-ui/react-menubar` | `menubar.tsx` | No | ~0.3 MB |
| `@radix-ui/react-navigation-menu` | `navigation-menu.tsx` | No | ~0.3 MB |
| `@radix-ui/react-radio-group` | `radio-group.tsx` | No | ~0.1 MB |
| `@radix-ui/react-separator` | `separator.tsx` | No | ~0.05 MB |
| `@radix-ui/react-toggle` | `toggle.tsx` | No | ~0.05 MB |
| `@radix-ui/react-toggle-group` | `toggle-group.tsx` | No | ~0.1 MB |

**Note on recharts:** The refactor plan mentions "admin charts" but inspection of
`AdminPanel.tsx` and `AdminAccounts.tsx` shows they import `BarChart3`, `PieChart`
from `lucide-react` (icon components), not from `recharts`. The `recharts` library is
only referenced from the shadcn `chart.tsx` wrapper, which itself has 0 app imports.
`recharts` is not in the 660 KB built bundle. Removal is safe.

### A2. npm devDependencies

| Package | Reason unused |
|---|---|
| `@tailwindcss/typography` | Not listed in `tailwind.config.ts` `plugins` array; not used anywhere |

### A3. Source files — non-vendored (safe to delete)

| File | Reason |
|---|---|
| `src/components/ui/use-toast.ts` | 3-line re-export of `@/hooks/use-toast`; 0 files import from this path (all 23 consumers import from `@/hooks/use-toast` directly) |
| `src/hooks/use-mobile.tsx` | Only imported in `src/components/ui/sidebar.tsx`, which itself is unused (0 app imports) |

### A4. Source files — vendored shadcn primitives (low priority, safe to delete alongside their deps)

These 23 files are shadcn-generated components that were scaffolded but never wired
into the app. They are safe to remove in batch with their associated npm packages
(listed in A1). Mark as low priority since they carry no runtime cost (already
tree-shaken out of the bundle).

```
src/components/ui/accordion.tsx        (pairs with @radix-ui/react-accordion)
src/components/ui/alert.tsx            (no exclusive npm dep — uses @radix-ui/react-slot)
src/components/ui/aspect-ratio.tsx     (pairs with @radix-ui/react-aspect-ratio)
src/components/ui/avatar.tsx           (pairs with @radix-ui/react-avatar)
src/components/ui/breadcrumb.tsx       (no exclusive npm dep)
src/components/ui/calendar.tsx         (pairs with react-day-picker + date-fns)
src/components/ui/carousel.tsx         (pairs with embla-carousel-react)
src/components/ui/chart.tsx            (pairs with recharts)
src/components/ui/collapsible.tsx      (pairs with @radix-ui/react-collapsible)
src/components/ui/context-menu.tsx     (pairs with @radix-ui/react-context-menu)
src/components/ui/drawer.tsx           (pairs with vaul)
src/components/ui/form.tsx             (pairs with react-hook-form)
src/components/ui/hover-card.tsx       (pairs with @radix-ui/react-hover-card)
src/components/ui/menubar.tsx          (pairs with @radix-ui/react-menubar)
src/components/ui/navigation-menu.tsx  (pairs with @radix-ui/react-navigation-menu)
src/components/ui/pagination.tsx       (no exclusive npm dep)
src/components/ui/radio-group.tsx      (pairs with @radix-ui/react-radio-group)
src/components/ui/resizable.tsx        (pairs with react-resizable-panels)
src/components/ui/separator.tsx        (pairs with @radix-ui/react-separator)
src/components/ui/sheet.tsx            (shares @radix-ui/react-dialog with dialog.tsx — keep the dep)
src/components/ui/sidebar.tsx          (uses @radix-ui/react-slot, lucide-react, others — all shared)
src/components/ui/toggle.tsx           (pairs with @radix-ui/react-toggle)
src/components/ui/toggle-group.tsx     (pairs with @radix-ui/react-toggle-group)
```

> **sheet.tsx caveat:** `sheet.tsx` uses `@radix-ui/react-dialog`. Do NOT remove that
> package — `dialog.tsx` (11 app imports) depends on it.

---

## Category B — Needs Manual Review

### B1. npm dependencies — intentionally pre-installed

| Package | Status | Notes |
|---|---|---|
| `zod` | 0 imports in src/ — currently unused | REFACTOR-PLAN.md Phase 2 explicitly requires Zod for `useEntityForm`. Likely pre-installed intentionally. Do not remove yet. |
| `react-hook-form` | Only in `form.tsx` (0 app imports) | Same as above — Phase 2 plans RHF adoption. If deleting `form.tsx`, re-add RHF when actually adopting. |
| `@hookform/resolvers` | 0 imports anywhere | Same context; safe to remove now and re-add in Phase 2. |

### B2. devDependencies — test infrastructure not yet exercised

| Package | Status | Notes |
|---|---|---|
| `@testing-library/react` | Used in `src/test/utils.tsx` | Phase 0 test util was written; no component tests use it yet. Keep — it is wired up. |
| `@testing-library/user-event` | Not yet imported | Needed for Phase 0 characterization tests. Keep. |

### B3. devDependencies — Capacitor CLI tooling

| Package | Status | Notes |
|---|---|---|
| `@capacitor/assets` | Not in any package.json script | Used via `npx capacitor-assets generate` for native icon/splash generation. No active use detected. Remove if not generating native assets; re-add when needed. |

### B4. Source files — test infrastructure

| File | Status | Notes |
|---|---|---|
| `src/test/utils.tsx` | 0 consumers currently | Phase 0 `renderWithProviders` utility — flagged by knip as unused but intentionally created as the base for upcoming characterization tests. Keep. |
| `src/test/mocks/supabase.ts` | 0 consumers currently | Same — Phase 0 supabase mock. Keep. |

---

## Category C — False Positives

| Tool | Item | Reason it is a false positive |
|---|---|---|
| depcheck | `@capacitor/android` | `android/` folder exists; used by `npx cap sync android`. Not a TS import — CLI-driven. |
| depcheck | `autoprefixer` | Configured in `postcss.config.js` which depcheck doesn't analyze. Required for Tailwind CSS. |
| depcheck | `postcss` | Same as autoprefixer — PostCSS config consumer. |
| depcheck | `@emotion/is-prop-valid` (missing) | Found only in `android/app/…/assets/index-up7CiXlN.js` (a Vite build artifact inside the android folder). Not missing from src. |
| knip | `ORIENTATION_OPTIONS` (AiFieldsEditor.tsx:50) | Exported but also used internally on line 123 of the same file. Symbol is a false-positive unused export. |
| knip | `resolveOverride` (useResellerPricing.ts:29) | Exported but also consumed internally on line 60. False positive. |
| knip | `AiProductOption` (aiDesign.ts:15) | Exported interface used internally on lines 32 and 181 of the same file. |
| knip | `ReorderAddress` (designVault.ts:254) | Exported interface used internally on line 268 of the same file. |
| knip / refactor-plan | `cmdk` | Flagged as "suspect" in plan. Actually USED: `command.tsx` → `LocationSelect.tsx`. Confirmed by grep. |
| knip (shadcn exports) | All shadcn barrel exports (`AlertDialogPortal`, `CommandDialog`, `DialogPortal`, etc.) | These are exported from vendored shadcn files that knip already flags as unused files. The export-level reports are redundant noise. |
| knip | `reducer` in `src/hooks/use-toast.ts` | `reducer` is exported but consumed internally. The file itself is used by 23 app files. Symbol export could be removed (`export const` → `const`) as a cleanup but is not dead code. |
| knip | `badgeVariants`, `ButtonProps`, `TextareaProps`, `BadgeProps` | Shadcn pattern: exporting the variant fn and prop type is conventional for consumer customization. Not removed unless the file is removed. |

---

## Missing Dependencies

depcheck reported one missing dependency (`@emotion/is-prop-valid`) but this is a
false positive (android build artifact only). No source-level missing dependencies
were detected. All packages imported by `src/` code are declared in `package.json`.

---

## Recommended Phase-1 Deletions

**Execute these in Phase 1 after the Phase-0 verification gate is green.**
Remove in this order to keep the tree clean:

### Step 1 — Non-shadcn source files (zero risk)

```
src/components/ui/use-toast.ts    # re-export nobody uses
src/hooks/use-mobile.tsx          # used only in unused sidebar.tsx
```

### Step 2 — Shadcn files + paired npm dep removals (batch together)

Run after confirming no accidental imports were added since this analysis.

Shadcn files to delete (23, listed in A4) alongside these `npm uninstall` commands:

```sh
npm uninstall \
  embla-carousel-react \
  react-resizable-panels \
  vaul \
  recharts \
  react-day-picker \
  date-fns \
  react-hook-form \
  @capacitor/ios \
  @radix-ui/react-accordion \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-avatar \
  @radix-ui/react-collapsible \
  @radix-ui/react-context-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-radio-group \
  @radix-ui/react-separator \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group
```

> `@hookform/resolvers` and `zod` are omitted from Step 2 — see B1 above (Phase 2 plans).

### Step 3 — devDependency cleanup

```sh
npm uninstall --save-dev @tailwindcss/typography
```

Optionally also remove `@capacitor/assets` if no native icon/splash generation is
planned in the near term (see B3).

### Verification after Phase-1 removals

```
npm run build       # must pass, no import errors
npx tsc --noEmit   # must pass (0 errors)
npm test           # 25 tests must stay green
npx knip           # should show 0 unused files/deps in src/
```

---

## Notes on Dynamic Imports and Lazy Routes

The following files are loaded via dynamic `import()` and are therefore not statically
reachable — they are NOT dead code even if a static-analysis tool flags them:

- `src/lib/biometric.ts` — dynamically imported by the biometric auth flow
- `src/lib/push.ts` — dynamically imported for push notification setup
- `src/lib/native.ts` — dynamically imported for Capacitor native features
- All route-level lazy components in `src/App.tsx` (`React.lazy(...)`)
- `src/integrations/supabase/types.ts` — generated file, excluded from analysis

None of these were flagged by knip in the current run; this note is for future
re-runs after the codebase changes.
