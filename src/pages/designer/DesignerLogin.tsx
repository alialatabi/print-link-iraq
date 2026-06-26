import { Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { Palette } from 'lucide-react';

const DesignerLogin = () => {
  return (
    <div className="py-20">
      <div className="container max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-8 shadow-card border border-border"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl hero-designer flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">دخول المصمم</h1>
            <p className="text-muted-foreground mt-2">سجل دخولك لمشاهدة الطلبات</p>
          </div>

          <p className="text-center text-muted-foreground mb-6">
            استخدم صفحة تسجيل الدخول الموحدة للدخول كمصمم
          </p>

          <Link to="/auth" className="block">
            <button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-4 rounded-xl font-bold transition-colors">
              تسجيل الدخول
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerLogin;
