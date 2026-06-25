import type { CapacitorConfig } from '@capacitor/cli';

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
  },
};

export default config;
