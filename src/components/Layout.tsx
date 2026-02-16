import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Printer, Home, Palette, ShieldCheck, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { label: 'الرئيسية', path: '/', icon: Home, show: true },
    { label: 'طلباتي', path: '/my-orders', icon: User, show: !!user },
    { label: 'طلبات المصمم', path: '/designer/orders', icon: Palette, show: role === 'designer' || role === 'admin' },
    { label: 'لوحة الطباعة', path: '/admin', icon: ShieldCheck, show: role === 'admin' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col font-cairo">
      <header className="sticky top-0 z-50 gradient-primary border-b border-primary/20 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Printer className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold text-primary-foreground">
              Print<span className="text-gradient">Link</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.filter(i => i.show).map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.path
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
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
                  className="px-3 py-2 rounded-lg text-sm font-medium text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <span className="hidden sm:inline">خروج</span>
                  <LogOut className="w-5 h-5 sm:hidden" />
                </button>
              ) : (
                <Link
                  to="/auth"
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                >
                  <span className="hidden sm:inline">تسجيل الدخول</span>
                  <LogIn className="w-5 h-5 sm:hidden" />
                </Link>
              )
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="gradient-primary py-8 mt-auto">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Printer className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="text-lg font-bold text-primary-foreground">PrintLink</span>
          </div>
          <p className="text-primary-foreground/60 text-sm">
            حلقة الوصل بين الزبون والمصمم © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
