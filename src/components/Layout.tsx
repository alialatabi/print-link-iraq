import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, Home, User, Palette, ShieldCheck, LogIn, LogOut, Menu, X, Sun, Moon, ChevronDown, CreditCard, FileText, Receipt, ClipboardList, UtensilsCrossed, Mail, ShoppingCart } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import type { ServiceType } from '@/data/mockData';

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-6 h-6" />,
  flyer: <FileText className="w-6 h-6" />,
  receipt: <Receipt className="w-6 h-6" />,
  letterhead: <ClipboardList className="w-6 h-6" />,
  menu: <UtensilsCrossed className="w-6 h-6" />,
  invitation: <Mail className="w-6 h-6" />,
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const { itemCount } = useCart();
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

            {/* Cart icon */}
            <Link to="/cart" className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ShoppingCart className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

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
        <div className="bg-card border-b border-border py-3 sm:py-4">
          <div className="container">
            <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-5 overflow-x-auto scrollbar-hide pb-1">
              {SERVICES.map((service, i) => {
                const styles = [
                  { bg: 'bg-cmyk-cyan/10', iconBg: 'bg-cmyk-cyan', iconText: 'text-white', hoverBorder: 'hover:border-cmyk-cyan' },
                  { bg: 'bg-cmyk-magenta/10', iconBg: 'bg-cmyk-magenta', iconText: 'text-white', hoverBorder: 'hover:border-cmyk-magenta' },
                  { bg: 'bg-cmyk-yellow/10', iconBg: 'bg-cmyk-yellow', iconText: 'text-foreground', hoverBorder: 'hover:border-cmyk-yellow' },
                  { bg: 'bg-cmyk-key/10', iconBg: 'bg-cmyk-key', iconText: 'text-white', hoverBorder: 'hover:border-cmyk-key' },
                  { bg: 'bg-primary/10', iconBg: 'bg-primary', iconText: 'text-primary-foreground', hoverBorder: 'hover:border-primary' },
                  { bg: 'bg-accent/10', iconBg: 'bg-accent', iconText: 'text-accent-foreground', hoverBorder: 'hover:border-accent' },
                ];
                const s = styles[i % styles.length];
                const isActive = pathname === `/templates/${service.type}`;
                return (
                  <Link
                    key={service.type}
                    to={`/templates/${service.type}`}
                    className={`flex flex-col items-center gap-2 px-4 py-3 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${s.hoverBorder} ${
                      isActive ? `border-primary ${s.bg}` : `border-transparent ${s.bg}`
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center shadow-sm`}>
                      {SERVICE_ICONS[service.type]}
                    </div>
                    <span className="text-xs font-bold text-foreground whitespace-nowrap">{SERVICE_LABELS[service.type as ServiceType]}</span>
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
