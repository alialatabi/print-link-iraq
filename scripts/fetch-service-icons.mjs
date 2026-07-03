// Downloads a consistent icon per catalog service — Material Design Icons (Apache 2.0) via the
// Iconify API, tinted in the brand cyan and rasterized to a padded 256px PNG (icon at ~70% so it
// breathes inside the UI's rounded containers). Writes public/service-icons/{serviceId}.png; the
// icon_url values (migration 20260703200000) already point at these paths, so regenerating +
// deploying is enough to refresh every icon. Rerunnable; fails loudly on unknown icon names.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const OUT_DIR = 'public/service-icons';
const SET = 'mdi';
const COLOR = '%2310B0E0'; // brand cyan #10B0E0
const CANVAS = 256;
const INNER = 176; // icon size inside the canvas (~69% => comfortable padding)

// serviceId -> mdi icon name (semantic print-trade concepts, not emoji lookalikes)
const ICONS = {
  // categories (parents)
  cards: 'card-account-details',
  office: 'briefcase-outline',
  receipt_book: 'receipt-text-outline',
  stamps: 'stamper',
  stickers: 'sticker-circle-outline',
  packaging: 'package-variant',
  advertising: 'bullhorn-outline',
  banners: 'billboard',
  // كروت
  card_iq_1: 'card-account-details-outline',
  card_iq_2: 'card-multiple',
  card_turkish: 'card-account-details-star',
  card_ivory_1: 'card-bulleted-outline',
  card_ivory_2: 'card-multiple-outline',
  // مطبوعات إدارية
  master_folder: 'folder-star-outline',
  file_folder: 'file-cabinet',
  letterhead: 'file-document-outline',
  doctor_rx: 'prescription',
  // وصولات (size in the label; the book icon differentiates the category)
  receipt_a4: 'receipt-text',
  receipt_a5: 'receipt-text-outline',
  receipt_a6: 'notebook-outline',
  receipt_dl: 'book-open-outline',
  // أختام — the real rubber-stamp icon everywhere; palette marks the color stamp
  stamp_rect_6x4: 'stamper',
  stamp_rect_5x3: 'stamper',
  stamp_rect_47x18: 'stamper',
  stamp_rect_35x14: 'stamper',
  stamp_sq_5x5: 'stamper',
  stamp_sq_4x4: 'stamper',
  stamp_sq_3x3: 'stamper',
  stamp_sq_2x2: 'stamper',
  stamp_oval_3x45: 'stamper',
  stamp_oval_35x55: 'stamper',
  stamp_pocket_35x14: 'stamper',
  stamp_pocket_47x18: 'stamper',
  stamp_color: 'palette',
  // ملصقات
  sticker_round_3: 'sticker-circle-outline',
  sticker_round_4: 'sticker-circle-outline',
  sticker_round_5: 'sticker-circle-outline',
  sticker_round_6: 'sticker-circle-outline',
  sticker_rect_card: 'sticker-outline',
  // تغليف — solid bag for the 500 packs, outline for the 1000 packs
  bag_16x25_500: 'shopping',
  bag_20x30_500: 'shopping',
  bag_25x35_500: 'shopping',
  bag_30x40_500: 'shopping',
  bag_37x50_500: 'shopping',
  bag_16x25_1000: 'shopping-outline',
  bag_20x30_1000: 'shopping-outline',
  bag_25x35_1000: 'shopping-outline',
  bag_30x40_1000: 'shopping-outline',
  bag_37x50_1000: 'shopping-outline',
  // مواد إعلانية
  brochure_a4: 'newspaper-variant',
  brochure_a5: 'newspaper-variant-outline',
  brochure_4c_1: 'file-document-multiple-outline',
  brochure_4c_2: 'book-open-page-variant-outline',
  menu: 'silverware-fork-knife',
  pen: 'pen',
  // لوحات وإعلانات
  rollup: 'presentation',
  flex: 'billboard',
};

mkdirSync(OUT_DIR, { recursive: true });
const pngCache = new Map();
let ok = 0;
const failures = [];
const pad = Math.round((CANVAS - INNER) / 2);

for (const [serviceId, icon] of Object.entries(ICONS)) {
  try {
    let png = pngCache.get(icon);
    if (!png) {
      const res = await fetch(`https://api.iconify.design/${SET}/${icon}.svg?color=${COLOR}&width=${INNER}&height=${INNER}`);
      const body = await res.text();
      if (!res.ok || !body.includes('<svg')) throw new Error(`iconify ${res.status}: ${body.slice(0, 80)}`);
      png = await sharp(Buffer.from(body))
        .resize(INNER, INNER, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      pngCache.set(icon, png);
    }
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
console.log(`icons written: ${ok}/${Object.keys(ICONS).length} → ${OUT_DIR} (padded ${INNER}/${CANVAS}, ${SET}, brand cyan)`);
