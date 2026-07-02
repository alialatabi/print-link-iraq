import { ReactNode, useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, ShoppingCart, Home, Sparkles, Package, Archive, User, Store, PlusCircle,
  Sun, Moon, type LucideIcon,
} from 'lucide-react';
import logoImg from '@/assets/logo-small.webp';
import NotificationBell from '@/components/NotificationBell';
import PullToRefresh from '@/components/native/PullToRefresh';
import { applyStatusBarTheme } from '@/lib/native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

interface NativeTab {
  icon: LucideIcon;
  label: string;
  path: string;
  /** Extra path prefixes that should also light up this tab (e.g. the browse flow). */
  match?: string[];
  /** Render this tab in a prominent, stand-out style (e.g. the AI design action). */
  highlight?: boolean;
}

// Full-screen flows: hide the bottom tab bar and show a back-only top bar.
const FULLSCREEN = ['/auth', '/staff-login', '/designer/login', '/complete-profile', '/verify-otp'];

// Optional short screen titles shown beside the back button on non-root screens.
const TITLES: Record<string, string> = {
  '/': 'الرئيسية',
  '/services': 'الخدمات',
  '/my-orders': 'طلباتي',
  '/design-vault': 'الخزنة',
  '/reorder-design': 'طلب تصميم',
  '/profile': 'حسابي',
  '/cart': 'السلة',
  '/reseller': 'الطلبات',
  '/reseller/new': 'طلب جديد',
};

const matchPath = (pathname: string, p: string) =>
  p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/');

const NativeShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { itemCount } = useCart();
  const qc = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  // Dark mode (native-only). The class drives the existing `.dark` design tokens; persisted in
  // localStorage and re-applied before paint in platform.ts so there's no flash on next launch.
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    applyStatusBarTheme(next);
  };

  // Pull-to-refresh: invalidate React Query caches AND remount the current route so pages
  // that fetch in their own effects reload too. Auth/Cart contexts live above the shell, so
  // the user stays logged in. The short delay keeps the spinner visible long enough to read.
  const handleRefresh = useCallback(async () => {
    qc.invalidateQueries();
    setRefreshKey(k => k + 1);
    await new Promise(r => setTimeout(r, 650));
  }, [qc]);

  // Customer / anonymous (and the safe fallback for admin/designer, who never reach native).
  const customerTabs: NativeTab[] = [
    { icon: Home, label: 'الرئيسية', path: '/' },
    { icon: Sparkles, label: 'تصميم AI', path: '/ai-design', highlight: true },
    { icon: Package, label: 'طلباتي', path: '/my-orders' },
    { icon: Archive, label: 'الخزنة', path: '/design-vault' },
    { icon: User, label: 'حسابي', path: user ? '/profile' : '/auth' },
  ];

  const resellerTabs: NativeTab[] = [
    { icon: Store, label: 'الطلبات', path: '/reseller' },
    { icon: PlusCircle, label: 'طلب جديد', path: '/reseller/new' },
    { icon: User, label: 'حسابي', path: '/profile' },
  ];

  const tabs = role === 'reseller' ? resellerTabs : customerTabs;

  const fullScreen = FULLSCREEN.some(p => matchPath(pathname, p));
  const showTabBar = !fullScreen;

  const rootPaths = tabs.map(t => t.path);
  const isRoot = rootPaths.includes(pathname);
  const title = TITLES[pathname];

  const isActive = (tab: NativeTab) => {
    const paths = tab.match ?? [tab.path];
    if (!paths.some(p => matchPath(pathname, p))) return false;
    // Don't also light up a less-specific sibling (e.g. /reseller while on /reseller/new).
    return !tabs.some(other =>
      other !== tab &&
      (other.match ?? [other.path]).some(p => p.length > tab.path.length && matchPath(pathname, p)),
    );
  };

  return (
    <div dir="rtl" className="native-app flex flex-col h-[100dvh] overflow-hidden bg-white dark:bg-background font-tajawal">
      {/* TOP BAR */}
      <header className="shrink-0 bg-white/95 dark:bg-card/95 backdrop-blur-xl border-b border-[#EFE7DC] dark:border-border pt-[env(safe-area-inset-top)]">
        <div className="h-14 px-4 flex items-center justify-between">
          {/* leading (right in RTL): logo on root tabs, else back chevron + optional title */}
          <div className="flex items-center gap-2 min-w-0">
            {isRoot && !fullScreen ? (
              <img src={logoImg} alt="مطبعتي" className="h-9 object-contain" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="رجوع"
                  className="-mr-1 p-1.5 rounded-xl text-[#243262] dark:text-foreground active:scale-90 transition-transform"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                {title && <span className="text-[15px] font-bold text-[#243262] dark:text-foreground truncate">{title}</span>}
              </>
            )}
          </div>

          {/* trailing (left in RTL = visual end): bell + cart, hidden on full-screen flows */}
          {!fullScreen && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="تبديل المظهر"
                className="p-2 rounded-xl text-[#6F6657] dark:text-gray-300 active:scale-90 transition-transform"
              >
                {dark ? <Sun className="w-[21px] h-[21px]" /> : <Moon className="w-[21px] h-[21px]" />}
              </button>
              {user && <NotificationBell />}
              {role !== 'reseller' && (
                <Link
                  to="/cart"
                  aria-label="السلة"
                  className="relative p-2 rounded-xl text-[#6F6657] dark:text-gray-300 active:scale-90 transition-transform"
                >
                  <ShoppingCart className="w-[22px] h-[22px]" />
                  {itemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-[#10B0E0] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                      {itemCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* SCROLLABLE PAGE AREA (with pull-to-refresh) — min-h-0 is required so it scrolls.
          The keyed wrapper remounts the active route on refresh; min-h-full lets a single
          short page (e.g. the hero) fill the area while long pages still scroll. */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 min-h-0">
        <div key={refreshKey} className="min-h-full flex flex-col">{children}</div>
      </PullToRefresh>

      {/* BOTTOM TAB BAR */}
      {showTabBar && (
        <nav className="shrink-0 bg-white dark:bg-card border-t border-[#EFE7DC] dark:border-border pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-stretch">
            {tabs.map(tab => {
              const active = isActive(tab);
              const Icon = tab.icon;
              if (tab.highlight) {
                // Stand-out action tab (AI design): a filled cyan→magenta gradient chip.
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 active:scale-95 transition-transform"
                  >
                    <span className={`w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10B0E0] to-[#D0207F] flex items-center justify-center shadow-[0_8px_18px_-6px_rgba(208,32,127,.6)] ${active ? 'ring-2 ring-[#D0207F]/30' : ''}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </span>
                    <span className="text-[10px] font-extrabold text-[#D0207F]">{tab.label}</span>
                  </Link>
                );
              }
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 active:scale-95 transition-transform ${
                    active ? 'text-[#10B0E0]' : 'text-[#9A8F7C] dark:text-gray-500'
                  }`}
                >
                  <Icon className="w-[22px] h-[22px]" />
                  <span className="text-[10px] font-bold">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default NativeShell;
