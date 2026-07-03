// Generates supabase/migrations/20260703180000_catalog_reset_seed.sql from
// docs/catalog/launch-catalog.json (the owner-approved launch catalog) plus
// docs/backup/services-backup-2026-07-03.json (pre-reset dump — source for the
// four kept AI-only products with their existing directives/config).
//
// Deterministic + reviewable: rerunning overwrites the same migration file.
// Owner decisions baked in (2026-07-03): templates re-added via admin later;
// receipts quantity = books (min_quantity = books-per-package); ختم ملوّن stored
// at 74,000 IQD (50 USD × 1480); menu/flex/doctor_rx/pen kept AI-only.
import { readFileSync, writeFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync('docs/catalog/launch-catalog.json', 'utf8'));
const backup = JSON.parse(readFileSync('docs/backup/services-backup-2026-07-03.json', 'utf8'));

const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const qj = (v) => (v == null ? 'NULL' : `${q(JSON.stringify(v))}::jsonb`);

// ── PRINT RULES blocks (kept in sync with migration 20260703140000 / AiFieldsEditor) ──
const RULES_COMMON = `PRINT RULES:
- Colors: prefer CMYK offset-printable colors; vivid or saturated tones are allowed whenever they benefit the design — but NEVER a very dark or predominantly black design or background.
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the artwork itself.
- Keep all text and badges safely away from the edges (at least a 5mm equivalent inside), but do not visually mark this margin.`;
const RULES_HIERARCHY_LINE = `
- Clear hierarchy top to bottom: business name → tagline → service badges → location → phone numbers.`;
const OUTPUT_FORMAT = `

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no product floating on a table, no paper texture, no shadows around the design, no hands holding it, no background scene behind the design. The design IS the entire image.`;
const STAMP_BLOCK = `PRINT RULES:
- Single-color ink only, high contrast, no gradients or photos (this product overrides the general color rule).
- No thin hairlines, no tiny text (nothing below an 8pt equivalent at the printed size).
- The white background must fill the ENTIRE canvas edge to edge. Do NOT draw any bleed lines, crop marks, trim marks, dashed borders, guide lines, rulers, or measurement annotations — the image must contain ONLY the stamp artwork itself.
- Keep all text safely inside the stamp border.

OUTPUT FORMAT:
- A single FLAT 2D graphic design, straight-on view, filling the full frame.
- NOT a mockup: no 3D perspective, no rubber stamp object, no handle, no ink pad, no paper texture, no shadows, no hands, no background scene. The design IS the entire image.`;

const HIERARCHY_CATS = new Set(['cards', 'office', 'packaging', 'advertising', 'banners']);
const PLAIN_SLUGS = new Set(['letterhead']); // structured doc — its own header/footer line, no generic hierarchy

function directivesFor(s) {
  if (s.category === 'stamps') return `${s.ai_design_instructions}\n\n${STAMP_BLOCK}`;
  const useHierarchy = HIERARCHY_CATS.has(s.category) && !PLAIN_SLUGS.has(s.slug);
  return `${s.ai_design_instructions}\n\n${RULES_COMMON}${useHierarchy ? RULES_HIERARCHY_LINE : ''}${OUTPUT_FORMAT}`;
}

// ── AI canvas / size mapping ──
function canvasFor(s) {
  if (s.category === 'cards') return '1536x1024';
  if (s.category === 'stamps') {
    if (s.shape === 'rectangle' || s.shape === 'pocket') return '1536x1024';
    if (s.shape === 'oval') return '1024x1536';
    return '1024x1024'; // square_or_round / custom
  }
  if (s.category === 'stickers') return s.shape === 'round' ? '1024x1024' : '1536x1024';
  if (s.slug === 'file_folder' || s.slug === 'master_folder') return '1536x1024'; // 50×35 / 9×5.5 landscape
  return '1024x1536'; // letterhead, receipts, bags, brochures, rollup — portrait
}
const CARD_OPTIONS = [
  { id: 'landscape', label: 'بالعرض', sizeLabel: 'أفقي (عرضي)', canvas: '1536x1024' },
  { id: 'portrait', label: 'بالطول', sizeLabel: 'عمودي (طولي)', canvas: '1024x1536' },
];

function metaFor(s) {
  const m = { pricing_unit: s.pricing_unit, batch_size: s.batch_size };
  for (const k of ['shape', 'copies', 'print_colors', 'lamination_note', 'price_usd_original']) {
    if (s[k] != null) m[k] = s[k];
  }
  return m;
}

const lines = [];
lines.push(`-- Launch catalog reset + seed (owner-approved list: docs/catalog/launch-catalog.json).
-- Pre-reset state backed up to docs/backup/services-backup-2026-07-03.json and
-- templates-backup-2026-07-03.json (48 templates — re-added via admin before launch).
--
-- 1) Wipes all TEST data: orders (with items/designs/notifications/vault rows via
--    explicit deletes + cascades), server carts, templates, and the whole services tree.
-- 2) Adds services.meta jsonb for catalog metadata the app doesn't model as columns
--    (pricing_unit, batch_size, shape, copies, print_colors, lamination_note...).
-- 3) Seeds 8 categories + 45 services; every service's ai_directives = the owner's new
--    per-product instructions + the canonical PRINT RULES / OUTPUT FORMAT block
--    (stamps get the single-color stamp variant).
-- 4) Re-inserts the 4 kept AI-only products (menu/flex/doctor_rx/pen) from the backup
--    with their existing AI config, hidden from the print catalog (print_enabled=false).

-- ── Wipe (FK-safe order) ─────────────────────────────────────────────────────────────
DELETE FROM public.notifications WHERE order_id IS NOT NULL;
DELETE FROM public.designs;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.carts;
DELETE FROM public.templates;
DELETE FROM public.services;

-- ── Catalog metadata column ──────────────────────────────────────────────────────────
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS meta jsonb;
`);

lines.push('\n-- ── Categories (parent services) ─────────────────────────────────────────────────────');
for (const c of catalog.categories) {
  lines.push(
    `INSERT INTO public.services (id, label, icon, description, sort_order, parent_id, print_enabled) VALUES (${q(c.slug)}, ${q(c.name_ar)}, ${q(c.icon || '📄')}, '', ${c.sort}, NULL, true);`,
  );
}

lines.push('\n-- ── Leaf services (45) ───────────────────────────────────────────────────────────────');
let sort = 0;
for (const s of catalog.services) {
  sort += 1;
  const isCard = s.category === 'cards';
  const cols = {
    id: q(s.slug),
    label: q(s.name_ar),
    icon: `'📄'`,
    description: q(s.notes || ''),
    sort_order: sort,
    parent_id: q(s.category),
    price: s.price,
    cost: 0,
    min_quantity: s.min_quantity,
    completion_days: s.delivery_days,
    cellophane_type: q(s.lamination === 'glossy' ? 'glossy' : s.lamination === 'matte' ? 'matte' : 'none'),
    print_enabled: s.shows_in_print ? 'true' : 'false',
    faces: s.sides === 'double' ? 2 : 1,
    ai_enabled: 'true',
    ai_fee: 1000,
    ai_canvas: q(canvasFor(s)),
    ai_size_label: q(s.size || null),
    ai_option_label: isCard ? q('اتجاه الكارت') : 'NULL',
    ai_options: isCard ? qj(CARD_OPTIONS) : `'[]'::jsonb`, // column is NOT NULL DEFAULT '[]'
    ai_custom_size: 'NULL',
    ai_directives: q(directivesFor(s)),
    meta: qj(metaFor(s)),
  };
  lines.push(
    `INSERT INTO public.services (${Object.keys(cols).join(', ')})\nVALUES (${Object.values(cols).join(', ')});`,
  );
}

lines.push('\n-- ── Kept AI-only products (from the pre-reset backup, print-hidden) ──────────────────');
const KEEP = { menu: 'advertising', flex: 'banners', doctor_rx: 'office', pen: 'advertising' };
let keepSort = 90;
for (const [id, parent] of Object.entries(KEEP)) {
  const r = backup.find((x) => x.id === id);
  if (!r) throw new Error(`backup row missing for kept AI-only service: ${id}`);
  keepSort += 1;
  const cols = {
    id: q(r.id),
    label: q(r.label),
    icon: q(r.icon || '📄'),
    description: q(r.description || ''),
    sort_order: keepSort,
    parent_id: q(parent),
    price: r.price ?? 0,
    cost: r.cost ?? 0,
    min_quantity: r.min_quantity ?? 1,
    completion_days: r.completion_days ?? 0,
    cellophane_type: q(r.cellophane_type || 'none'),
    print_enabled: 'false',
    faces: r.faces ?? 1,
    ai_enabled: 'true',
    ai_fee: r.ai_fee ?? 1000,
    ai_canvas: q(r.ai_canvas || '1024x1024'),
    ai_size_label: q(r.ai_size_label),
    ai_option_label: q(r.ai_option_label),
    ai_options: r.ai_options ? qj(r.ai_options) : `'[]'::jsonb`,
    ai_custom_size: r.ai_custom_size ? qj(r.ai_custom_size) : 'NULL',
    ai_directives: q(r.ai_directives),
    meta: 'NULL',
  };
  lines.push(
    `INSERT INTO public.services (${Object.keys(cols).join(', ')})\nVALUES (${Object.values(cols).join(', ')});`,
  );
}

const sql = lines.join('\n') + '\n';
writeFileSync('supabase/migrations/20260703180000_catalog_reset_seed.sql', sql);
console.log(
  `written: categories=${catalog.categories.length} services=${catalog.services.length} keepers=${Object.keys(KEEP).length} total_inserts=${catalog.categories.length + catalog.services.length + Object.keys(KEEP).length}`,
);
