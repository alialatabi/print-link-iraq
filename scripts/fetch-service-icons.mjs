// Downloads a consistent, colorful icon per catalog service (Microsoft Fluent Emoji — flat
// variant, MIT licensed) from the Iconify API, rasterizes to 256px PNG with sharp, and writes
// them to public/service-icons/{serviceId}.png (served from matbaty.com — icon_url points there
// via migration 20260703200000_service_icon_urls.sql, which this script also generates).
// Rerunnable; fails loudly if any icon name is unknown so mappings stay correct.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SITE = 'https://matbaty.com';
const OUT_DIR = 'public/service-icons';
const SET = 'fluent-emoji-flat';

// serviceId -> fluent-emoji-flat icon name (mirrors the approved emoji meanings)
const ICONS = {
  // categories (parents) — consistent style across the whole browse tree
  cards: 'credit-card',
  office: 'file-folder',
  receipt_book: 'receipt',
  stamps: 'postbox',
  stickers: 'label',
  packaging: 'shopping-bags',
  advertising: 'megaphone',
  banners: 'placard',
  // كروت
  card_iq_1: 'identification-card',
  card_iq_2: 'credit-card',
  card_turkish: 'crown',
  card_ivory_1: 'white-heart',
  card_ivory_2: 'diamond-with-a-dot',
  // مطبوعات إدارية
  master_folder: 'open-file-folder',
  file_folder: 'card-index-dividers',
  letterhead: 'page-facing-up',
  doctor_rx: 'stethoscope',
  // وصولات
  receipt_a4: 'receipt',
  receipt_a5: 'clipboard',
  receipt_a6: 'spiral-notepad',
  receipt_dl: 'bookmark-tabs',
  // أختام
  stamp_rect_6x4: 'blue-square',
  stamp_rect_5x3: 'blue-square',
  stamp_rect_47x18: 'blue-square',
  stamp_rect_35x14: 'blue-square',
  stamp_sq_5x5: 'radio-button',
  stamp_sq_4x4: 'radio-button',
  stamp_sq_3x3: 'radio-button',
  stamp_sq_2x2: 'radio-button',
  stamp_oval_3x45: 'hollow-red-circle',
  stamp_oval_35x55: 'hollow-red-circle',
  stamp_pocket_35x14: 'clutch-bag',
  stamp_pocket_47x18: 'clutch-bag',
  stamp_color: 'rainbow',
  // ملصقات
  sticker_round_3: 'white-circle',
  sticker_round_4: 'blue-circle',
  sticker_round_5: 'green-circle',
  sticker_round_6: 'yellow-circle',
  sticker_rect_card: 'label',
  // تغليف
  bag_16x25_500: 'shopping-bags',
  bag_20x30_500: 'shopping-bags',
  bag_25x35_500: 'shopping-bags',
  bag_30x40_500: 'shopping-bags',
  bag_37x50_500: 'shopping-bags',
  bag_16x25_1000: 'handbag',
  bag_20x30_1000: 'handbag',
  bag_25x35_1000: 'handbag',
  bag_30x40_1000: 'handbag',
  bag_37x50_1000: 'handbag',
  // مواد إعلانية
  brochure_a4: 'newspaper',
  brochure_a5: 'rolled-up-newspaper',
  brochure_4c_1: 'page-with-curl',
  brochure_4c_2: 'open-book',
  menu: 'fork-and-knife-with-plate',
  pen: 'pen',
  // لوحات وإعلانات
  rollup: 'scroll',
  flex: 'framed-picture',
};

mkdirSync(OUT_DIR, { recursive: true });
const svgCache = new Map();
let ok = 0;
const failures = [];

for (const [serviceId, icon] of Object.entries(ICONS)) {
  try {
    let svg = svgCache.get(icon);
    if (!svg) {
      const res = await fetch(`https://api.iconify.design/${SET}/${icon}.svg?width=256&height=256`);
      const body = await res.text();
      if (!res.ok || !body.includes('<svg')) throw new Error(`iconify ${res.status}: ${body.slice(0, 80)}`);
      svg = body;
      svgCache.set(icon, svg);
    }
    const png = await sharp(Buffer.from(svg)).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    writeFileSync(`${OUT_DIR}/${serviceId}.png`, png);
    ok += 1;
  } catch (e) {
    failures.push(`${serviceId} (${icon}): ${e.message}`);
  }
}

if (failures.length) {
  console.error('FAILED:\n' + failures.join('\n'));
  process.exit(1);
}

// Generate the icon_url migration.
const lines = [
  '-- Real image icons for the launch catalog: Microsoft Fluent Emoji (flat, MIT) rendered to',
  '-- 256px PNGs in public/service-icons/ (see scripts/fetch-service-icons.mjs), served from the',
  '-- site itself. The emoji `icon` column stays as the fallback while the deploy propagates.',
];
for (const serviceId of Object.keys(ICONS)) {
  lines.push(`UPDATE public.services SET icon_url = '${SITE}/service-icons/${serviceId}.png' WHERE id = '${serviceId}';`);
}
writeFileSync('supabase/migrations/20260703200000_service_icon_urls.sql', lines.join('\n') + '\n');
console.log(`icons written: ${ok}/${Object.keys(ICONS).length} → ${OUT_DIR}; migration generated.`);
