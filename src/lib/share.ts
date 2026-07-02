import { Capacitor } from '@capacitor/core';

/**
 * Cross-platform share helper — share an order-tracking link or a design to WhatsApp & co.
 *
 * Channel selection (see `selectShareStrategy`):
 *   1. Native app         → @capacitor/share (the system share sheet), dynamically imported
 *      so the plugin never lands in the web bundle (mirrors the pattern in src/lib/push.ts).
 *   2. Web + Web Share API → navigator.share (Android Chrome, iOS Safari, …).
 *   3. Anything else       → open https://wa.me/?text=… in a new tab. WhatsApp is the dominant
 *      channel in Iraq, so it is the deliberate final fallback.
 *
 * A user-cancelled share (AbortError / "cancel") is swallowed silently — never surfaced as an
 * error and never re-routed to the wa.me fallback (which would re-open a sheet they dismissed).
 */

/** Canonical public origin (kept in sync with SEOHead's BASE_URL). */
export const SITE_URL = 'https://matbaty.com';

export interface ShareContentInput {
  /** Share-sheet title / email subject. */
  title?: string;
  /** The message body (Arabic). */
  text: string;
  /** A link to share (http/https, or file:// on native). */
  url?: string;
  /**
   * file:// URIs to share. Native (iOS/Android) only — the Web Share API needs File objects,
   * not URI strings, so `files` is ignored on the web (matches @capacitor/share's own semantics).
   */
  files?: string[];
  /** Android share-modal title; defaults to `title`. */
  dialogTitle?: string;
}

export type ShareStrategy = 'native' | 'web' | 'whatsapp';

/**
 * Pure channel-selection logic: native wins; else the Web Share API if present; else WhatsApp.
 * Extracted so the fallback decision is unit-testable without a real platform/navigator.
 */
export function selectShareStrategy(env: { isNative: boolean; canWebShare: boolean }): ShareStrategy {
  if (env.isNative) return 'native';
  if (env.canWebShare) return 'web';
  return 'whatsapp';
}

/** Compose the Arabic share message: the text, with the URL appended on its own line. Pure. */
export function buildShareText(input: { text: string; url?: string }): string {
  const text = input.text.trim();
  return input.url ? `${text}\n${input.url}` : text;
}

/** Build a wa.me deep link that pre-fills the composed message (text + url). Pure. */
export function buildWhatsAppUrl(input: { text: string; url?: string }): string {
  return `https://wa.me/?text=${encodeURIComponent(buildShareText(input))}`;
}

/** True when an error represents the user dismissing the share sheet (not a real failure). */
export function isShareCancellation(err: unknown): boolean {
  if (!err) return false;
  if ((err as { name?: string }).name === 'AbortError') return true;
  const message = String((err as { message?: string }).message ?? err);
  return /abort|cancel/i.test(message);
}

/** Whether the current environment exposes the Web Share API. */
function hasWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Open the WhatsApp share composer in a new tab / the system browser. */
function openWhatsApp(input: ShareContentInput): void {
  if (typeof window === 'undefined') return;
  window.open(buildWhatsAppUrl(input), '_blank', 'noopener,noreferrer');
}

/**
 * Share content across the best available channel. Resolves once the share has been handed off
 * (or the WhatsApp fallback opened); never rejects — a cancelled share resolves quietly, and a
 * real native/web-share failure degrades to the wa.me fallback.
 */
export async function shareContent(input: ShareContentInput): Promise<void> {
  const strategy = selectShareStrategy({
    isNative: Capacitor.isNativePlatform(),
    canWebShare: hasWebShare(),
  });

  if (strategy === 'native') {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: input.title,
        text: input.text,
        url: input.url,
        files: input.files,
        dialogTitle: input.dialogTitle ?? input.title,
      });
      return;
    } catch (err) {
      if (isShareCancellation(err)) return;
      // Real failure → fall through to the WhatsApp fallback below.
    }
  } else if (strategy === 'web') {
    try {
      await navigator.share({ title: input.title, text: input.text, url: input.url });
      return;
    } catch (err) {
      if (isShareCancellation(err)) return;
      // Real failure → fall through to the WhatsApp fallback below.
    }
  }

  openWhatsApp(input);
}
