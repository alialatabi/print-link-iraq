import { Capacitor } from '@capacitor/core';

/**
 * True when running inside the installed Capacitor app (Android/iOS), false in any
 * web browser. Evaluated once at module load (Capacitor.isNativePlatform() is sync).
 *
 * Use this to switch the UI into a native, app-like shell (bottom tab bar, slim top
 * bar, single-screen home) while leaving the marketing website untouched on the web.
 */
export const isNativeApp = Capacitor.isNativePlatform();

// Tag the document root in the installed app so native-only CSS (e.g. a slightly smaller
// base text size) can target `html.native`. rem-based sizes all scale from this root.
if (isNativeApp && typeof document !== 'undefined') {
  document.documentElement.classList.add('native');
  // Apply the saved theme before first paint so there's no flash (dark mode is native-only).
  try {
    if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
  } catch { /* storage unavailable */ }
}
