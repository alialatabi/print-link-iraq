/**
 * Generates an optimized image URL using Supabase Storage's image transformation API.
 * Converts /object/public/ URLs to /render/image/public/ with width/height/quality params.
 * Non-Supabase URLs are returned unchanged.
 * 
 * Quality is kept at 100 to preserve original image quality as per project policy.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string {
  if (!url) return '';

  const { width, height, quality = 85 } = options;

  // Only transform Supabase storage URLs
  if (!url.includes('supabase.co/storage/v1/object/public/')) {
    return url;
  }

  // Replace /object/public/ with /render/image/public/ for transformation API
  let transformedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));

  const separator = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${separator}${params.toString()}`;
}
