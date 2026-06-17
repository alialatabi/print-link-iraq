import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { useHeartbeat } from '@/hooks/useHeartbeat';

type AppRole = 'customer' | 'designer' | 'admin' | 'reseller';
type SignOutCallback = () => void;

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isSuperAdmin: boolean;
  phoneLogin: (phone: string, password?: string) => Promise<{ error: any; isNewUser?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

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
      supabase.from('profiles').select('phone, is_super_admin').eq('user_id', userId).single(),
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
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const phoneLogin = async (phone: string, password?: string) => {
    try {
      const body: any = { phone };
      if (password) body.password = password;
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body,
      });
      if (error) return { error };
      if (data?.error) return { error: { message: data.error } };

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { error: null, isNewUser: data?.isNewUser };
    } catch (err: any) {
      return { error: { message: err.message || 'خطأ في تسجيل الدخول' } };
    }
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setRole(null);
    setIsSuperAdmin(false);
    await supabase.auth.signOut();
  };

  // Heartbeat for all users: updates last_seen every 60s while site is open
  useHeartbeat(user?.id, !!user);

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isSuperAdmin, phoneLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
