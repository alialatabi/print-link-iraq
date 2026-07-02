/**
 * Unit tests for src/lib/share.ts
 *
 * The pure helpers (`buildShareText`, `buildWhatsAppUrl`, `selectShareStrategy`,
 * `isShareCancellation`) are tested directly. `shareContent` is exercised in the web
 * environment (jsdom → Capacitor.isNativePlatform() is false, so the native @capacitor/share
 * branch is never taken) by mocking `navigator.share` and `window.open` — covering the
 * Web-Share path, the wa.me fallback, and silent handling of a user-cancelled share.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildShareText,
  buildWhatsAppUrl,
  selectShareStrategy,
  isShareCancellation,
  shareContent,
} from './share';

// ---------------------------------------------------------------------------
// buildShareText
// ---------------------------------------------------------------------------

describe('buildShareText', () => {
  it('appends the url on its own line when provided', () => {
    expect(buildShareText({ text: 'تابع حالة طلبي في مطبعتي 🖨️', url: 'https://matbaty.com/track-order/abc' }))
      .toBe('تابع حالة طلبي في مطبعتي 🖨️\nhttps://matbaty.com/track-order/abc');
  });

  it('returns just the trimmed text when no url is given', () => {
    expect(buildShareText({ text: '  شوفوا التصميم  ' })).toBe('شوفوا التصميم');
  });
});

// ---------------------------------------------------------------------------
// buildWhatsAppUrl
// ---------------------------------------------------------------------------

describe('buildWhatsAppUrl', () => {
  it('encodes the composed text+url into a wa.me link', () => {
    const url = buildWhatsAppUrl({ text: 'hi there', url: 'https://a.b/c d' });
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    // Round-trips back to the exact composed message (spaces/newlines encoded).
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe('hi there\nhttps://a.b/c d');
  });

  it('percent-encodes spaces and newlines (no raw whitespace in the query)', () => {
    const url = buildWhatsAppUrl({ text: 'a b', url: 'https://x/y' });
    expect(url).not.toMatch(/text=[^&]*\s/);
  });
});

// ---------------------------------------------------------------------------
// selectShareStrategy — the fallback-selection logic
// ---------------------------------------------------------------------------

describe('selectShareStrategy', () => {
  it('prefers the native share sheet whenever running natively', () => {
    expect(selectShareStrategy({ isNative: true, canWebShare: true })).toBe('native');
    expect(selectShareStrategy({ isNative: true, canWebShare: false })).toBe('native');
  });

  it('uses the Web Share API when not native and it is available', () => {
    expect(selectShareStrategy({ isNative: false, canWebShare: true })).toBe('web');
  });

  it('falls back to WhatsApp when neither native nor Web Share is available', () => {
    expect(selectShareStrategy({ isNative: false, canWebShare: false })).toBe('whatsapp');
  });
});

// ---------------------------------------------------------------------------
// isShareCancellation
// ---------------------------------------------------------------------------

describe('isShareCancellation', () => {
  it('detects a Web-Share AbortError by name', () => {
    expect(isShareCancellation(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
  });

  it('detects a native "Share canceled" message', () => {
    expect(isShareCancellation(new Error('Share canceled'))).toBe(true);
    expect(isShareCancellation(new Error('Abort'))).toBe(true);
  });

  it('treats a genuine failure as NOT a cancellation', () => {
    expect(isShareCancellation(new Error('network unreachable'))).toBe(false);
    expect(isShareCancellation(new Error('NotAllowedError: permission denied'))).toBe(false);
  });

  it('handles null / undefined safely', () => {
    expect(isShareCancellation(null)).toBe(false);
    expect(isShareCancellation(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shareContent — web environment (native branch is unreachable under jsdom)
// ---------------------------------------------------------------------------

describe('shareContent (web env)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { share?: unknown }).share;
  });

  const setNavigatorShare = (fn: unknown) =>
    Object.defineProperty(navigator, 'share', { value: fn, configurable: true, writable: true });

  it('uses navigator.share when the Web Share API is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorShare(share);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await shareContent({ title: 'ttl', text: 'hi', url: 'https://a' });

    expect(share).toHaveBeenCalledWith({ title: 'ttl', text: 'hi', url: 'https://a' });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('falls back to the wa.me link when the Web Share API is absent', async () => {
    delete (navigator as { share?: unknown }).share;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await shareContent({ text: 'hi', url: 'https://a' });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const opened = openSpy.mock.calls[0][0] as string;
    expect(opened.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(opened.slice('https://wa.me/?text='.length))).toBe('hi\nhttps://a');
  });

  it('silently swallows a user-cancelled share (no wa.me fallback)', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('Abort'), { name: 'AbortError' }));
    setNavigatorShare(share);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await expect(shareContent({ text: 'hi', url: 'https://a' })).resolves.toBeUndefined();

    expect(share).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('degrades to the wa.me link when navigator.share fails for a real reason', async () => {
    const share = vi.fn().mockRejectedValue(new Error('NotAllowedError: permission denied'));
    setNavigatorShare(share);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    await shareContent({ text: 'hi', url: 'https://a' });

    expect(share).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
