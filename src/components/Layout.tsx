import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Printer, Home, User, Palette, ShieldCheck, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { label: 'الرئيسية', path: '/', icon: Home, show: true },
    { label: 'طلباتي', path: '/my-orders', icon: User, show: !!user },
    { label: 'المصمم', path: '/designer/orders', icon: Palette, show: role === 'designer' || role === 'admin' },
    { label: 'الإدارة', path: '/admin', icon: ShieldCheck, show: role === 'admin' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col font-cairo" dir="rtl">
      {/* CMYK color strip */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-cmyk-cyan" />
        <div className="flex-1 bg-cmyk-magenta" />
        <div className="flex-1 bg-cmyk-yellow" />
        <div className="flex-1 bg-cmyk-key" />
      </div>

      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <Printer className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold text-foreground">
              Print<span className="text-cmyk-magenta">Link</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.filter(i => i.show).map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="hidden sm:inline">{item.label}</span>
                <item.icon className="w-5 h-5 sm:hidden" />
              </Link>
            ))}

            {!loading && (
              user ? (
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="hidden sm:inline">خروج</span>
                  <LogOut className="w-5 h-5 sm:hidden" />
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-3 py-1.5 rounded text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <span className="hidden sm:inline">دخول</span>
                  <LogIn className="w-5 h-5 sm:hidden" />
                </Link>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-6 mt-auto">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">PrintLink</span>
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
