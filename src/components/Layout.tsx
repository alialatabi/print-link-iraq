import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Palette, ShieldCheck, LogIn, LogOut, Menu, X, ShoppingCart, Store, Archive, Sparkles } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import NotificationBell from '@/components/NotificationBell';
import SearchBar from '@/components/SearchBar';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useServices } from '@/hooks/useServices';
import { isNativeApp } from '@/lib/platform';
import NativeShell from '@/components/native/NativeShell';


const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const { parentServices } = useServices();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    if (isNativeApp) return; // the installed app manages its own theme (incl. dark mode)
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  if (isNativeApp) return <NativeShell>{children}</NativeShell>;

  const isDesignerOnly = role === 'designer';
  const isResellerOnly = role === 'reseller';
  const isAdminOnly = role === 'admin';
  // Hide the customer-facing chrome (catalog/cart/search) for staff-only roles.
  const hideShopChrome = isDesignerOnly || isResellerOnly || isAdminOnly;

  const NAV_ITEMS = [
    { label: 'الرئيسية', path: '/', icon: Home, show: !hideShopChrome },
    { label: 'طلباتي', path: '/my-orders', icon: User, show: !!user && !hideShopChrome },
    { label: 'خزنة التصاميم', path: '/design-vault', icon: Archive, show: !!user && !hideShopChrome },
    { label: 'حسابي', path: '/profile', icon: User, show: !!user && !hideShopChrome },
    { label: 'المصمم', path: '/designer/orders', icon: Palette, show: role === 'designer' || role === 'admin' },
    { label: 'بوابة المطبعة', path: '/reseller', icon: Store, show: role === 'reseller' || role === 'admin' },
    { label: 'الإدارة', path: '/admin', icon: ShieldCheck, show: role === 'admin' },
  ];

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate('/auth');
  };

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col font-tajawal" dir="rtl">
      {/* CMYK color strip */}
      <div className="flex h-0.5">
        <div className="flex-1 bg-cmyk-cyan" />
        <div className="flex-1 bg-cmyk-magenta" />
        <div className="flex-1 bg-cmyk-yellow" />
        <div className="flex-1 bg-cmyk-key" />
      </div>

      <header className="sticky top-0 z-50">
        {/* pt-[env(safe-area-inset-top)] lets the header background fill the status-bar/notch area on
            native (0 on web/non-notch) so its content sits below the status bar. */}
        <div className="bg-card/90 dark:bg-white/90 dark:text-[hsl(222,47%,11%)] backdrop-blur-xl border-b border-border/50 shadow-card pt-[env(safe-area-inset-top)]">
          <div className="container flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group" onClick={closeMobile}>
              <img src={logoImg} alt="مطبعتي" width="47" height="56" className="h-14 object-contain drop-shadow-md" style={{ aspectRatio: '47/56' }} />
            </Link>

            {/* Search bar - desktop */}
            {!hideShopChrome && <div className="hidden sm:block"><SearchBar /></div>}

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
            {!hideShopChrome && (
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
            {!hideShopChrome && (
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
        {!hideShopChrome && !pathname.startsWith('/auth') && !pathname.startsWith('/staff-login') && !pathname.startsWith('/designer/login') && (
        <div className="bg-card/50 dark:bg-white/50 dark:text-[hsl(222,47%,11%)] backdrop-blur-sm border-b border-border/30">
          <div className="container">
            <div className="flex items-end justify-start sm:justify-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide pt-5 pb-3 px-1 min-h-[100px]">
              {/* AI design — same floating-pedestal style/hover as the categories */}
              <Link to="/ai-design" className="flex flex-col items-center gap-1.5 min-w-[60px] group">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full transition-all duration-300 bg-muted/60 dark:bg-[hsl(210,40%,96%)]/60 group-hover:bg-muted dark:group-hover:bg-[hsl(210,40%,96%)] group-hover:shadow-sm group-hover:scale-105" />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[4.5rem] h-[4.5rem] rounded-2xl overflow-hidden transition-all duration-300 drop-shadow-lg group-hover:drop-shadow-xl group-hover:-translate-y-1 group-hover:scale-110 bg-gradient-to-br from-[#E4F7FC] to-[#FCE7F1] flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-[#10B0E0]" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold whitespace-nowrap transition-colors duration-150 mt-1 text-muted-foreground group-hover:text-foreground">
                  تصميم AI
                </span>
              </Link>
              {parentServices.map((service) => {
                const isActive = pathname.includes(`/sub-services/${service.id}`) || pathname.includes(`/specializations/${service.id}`) || pathname.includes(`/templates/${service.id}`);
                return (
                  <Link
                    key={service.id}
                    to={`/sub-services/${service.id}`}
                    className="flex flex-col items-center gap-1.5 min-w-[60px] group"
                  >
                    {/* Container with floating image effect */}
                    <div className="relative">
                      {/* Background circle */}
                      <div className={`w-14 h-14 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-muted dark:bg-[hsl(210,40%,96%)] shadow-md ring-2 ring-primary/30 scale-105'
                          : 'bg-muted/60 dark:bg-[hsl(210,40%,96%)]/60 group-hover:bg-muted dark:group-hover:bg-[hsl(210,40%,96%)] group-hover:shadow-sm group-hover:scale-105'
                      }`} />
                      {/* Floating image - larger than the circle, positioned above */}
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-[4.5rem] h-[4.5rem] rounded-2xl overflow-hidden transition-all duration-300 drop-shadow-lg group-hover:drop-shadow-xl group-hover:-translate-y-1 group-hover:scale-110 ${
                        isActive ? '-translate-y-1 scale-110' : ''
                      }`}>
                        {service.icon_url ? (
                          <img src={getOptimizedImageUrl(service.icon_url, { width: 144, height: 144 })} alt={service.label} loading="lazy" width="72" height="72" className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                          }`}>
                            <span className="text-2xl">{service.icon}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold whitespace-nowrap transition-colors duration-150 mt-1 ${
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
                {/* Search bar - mobile */}
                {!hideShopChrome && <div className="mb-3"><SearchBar onNavigate={closeMobile} /></div>}
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

                {!hideShopChrome && (
                <div className="pt-3 border-t border-border/30 mt-3">
                  <p className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">خدماتنا</p>
                  {parentServices.map(service => (
                    <Link
                      key={service.id}
                      to={`/sub-services/${service.id}`}
                      onClick={closeMobile}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
                    >
                      {service.icon_url ? (
                        <img src={getOptimizedImageUrl(service.icon_url, { width: 56, height: 56 })} alt={service.label} loading="lazy" width="28" height="28" className="w-7 h-7 rounded-md object-cover" />
                      ) : (
                        <span className="text-primary text-lg">{service.icon}</span>
                      )}
                      {service.label}
                    </Link>
                  ))}
                </div>
                )}


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

      <main className="flex-1 min-h-[80vh]" role="main">{children}</main>

      {/* Customer shop footer — hidden for staff-only roles (designer/admin/reseller). */}
      {!hideShopChrome && (
      <footer className="border-t border-border/30 mt-auto bg-card dark:bg-white dark:text-[hsl(222,47%,11%)]">
        <div className="container max-w-5xl py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8 text-center sm:text-right">
            {/* Brand */}
            <div className="flex flex-col items-center sm:items-start gap-3">
              <img src={logoImg} alt="مطبعتي" width="54" height="64" className="h-16 object-contain drop-shadow-md" style={{ aspectRatio: '54/64' }} />
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
                  { label: 'خزنة التصاميم', path: '/design-vault' },
                  { label: 'ارفع تصميمك', path: '/upload-design' },
                  { label: 'سياسة الخصوصية', path: '/privacy' },
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
            <div className="flex items-center gap-3 text-[11px]">
              <p className="text-muted-foreground">
                © {new Date().getFullYear()} مطبعتي — جميع الحقوق محفوظة
              </p>
              <span className="text-border">•</span>
              <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors duration-150">
                سياسة الخصوصية
              </Link>
            </div>
            <div className="flex h-0.5 w-24 rounded-full overflow-hidden">
              <div className="flex-1 bg-cmyk-cyan" />
              <div className="flex-1 bg-cmyk-magenta" />
              <div className="flex-1 bg-cmyk-yellow" />
              <div className="flex-1 bg-cmyk-key" />
            </div>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
};

export default Layout;
