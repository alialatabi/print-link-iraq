import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Eye, Home, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');

  return (
    <div className="py-24 sm:py-36">
      <div className="container max-w-md text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.7, bounce: 0.4 }}
        >
          {/* Success icon with ring */}
          <div className="relative w-28 h-28 mx-auto mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', duration: 0.6 }}
              className="absolute inset-0 rounded-full bg-success/10 animate-ping"
              style={{ animationDuration: '2s', animationIterationCount: 3 }}
            />
            <div className="relative w-28 h-28 rounded-full bg-success/10 border-2 border-success/20 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: 'spring', duration: 0.5 }}
              >
                <CheckCircle className="w-14 h-14 text-success" />
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wider uppercase">تم بنجاح</span>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-4 tracking-tight leading-snug">
              تم إرسال طلبك بنجاح!
            </h1>

            {orderId && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 border border-border/50 mb-4">
                <span className="text-xs text-muted-foreground">رقم الطلب:</span>
                <span className="font-mono font-bold text-foreground text-sm">{orderId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}

            <p className="text-muted-foreground text-sm mb-12 leading-relaxed max-w-sm mx-auto">
              سيتم تعيين مصمم لطلبك قريباً وستتلقى إشعاراً فورياً عند جهوز التصميم
            </p>

            <div className="flex flex-col gap-3">
              {orderId && (
                <Link to={`/track-order/${orderId}`}>
                  <Button size="lg" className="w-full h-13 text-base font-bold rounded-xl gap-2 animate-cta-glow">
                    <Eye className="w-5 h-5" />
                    تتبع الطلب
                  </Button>
                </Link>
              )}
              <Link to="/">
                <Button variant="outline" size="lg" className="w-full h-13 text-base rounded-xl gap-2">
                  <Home className="w-5 h-5" />
                  العودة للرئيسية
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderSuccess;
