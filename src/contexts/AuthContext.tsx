import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useHeartbeat } from '@/hooks/useHeartbeat';

type AppRole = 'customer' | 'designer' | 'admin' | 'reseller';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
  phoneLogin: (phone: string, password?: string) => Promise<{ error: { message: string } | null; isNewUser?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Keep a customer signed in for 4 weeks after their last activity, then force a
// logout so they must verify by OTP again. The server-side inactivity timeout
// is a paid Supabase feature, so we enforce the window on the client instead.
const LAST_ACTIVITY_KEY = 'mb_last_activity';
const MAX_INACTIVITY_MS = 28 * 24 * 60 * 60 * 1000; // 4 weeks

const markActivity = () => {
  try { localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString()); } catch { /* storage unavailable */ }
};

const isInactivityExpired = () => {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return false; // no record yet → don't punish an existing session
    const last = parseInt(raw, 10);
    if (!Number.isFinite(last)) return false;
    return Date.now() - last > MAX_INACTIVITY_MS;
  } catch {
    return false;
  }
};

// eslint-disable-next-line react-refresh/only-export-components -- standard React context pattern: hook + provider in one file
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchRole = async (userId: string) => {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
    ]);
    const roleList = (roles || []).map(r => r.role);

    if (roleList.includes('admin')) setRole('admin');
    else if (roleList.includes('designer')) setRole('designer');
    else if (roleList.includes('reseller')) setRole('reseller');
    else setRole('customer');

    // Check super admin from database
    setIsSuperAdmin(profile?.is_super_admin === true);
  };

  useEffect(() => {
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Refresh the activity stamp on genuine post-load events (sign-in,
          // hourly token refresh). NOT on INITIAL_SESSION — that replays the
          // persisted session and would overwrite the stamp before the
          // initial-load expiry check below can read it.
          if (event !== 'INITIAL_SESSION') markActivity();
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
        }
        // Only set loading false after initial session is handled
        if (initialSessionHandled) {
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      initialSessionHandled = true;

      // Enforce the 4-week inactivity window: if the last activity is older
      // than the limit, sign out so the customer must re-verify by OTP.
      if (session && isInactivityExpired()) {
        await supabase.auth.signOut();
        try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch { /* ignore */ }
        setSession(null);
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (session) markActivity();
      setSession(session);
      setUser(session?.user ?? null);
      // Resolve the role BEFORE clearing loading. Otherwise a direct load /
      // refresh of a protected route runs the guard while role is still null
      // and bounces the user to "/".
      if (session?.user) {
        await fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const phoneLogin = async (phone: string, password?: string) => {
    try {
      const body: Record<string, unknown> = { phone };
      if (password) body.password = password;
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body,
      });
      if (error) {
        // supabase-js returns a generic message for non-2xx and stashes the real
        // function Response in error.context — read it so the actual reason
        // (الرمز غير صحيح / تم تجاوز عدد المحاولات / …) surfaces to the caller.
        let message = error.message;
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
          const body = ctx?.json ? await ctx.json() : undefined;
          if (body?.error) message = body.error;
        } catch { /* keep the generic message */ }
        return { error: { message } };
      }
      if (data?.error) return { error: { message: data.error } };

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { error: null as null, isNewUser: data?.isNewUser };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { error: { message: err.message || 'خطأ في تسجيل الدخول' } };
    }
  };

  const signOut = async () => {
    // Drop this device's push token first so a shared phone stops delivering the
    // previous user's order notifications. Native-only + best-effort; push cleanup
    // must never block or fail the sign-out.
    try { await import('@/lib/push').then(m => m.unregisterPush()); } catch { /* ignore */ }
    // Biometric credentials are stored separately and survive sign-out, so a normal
    // (global) sign-out is fine — biometric login re-authenticates from scratch.
    setUser(null);
    setSession(null);
    setRole(null);
    setIsSuperAdmin(false);
    try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
  };

  // Register for native push notifications once the user is known (no-op on web; dynamic import
  // keeps the push code out of the web bundle).
  useEffect(() => {
    if (user?.id) { import('@/lib/push').then(m => m.registerPush(user.id)).catch(() => {}); }
  }, [user?.id]);

  // Heartbeat for all users: updates last_seen every 60s while site is open
  useHeartbeat(user?.id, !!user);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isSuperAdmin, phoneLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
