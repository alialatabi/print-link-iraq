import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Palette, ShieldCheck, LogIn, LogOut, Menu, X, Sun, Moon, ShoppingCart } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import NotificationBell from '@/components/NotificationBell';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useServices } from '@/hooks/useServices';


const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const { services } = useServices();
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

  const isDesignerOnly = role === 'designer';

  const NAV_ITEMS = [
    { label: 'الرئيسية', path: '/', icon: Home, show: !isDesignerOnly },
    { label: 'طلباتي', path: '/my-orders', icon: User, show: !!user && !isDesignerOnly },
    { label: 'حسابي', path: '/profile', icon: User, show: !!user && !isDesignerOnly },
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
        <div className="bg-card/90 dark:bg-white/90 dark:text-[hsl(222,47%,11%)] backdrop-blur-xl border-b border-border/50 shadow-card">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMobile}>
              <img src={logoImg} alt="مطبعتي" className="h-14 w-auto object-contain drop-shadow-md" />
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
                      : 'text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

            {/* Cart icon */}
            {!isDesignerOnly && (
            <Link to="/cart" aria-label="سلة التسوق" className="relative p-2.5 rounded-xl text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100 transition-all duration-150">
              <ShoppingCart className="w-[18px] h-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>
            )}

            {/* Notification bell */}
            {user && <NotificationBell />}

            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="p-2.5 rounded-xl text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100 transition-all duration-150"
              aria-label="تبديل الوضع"
            >
              {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>

            {!loading && (
              user ? (
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-xl text-sm text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100 transition-all duration-150"
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
            {!isDesignerOnly && (
            <Link to="/cart" aria-label="سلة التسوق" className="relative p-2.5 rounded-xl text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100 transition-all duration-150">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </Link>
            )}
            {user && <NotificationBell />}
            <button
              className="p-2.5 rounded-xl text-muted-foreground dark:text-gray-600 hover:text-foreground dark:hover:text-gray-900 hover:bg-muted/60 dark:hover:bg-gray-100 transition-all duration-150"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Services sub-navbar - circular icons (hidden for designers) */}
        {!isDesignerOnly && !pathname.startsWith('/auth') && !pathname.startsWith('/staff-login') && !pathname.startsWith('/designer/login') && (
        <div className="bg-card/50 dark:bg-white/50 dark:text-[hsl(222,47%,11%)] backdrop-blur-sm border-b border-border/30">
          <div className="container">
            <div className="flex items-center justify-start sm:justify-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide py-3 px-1">
              {services.filter(s => !s.parent_id).map((service) => {
                const isActive = pathname.includes(`/sub-services/${service.id}`) || pathname.includes(`/specializations/${service.id}`) || pathname.includes(`/templates/${service.id}`);
                return (
                  <Link
                    key={service.id}
                    to={`/sub-services/${service.id}`}
                    className="flex flex-col items-center gap-1.5 min-w-[60px] group"
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30'
                        : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-sm'
                    }`}>
                      <span className="text-xl">{service.icon}</span>
                    </div>
                    <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    }`}>
                      {service.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden overflow-hidden border-t border-border/30 bg-card/95 dark:bg-white/95 dark:text-[hsl(222,47%,11%)] backdrop-blur-xl"
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

                {!isDesignerOnly && (
                <div className="pt-3 border-t border-border/30 mt-3">
                  <p className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">خدماتنا</p>
                  {services.filter(s => !s.parent_id).map(service => (
                    <Link
                      key={service.id}
                      to={`/sub-services/${service.id}`}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                    >
                      <span className="text-primary text-lg">{service.icon}</span>
                      {service.label}
                    </Link>
                  ))}
                </div>
                )}

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

      <footer className="border-t border-border/30 mt-auto bg-card dark:bg-white dark:text-[hsl(222,47%,11%)]">
        <div className="container max-w-5xl py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center sm:text-right">
            {/* Brand */}
            <div className="flex flex-col items-center sm:items-start gap-3">
              <img src={logoImg} alt="مطبعتي" className="h-16 w-auto object-contain drop-shadow-md" />
              <p className="text-muted-foreground text-xs leading-relaxed max-w-[220px]">
                حلول طباعة متكاملة للأفراد والشركات، بجودة احترافية وتوصيل سريع.
              </p>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">روابط سريعة</h4>
              <ul className="space-y-2.5">
                {[
                  { label: 'الخدمات', path: '/services' },
                  { label: 'طلباتي', path: '/my-orders' },
                  { label: 'ارفع تصميمك', path: '/upload-design' },
                ].map(link => (
                  <li key={link.path}>
                    <Link to={link.path} className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact / Info */}
            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">تواصل معنا</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li>توصيل لجميع أنحاء العراق</li>
                <li>طباعة خلال ٧٢ ساعة</li>
                <li>دعم سريع وموثوق</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/30">
          <div className="container max-w-5xl py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-muted-foreground text-[11px]">
              © {new Date().getFullYear()} مطبعتي — جميع الحقوق محفوظة
            </p>
            <div className="flex h-0.5 w-24 rounded-full overflow-hidden">
              <div className="flex-1 bg-cmyk-cyan" />
              <div className="flex-1 bg-cmyk-magenta" />
              <div className="flex-1 bg-cmyk-yellow" />
              <div className="flex-1 bg-cmyk-key" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
