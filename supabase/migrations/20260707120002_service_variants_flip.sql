-- Variant-tier product system — LAUNCH FLIP.
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️  DO NOT RUN THIS MIGRATION ON ITS OWN. It must be applied ONLY together
-- with the frontend deploy that ships VariantPicker + the cart/checkout
-- variant flow (agents "picker"/"cart"/upload/reseller). Applying it earlier
-- hides the 39 old duplicated sub-services from the print catalog while the
-- live frontend still expects them, breaking checkout for those products.
-- ══════════════════════════════════════════════════════════════════════════
--
-- Effects, in one transaction:
--  1) Re-points every template that belonged to one of the 39 old duplicated
--     sub-service ids to its new consolidated parent service id (the
--     specific size/shape is now chosen in the VariantPicker, not baked into
--     the template's service_type).
--  2) Flips print_enabled: true for the 7 new consolidated services, false
--     for the 39 old ones they replace. ai_enabled is NOT touched anywhere —
--     the AI-design flow for these ids (if any) is unaffected.

BEGIN;

-- ── 1) Re-point templates.service_type to the new consolidated service id ──
UPDATE public.templates SET service_type = 'card_iq'    WHERE service_type IN ('card_iq_1', 'card_iq_2');
UPDATE public.templates SET service_type = 'card_ivory' WHERE service_type IN ('card_ivory_1', 'card_ivory_2');
UPDATE public.templates SET service_type = 'receipt'    WHERE service_type IN ('receipt_a4', 'receipt_a5', 'receipt_a6', 'receipt_dl');
UPDATE public.templates SET service_type = 'stamp'      WHERE service_type IN (
  'stamp_rect_6x4', 'stamp_rect_5x3', 'stamp_rect_47x18', 'stamp_rect_35x14',
  'stamp_sq_5x5', 'stamp_sq_4x4', 'stamp_sq_3x3', 'stamp_sq_2x2',
  'stamp_oval_3x45', 'stamp_oval_35x55',
  'stamp_pocket_35x14', 'stamp_pocket_47x18'
);
UPDATE public.templates SET service_type = 'sticker'    WHERE service_type IN ('sticker_round_3', 'sticker_round_4', 'sticker_round_5', 'sticker_round_6', 'sticker_rect_card');
UPDATE public.templates SET service_type = 'bag'        WHERE service_type IN (
  'bag_16x25_500', 'bag_20x30_500', 'bag_25x35_500', 'bag_30x40_500', 'bag_37x50_500',
  'bag_16x25_1000', 'bag_20x30_1000', 'bag_25x35_1000', 'bag_30x40_1000', 'bag_37x50_1000'
);
UPDATE public.templates SET service_type = 'brochure'   WHERE service_type IN ('brochure_a4', 'brochure_a5', 'brochure_4c_1', 'brochure_4c_2');

-- ── 2) Flip catalog visibility ───────────────────────────────────────────────
UPDATE public.services SET print_enabled = true
WHERE id IN ('card_iq', 'card_ivory', 'receipt', 'stamp', 'sticker', 'bag', 'brochure');

UPDATE public.services SET print_enabled = false
WHERE id IN (
  'card_iq_1', 'card_iq_2',
  'card_ivory_1', 'card_ivory_2',
  'receipt_a4', 'receipt_a5', 'receipt_a6', 'receipt_dl',
  'stamp_rect_6x4', 'stamp_rect_5x3', 'stamp_rect_47x18', 'stamp_rect_35x14',
  'stamp_sq_5x5', 'stamp_sq_4x4', 'stamp_sq_3x3', 'stamp_sq_2x2',
  'stamp_oval_3x45', 'stamp_oval_35x55',
  'stamp_pocket_35x14', 'stamp_pocket_47x18',
  'sticker_round_3', 'sticker_round_4', 'sticker_round_5', 'sticker_round_6', 'sticker_rect_card',
  'bag_16x25_500', 'bag_20x30_500', 'bag_25x35_500', 'bag_30x40_500', 'bag_37x50_500',
  'bag_16x25_1000', 'bag_20x30_1000', 'bag_25x35_1000', 'bag_30x40_1000', 'bag_37x50_1000',
  'brochure_a4', 'brochure_a5', 'brochure_4c_1', 'brochure_4c_2'
);

-- ── 3) Mark the old rows as superseded ──────────────────────────────────────
-- Pickers that list print-disabled services too (upload flow, reseller
-- new-order) exclude superseded rows; the rows stay for history lookups.
UPDATE public.services SET superseded_by = 'card_iq'    WHERE id IN ('card_iq_1', 'card_iq_2');
UPDATE public.services SET superseded_by = 'card_ivory' WHERE id IN ('card_ivory_1', 'card_ivory_2');
UPDATE public.services SET superseded_by = 'receipt'    WHERE id IN ('receipt_a4', 'receipt_a5', 'receipt_a6', 'receipt_dl');
UPDATE public.services SET superseded_by = 'stamp'      WHERE id IN (
  'stamp_rect_6x4', 'stamp_rect_5x3', 'stamp_rect_47x18', 'stamp_rect_35x14',
  'stamp_sq_5x5', 'stamp_sq_4x4', 'stamp_sq_3x3', 'stamp_sq_2x2',
  'stamp_oval_3x45', 'stamp_oval_35x55',
  'stamp_pocket_35x14', 'stamp_pocket_47x18'
);
UPDATE public.services SET superseded_by = 'sticker'    WHERE id IN ('sticker_round_3', 'sticker_round_4', 'sticker_round_5', 'sticker_round_6', 'sticker_rect_card');
UPDATE public.services SET superseded_by = 'bag'        WHERE id IN (
  'bag_16x25_500', 'bag_20x30_500', 'bag_25x35_500', 'bag_30x40_500', 'bag_37x50_500',
  'bag_16x25_1000', 'bag_20x30_1000', 'bag_25x35_1000', 'bag_30x40_1000', 'bag_37x50_1000'
);
UPDATE public.services SET superseded_by = 'brochure'   WHERE id IN ('brochure_a4', 'brochure_a5', 'brochure_4c_1', 'brochure_4c_2');

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, commented out — apply by hand only, in its own transaction)
--
-- The print_enabled flip is fully reversible. The templates.service_type
-- re-point in step 1 is LOSSY for card_iq/card_ivory/bag: many old ids
-- collapsed onto one new id (e.g. both card_iq_1 and card_iq_2 -> card_iq;
-- both bag_16x25_500 and bag_16x25_1000 -> bag_16x25's variant), so which
-- specific old id a given template originally had cannot be recovered from
-- the database alone. Only run the template UPDATE below if you still know
-- (from an out-of-band backup/export taken before this migration) which
-- templates need which original id restored — otherwise leave templates on
-- the new consolidated ids and only revert print_enabled.
-- ══════════════════════════════════════════════════════════════════════════

-- BEGIN;
--
-- UPDATE public.services SET print_enabled = false
-- WHERE id IN ('card_iq', 'card_ivory', 'receipt', 'stamp', 'sticker', 'bag', 'brochure');
--
-- UPDATE public.services SET print_enabled = true
-- WHERE id IN (
--   'card_iq_1', 'card_iq_2',
--   'card_ivory_1', 'card_ivory_2',
--   'receipt_a4', 'receipt_a5', 'receipt_a6', 'receipt_dl',
--   'stamp_rect_6x4', 'stamp_rect_5x3', 'stamp_rect_47x18', 'stamp_rect_35x14',
--   'stamp_sq_5x5', 'stamp_sq_4x4', 'stamp_sq_3x3', 'stamp_sq_2x2',
--   'stamp_oval_3x45', 'stamp_oval_35x55',
--   'stamp_pocket_35x14', 'stamp_pocket_47x18',
--   'sticker_round_3', 'sticker_round_4', 'sticker_round_5', 'sticker_round_6', 'sticker_rect_card',
--   'bag_16x25_500', 'bag_20x30_500', 'bag_25x35_500', 'bag_30x40_500', 'bag_37x50_500',
--   'bag_16x25_1000', 'bag_20x30_1000', 'bag_25x35_1000', 'bag_30x40_1000', 'bag_37x50_1000',
--   'brochure_a4', 'brochure_a5', 'brochure_4c_1', 'brochure_4c_2'
-- );
--
-- UPDATE public.services SET superseded_by = NULL WHERE superseded_by IS NOT NULL;
--
-- -- Only reversible without ambiguity for the groups that map 1:1 (receipt,
-- -- stamp, sticker, brochure — one old id per new id, no collapsing):
-- UPDATE public.templates SET service_type = 'receipt_a4' WHERE service_type = 'receipt' AND /* restrict to templates you know were receipt_a4 */ false;
-- -- (repeat per-id for receipt_a5/a6/dl, the 12 stamp_* ids, the 5 sticker_* ids,
-- --  brochure_a4/a5/4c_1/4c_2 — each guarded by your own out-of-band mapping.)
-- -- card_iq_1/2, card_ivory_1/2 and the 10 bag_* ids are NOT safely reversible
-- -- here (many-to-one collapse) without that external mapping.
--
-- COMMIT;
