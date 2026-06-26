import { isNativeApp } from '@/lib/platform';
import { Preferences } from '@capacitor/preferences';

/**
 * Biometric ("fingerprint / face") login for the native app.
 *
 * Model: the user's phone + 6-digit PIN are stored in app-private Preferences and gated
 * by a biometric prompt on *retrieval*. Biometric login then performs a normal `phone-login`
 * with those credentials — so it is independent of session/token revocation (a stored refresh
 * token is killed by any sign-out, which is why that approach didn't work). On web: all no-ops.
 *
 * Note: the PIN is stored app-private (not hardware-encrypted). A Keystore/Keychain secure-storage
 * plugin would harden this further — see SECURITY_AUDIT.md.
 */

const CRED_KEY = 'mb_bio_cred';   // JSON { phone, pin } — presence = biometric enabled (PIN-gated)
const PHONE_KEY = 'mb_bio_phone'; // the enrolled phone (unguarded) — for the per-number check

interface BioCred { phone: string; pin: string; }

const normPhone = (p: string) => p.replace(/\s+/g, '').replace(/^0/, '964');

// Lazily load the plugin MODULE (never the proxy itself). Returning the Capacitor plugin
// proxy from an async fn makes Promise.resolve probe `proxy.then`, which the proxy turns into
// a bogus native `BiometricAuthNative.then()` call. Caching the module namespace avoids that.
let cachedMod: typeof import('@aparajita/capacitor-biometric-auth') | null | undefined;
async function loadMod() {
  if (!isNativeApp) return null;
  if (cachedMod !== undefined) return cachedMod;
  try {
    cachedMod = await import('@aparajita/capacitor-biometric-auth');
  } catch {
    cachedMod = null;
  }
  return cachedMod;
}

/** Device has enrolled biometric hardware available. */
export async function biometricSupported(): Promise<boolean> {
  const mod = await loadMod();
  if (!mod) return false;
  try {
    const info = await mod.BiometricAuth.checkBiometry();
    return !!info.isAvailable;
  } catch {
    return false;
  }
}

/** Biometric login is set up on this device (credentials are stored). */
export async function biometricEnabled(): Promise<boolean> {
  if (!isNativeApp) return false;
  try {
    const { value } = await Preferences.get({ key: CRED_KEY });
    return !!value;
  } catch {
    return false;
  }
}

/**
 * Biometric is enrolled on this device FOR THIS PHONE and the hardware is available.
 * Used by the sign-in screen to show fingerprint instead of the PIN for the right number only.
 */
export async function biometricEnabledForPhone(phone: string): Promise<boolean> {
  if (!isNativeApp || !phone) return false;
  try {
    const { value } = await Preferences.get({ key: PHONE_KEY });
    if (!value || value !== normPhone(phone)) return false;
    return await biometricSupported();
  } catch {
    return false;
  }
}

async function promptBiometric(reason: string): Promise<boolean> {
  const mod = await loadMod();
  if (!mod) return false;
  try {
    // Pure biometric (no device-credential fallback — that combo can fail to call back
    // on some devices). Raced against a timeout so a stuck prompt can never hang the UI.
    const auth = mod.BiometricAuth.authenticate({
      reason,
      cancelTitle: 'إلغاء',
      androidTitle: 'تسجيل الدخول بالبصمة',
      androidSubtitle: reason,
    }).then(() => true).catch(() => false);
    const timeout = new Promise<boolean>((res) => setTimeout(() => res(false), 60000));
    return await Promise.race([auth, timeout]);
  } catch {
    return false;
  }
}

/**
 * Enable biometric login (deliberate opt-in from the profile toggle): confirm the user's
 * biometric, then store their phone + PIN. Returns false if unsupported or the user cancels.
 */
export async function enableBiometric(phone: string, pin: string): Promise<boolean> {
  if (!isNativeApp || !phone || !pin) return false;
  if (!(await biometricSupported())) return false;
  if (!(await promptBiometric('فعّل تسجيل الدخول بالبصمة'))) return false;
  try {
    const np = normPhone(phone);
    await Preferences.set({ key: CRED_KEY, value: JSON.stringify({ phone: np, pin }) });
    await Preferences.set({ key: PHONE_KEY, value: np });
    return true;
  } catch {
    return false;
  }
}

/** Prompt biometric, then return the stored credentials for the caller to sign in with. */
export async function biometricRetrieve(): Promise<BioCred | null> {
  if (!(await biometricEnabled())) return null;
  if (!(await promptBiometric('تسجيل الدخول بالبصمة'))) return null;
  try {
    const { value } = await Preferences.get({ key: CRED_KEY });
    if (!value) return null;
    const cred = JSON.parse(value) as BioCred;
    return cred.phone && cred.pin ? cred : null;
  } catch {
    return null;
  }
}

export async function disableBiometric(): Promise<void> {
  try {
    await Preferences.remove({ key: CRED_KEY });
    await Preferences.remove({ key: PHONE_KEY });
  } catch { /* ignore */ }
}
