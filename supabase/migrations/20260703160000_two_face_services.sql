-- Two-face (front/back) printed products — e.g. كارت وجهين.
-- A service may be single-face (one design file per version) or two-face (an الوجه الأمامي +
-- الوجه الخلفي pair per version). The admin picks this per sub-service; the designer then
-- uploads TWO files per version, the customer approves both, and the print dispatch sends both
-- clearly labeled.
--
-- Backward-compatible & additive:
--  * services.faces defaults to 1, so every existing product keeps its single-file behaviour.
--  * designs.face is nullable — NULL marks a legacy/single-face design; existing rows are untouched.

-- 1) How many printed faces a (sub-)service has. 1 = single design file, 2 = front + back.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS faces smallint NOT NULL DEFAULT 1 CHECK (faces IN (1, 2));

COMMENT ON COLUMN public.services.faces IS
  'Printed faces per design version: 1 = single file, 2 = front (أمامي) + back (خلفي).';

-- 2) Which face a design row belongs to. NULL = single-face design (the default, legacy).
--    Two-face products write one row per face sharing the same version number.
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS face text CHECK (face IN ('front', 'back'));

COMMENT ON COLUMN public.designs.face IS
  'Two-face products only: ''front'' (أمامي) or ''back'' (خلفي). NULL for single-face designs.';

-- 3) Seed the obvious two-face catalog rows. Idempotent UPDATEs — no-op if an id is absent.
--    vip_card       — كارت وجهين (the real print product).
--    aip_card_double — كارت وجهين in the AI catalog (migrated from ai_products.card_double,
--                      20260621160000_unify_ai_into_services). AI-only, but its designer still
--                      prepares two print-ready faces, so it is two-face for the upload/print flow.
UPDATE public.services SET faces = 2 WHERE id IN ('vip_card', 'aip_card_double');
