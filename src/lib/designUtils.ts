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
