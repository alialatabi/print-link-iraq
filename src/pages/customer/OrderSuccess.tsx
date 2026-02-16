import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Eye, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');

  return (
    <div className="py-20">
      <div className="container max-w-md text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
        >
          <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-14 h-14 text-success" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">تم إرسال طلبك بنجاح!</h1>
          <p className="text-muted-foreground text-lg mb-2">رقم الطلب: {orderId}</p>
          <p className="text-muted-foreground mb-8">سيتم تعيين مصمم لطلبك قريباً وستتلقى إشعاراً عند جهوز التصميم</p>

          <div className="flex flex-col gap-3">
            {orderId && (
              <Link to={`/track-order/${orderId}`}>
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl">
                  <Eye className="w-5 h-5 ml-2" />
                  تتبع الطلب
                </Button>
              </Link>
            )}
            <Link to="/">
              <Button variant="outline" size="lg" className="w-full py-6 rounded-xl">
                <Home className="w-5 h-5 ml-2" />
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderSuccess;
