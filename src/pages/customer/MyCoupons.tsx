import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Ticket, Copy, CheckCircle2, Tag } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CouponRow {
  id: string;
  code: string;
  percentage: number;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
}

const MyCoupons = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setCoupons((data as CouponRow[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const copyCode = (coupon: CouponRow) => {
    navigator.clipboard.writeText(coupon.code);
    setCopiedId(coupon.id);
    toast({ title: 'تم نسخ الكود! 🎉', description: `الصقه في السلة للحصول على خصم ${coupon.percentage}%` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">كوبونات الخصم</h1>
            <p className="text-muted-foreground text-sm mt-1">انسخ الكود واستخدمه في السلة للحصول على خصم</p>
          </div>

          {coupons.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Ticket className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد كوبونات متاحة حالياً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {coupons.map((c, i) => {
                const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                const isMaxed = c.max_uses && c.used_count >= c.max_uses;
                const isAvailable = !isExpired && !isMaxed;

                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
                      isAvailable
                        ? 'border-primary/40 bg-primary/5 hover:border-primary/60 hover:shadow-md'
                        : 'border-border/50 bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-black text-xl">{c.percentage}%</span>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">خصم {c.percentage}%</p>
                            {c.expires_at && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {isExpired ? 'منتهي الصلاحية' : `ينتهي: ${new Date(c.expires_at).toLocaleDateString('ar')}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => isAvailable && copyCode(c)}
                        disabled={!isAvailable}
                        className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono font-black tracking-[0.2em] text-lg transition-all ${
                          isAvailable
                            ? 'bg-card border-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 active:scale-[0.98]'
                            : 'bg-muted/50 border border-border text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        <Tag className="w-4 h-4" />
                        {c.code}
                        {copiedId === c.id ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Copy className="w-4 h-4 opacity-50" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default MyCoupons;
