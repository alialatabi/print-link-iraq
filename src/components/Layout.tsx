import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Printer, Home, Palette, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'الرئيسية', path: '/', icon: Home },
  { label: 'طلبات المصمم', path: '/designer/orders', icon: Palette },
  { label: 'لوحة الطباعة', path: '/admin', icon: ShieldCheck },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col font-cairo">
      {/* Navbar */}
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
            {NAV_ITEMS.map(item => (
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
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
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
