export type ServiceType = 'business_card' | 'flyer' | 'receipt' | 'letterhead' | 'menu' | 'invitation';

export type OrderStatus = 
  | 'draft' 
  | 'submitted' 
  | 'assigned' 
  | 'design_uploaded' 
  | 'waiting_approval' 
  | 'approved' 
  | 'print_ready' 
  | 'printed' 
  | 'delivered';

export interface Template {
  id: string;
  name: string;
  service_type: ServiceType;
  preview_url: string;
  description: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  template_id: string;
  template_name: string;
  service_type: ServiceType;
  status: OrderStatus;
  details: {
    name?: string;
    job_title?: string;
    phone?: string;
    address?: string;
    email?: string;
    notes?: string;
  };
  design_url?: string;
  created_at: string;
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  business_card: 'كروت شخصية',
  flyer: 'فلايرات',
  receipt: 'وصولات',
  letterhead: 'ترويسة',
  menu: 'قوائم طعام',
  invitation: 'دعوات',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'مسودة',
  submitted: 'تم الإرسال',
  assigned: 'تم التعيين',
  design_uploaded: 'تم رفع التصميم',
  waiting_approval: 'بانتظار الموافقة',
  approved: 'تمت الموافقة',
  print_ready: 'جاهز للطباعة',
  printed: 'تمت الطباعة',
  delivered: 'تم التسليم',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  assigned: 'bg-accent/20 text-accent-foreground',
  design_uploaded: 'bg-accent/30 text-accent-foreground',
  waiting_approval: 'bg-accent text-accent-foreground',
  approved: 'bg-success/20 text-success',
  print_ready: 'bg-success/40 text-success-foreground',
  printed: 'bg-success text-success-foreground',
  delivered: 'bg-success text-success-foreground',
};

export const SERVICES: { type: ServiceType; icon: string; description: string }[] = [
  { type: 'business_card', icon: '💳', description: 'تصميم كروت شخصية احترافية بأشكال متعددة' },
  { type: 'flyer', icon: '📄', description: 'فلايرات إعلانية جذابة لعملك' },
  { type: 'receipt', icon: '🧾', description: 'وصولات رسمية لمعاملاتك التجارية' },
  { type: 'letterhead', icon: '📋', description: 'ترويسة رسمية لمؤسستك' },
  { type: 'menu', icon: '🍽️', description: 'قوائم طعام أنيقة لمطعمك' },
  { type: 'invitation', icon: '💌', description: 'بطاقات دعوة مميزة لمناسباتك' },
];

export const MOCK_TEMPLATES: Template[] = [
  { id: 't1', name: 'كلاسيك بزنس', service_type: 'business_card', preview_url: '', description: 'تصميم كلاسيكي أنيق' },
  { id: 't2', name: 'مودرن كارد', service_type: 'business_card', preview_url: '', description: 'تصميم عصري حديث' },
  { id: 't3', name: 'إبداعي', service_type: 'business_card', preview_url: '', description: 'تصميم إبداعي ملفت' },
  { id: 't4', name: 'بسيط وأنيق', service_type: 'business_card', preview_url: '', description: 'بساطة مع أناقة' },
  { id: 't5', name: 'فلاير عرض', service_type: 'flyer', preview_url: '', description: 'فلاير لعروض خاصة' },
  { id: 't6', name: 'فلاير حدث', service_type: 'flyer', preview_url: '', description: 'فلاير لإعلان حدث' },
  { id: 't7', name: 'فلاير منتج', service_type: 'flyer', preview_url: '', description: 'فلاير عرض منتجات' },
  { id: 't8', name: 'وصل رسمي', service_type: 'receipt', preview_url: '', description: 'وصل رسمي معتمد' },
  { id: 't9', name: 'وصل بسيط', service_type: 'receipt', preview_url: '', description: 'وصل بسيط وعملي' },
  { id: 't10', name: 'ترويسة رسمية', service_type: 'letterhead', preview_url: '', description: 'ترويسة لمراسلاتك الرسمية' },
  { id: 't11', name: 'منيو مطعم', service_type: 'menu', preview_url: '', description: 'قائمة طعام عصرية' },
  { id: 't12', name: 'دعوة زفاف', service_type: 'invitation', preview_url: '', description: 'دعوة زفاف أنيقة' },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-001',
    customer_name: 'أحمد محمد',
    customer_phone: '07701234567',
    template_id: 't1',
    template_name: 'كلاسيك بزنس',
    service_type: 'business_card',
    status: 'waiting_approval',
    details: { name: 'أحمد محمد', job_title: 'مدير تسويق', phone: '07701234567', address: 'بغداد - الكرادة', email: 'ahmed@mail.com' },
    design_url: '',
    created_at: '2026-02-14',
  },
  {
    id: 'ord-002',
    customer_name: 'سارة علي',
    customer_phone: '07809876543',
    template_id: 't5',
    template_name: 'فلاير عرض',
    service_type: 'flyer',
    status: 'assigned',
    details: { name: 'سارة علي', notes: 'عرض خاص لمحل ملابس', phone: '07809876543', address: 'بغداد - المنصور' },
    created_at: '2026-02-15',
  },
  {
    id: 'ord-003',
    customer_name: 'علي حسين',
    customer_phone: '07712345678',
    template_id: 't8',
    template_name: 'وصل رسمي',
    service_type: 'receipt',
    status: 'approved',
    details: { name: 'شركة النور', phone: '07712345678', address: 'البصرة - العشار' },
    design_url: '',
    created_at: '2026-02-13',
  },
  {
    id: 'ord-004',
    customer_name: 'فاطمة كريم',
    customer_phone: '07801112233',
    template_id: 't2',
    template_name: 'مودرن كارد',
    service_type: 'business_card',
    status: 'submitted',
    details: { name: 'فاطمة كريم', job_title: 'مهندسة برمجيات', phone: '07801112233', address: 'أربيل' },
    created_at: '2026-02-16',
  },
];

export const TEMPLATE_COLORS: Record<ServiceType, { bg: string; accent: string }> = {
  business_card: { bg: 'from-primary/5 to-primary/10', accent: 'border-primary/30' },
  flyer: { bg: 'from-accent/5 to-accent/15', accent: 'border-accent/30' },
  receipt: { bg: 'from-muted to-muted/80', accent: 'border-border' },
  letterhead: { bg: 'from-primary/5 to-secondary/5', accent: 'border-primary/20' },
  menu: { bg: 'from-accent/10 to-success/5', accent: 'border-accent/20' },
  invitation: { bg: 'from-accent/10 to-primary/5', accent: 'border-accent/30' },
};

// Real-world aspect ratios for each service type (width/height as CSS aspect-ratio)
export const TEMPLATE_ASPECT_RATIOS: Record<ServiceType, string> = {
  business_card: '9/5.5',   // 9×5.5 cm landscape
  flyer: '3/4',             // portrait flyer
  receipt: '1/1.414',       // A4/A5/A6 portrait
  letterhead: '1/1.414',    // A4 portrait
  menu: '3/4',              // portrait menu
  invitation: '4/5',        // portrait invitation
};
