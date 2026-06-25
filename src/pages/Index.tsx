import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { m as motion } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Upload, Edit3, LayoutGrid, Printer, Truck,
  Check, Star, Clock, Palette, ShoppingBag, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import SEOHead from '@/components/SEOHead';
import JsonLd, { localBusinessSchema, websiteSchema, organizationSchema } from '@/components/JsonLd';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { isNativeApp } from '@/lib/platform';
import NativeHome from '@/components/native/NativeHome';

interface PopularTemplate {
  id: string;
  name: string;
  preview_url: string | null;
  service_type: string;
  order_count: number;
}


interface Activity {
  product: string | null;
  province: string | null;
  created_at: string;
}

const SERVICE_LABELS: Record<string, string> = {
  business_card: 'كروت شخصية', flyer: 'فلايرات', receipt: 'وصولات',
  letterhead: 'ترويسة', menu: 'قوائم طعام', invitation: 'دعوات',
};

// Circular category icon colors (cycled), matching the design palette.

// Gradient backgrounds for template cards that have no preview image.
const TYPE_GRAD: Record<string, string> = {
  business_card: 'from-[#E4F7FC] to-[#FCE7F1]',
  flyer: 'from-[#FCE7F1] to-[#FBF3E2]',
  menu: 'from-[#FBF3E2] to-[#FCE7F1]',
  invitation: 'from-[#FCE7F1] to-[#E4F7FC]',
  receipt: 'from-[#E7F7EE] to-[#E4F7FC]',
  letterhead: 'from-[#EAEEF7] to-[#E4F7FC]',
};

const HOW_STEPS = [
  { n: 1, icon: LayoutGrid, title: 'اختر القالب', sub: '+500 قالب جاهز لكل نوع نشاط', bg: 'bg-[#E4F7FC]', fg: 'text-[#0B86AB]', badge: 'bg-[#10B0E0]' },
  { n: 2, icon: PenLine, title: 'خصّصه', sub: 'أضف بياناتك وألوانك وشوفه مباشرة', bg: 'bg-[#FCE7F1]', fg: 'text-[#B01169]', badge: 'bg-[#D0207F]' },
  { n: 3, icon: Printer, title: 'نطبعه بجودة عالية', sub: 'مراجعة مجانية قبل الطباعة', bg: 'bg-[#EAEEF7]', fg: 'text-[#243262]', badge: 'bg-[#243262]' },
  { n: 4, icon: Truck, title: 'نوصله لبابك', sub: 'توصيل لكل العراق خلال 72 ساعة', bg: 'bg-[#E7F7EE]', fg: 'text-[#1B8A52]', badge: 'bg-[#22A565]' },
];

const STATS = [
  { val: '500+', label: 'قالب قابل للتخصيص', color: 'text-[#10B0E0]' },
  { val: '1000+', label: 'تصميم مُنجز', color: 'text-[#22A565]' },
  { val: '72h', label: 'وقت التسليم', color: 'text-[#D0207F]' },
  { val: '4.9★', label: 'تقييم العملاء', color: 'text-[#243262]' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return `قبل ${Math.floor(d / 30)} شهر`;
}

// Card thumbnail: real preview image, falling back to a generic card mock if there's no preview
// OR the image fails to load (some templates have broken preview_url).
const CardThumb = ({ t, isFirst }: { t: PopularTemplate; isFirst: boolean }) => {
  const [broken, setBroken] = useState(false);
  const showImg = !!t.preview_url && !broken;
  return (
    <div className={`relative aspect-[3/4] overflow-hidden ${showImg ? 'bg-[#F4ECE0]/40' : `bg-gradient-to-br ${TYPE_GRAD[t.service_type] || 'from-[#EAEEF7] to-[#E4F7FC]'} flex items-center justify-center p-5`}`}>
      {showImg ? (
        <img
          src={getOptimizedImageUrl(t.preview_url!, { width: 400, height: 533 })}
          alt={t.name} loading="lazy" width={400} height={533}
          onError={() => setBroken(true)}
          className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
        />
      ) : (
        <div className="w-[78%] aspect-[1.6] bg-white rounded-[10px] shadow-[0_14px_28px_-14px_rgba(80,60,40,.5)] -rotate-3 p-3.5 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#10B0E0]/15 shrink-0" />
            <div className="h-[3px] w-9 rounded bg-[#10B0E0]" />
          </div>
          <div className="space-y-1.5">
            <div className="h-[5px] w-[70%] rounded bg-[#EAE2D6]" />
            <div className="h-[5px] w-[50%] rounded bg-[#EAE2D6]" />
            <div className="num text-[9px] text-[#9A8F7C] font-semibold pt-1">0770 123 4567</div>
          </div>
        </div>
      )}
      {isFirst && (
        <span className="absolute top-3 right-3 bg-white text-[#0B86AB] text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-[0_4px_10px_-4px_rgba(80,60,40,.4)] inline-flex items-center gap-1">
          <Star className="w-2.5 h-2.5 fill-current" /> الأكثر طلباً
        </span>
      )}
      <span className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300 inline-flex items-center gap-1 bg-[#10B0E0] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
        <Edit3 className="w-2.5 h-2.5" /> خصّص الآن
      </span>
    </div>
  );
};

const Index = () => {
  const { role } = useAuth();
  const [popularTemplates, setPopularTemplates] = useState<PopularTemplate[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [serviceLabels, setServiceLabels] = useState<Record<string, string>>(SERVICE_LABELS);

  useEffect(() => {
    // Arabic labels for every service type (covers types beyond the 6 hardcoded ones, e.g. vip_card).
    const loadLabels = async () => {
      const { data } = await supabase.from('services').select('id, label');
      if (data) setServiceLabels(prev => {
        const map = { ...prev };
        (data as { id: string; label: string }[]).forEach(s => { if (s.id && s.label) map[s.id] = s.label; });
        return map;
      });
    };

    const loadPopular = async () => {
      setLoading(true);
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name, preview_url, service_type');
      if (!templates) { setLoading(false); return; }
      const { data: orders } = await supabase.from('orders').select('template_id');
      const countMap: Record<string, number> = {};
      (orders || []).forEach((o: { template_id: string | null }) => {
        if (o.template_id) countMap[o.template_id] = (countMap[o.template_id] || 0) + 1;
      });
      const withCounts = templates.map(t => ({ ...t, order_count: countMap[t.id] || 0 }));
      withCounts.sort((a, b) => b.order_count - a.order_count);
      setPopularTemplates(withCounts.slice(0, 8));
      setLoading(false);
    };

    // Latest orders, anonymized (no names) — via SECURITY DEFINER RPC so it works for anonymous visitors.
    const loadActivity = async () => {
      const { data } = await supabase.rpc('recent_order_activity', { p_limit: 10 });
      if (Array.isArray(data)) setActivity(data as Activity[]);
    };

    loadLabels();
    loadPopular();
    loadActivity();
  }, []);

  // Arabic label for a service type, falling back to a cleaned slug (never raw "vip_card").
  const labelFor = (st: string) => serviceLabels[st] || st.replace(/_/g, ' ');

  const tickerItems = useMemo(() => activity.map(a => {
    const label = a.product ? labelFor(a.product) : 'تصميم';
    const place = a.province ? ` · ${a.province}` : '';
    return `تم طلب ${label}${place} · ${timeAgo(a.created_at)}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activity, serviceLabels]);

  const filterChips = useMemo(() => {
    const types = Array.from(new Set(popularTemplates.map(t => t.service_type)))
      .filter(t => serviceLabels[t]); // only types that have a real Arabic label become chips
    return [{ key: 'all', label: 'الكل' }, ...types.map(t => ({ key: t, label: serviceLabels[t] }))];
  }, [popularTemplates, serviceLabels]);

  const visibleTemplates = filter === 'all'
    ? popularTemplates
    : popularTemplates.filter(t => t.service_type === filter);

  if (role === 'designer') return <Navigate to="/designer/orders" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (isNativeApp && role === 'reseller') return <Navigate to="/reseller" replace />;
  if (isNativeApp) return <NativeHome />;

  return (
    <div className="bg-white text-[#243262] overflow-hidden">
      <SEOHead
        title="خدمات طباعة احترافية في العراق"
        description="مطبعتي - خدمات طباعة أونلاين في العراق. كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات. اختر قالباً، خصّصه، واستلمه لباب بيتك."
        canonical="/"
      />
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-28 -right-20 w-[380px] h-[380px] rounded-full bg-[radial-gradient(circle,rgba(16,176,224,.16),transparent_70%)] animate-blob pointer-events-none" />
        <div className="absolute -bottom-32 -left-16 w-[360px] h-[360px] rounded-full bg-[radial-gradient(circle,rgba(208,32,127,.13),transparent_70%)] animate-blob pointer-events-none" />

        <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-12 sm:py-16 grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-12 items-center relative">
          {/* left: copy */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="text-center lg:text-right">
            <div className="inline-flex items-center gap-2 bg-white border border-[#EFE7DC] text-[#0B86AB] text-xs font-extrabold px-3.5 py-1.5 rounded-full mb-5 shadow-[0_4px_12px_-8px_rgba(80,60,40,.4)]">
              <span className="w-[7px] h-[7px] rounded-full bg-[#22A565] animate-pulse" />
              اختر · خصّص · اطبع · استلم
            </div>
            <h1 className="font-tajawal text-4xl sm:text-5xl lg:text-[54px] font-extrabold leading-[1.1] tracking-tight mb-4">
              مطبعتك <span className="text-[#10B0E0]">الكاملة</span>
              <br />بضغطة وحدة
            </h1>
            <p className="text-[#6F6657] text-sm sm:text-[17px] leading-[1.8] font-medium max-w-md mx-auto lg:mx-0 mb-8">
              كروت، فلايرات، قوائم طعام، ودعوات — اختر قالبك، خصّصه باسمك وألوانك، ونوصله لباب بيتك خلال يومين داخل بغداد.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 justify-center lg:justify-start mb-8">
              <Link to="/services">
                <Button size="lg" className="cta-glow h-auto gap-2.5 bg-[#FFB400] text-[#243262] hover:bg-[#FFB400]/90 font-extrabold text-base sm:text-lg px-8 sm:px-9 py-4 rounded-2xl">
                  خصّص تصميمك
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/upload-design" className="inline-flex items-center gap-2 text-[#243262] font-bold text-sm hover:text-[#0B86AB] transition-colors">
                <Upload className="w-4 h-4 text-[#10B0E0]" />
                ارفع تصميمك الجاهز
              </Link>
              <Link to="/ai-design" className="inline-flex items-center gap-2 text-[#243262] font-bold text-sm hover:text-[#B01169] transition-colors">
                <Sparkles className="w-4 h-4 text-[#D0207F]" />
                صمّم بالذكاء الاصطناعي
              </Link>
            </div>

            {/* trust row */}
            <div className="flex items-center gap-6 flex-wrap justify-center lg:justify-start">
              {[{ v: '72h', l: 'توصيل لكل العراق' }, { v: '500+', l: 'قالب جاهز' }, { v: '4.9★', l: 'تقييم العملاء' }].map((s, i) => (
                <div key={i} className="flex items-center gap-6">
                  {i > 0 && <span className="w-px h-8 bg-[#EFE7DC]" />}
                  <div className="flex flex-col gap-0.5">
                    <span dir="ltr" className="num inline-block text-[22px] font-semibold text-[#243262] leading-none">{s.v}</span>
                    <span className="text-xs text-[#9A8F7C] font-semibold">{s.l}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* right: product showcase */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="relative flex items-center justify-center min-h-[320px] sm:min-h-[420px]">
            {/* back card */}
            <div className="absolute w-[300px] sm:w-[420px] max-w-[84%] aspect-[1.75/1] bg-[#243262] rounded-[20px] shadow-[0_30px_60px_-30px_rgba(80,60,40,.5)] rotate-[7deg] translate-x-4 -translate-y-7 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B0E0]/30 rounded-bl-[100%]" />
              <div className="absolute inset-0 p-6 sm:p-7 flex flex-col justify-between">
                <div className="text-xl sm:text-[22px] font-extrabold text-white">عيادة النور</div>
                <div className="num text-[12px] text-white/70 font-semibold">0771 888 2200</div>
              </div>
            </div>
            {/* front card — Matbaaty business card design */}
            <img
              src="/hero-card.png"
              alt="بطاقة عمل مطبعتي"
              width={440}
              height={295}
              className="relative w-[320px] sm:w-[440px] max-w-[90%] rounded-[20px] shadow-[0_40px_70px_-28px_rgba(80,60,40,.6)] animate-floaty"
            />
            {/* floating badges */}
            <div className="absolute top-4 sm:top-7 right-[4%] bg-white border border-[#EFE7DC] rounded-[14px] px-3 py-2.5 shadow-[0_16px_30px_-14px_rgba(80,60,40,.45)] flex items-center gap-2">
              <span className="w-[30px] h-[30px] rounded-[9px] bg-[#E7F7EE] text-[#1B8A52] flex items-center justify-center">
                <Check className="w-4 h-4" />
              </span>
              <div>
                <div className="text-[12px] font-extrabold text-[#243262]">جاهز للطباعة</div>
                <div className="num text-[10px] text-[#9A8F7C] font-semibold">9×5 سم · وجهين</div>
              </div>
            </div>
            <div className="absolute bottom-6 sm:bottom-10 left-[2%] bg-white border border-[#EFE7DC] rounded-[14px] px-3.5 py-2.5 shadow-[0_16px_30px_-14px_rgba(80,60,40,.45)]">
              <div className="text-[11px] text-[#9A8F7C] font-bold">يبدأ من</div>
              <div><span className="num text-[20px] font-semibold text-[#243262]">15,000</span><span className="text-[12px] text-[#6F6657] font-bold"> د.ع</span></div>
            </div>
            <span className="absolute top-1 left-[12%] bg-[#D0207F] text-white text-[12px] font-extrabold px-3 py-1.5 rounded-full shadow-[0_10px_22px_-10px_rgba(208,32,127,.6)]">خصم 20%</span>
          </motion.div>
        </div>
      </section>

      {/* ─── Social proof ticker (latest orders, no names) ─── */}
      {tickerItems.length > 0 && (
        <div className="bg-[#243262] overflow-hidden py-3">
          <div className="flex gap-10 w-max animate-ticker whitespace-nowrap px-5">
            {[...tickerItems, ...tickerItems].map((txt, i) => (
              <span key={i} className="inline-flex items-center gap-2.5 text-white text-[13px] font-semibold">
                <span className="w-[7px] h-[7px] rounded-full bg-[#29F5A0]" />
                {txt}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Product catalog with filter ─── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-7 pt-14 sm:pt-16 pb-5">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0} className="text-center mb-6">
          <div className="text-[13px] font-extrabold tracking-[0.1em] text-[#A89B88] mb-2">قوالب جاهزة للتخصيص</div>
          <h2 className="text-2xl sm:text-[32px] font-extrabold tracking-tight mb-2">اختر قالبك وخصّصه <span className="text-[#10B0E0]">بثوانٍ</span></h2>
          <p className="text-[15px] text-[#6F6657] font-medium">اختر المنتج — أدخل بياناتك — نطبعه ونوصله لك</p>
        </motion.div>

        {/* filter chips */}
        {filterChips.length > 1 && (
          <div className="flex flex-wrap gap-2.5 justify-center mb-8">
            {filterChips.map(chip => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setFilter(chip.key)}
                  className={`font-bold text-sm px-5 py-2.5 rounded-full border-[1.5px] transition-all duration-150 active:scale-95 ${
                    active
                      ? 'bg-[#243262] text-white border-[#243262]'
                      : 'bg-white text-[#6F6657] border-[#E6DCCC] hover:border-[#10B0E0]/50'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-[20px] bg-[#F4ECE0]/60 animate-pulse">
                <div className="aspect-[3/4]" />
                <div className="p-4 space-y-2"><div className="h-3 bg-[#EAE2D6] rounded w-3/4" /><div className="h-3 bg-[#EAE2D6] rounded w-1/2" /></div>
              </div>
            ))}
          </div>
        ) : visibleTemplates.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {visibleTemplates.map((t, i) => (
              <motion.div key={t.id} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-20px' }} variants={fadeUp} custom={i % 4}>
                {/* services hover effect: lift + cyan border + image zoom + "خصّص" badge */}
                <Link
                  to={`/template/${t.id}`}
                  className="group block rounded-[20px] overflow-hidden bg-white border border-[#EFE7DC] shadow-[0_12px_30px_-22px_rgba(80,60,40,.4)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_-26px_rgba(80,60,40,.45)] hover:border-[#10B0E0]/40"
                >
                  <CardThumb t={t} isFirst={i === 0} />
                  <div className="p-3.5 sm:p-4">
                    <span className="inline-block bg-[#F4ECE0] text-[#9A8F7C] text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {labelFor(t.service_type)}
                    </span>
                    <div className="font-extrabold text-[15px] mt-2.5 line-clamp-1">{t.name}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[#F4ECE0] flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 text-[#9A8F7C]" />
            </div>
            <p className="text-[#9A8F7C] text-sm">لا توجد قوالب بعد</p>
          </div>
        )}

        <div className="text-center mt-9">
          <Link to="/services">
            <Button variant="outline" className="bg-white border-[1.5px] border-[#E6DCCC] text-[#243262] hover:border-[#10B0E0]/50 hover:bg-white font-bold rounded-full px-7 py-3 h-auto gap-2">
              عرض جميع القوالب
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="bg-[#FBF9F5] border-y border-[#EFE7DC] mt-12">
        <div className="max-w-[1080px] mx-auto px-5 sm:px-7 py-14">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0} className="text-center mb-10">
            <h2 className="text-2xl sm:text-[30px] font-extrabold tracking-tight mb-2">من الفكرة للباب <span className="text-[#10B0E0]">بأربع خطوات</span></h2>
            <p className="text-[15px] text-[#6F6657] font-medium">كل شي أونلاين — بدون ما تطلع من البيت</p>
          </motion.div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8">
            {HOW_STEPS.map((s, i) => (
              <motion.div key={s.n} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className="flex flex-col items-center text-center gap-3">
                <div className={`relative w-[60px] h-[60px] rounded-[18px] ${s.bg} ${s.fg} flex items-center justify-center`}>
                  <s.icon className="w-7 h-7" />
                  <span className={`num absolute -top-2 -right-2 w-6 h-6 rounded-full ${s.badge} text-white text-xs font-bold flex items-center justify-center`}>{s.n}</span>
                </div>
                <div className="font-extrabold text-base">{s.title}</div>
                <div className="text-[13px] text-[#6F6657] font-medium leading-relaxed max-w-[200px]">{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Trust stats ─── */}
      <section className="max-w-[1080px] mx-auto px-5 sm:px-7 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i} className="bg-white border border-[#EFE7DC] rounded-[20px] p-6 text-center shadow-[0_12px_30px_-24px_rgba(80,60,40,.4)]">
              <div dir="ltr" className={`num text-[34px] font-semibold ${s.color}`}>{s.val}</div>
              <div className="text-[13px] text-[#6F6657] font-semibold mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-gradient-to-br from-[#243262] to-[#1a2548]">
        <div className="max-w-[760px] mx-auto px-5 sm:px-7 py-16 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 bg-[#29F5A0]/15 text-[#29F5A0] text-[13px] font-bold px-4 py-2 rounded-full mb-6">
              <Clock className="w-4 h-4" />
              طباعة وتسليم خلال 72 ساعة لكل العراق
            </div>
            <h2 className="text-3xl sm:text-[38px] font-extrabold text-white tracking-tight mb-4 leading-tight">
              خصّص تصميمك واطبعه <span className="text-[#29F5A0]">خلال دقيقة</span>
            </h2>
            <p className="text-white/70 text-sm sm:text-base font-medium mb-8">اختر قالب — أضف بياناتك — نطبعه ونوصله لك</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/services">
                <Button size="lg" className="cta-glow h-auto bg-[#FFB400] text-[#243262] hover:bg-[#FFB400]/90 font-extrabold text-base sm:text-[17px] px-9 py-4 rounded-2xl gap-2">
                  <Palette className="w-5 h-5" />
                  ابدأ التخصيص الآن
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Sticky mobile CTA ─── */}
      <div className="fixed bottom-0 right-0 left-0 z-40 sm:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
        <Link to="/services" className="pointer-events-auto block">
          <Button size="lg" className="w-full h-13 text-base gap-2 bg-[#FFB400] text-[#243262] hover:bg-[#FFB400]/90 font-extrabold shadow-elevated">
            <Palette className="w-4 h-4" />
            خصّص تصميمك الآن
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
