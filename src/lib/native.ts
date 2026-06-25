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
}
