-- Variant-tier product system — seed.
--
-- Idempotent: services rows use ON CONFLICT (id) DO NOTHING (create once);
-- service_variants rows use ON CONFLICT (id) DO UPDATE (re-running this file
-- refreshes labels/tiers/grouping to match this migration, e.g. after the
-- admin edits SEED SPEC numbers and this file is amended).
--
-- All tier costs are seeded as 0 — the admin fills real production costs in
-- later via the admin UI. `gift` is set ONLY on sticker tiers, per spec.
--
-- print_enabled = false on every NEW consolidated service below: the catalog
-- keeps selling the old duplicated sub-services until the separate flip
-- migration (20260707120002) runs together with the frontend deploy.
--
-- Section A: NEW consolidated services (card_iq, card_ivory, receipt, stamp,
--            sticker, bag, brochure), each with its `service_variants` rows.
-- Section B: a single 'قياسي' variant attached to EXISTING services that
--            keep selling as-is (card_turkish, master_folder, file_folder,
--            letterhead, rollup) — nothing else changes on those rows.

-- ════════════════════════════════════════════════════════════════════════════
-- Section A — new consolidated services
-- ════════════════════════════════════════════════════════════════════════════

-- ── A1) card_iq — كارت عراقي (rep: card_iq_1) ───────────────────────────────
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'card_iq', 'كارت عراقي', icon, icon_url, description, sort_order, 'cards', 15000, 0, 1000, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'card_iq_1'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('card_iq_face1', 'card_iq', 'وجه', NULL, NULL, 1, NULL,
   '[{"qty":1000,"price":15000,"cost":0},{"qty":2000,"price":30000,"cost":0},{"qty":3000,"price":45000,"cost":0},{"qty":5000,"price":75000,"cost":0}]'::jsonb, 0, true),
  ('card_iq_face2', 'card_iq', 'وجهين', NULL, NULL, 2, NULL,
   '[{"qty":1000,"price":20000,"cost":0},{"qty":2000,"price":40000,"cost":0},{"qty":3000,"price":60000,"cost":0},{"qty":5000,"price":100000,"cost":0}]'::jsonb, 1, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ── A2) card_ivory — كارت عظم عاج (rep: card_ivory_1) ───────────────────────
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'card_ivory', 'كارت عظم عاج', icon, icon_url, description, sort_order, 'cards', 35000, 0, 100, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'card_ivory_1'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('card_ivory_face1', 'card_ivory', 'وجه', NULL, NULL, 1, NULL,
   '[{"qty":100,"price":35000,"cost":0},{"qty":200,"price":70000,"cost":0},{"qty":300,"price":105000,"cost":0}]'::jsonb, 0, true),
  ('card_ivory_face2', 'card_ivory', 'وجهين', NULL, NULL, 2, NULL,
   '[{"qty":100,"price":40000,"cost":0},{"qty":200,"price":80000,"cost":0},{"qty":300,"price":120000,"cost":0}]'::jsonb, 1, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ── A3) receipt — وصل (rep: receipt_a4; unit_label = 'دفتر') ────────────────
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'receipt', 'وصل', icon, icon_url, description, sort_order, 'receipt_book', 35000, 0, 5, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'receipt_a4'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('receipt_a4', 'receipt', 'A4', NULL, NULL, NULL, 'دفتر',
   '[{"qty":5,"price":35000,"cost":0},{"qty":10,"price":70000,"cost":0},{"qty":15,"price":105000,"cost":0},{"qty":20,"price":140000,"cost":0}]'::jsonb, 0, true),
  ('receipt_a5', 'receipt', 'A5', NULL, NULL, NULL, 'دفتر',
   '[{"qty":10,"price":35000,"cost":0},{"qty":20,"price":70000,"cost":0},{"qty":30,"price":105000,"cost":0},{"qty":40,"price":140000,"cost":0}]'::jsonb, 1, true),
  ('receipt_a6', 'receipt', 'A6', NULL, NULL, NULL, 'دفتر',
   '[{"qty":20,"price":35000,"cost":0},{"qty":40,"price":70000,"cost":0},{"qty":60,"price":105000,"cost":0}]'::jsonb, 2, true),
  ('receipt_dl', 'receipt', 'ثلث A4 (DL)', NULL, NULL, NULL, 'دفتر',
   '[{"qty":15,"price":35000,"cost":0},{"qty":30,"price":70000,"cost":0},{"qty":45,"price":105000,"cost":0}]'::jsonb, 3, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ── A4) stamp — ختم (rep: stamp_rect_6x4; group_label chips; ink_color attribute) ──
-- stamp_color ('ختم ملوّن') stays its own untouched sub-service — not part of this product.
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'stamp', 'ختم', icon, icon_url, description, sort_order, 'stamps', 15000, 0, 1, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'stamp_rect_6x4'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('stamp_rect_6x4', 'stamp', '6×4', 'مستطيل', NULL, NULL, NULL,
   '[{"qty":1,"price":30000,"cost":0},{"qty":2,"price":60000,"cost":0}]'::jsonb, 0, true),
  ('stamp_rect_5x3', 'stamp', '5×3', 'مستطيل', NULL, NULL, NULL,
   '[{"qty":1,"price":25000,"cost":0},{"qty":2,"price":50000,"cost":0}]'::jsonb, 1, true),
  ('stamp_rect_47x18', 'stamp', '4.7×1.8', 'مستطيل', NULL, NULL, NULL,
   '[{"qty":1,"price":20000,"cost":0},{"qty":2,"price":40000,"cost":0}]'::jsonb, 2, true),
  ('stamp_rect_35x14', 'stamp', '3.5×1.4', 'مستطيل', NULL, NULL, NULL,
   '[{"qty":1,"price":15000,"cost":0},{"qty":2,"price":30000,"cost":0}]'::jsonb, 3, true),
  ('stamp_sq_5x5', 'stamp', '5×5', 'مربع/دائري', NULL, NULL, NULL,
   '[{"qty":1,"price":30000,"cost":0},{"qty":2,"price":60000,"cost":0}]'::jsonb, 4, true),
  ('stamp_sq_4x4', 'stamp', '4×4', 'مربع/دائري', NULL, NULL, NULL,
   '[{"qty":1,"price":25000,"cost":0},{"qty":2,"price":50000,"cost":0}]'::jsonb, 5, true),
  ('stamp_sq_3x3', 'stamp', '3×3', 'مربع/دائري', NULL, NULL, NULL,
   '[{"qty":1,"price":20000,"cost":0},{"qty":2,"price":40000,"cost":0}]'::jsonb, 6, true),
  ('stamp_sq_2x2', 'stamp', '2×2', 'مربع/دائري', NULL, NULL, NULL,
   '[{"qty":1,"price":15000,"cost":0},{"qty":2,"price":30000,"cost":0}]'::jsonb, 7, true),
  ('stamp_oval_3x45', 'stamp', '3×4.5', 'بيضوي', NULL, NULL, NULL,
   '[{"qty":1,"price":20000,"cost":0},{"qty":2,"price":40000,"cost":0}]'::jsonb, 8, true),
  ('stamp_oval_35x55', 'stamp', '3.5×5.5', 'بيضوي', NULL, NULL, NULL,
   '[{"qty":1,"price":25000,"cost":0},{"qty":2,"price":50000,"cost":0}]'::jsonb, 9, true),
  ('stamp_pocket_35x14', 'stamp', '3.5×1.4', 'جيب', NULL, NULL, NULL,
   '[{"qty":1,"price":15000,"cost":0},{"qty":2,"price":30000,"cost":0}]'::jsonb, 10, true),
  ('stamp_pocket_47x18', 'stamp', '4.7×1.8', 'جيب', NULL, NULL, NULL,
   '[{"qty":1,"price":20000,"cost":0},{"qty":2,"price":40000,"cost":0}]'::jsonb, 11, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

UPDATE public.services SET variant_attributes =
  '[{"id":"ink_color","label":"لون الحبر","options":[{"id":"blue","label":"أزرق"},{"id":"green","label":"أخضر"},{"id":"red","label":"أحمر"},{"id":"black","label":"أسود"}]}]'::jsonb
WHERE id = 'stamp';

-- ── A5) sticker — ستيكر (rep: sticker_round_3; ALL tiers carry a gift) ──────
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'sticker', 'ستيكر', icon, icon_url, description, sort_order, 'stickers', 10500, 0, 500, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'sticker_round_3'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('sticker_round_3', 'sticker', 'دائري 3سم', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":10500,"cost":0,"gift":100},{"qty":1000,"price":21000,"cost":0,"gift":200},{"qty":1500,"price":31500,"cost":0,"gift":300},{"qty":2000,"price":42000,"cost":0,"gift":400}]'::jsonb, 0, true),
  ('sticker_round_4', 'sticker', 'دائري 4سم', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":12500,"cost":0,"gift":100},{"qty":1000,"price":25000,"cost":0,"gift":200},{"qty":1500,"price":37500,"cost":0,"gift":300},{"qty":2000,"price":50000,"cost":0,"gift":400}]'::jsonb, 1, true),
  ('sticker_round_5', 'sticker', 'دائري 5سم', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":19000,"cost":0,"gift":100},{"qty":1000,"price":38000,"cost":0,"gift":200},{"qty":1500,"price":57000,"cost":0,"gift":300},{"qty":2000,"price":76000,"cost":0,"gift":400}]'::jsonb, 2, true),
  ('sticker_round_6', 'sticker', 'دائري 6سم', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":23000,"cost":0,"gift":100},{"qty":1000,"price":46000,"cost":0,"gift":200},{"qty":1500,"price":69000,"cost":0,"gift":300},{"qty":2000,"price":92000,"cost":0,"gift":400}]'::jsonb, 3, true),
  ('sticker_rect_card', 'sticker', 'مستطيل حجم كارت', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":12500,"cost":0,"gift":100},{"qty":1000,"price":25000,"cost":0,"gift":200},{"qty":1500,"price":37500,"cost":0,"gift":300},{"qty":2000,"price":50000,"cost":0,"gift":400}]'::jsonb, 4, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ── A6) bag — علاكة (rep: bag_16x25_500; bag_color → dependent ink_color) ───
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'bag', 'علاكة', icon, icon_url, description, sort_order, 'packaging', 60000, 0, 500, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'bag_16x25_500'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('bag_16x25', 'bag', '16×25', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":60000,"cost":0},{"qty":1000,"price":75000,"cost":0},{"qty":1500,"price":90000,"cost":0},{"qty":2000,"price":105000,"cost":0}]'::jsonb, 0, true),
  ('bag_20x30', 'bag', '20×30', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":90000,"cost":0},{"qty":1000,"price":110000,"cost":0},{"qty":1500,"price":130000,"cost":0},{"qty":2000,"price":150000,"cost":0}]'::jsonb, 1, true),
  ('bag_25x35', 'bag', '25×35', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":100000,"cost":0},{"qty":1000,"price":125000,"cost":0},{"qty":1500,"price":150000,"cost":0},{"qty":2000,"price":175000,"cost":0}]'::jsonb, 2, true),
  ('bag_30x40', 'bag', '30×40', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":120000,"cost":0},{"qty":1000,"price":145000,"cost":0},{"qty":1500,"price":170000,"cost":0},{"qty":2000,"price":195000,"cost":0}]'::jsonb, 3, true),
  ('bag_37x50', 'bag', '37×50', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":140000,"cost":0},{"qty":1000,"price":180000,"cost":0},{"qty":1500,"price":220000,"cost":0},{"qty":2000,"price":260000,"cost":0}]'::jsonb, 4, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

UPDATE public.services SET variant_attributes =
  '[
     {"id":"bag_color","label":"لون العلاكة","options":[
       {"id":"white","label":"أبيض","allows":{"ink_color":["black","red","blue","green","gold"]}},
       {"id":"black","label":"أسود","allows":{"ink_color":["white","gold","silver"]}},
       {"id":"kraft","label":"كرافت بني","allows":{"ink_color":["black","white","red"]}},
       {"id":"red","label":"أحمر","allows":{"ink_color":["black","white","gold"]}},
       {"id":"blue","label":"أزرق","allows":{"ink_color":["black","white","silver"]}}
     ]},
     {"id":"ink_color","label":"لون الطباعة","options":[
       {"id":"black","label":"أسود"},{"id":"white","label":"أبيض"},{"id":"red","label":"أحمر"},
       {"id":"blue","label":"أزرق"},{"id":"green","label":"أخضر"},{"id":"gold","label":"ذهبي"},{"id":"silver","label":"فضي"}
     ]}
   ]'::jsonb
WHERE id = 'bag';

-- ── A7) brochure — بروشور (rep: brochure_a4) ────────────────────────────────
INSERT INTO public.services
  (id, label, icon, icon_url, description, sort_order, parent_id, price, cost, min_quantity, completion_days, cellophane_type, print_enabled, ai_enabled)
SELECT 'brochure', 'بروشور', icon, icon_url, description, sort_order, 'advertising', 60000, 0, 1000, completion_days, cellophane_type, false, false
FROM public.services WHERE id = 'brochure_a4'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('brochure_a4', 'brochure', 'A4', NULL, NULL, NULL, NULL,
   '[{"qty":1000,"price":225000,"cost":0},{"qty":2000,"price":450000,"cost":0}]'::jsonb, 0, true),
  ('brochure_a5', 'brochure', 'A5', NULL, NULL, NULL, NULL,
   '[{"qty":1000,"price":160000,"cost":0},{"qty":2000,"price":320000,"cost":0}]'::jsonb, 1, true),
  ('brochure_4c_1', 'brochure', '4 كارتات وجه', NULL, NULL, 1, NULL,
   '[{"qty":1000,"price":60000,"cost":0},{"qty":2000,"price":120000,"cost":0}]'::jsonb, 2, true),
  ('brochure_4c_2', 'brochure', '4 كارتات وجهين', NULL, NULL, 2, NULL,
   '[{"qty":1000,"price":80000,"cost":0},{"qty":2000,"price":160000,"cost":0}]'::jsonb, 3, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ════════════════════════════════════════════════════════════════════════════
-- Section B — single 'قياسي' variant attached to EXISTING services.
-- These services are untouched otherwise (still print_enabled as before);
-- menu, pen, doctor_rx, flex, stamp_color are UNTOUCHED (no variants added).
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.service_variants (id, service_id, label, group_label, size_label, faces, unit_label, tiers, sort_order, active) VALUES
  ('card_turkish_std', 'card_turkish', 'قياسي', NULL, NULL, NULL, NULL,
   '[{"qty":1000,"price":90000,"cost":0},{"qty":2000,"price":180000,"cost":0}]'::jsonb, 0, true),
  ('master_folder_std', 'master_folder', 'قياسي', NULL, NULL, NULL, NULL,
   '[{"qty":1000,"price":80000,"cost":0},{"qty":2000,"price":160000,"cost":0}]'::jsonb, 0, true),
  ('file_folder_std', 'file_folder', 'قياسي', NULL, NULL, NULL, NULL,
   '[{"qty":1000,"price":350000,"cost":0},{"qty":2000,"price":700000,"cost":0}]'::jsonb, 0, true),
  ('letterhead_std', 'letterhead', 'قياسي', NULL, NULL, NULL, NULL,
   '[{"qty":500,"price":30000,"cost":0},{"qty":1000,"price":60000,"cost":0},{"qty":1500,"price":90000,"cost":0},{"qty":2000,"price":120000,"cost":0}]'::jsonb, 0, true),
  ('rollup_std', 'rollup', 'قياسي', NULL, NULL, NULL, NULL,
   '[{"qty":1,"price":55000,"cost":0},{"qty":2,"price":110000,"cost":0},{"qty":3,"price":165000,"cost":0}]'::jsonb, 0, true)
ON CONFLICT (id) DO UPDATE SET
  service_id = EXCLUDED.service_id, label = EXCLUDED.label, group_label = EXCLUDED.group_label,
  size_label = EXCLUDED.size_label, faces = EXCLUDED.faces, unit_label = EXCLUDED.unit_label,
  tiers = EXCLUDED.tiers, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;
