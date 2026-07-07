/**
 * Tests for `getOptimizedImageUrl` (src/lib/imageUtils.ts), which rewrites Supabase
 * storage URLs to the `/render/image/` transform endpoint.
 *
 * Covers a real regression: Supabase's default resize mode is 'cover' (crop-to-fill),
 * so passing both width + height without `resize: 'contain'` cropped landscape template
 * previews into a square. The `resize` param must only appear on the URL when the
 * caller explicitly passes it — every other call site relies on the untouched default.
 */
import { describe, it, expect } from 'vitest';
import { getOptimizedImageUrl } from './imageUtils';

describe('getOptimizedImageUrl', () => {
  it('returns an empty string for null/undefined input', () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
  });

  it('returns a non-Supabase URL unchanged', () => {
    const url = 'https://example.com/images/foo.png';
    expect(getOptimizedImageUrl(url, { width: 400, height: 400 })).toBe(url);
  });

  it('leaves an R2/other-host URL untouched even with options passed', () => {
    const url = 'https://pub-abc123.r2.dev/templates/foo.jpg';
    expect(getOptimizedImageUrl(url, { width: 400, height: 400, resize: 'contain' })).toBe(url);
  });

  it('rewrites the object path to the render/image transform path', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    const result = getOptimizedImageUrl(url, { width: 400 });
    expect(result.startsWith('https://proj.supabase.co/storage/v1/render/image/public/templates/foo.png?')).toBe(true);
  });

  it('sets width, height, and quality params when provided', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    const result = getOptimizedImageUrl(url, { width: 400, height: 533, quality: 90 });
    const query = new URL(result).searchParams;
    expect(query.get('width')).toBe('400');
    expect(query.get('height')).toBe('533');
    expect(query.get('quality')).toBe('90');
  });

  it('defaults quality to 85 when not provided', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    const result = getOptimizedImageUrl(url, { width: 400 });
    expect(new URL(result).searchParams.get('quality')).toBe('85');
  });

  it('does NOT include a resize param when the caller omits it (default call sites)', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    const result = getOptimizedImageUrl(url, { width: 400, height: 400 });
    expect(new URL(result).searchParams.has('resize')).toBe(false);
  });

  it('includes resize=contain when the caller explicitly passes it (template card fix)', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    const result = getOptimizedImageUrl(url, { width: 400, height: 400, resize: 'contain' });
    expect(new URL(result).searchParams.get('resize')).toBe('contain');
  });

  it('supports the other resize modes (cover, fill)', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png';
    expect(
      new URL(getOptimizedImageUrl(url, { width: 100, resize: 'cover' })).searchParams.get('resize')
    ).toBe('cover');
    expect(
      new URL(getOptimizedImageUrl(url, { width: 100, resize: 'fill' })).searchParams.get('resize')
    ).toBe('fill');
  });

  it('appends params with & when the source URL already has a query string', () => {
    const url = 'https://proj.supabase.co/storage/v1/object/public/templates/foo.png?token=abc';
    const result = getOptimizedImageUrl(url, { width: 400 });
    expect(result).toContain('token=abc');
    expect(result).toMatch(/\?token=abc&/);
  });
});
