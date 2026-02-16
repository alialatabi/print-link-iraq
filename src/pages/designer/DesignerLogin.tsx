import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Lock } from 'lucide-react';

const DesignerLogin = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { setDesignerLoggedIn } = useApp();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setDesignerLoggedIn(true);
    navigate('/designer/orders');
  };

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

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label className="text-foreground mb-2 block">رقم الهاتف</Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07xxxxxxxxx"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div>
              <Label className="text-foreground mb-2 block">كلمة المرور</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <p className="text-muted-foreground text-xs">للتجربة: أدخل أي بيانات</p>
            <Button type="submit" size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6 rounded-xl">
              <Lock className="w-5 h-5 ml-2" />
              تسجيل الدخول
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerLogin;
