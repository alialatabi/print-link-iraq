import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a signed URL for a design file stored in the private 'designs' bucket.
 * @param filePath - The storage path (e.g., "orderId/v1.png")
 * @returns Signed URL valid for 1 hour, or null on error
 */
export const getDesignSignedUrl = async (filePath: string): Promise<string | null> => {
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
    .createSignedUrl(filePath, 3600); // 1 hour

  if (error) {
    console.error('Failed to generate signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
};
