import { m as motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { isNativeApp } from '@/lib/platform';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'مقدمة',
    body: [
      'نحن في "مطبعتي" نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضّح هذه السياسة نوع البيانات التي نجمعها منك، وكيفية استخدامها وحمايتها عند استخدامك لخدماتنا.',
    ],
  },
  {
    title: 'البيانات التي نجمعها',
    body: [
      'الاسم الكامل ورقم الهاتف الخاص بك.',
      'عنوان التوصيل (المحافظة، المنطقة، وأقرب علامة دالة).',
      'تفاصيل طلباتك والتصاميم التي ترفعها أو تنشئها عبر المنصة.',
      'بيانات الاستخدام التقنية الأساسية اللازمة لتشغيل الموقع وتحسين تجربتك.',
    ],
  },
  {
    title: 'كيفية استخدام البيانات',
    body: [
      'إنشاء حسابك وتسجيل دخولك والتحقق من رقم هاتفك.',
      'معالجة طلباتك وتجهيزها وتوصيلها إلى عنوانك.',
      'التواصل معك بخصوص حالة طلباتك والدعم الفني.',
      'تحسين جودة خدماتنا وتطوير المنصة.',
    ],
  },
  {
    title: 'التحقق عبر رسالة نصية',
    body: [
      'نستخدم رقم هاتفك لإرسال رمز تحقق (OTP) عبر رسالة نصية (SMS) أو واتساب لتأكيد هويتك عند تسجيل الدخول. لا نشارك رقمك لأغراض دعائية، ويُستخدم فقط لأغراض التحقق والتواصل المتعلق بطلباتك.',
    ],
  },
  {
    title: 'مشاركة البيانات',
    body: [
      'لا نبيع بياناتك الشخصية لأي طرف ثالث.',
      'قد نشارك المعلومات الضرورية فقط مع المصممين ومندوبي التوصيل لإتمام طلبك.',
      'قد نفصح عن البيانات إذا تطلّب القانون ذلك.',
    ],
  },
  {
    title: 'الموافقة على استخدام البيانات والتصاميم',
    body: [
      'باستخدامك للمنصة، فإنك توافق على أن نحتفظ بتصاميمك والمعلومات الواردة بداخلها وأن ننشرها ونستخدمها.',
      'توافق على احتفاظنا بعنوانك ورقم هاتفك وتاريخ طلباتك.',
      'توافق على استخدام صورك ومعلوماتك وتصاميمك لتدريب نماذج الذكاء الاصطناعي في المستقبل.',
    ],
  },
  {
    title: 'حماية البيانات',
    body: [
      'نتّخذ إجراءات تقنية وتنظيمية معقولة لحماية بياناتك من الوصول غير المصرّح به أو الفقدان أو التعديل.',
    ],
  },
  {
    title: 'الاحتفاظ بالبيانات',
    body: [
      'نحتفظ ببياناتك طالما كان حسابك نشطًا أو بالقدر اللازم لتقديم خدماتنا والوفاء بالالتزامات القانونية.',
    ],
  },
  {
    title: 'حقوقك',
    body: [
      'يحق لك الاطلاع على بياناتك وتعديلها أو طلب حذف حسابك في أي وقت عبر التواصل معنا.',
    ],
  },
  {
    title: 'التواصل معنا',
    body: [
      'لأي استفسار يخص هذه السياسة أو بياناتك الشخصية، يمكنك التواصل معنا عبر قنوات الدعم المتاحة في المنصة.',
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'py-12 sm:py-20'}>
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={isNativeApp ? 'text-center mb-6' : 'text-center mb-10'}>
            <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              سياسة الخصوصية
            </h1>
            <p className="text-muted-foreground text-sm mt-3">
              آخر تحديث: {new Date().toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 p-6 sm:p-9 shadow-card space-y-8">
            {SECTIONS.map(section => (
              <section key={section.title}>
                <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
                {section.body.length === 1 ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">{section.body[0]}</p>
                ) : (
                  <ul className="space-y-2">
                    {section.body.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-muted-foreground text-sm leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
