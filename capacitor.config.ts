import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// Wraps the built Vite web app (web-dir: dist) into native iOS/Android shells. The app still talks
// to Supabase over HTTPS exactly as on the web — only the auth session storage differs on device
// (see src/integrations/supabase/client.ts, which uses @capacitor/preferences on native).
const config: CapacitorConfig = {
  appId: 'com.matbaaty.app',
  appName: 'Matbaaty', // Latin for the native project; the Arabic display label (مطبعتي) is set in
                       // the native resources (android: app/src/main/res/values/strings.xml).
  webDir: 'dist',
  backgroundColor: '#F6EFE5', // matches the app's cream background (--background) to avoid flashes
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#F6EFE5',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      // iOS: resize the whole WebView when the keyboard shows so `100dvh`/`vh` shrink to the
      // visible area — mirrors Android's windowSoftInputMode=adjustResize. `Body` would only
      // resize <body> and leave viewport units untouched, so the 100dvh app shell wouldn't
      // shrink and the keyboard would still cover the bottom inputs/buttons.
      resize: KeyboardResize.Native,
      // Android: the app draws behind the status bar (safe-area insets ⇒ "full screen"), where a
      // known bug stops adjustResize from resizing the WebView; this workaround restores it.
      resizeOnFullScreen: true,
    },
  },
};

export default config;
