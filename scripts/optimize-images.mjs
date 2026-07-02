// One-shot asset optimizer (P0 #6, docs/UX-AUDIT-2026-07-02.md).
// Generates the WebP variants the app actually ships:
//   public/hero-card.webp      — desktop hero  (1200px wide, q80)  from public/hero-card.png
//   public/hero-card-sm.webp   — mobile hero   (640px wide,  q80)  from public/hero-card.png
//   src/assets/logo-small.webp — header/footer logo (160px tall, q90) from src/assets/logo.png
//
// NOTE: the unreferenced 5.1 MB public/hero-card.png was deleted after these variants were
// generated (2026-07-02), so its jobs are skipped on re-runs unless the original is restored.
//
// Usage: node scripts/optimize-images.mjs

import sharp from 'sharp';
import { stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function report(file) {
  const { size } = await stat(file);
  const { width, height } = await sharp(file).metadata();
  console.log(`${path.relative(root, file)}  ${width}x${height}  ${size} B (${kb(size)})`);
  return { width, height, size };
}

// src → dest, skipping (with a warning) when the source original is gone.
async function convert(src, dest, resize, quality) {
  if (!existsSync(src)) {
    console.warn(`skip ${path.relative(root, dest)} — source ${path.relative(root, src)} not found`);
    return;
  }
  await sharp(src).resize({ ...resize, withoutEnlargement: true }).webp({ quality }).toFile(dest);
  await report(dest);
}

async function main() {
  const heroSrc = path.join(root, 'public', 'hero-card.png');
  const logoSrc = path.join(root, 'src', 'assets', 'logo.png');

  await convert(heroSrc, path.join(root, 'public', 'hero-card.webp'), { width: 1200 }, 80);
  await convert(heroSrc, path.join(root, 'public', 'hero-card-sm.webp'), { width: 640 }, 80);
  await convert(logoSrc, path.join(root, 'src', 'assets', 'logo-small.webp'), { height: 160 }, 90);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
