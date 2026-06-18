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
  | 'delivered'
  | 'cancelled';

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
  cancelled: 'تم الإلغاء',
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
  cancelled: 'bg-destructive/10 text-destructive',
};

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

