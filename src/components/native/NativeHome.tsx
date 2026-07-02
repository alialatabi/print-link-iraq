import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { ArrowLeft, Upload, Sparkles, Palette, ChevronLeft } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import { useServiceDiscounts } from '@/hooks/useServiceDiscounts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getServiceIcon } from '@/lib/serviceIcons';

// Native "launchpad" home: greeting → promo banner → quick actions → service shortcuts.
// Lives inside the shell's scroll area (pull-to-refresh re-fetches the services below).
const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
});

const QUICK_ACTIONS = [
  { to: '/services', label: 'خصّص تصميم', Icon: Palette, bg: 'bg-[#E4F7FC]', fg: 'text-[#0B86AB]' },
  { to: '/upload-design', label: 'ارفع تصميمك', Icon: Upload, bg: 'bg-[#E7F7EE]', fg: 'text-[#1B8A52]' },
  { to: '/ai-design', label: 'تصميم AI', Icon: Sparkles, bg: 'bg-[#FCE7F1]', fg: 'text-[#D0207F]' },
];

const NativeHome = () => {
  const { parentServices, getSubServices } = useServices();
  const { getDiscount } = useServiceDiscounts();
  const { user } = useAuth();
  const [name, setName] = useState('');

  // Personalize the greeting with the customer's saved display name (first word only).
  useEffect(() => {
    if (!user) { setName(''); return; }
    supabase.from('profiles').select('display_name').eq('user_id', user.id).single()
      .then(({ data }) => {
        const full = (((data as { display_name?: string | null })?.display_name) || '').trim();
        setName(full.split(/\s+/)[0] || '');
      });
  }, [user]);

  return (
    <div className="flex-1 bg-white dark:bg-background px-5 pt-5 pb-8" dir="rtl">
      {/* Greeting */}
      <motion.div {...fade(0)} className="mb-4">
        <p className="text-sm text-[#9A8F7C] dark:text-muted-foreground font-semibold">{name ? `مرحباً ${name}` : 'مرحباً بك'} 👋</p>
        <h1 className="text-[26px] font-extrabold text-[#243262] dark:text-foreground leading-tight tracking-tight">صمّم واطبع باحتراف</h1>
      </motion.div>

      {/* Promo banner */}
      <motion.div {...fade(1)}>
        <Link
          to="/services"
          className="relative block rounded-[26px] overflow-hidden bg-gradient-to-br from-[#243262] to-[#1a2548] p-5 shadow-[0_22px_44px_-26px_rgba(36,50,98,.8)] active:scale-[0.99] transition-transform"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#10B0E0]/20 pointer-events-none" />
          <div className="absolute -bottom-12 right-8 w-28 h-28 rounded-full bg-[#D0207F]/15 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 bg-[#29F5A0]/15 text-[#29F5A0] text-[11px] font-bold px-2.5 py-1 rounded-full mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#29F5A0]" />
                طباعة وتوصيل خلال 72 ساعة
              </span>
              <h2 className="text-white font-extrabold text-[19px] leading-snug">
                مطبعتك الكاملة<br />بضغطة وحدة
              </h2>
              <span className="inline-flex items-center gap-1.5 mt-3.5 bg-[#FFB400] text-[#243262] font-extrabold text-sm px-4 py-2 rounded-xl shadow-[0_10px_22px_-10px_rgba(255,180,0,.7)]">
                ابدأ الآن <ArrowLeft className="w-4 h-4" />
              </span>
            </div>
            {/* Renders at 112-128px, so the 640w WebP variant alone is plenty (>=5x DPR);
                eager (top-of-screen banner) with explicit dimensions to avoid CLS. */}
            <img
              src="/hero-card-sm.webp"
              alt="بطاقة عمل مطبعتي"
              width={128}
              height={86}
              decoding="async"
              className="w-28 sm:w-32 rounded-xl shadow-[0_24px_40px_-18px_rgba(0,0,0,.55)] animate-floaty shrink-0"
            />
          </div>
        </Link>
      </motion.div>

      {/* Quick actions */}
      <motion.div {...fade(2)} className="mt-7">
        <h3 className="text-sm font-extrabold text-[#243262] dark:text-foreground mb-3">إجراءات سريعة</h3>
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center gap-2 bg-white dark:bg-card rounded-2xl p-3.5 border border-[#EFE7DC] dark:border-border shadow-[0_10px_24px_-18px_rgba(80,60,40,.6)] active:scale-95 transition-transform"
            >
              <span className={`w-11 h-11 rounded-xl ${a.bg} ${a.fg} flex items-center justify-center`}>
                <a.Icon className="w-5 h-5" />
              </span>
              <span className="text-[12px] font-bold text-[#243262] dark:text-foreground text-center leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Service shortcuts */}
      {parentServices.length > 0 && (
        <motion.div {...fade(3)} className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-[#243262] dark:text-foreground">الخدمات</h3>
            <Link to="/services" className="inline-flex items-center gap-0.5 text-xs font-bold text-[#10B0E0]">
              عرض الكل <ChevronLeft className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {parentServices.map(service => {
              const Icon = getServiceIcon(service);
              const discount = Math.max(getDiscount(service.id), 0, ...getSubServices(service.id).map(s => getDiscount(s.id)));
              return (
                <Link key={service.id} to={`/sub-services/${service.id}`} className="flex flex-col items-center gap-2 shrink-0 w-[68px]">
                  <span className="relative w-16 h-16 rounded-2xl bg-white dark:bg-card border border-[#EFE7DC] dark:border-border shadow-[0_10px_24px_-18px_rgba(80,60,40,.6)] flex items-center justify-center active:scale-95 transition-transform">
                    <Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
                    {discount > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 bg-cmyk-magenta text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow">
                        {discount}%
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-semibold text-[#6F6657] dark:text-muted-foreground text-center leading-tight line-clamp-2">{service.label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default NativeHome;
