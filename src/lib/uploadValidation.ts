/**
 * Upload validation for the PUBLIC `order-attachments` bucket (H10 — stored XSS).
 *
 * SVG/HTML/XML are deliberately excluded: served inline from a public URL they can execute
 * embedded script in our origin. We allow only raster images + PDF for customer attachments.
 * This is the client-side guard; the bucket also enforces an allowed-mime-types allowlist
 * server-side so a direct storage-API call can't bypass it.
 */

export const IMAGE_PDF_ACCEPT = '.png,.jpg,.jpeg,.pdf';
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg';

const ALLOWED_WITH_PDF = ['png', 'jpg', 'jpeg', 'pdf'];
const ALLOWED_IMAGE_ONLY = ['png', 'jpg', 'jpeg'];

const extOf = (name: string) => (name.split('.').pop() || '').toLowerCase();

/** True when the file is a safe raster image (and PDF when `pdf` is set). */
export function isAllowedAttachment(file: File, opts: { pdf?: boolean } = {}): boolean {
  const allowed = opts.pdf ? ALLOWED_WITH_PDF : ALLOWED_IMAGE_ONLY;
  if (!allowed.includes(extOf(file.name))) return false;
  // Belt-and-suspenders: reject by declared mime too (blocks image/svg+xml, text/html, …).
  const type = (file.type || '').toLowerCase();
  if (type && /(svg|html|xml|javascript)/.test(type)) return false;
  return true;
}

/** Split a file list into allowed files and the names of rejected ones. */
export function partitionAllowed(files: File[], opts: { pdf?: boolean } = {}) {
  const ok: File[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    if (isAllowedAttachment(f, opts)) ok.push(f);
    else rejected.push(f.name);
  }
  return { ok, rejected };
}
