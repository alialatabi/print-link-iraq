/**
 * Design-related utility functions, extracted from designVault.ts and storage.ts
 * during Phase 1.2 of the refactor plan.
 *
 * Re-exports are present in both source modules so existing import paths
 * continue to work without any changes in callers.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Image detection ─────────────────────────────────────────────────────────

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];

/**
 * True when a URL/path points at a directly-renderable raster image (not pdf/psd/etc).
 * Moved from `src/lib/designVault.ts`; re-exported there for backward compatibility.
 */
export function isImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.includes(ext);
}

// ─── Signed URL helper ────────────────────────────────────────────────────────

/**
 * Generate a signed URL for a design file stored in the private 'designs' bucket.
 * @param filePath - The storage path (e.g., "orderId/v1.png")
 * @param downloadName - When set, the signed URL forces a download (Content-Disposition: attachment) with this filename.
 * @returns Signed URL valid for 1 hour, or null on error.
 *
 * Moved from `src/lib/storage.ts`; re-exported there for backward compatibility.
 */
export const getDesignSignedUrl = async (filePath: string, downloadName?: string): Promise<string | null> => {
  if (!filePath) return null;

  // If it's already a full URL (legacy data), try to extract the path
  if (filePath.startsWith('http')) {
    const match = filePath.split('/designs/')[1];
    if (match) {
      filePath = decodeURIComponent(match);
    } else {
      return null;
    }
  }

  const { data, error } = await supabase.storage
    .from('designs')
    .createSignedUrl(filePath, 3600, downloadName ? { download: downloadName } : undefined); // 1 hour

  if (error) {
    console.error('Failed to generate signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
};

// ─── Direct approve→print eligibility (designer) ──────────────────────────────

export interface DirectPrintEligibility {
  /** Show the direct "approve & send to print" action at all. */
  canDirectPrint: boolean;
  /** Blocked specifically because it's an AI draft with no designer-uploaded final. */
  blockedAiDraft: boolean;
}

/**
 * Decide whether a designer may approve an item and send it straight to print, and — for AI
 * items — whether it is blocked because only the AI *draft* exists.
 *
 * Rules:
 *  - The item's status must allow work (`canWork`).
 *  - AI-design items may ONLY be printed from a designer-uploaded final. The image the customer
 *    attached is an AI DRAFT (needs Arabic typesetting / print prep) and must never be dispatched
 *    to the print group — so attachments do NOT unlock direct print for AI items.
 *  - Non-AI items may be printed from an uploaded design OR a customer-attached print-ready file.
 *
 * Pure — no I/O — so the guard is unit-tested independently of the component.
 */
export function evaluateDirectPrint(opts: {
  canWork: boolean;
  isAiDesign: boolean;
  hasUploadedDesign: boolean;
  attachmentCount: number;
}): DirectPrintEligibility {
  const { canWork, isAiDesign, hasUploadedDesign, attachmentCount } = opts;
  if (!canWork) return { canDirectPrint: false, blockedAiDraft: false };
  if (isAiDesign) {
    return { canDirectPrint: hasUploadedDesign, blockedAiDraft: !hasUploadedDesign };
  }
  return { canDirectPrint: hasUploadedDesign || attachmentCount > 0, blockedAiDraft: false };
}

// ─── Human-readable file size ─────────────────────────────────────────────────

/**
 * Format a byte count as a short human string (e.g. `1.4MB`, `820KB`, `512B`). Uses en-US digits
 * (matmaa shows file sizes LTR next to filenames). Pure — unit-tested.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)}KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)}MB`;
}
