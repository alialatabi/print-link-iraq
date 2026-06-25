import { Capacitor } from '@capacitor/core';

// Native-only startup. The app background is light (cream), so the status bar uses dark icons
// (Style.Light = "light background → dark content"). The splash is hidden once the web layer is up.
// Plugins are dynamically imported so they stay out of the web bundle. No-op on the web.
export async function initNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#F6EFE5' });
    }
  } catch { /* status bar styling is non-critical */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* ignore */ }

  try {
    const { App } = await import('@capacitor/app');

    // Android hardware back: close an open dialog/sheet first, else navigate back through the SPA,
    // else (at the root) exit the app — the expected Android behavior.
    App.addListener('backButton', ({ canGoBack }) => {
      const overlay = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (overlay) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      if (canGoBack) window.history.back();
      else App.exitApp();
    });

    // Deep links (App Links https://matbaty.com/... or the com.matbaaty.app:// scheme) → route the
    // SPA to that path so e.g. an order link opens the order inside the app. Prefer the router
    // (keeps the back stack); fall back to a full nav before React has mounted.
    const routeTo = (rawUrl: string) => {
      try {
        const u = new URL(rawUrl);
        const path = `${u.pathname}${u.search}`;
        if (!path || path === '/') return;
        const nav = (window as unknown as { __appNavigate?: (to: string) => void }).__appNavigate;
        if (nav) nav(path);
        else window.location.assign(path);
      } catch { /* ignore malformed urls */ }
    };
    App.addListener('appUrlOpen', ({ url }) => routeTo(url));
    // Cold start launched via a link → route once after boot.
    const launch = await App.getLaunchUrl();
    if (launch?.url) routeTo(launch.url);
  } catch { /* @capacitor/app not critical */ }
}
