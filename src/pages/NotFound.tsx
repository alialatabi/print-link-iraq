import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { Home, LayoutGrid, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="py-20 sm:py-28">
      <SEOHead title="الصفحة غير موجودة" noindex />
      <div className="container max-w-md text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-6">
            <SearchX className="w-8 h-8 text-primary" />
          </div>
          <p className="text-6xl font-black text-primary/20 mb-3" dir="ltr">404</p>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">
            الصفحة غير موجودة
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            يبدو أن الرابط الذي فتحته غير صحيح أو أن الصفحة انتقلت لمكان آخر.
            يمكنك العودة للرئيسية أو تصفح خدمات الطباعة.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="rounded-xl font-bold gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                العودة للرئيسية
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-xl font-bold gap-2">
              <Link to="/services">
                <LayoutGrid className="w-4 h-4" />
                تصفح الخدمات
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
