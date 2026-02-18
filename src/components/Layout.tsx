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
    navigate('/auth');
  };

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col font-cairo" dir="rtl">
      {/* CMYK color strip */}
      <div className="flex h-0.5">
        <div className="flex-1 bg-cmyk-cyan" />
        <div className="flex-1 bg-cmyk-magenta" />
        <div className="flex-1 bg-cmyk-yellow" />
        <div className="flex-1 bg-cmyk-key" />
      </div>

      <header className="sticky top-0 z-50">
        <div className="bg-card/90 backdrop-blur-xl border-b border-border/50 shadow-card">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMobile}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
                <TrendingUp className="w-4.5 h-4.5 text-destructive-foreground" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-l from-accent to-accent/80 bg-clip-text text-transparent">
                مطبعتي
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.filter(i => i.show).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                    pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

            {/* Cart icon */}
            <Link to="/cart" className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150">
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
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
              aria-label="تبديل الوضع"
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {!loading && (
              user ? (
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                >
                  خروج
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-elevated hover:-translate-y-px transition-all duration-200"
                >
                  دخول
                </Link>
              )
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="flex items-center gap-1 sm:hidden">
            <Link to="/cart" className="relative p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>
            {user && <NotificationBell />}
            <button
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Services sub-navbar - circular icons */}
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/30">
          <div className="container">
            <div className="flex items-center justify-start sm:justify-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide py-3 px-1">
              {SERVICES.map((service) => {
                const isActive = pathname.includes(`/specializations/${service.type}`) || pathname.includes(`/templates/${service.type}`);
                return (
                  <Link
                    key={service.type}
                    to={`/specializations/${service.type}`}
                    className="flex flex-col items-center gap-1.5 min-w-[60px] group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                        : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-sm'
                    }`}>
                      {SERVICE_ICONS[service.type]}
                    </div>
                    <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}>
                      {SERVICE_LABELS[service.type as ServiceType]}
                    </span>
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
              className="sm:hidden overflow-hidden border-t border-border/30 bg-card/95 backdrop-blur-xl"
            >
              <div className="container py-4 space-y-1">
                {NAV_ITEMS.filter(i => i.show).map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      pathname === item.path
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                ))}

                {/* Services links mobile */}
                <div className="pt-3 border-t border-border/30 mt-3">
                  <p className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">خدماتنا</p>
                  {SERVICES.map(service => (
                    <Link
                      key={service.type}
                      to={`/specializations/${service.type}`}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                    >
                      <span className="text-primary">{SERVICE_ICONS[service.type]}</span>
                      {SERVICE_LABELS[service.type as ServiceType]}
                    </Link>
                  ))}
                </div>

                {/* Dark mode toggle mobile */}
                <button
                  onClick={() => setDark(d => !d)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                >
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </button>

                {!loading && (
                  user ? (
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-destructive hover:bg-destructive/5 transition-all duration-150"
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

      <footer className="border-t border-border/40 py-12 mt-auto bg-muted/30">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-destructive-foreground" />
            </div>
            <span className="text-sm font-extrabold bg-gradient-to-l from-accent to-accent/80 bg-clip-text text-transparent">
              مطبعتي
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
