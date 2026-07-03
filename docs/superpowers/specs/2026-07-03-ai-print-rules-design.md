# AI Design — Print Rules v2 (approved 2026-07-03)

Owner decision: the universal PRINT RULES + OUTPUT FORMAT live **in each service's
توجيهات التصميم (`services.ai_directives`)** — visible/editable per product in the admin
panel — not solely in the edge function. Color rule per owner: vivid tones allowed
whenever the design benefits, but NEVER very dark / predominantly black designs.

## Changes

1. **Data migration** (`services` rows where `ai_enabled`): rewrite `ai_directives` =
   preserved product-specific sentence + English PRINT RULES + OUTPUT FORMAT block.
   - Hierarchy line (business name → tagline → badges → location → phones) only on
     identity/ad products; stamps/receipts/prescriptions/menus keep their own structure.
   - Old duplicated generic CMYK boilerplate removed (superseded by the block).
   - Size audit: fix any wrong `ai_size_label`/`ai_canvas`/option canvas in the same file.

2. **Edge function `ai-design-generate`** (alignment so it can't fight the rules):
   - `MAX_DIRECTIVES_CHARS` 600 → 2500 (the block would otherwise truncate).
   - System prompt: prefer-CMYK-but-vivid-allowed (never-dark stays CRITICAL);
     full-bleed edge-to-edge + NEVER draw crop/trim/bleed marks/guides/rulers;
     no hairlines / no sub-8pt-equivalent text; "the design IS the entire image"
     mockup ban; compose proportions + typography scale for the exact physical size.
   - Fallback prompt mirrors the same rules.

3. **AiFieldsEditor**: one-click "أدرج قواعد الطباعة" button appends the canonical rules
   block to the directives textarea so future products get the rules without retyping.

Deploy: `supabase db push` + `supabase functions deploy ai-design-generate` + Vercel.
