import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, Home, User, Palette, ShieldCheck, LogIn, LogOut, Menu, X, Sun, Moon, ChevronDown, CreditCard, FileText, Receipt, ClipboardList, UtensilsCrossed, Mail } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import type { ServiceType } from '@/data/mockData';

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-4 h-4" />,
  flyer: <FileText className="w-4 h-4" />,
  receipt: <Receipt className="w-4 h-4" />,
  letterhead: <ClipboardList className="w-4 h-4" />,
  menu: <UtensilsCrossed className="w-4 h-4" />,
  invitation: <Mail className="w-4 h-4" />,
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const NAV_ITEMS = [
    { label: 'الرئيسية', path: '/', icon: Home, show: true },
    { label: 'طلباتي', path: '/my-orders', icon: User, show: !!user },
    { label: 'حسابي', path: '/profile', icon: User, show: !!user },
    { label: 'المصمم', path: '/designer/orders', icon: Palette, show: role === 'designer' || role === 'admin' },
    { label: 'الإدارة', path: '/admin', icon: ShieldCheck, show: role === 'admin' },
  ];

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col font-cairo" dir="rtl">
      {/* CMYK color strip */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-cmyk-cyan" />
        <div className="flex-1 bg-cmyk-magenta" />
        <div className="flex-1 bg-cmyk-yellow" />
        <div className="flex-1 bg-cmyk-key" />
      </div>

      <header className="sticky top-0 z-50">
        <div className="bg-card/95 backdrop-blur-md border-b border-border">
          <div className="container flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2" onClick={closeMobile}>
              <TrendingUp className="w-6 h-6 text-red-500" />
              <span className="text-lg font-bold text-yellow-400">
                ترندي
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.filter(i => i.show).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

            {/* Notification bell */}
            {user && <NotificationBell />}

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="تبديل الوضع"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {!loading && (
              user ? (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  خروج
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  دخول
                </Link>
              )
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="القائمة"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Services sub-navbar */}
        <div className="hidden sm:block bg-card border-b border-border py-3">
          <div className="container">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {SERVICES.map((service, i) => {
                const colors = [
                  'bg-cmyk-cyan text-white hover:bg-cmyk-cyan/80',
                  'bg-cmyk-magenta text-white hover:bg-cmyk-magenta/80',
                  'bg-cmyk-yellow text-foreground hover:bg-cmyk-yellow/80',
                  'bg-cmyk-key text-white hover:bg-cmyk-key/80',
                  'bg-primary text-primary-foreground hover:bg-primary/80',
                  'bg-accent text-accent-foreground hover:bg-accent/80',
                ];
                const isActive = pathname === `/templates/${service.type}`;
                return (
                  <Link
                    key={service.type}
                    to={`/templates/${service.type}`}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                      isActive
                        ? `${colors[i % colors.length]} ring-2 ring-offset-2 ring-primary`
                        : colors[i % colors.length]
                    }`}
                  >
                    {SERVICE_LABELS[service.type as ServiceType]}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden overflow-hidden border-t border-border bg-card"
            >
              <div className="container py-3 space-y-1">
                {NAV_ITEMS.filter(i => i.show).map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      pathname === item.path
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                ))}

                {/* Services links mobile */}
                <div className="pt-2 border-t border-border mt-2">
                  <p className="px-4 py-2 text-xs font-bold text-muted-foreground">خدماتنا</p>
                  {SERVICES.map(service => (
                    <Link
                      key={service.type}
                      to={`/templates/${service.type}`}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="text-primary">{SERVICE_ICONS[service.type]}</span>
                      {SERVICE_LABELS[service.type as ServiceType]}
                    </Link>
                  ))}
                </div>

                {/* Dark mode toggle mobile */}
                <button
                  onClick={() => setDark(d => !d)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </button>

                {!loading && (
                  user ? (
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      تسجيل خروج
                    </button>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <LogIn className="w-5 h-5" />
                      تسجيل دخول
                    </Link>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-8 mt-auto bg-card">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-red-500" />
            <span className="text-sm font-bold text-yellow-400">
              ترندي
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            حلقة الوصل بين الزبون والمصمم © {new Date().getFullYear()}
          </p>
        </div>
        {/* CMYK color strip */}
        <div className="flex h-1 mt-6">
          <div className="flex-1 bg-cmyk-cyan" />
          <div className="flex-1 bg-cmyk-magenta" />
          <div className="flex-1 bg-cmyk-yellow" />
          <div className="flex-1 bg-cmyk-key" />
        </div>
      </footer>
    </div>
  );
};

export default Layout;
