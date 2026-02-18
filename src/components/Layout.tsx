import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, Home, User, Palette, ShieldCheck, LogIn, LogOut, Menu, X, Sun, Moon, CreditCard, FileText, Receipt, ClipboardList, UtensilsCrossed, Mail, ShoppingCart } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import type { ServiceType } from '@/data/mockData';

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-5 h-5" />,
  flyer: <FileText className="w-5 h-5" />,
  receipt: <Receipt className="w-5 h-5" />,
  letterhead: <ClipboardList className="w-5 h-5" />,
  menu: <UtensilsCrossed className="w-5 h-5" />,
  invitation: <Mail className="w-5 h-5" />,
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
      <div className="flex h-1">
        <div className="flex-1 bg-cmyk-cyan" />
        <div className="flex-1 bg-cmyk-magenta" />
        <div className="flex-1 bg-cmyk-yellow" />
        <div className="flex-1 bg-cmyk-key" />
      </div>

      <header className="sticky top-0 z-50">
        <div className="bg-card/80 backdrop-blur-xl border-b border-border/60">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMobile}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <TrendingUp className="w-4.5 h-4.5 text-destructive-foreground" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-l from-accent to-accent/80 bg-clip-text text-transparent">
                ترندي
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.filter(i => i.show).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    pathname === item.path
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

            {/* Cart icon */}
            <Link to="/cart" className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200">
              <ShoppingCart className="w-[18px] h-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>

            {/* Notification bell */}
            {user && <NotificationBell />}

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              aria-label="تبديل الوضع"
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {!loading && (
              user ? (
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                >
                  خروج
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 hover:shadow-md transition-all duration-200"
                >
                  دخول
                </Link>
              )
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="flex items-center gap-1 sm:hidden">
            <Link to="/cart" className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>
            {user && <NotificationBell />}
            <button
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Services sub-navbar */}
        <div className="bg-card/60 backdrop-blur-sm border-b border-border/40 py-3">
          <div className="container">
            <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide pb-0.5">
              {SERVICES.map((service, i) => {
                const colorClasses = [
                  'bg-[hsl(var(--cmyk-cyan))]/8 hover:bg-[hsl(var(--cmyk-cyan))]/15 text-[hsl(var(--cmyk-cyan))]',
                  'bg-[hsl(var(--cmyk-magenta))]/8 hover:bg-[hsl(var(--cmyk-magenta))]/15 text-[hsl(var(--cmyk-magenta))]',
                  'bg-[hsl(var(--cmyk-yellow))]/10 hover:bg-[hsl(var(--cmyk-yellow))]/20 text-foreground',
                  'bg-secondary/8 hover:bg-secondary/15 text-foreground',
                  'bg-primary/8 hover:bg-primary/15 text-primary',
                  'bg-accent/10 hover:bg-accent/20 text-foreground',
                ];
                const cls = colorClasses[i % colorClasses.length];
                const isActive = pathname === `/templates/${service.type}`;
                return (
                  <Link
                    key={service.type}
                    to={`/templates/${service.type}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${cls} ${
                      isActive ? 'ring-2 ring-primary/30 shadow-sm' : ''
                    }`}
                  >
                    <span className="opacity-80">{SERVICE_ICONS[service.type]}</span>
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
              className="sm:hidden overflow-hidden border-t border-border/40 bg-card/95 backdrop-blur-xl"
            >
              <div className="container py-4 space-y-1">
                {NAV_ITEMS.filter(i => i.show).map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
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
                <div className="pt-3 border-t border-border/40 mt-3">
                  <p className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">خدماتنا</p>
                  {SERVICES.map(service => (
                    <Link
                      key={service.type}
                      to={`/templates/${service.type}`}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                    >
                      <span className="text-primary">{SERVICE_ICONS[service.type]}</span>
                      {SERVICE_LABELS[service.type as ServiceType]}
                    </Link>
                  ))}
                </div>

                {/* Dark mode toggle mobile */}
                <button
                  onClick={() => setDark(d => !d)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                >
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </button>

                {!loading && (
                  user ? (
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-all duration-200"
                    >
                      <LogOut className="w-5 h-5" />
                      تسجيل خروج
                    </button>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={closeMobile}
                      className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-200"
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

      <footer className="border-t border-border/40 py-10 mt-auto bg-card/50">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-destructive-foreground" />
            </div>
            <span className="text-sm font-extrabold bg-gradient-to-l from-accent to-accent/80 bg-clip-text text-transparent">
              ترندي
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            حلقة الوصل بين الزبون والمصمم © {new Date().getFullYear()}
          </p>
        </div>
        {/* CMYK color strip */}
        <div className="flex h-0.5 mt-8">
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
