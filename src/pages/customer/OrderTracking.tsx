import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, FileText, Palette, Printer, Truck, Package, Eye, MessageSquare, RefreshCw, MapPin, ImagePlus, X, Edit2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { OrderStatus } from '@/data/mockData';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';
import { playNotificationSound } from '@/lib/notificationSound';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
  order_item_id: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  template_id: string | null;
  status: OrderStatus;
  details: Record<string, any>;
  templates?: { name: string; service_type: string } | null;
}

const RevisionImages = ({ paths }: { paths: string[] }) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const results = await Promise.all(paths.map(async (p) => {
        const { data } = await supabase.storage.from('order-attachments').createSignedUrl(p, 3600);
        return data?.signedUrl || null;
      }));
      if (!cancelled) setUrls(results.filter(Boolean) as string[]);
    };
    load();
    return () => { cancelled = true; };
  }, [paths]);
  if (urls.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {urls.map((url, i) => (
        <img key={i} src={url} alt={`مرفق ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border/60 cursor-pointer" onClick={() => window.open(url, '_blank')} />
      ))}
    </div>
  );
};

const ITEM_STEPS = [
  { status: 'submitted', label: 'تم الإرسال', icon: FileText },
  { status: 'assigned', label: 'تم تعيين مصمم', icon: Palette },
  { status: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock },
  { status: 'approved', label: 'تمت الموافقة', icon: CheckCircle },
  { status: 'print_ready', label: 'جاهز للطباعة', icon: Printer },
  { status: 'delivered', label: 'تم التسليم', icon: Truck },
];

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<DesignVersion[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const [submittingItem, setSubmittingItem] = useState<string | null>(null);
  const [showRevisionItem, setShowRevisionItem] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [revisionImages, setRevisionImages] = useState<Record<string, File[]>>({});
  const [revisionImagePreviews, setRevisionImagePreviews] = useState<Record<string, string[]>>({});
  const revisionImgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadOrder = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*, templates(name)').eq('id', orderId || '').maybeSingle();
    setOrder(data);
    setLoading(false);
  }, [orderId]);

  const loadItems = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase.from('order_items').select('*, templates(name, service_type)').eq('order_id', orderId).order('created_at', { ascending: true });
    const items = (data as unknown as OrderItem[]) || [];
    setOrderItems(items);
    if (items.length > 0 && !expandedItem) setExpandedItem(items[0].id);
  }, [orderId]);

  const loadDesigns = useCallback(async () => {
    const { data } = await supabase.from('designs').select('*').eq('order_id', orderId || '').order('version', { ascending: false });
    const d = (data as DesignVersion[]) || [];
    setDesigns(d);
    // Auto-expand latest design inline for each item
    const itemIds = [...new Set(d.map(x => x.order_item_id).filter(Boolean))];
    for (const itemId of itemIds) {
      const latest = d.find(x => x.order_item_id === itemId && x.file_url);
      if (latest?.file_url) {
        const url = await getDesignSignedUrl(latest.file_url);
        if (url) setPreviewUrls(prev => ({ ...prev, [itemId!]: url, [`${itemId}_selected`]: latest.id, [`${itemId}_inline`]: url }));
      }
    }
  }, [orderId]);

  useEffect(() => { loadOrder(); loadItems(); loadDesigns(); }, [loadOrder, loadItems, loadDesigns]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(`tracking-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'designs', filter: `order_id=eq.${orderId}` }, () => { playNotificationSound(); toast({ title: '🎨 المصمم رفع تصميم جديد!' }); loadDesigns(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => { loadOrder(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => { playNotificationSound(); toast({ title: '🔔 تحديث على طلبك' }); loadItems(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, loadOrder, loadItems, loadDesigns]);

  const getItemDesigns = (itemId: string) => designs.filter(d => d.order_item_id === itemId);

  const handleApproveItem = async (itemId: string) => {
    if (!orderId) return;
    const itemDesigns = getItemDesigns(itemId);
    if (itemDesigns.length > 0) {
      await supabase.from('designs').update({ approved: true }).eq('id', itemDesigns[0].id);
    }
    await supabase.from('order_items').update({ status: 'approved' as any, details: { ...(orderItems.find(i => i.id === itemId)?.details || {}), approved_at: new Date().toISOString() } as any }).eq('id', itemId);

    // Check if all items approved
    const updated = orderItems.map(i => i.id === itemId ? { ...i, status: 'approved' as OrderStatus } : i);
    const allApproved = updated.every(i => ['approved', 'print_ready', 'printed', 'delivered'].includes(i.status));
    if (allApproved) {
      // Navigate to delivery address for the whole order
      navigate(`/delivery-address/${orderId}`);
      return;
    }

    toast({ title: 'تمت الموافقة على هذا العنصر ✅' });
    loadItems();
    loadDesigns();
  };

  const handleRevisionImageSelect = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = Array.from(e.target.files || []);
    const current = revisionImages[itemId] || [];
    const combined = [...current, ...files].slice(0, 3);
    setRevisionImages(prev => ({ ...prev, [itemId]: combined }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: combined.map(f => URL.createObjectURL(f)) }));
    e.target.value = '';
  };

  const removeRevisionImage = (itemId: string, index: number) => {
    const updated = (revisionImages[itemId] || []).filter((_, i) => i !== index);
    setRevisionImages(prev => ({ ...prev, [itemId]: updated }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: updated.map(f => URL.createObjectURL(f)) }));
  };

  const handleRequestRevision = async (itemId: string) => {
    const note = revisionNotes[itemId]?.trim();
    if (!orderId || !note) return;
    setSubmittingItem(itemId);

    const uploadedUrls: string[] = [];
    for (const img of (revisionImages[itemId] || [])) {
      const ext = img.name.split('.').pop();
      const path = `${orderId}/${itemId}/revision-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('order-attachments').upload(path, img, { upsert: false });
      if (!error) uploadedUrls.push(path);
    }

    const item = orderItems.find(i => i.id === itemId);
    const currentDetails = item?.details || {};
    const revisions = currentDetails.revisions || [];
    const itemDesigns = getItemDesigns(itemId);
    revisions.push({ note, date: new Date().toISOString(), version: itemDesigns[0]?.version || 0, images: uploadedUrls });

    await supabase.from('order_items').update({
      status: 'assigned' as any,
      details: { ...currentDetails, revisions } as any,
    }).eq('id', itemId);

    toast({ title: 'تم إرسال طلب التعديل للمصمم' });
    setRevisionNotes(prev => ({ ...prev, [itemId]: '' }));
    setRevisionImages(prev => ({ ...prev, [itemId]: [] }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: [] }));
    setShowRevisionItem(null);
    loadItems();
    setSubmittingItem(null);
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelled' as any, designer_id: null }).eq('id', orderId);
    if (error) toast({ title: 'حدث خطأ', variant: 'destructive' });
    else { toast({ title: 'تم إلغاء الطلب' }); navigate('/my-orders'); }
  };

  if (loading) return <div className="py-24 text-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;
  if (!order) return <div className="py-24 text-center"><p className="text-muted-foreground text-sm">لم يتم العثور على الطلب</p></div>;

  const hasItems = orderItems.length > 0;

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">تتبع الطلب</h1>
              <p className="text-muted-foreground text-sm mt-1">
                رقم الطلب: {order.id?.slice(0, 8)}...
                {hasItems && <span className="mr-2">• {orderItems.length} عناصر</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status as OrderStatus} />
              {(['submitted', 'assigned', 'design_uploaded', 'waiting_approval'] as string[]).includes(order.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5">
                      <XCircle className="w-4 h-4" />إلغاء الطلب
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد إلغاء الطلب</AlertDialogTitle>
                      <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>تراجع</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">نعم، إلغاء</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Items */}
          {hasItems ? (
            <div className="space-y-4">
              {orderItems.map((item, idx) => {
                const isExpanded = expandedItem === item.id;
                const itemDesigns = getItemDesigns(item.id);
                const itemDetails = item.details || {};
                const revisions: any[] = itemDetails.revisions || [];
                const designerMessages: any[] = itemDetails.designer_messages || [];
                const previewUrl = previewUrls[item.id];
                const currentStepIndex = ITEM_STEPS.findIndex(s => s.status === item.status);
                const showDesignReview = ['waiting_approval', 'design_uploaded'].includes(item.status) || itemDesigns.length > 0;
                const curRevisionImages = revisionImagePreviews[item.id] || [];

                return (
                  <div key={item.id} className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
                    {/* Item Header */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors text-right"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-sm">{idx + 1}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm">{item.templates?.name || 'عنصر'}</h3>
                          <p className="text-xs text-muted-foreground">{SERVICE_LABELS[item.templates?.service_type as ServiceType] || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={item.status} />
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded */}
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-border">
                        {/* Progress Steps */}
                        <div className="p-5 border-b border-border/60">
                          <h4 className="font-bold text-foreground text-sm mb-4">مراحل العنصر</h4>
                          <div className="space-y-2">
                            {ITEM_STEPS.map((step, i) => {
                              const isComplete = i <= currentStepIndex;
                              const isCurrent = i === currentStepIndex;
                              return (
                                <div key={step.status} className="flex items-center gap-3">
                                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                                    isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                                    isCurrent && 'ring-2 ring-success/30 ring-offset-1 ring-offset-background'
                                  )}>
                                    <step.icon className="w-3.5 h-3.5" />
                                  </div>
                                  <p className={cn('font-medium text-sm flex-1', isComplete ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
                                  {isComplete && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Design Review */}
                        {showDesignReview && (
                          <div className="p-5">
                            <h4 className="font-bold text-foreground text-sm mb-4">التصميم</h4>

                            {itemDesigns.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {itemDesigns.map((design, i) => {
                                  const isSelected = previewUrls[`${item.id}_selected`] === design.id;
                                  return (
                                    <div key={design.id}>
                                      <div
                                        onClick={async () => {
                                          if (!design.file_url) return;
                                          if (isSelected) {
                                            setPreviewUrls(prev => { const n = { ...prev }; delete n[`${item.id}_selected`]; delete n[`${item.id}_inline`]; return n; });
                                          } else {
                                            const url = await getDesignSignedUrl(design.file_url);
                                            if (url) setPreviewUrls(prev => ({ ...prev, [`${item.id}_selected`]: design.id, [`${item.id}_inline`]: url }));
                                          }
                                        }}
                                        className={cn(
                                          'rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer transition-all',
                                          isSelected ? 'bg-primary/10 border-2 border-primary/30' : i === 0 ? 'bg-primary/5 border border-primary/10 hover:bg-primary/8' : 'bg-muted/40 border border-border/50 hover:bg-muted/60'
                                        )}
                                      >
                                        <div className="flex items-center gap-3">
                                          <FileText className={cn('w-4 h-4', isSelected || i === 0 ? 'text-primary' : 'text-muted-foreground')} />
                                          <div>
                                            <p className="font-medium text-foreground text-sm">الإصدار {design.version} {i === 0 && <span className="text-primary text-[11px] mr-1">(الأحدث)</span>}</p>
                                            <p className="text-muted-foreground text-[11px]">{new Date(design.uploaded_at).toLocaleDateString('ar')}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          {design.approved && <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-lg flex items-center gap-1"><CheckCircle className="w-3 h-3" />معتمد</span>}
                                          {isSelected ? <ChevronUp className="w-4 h-4 text-primary" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                                        </div>
                                      </div>
                                      {/* Inline image preview */}
                                      {isSelected && previewUrls[`${item.id}_inline`] && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                                          <img src={previewUrls[`${item.id}_inline`]} alt={`الإصدار ${design.version}`} className="w-full object-contain" />
                                        </motion.div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Designer messages */}
                            {designerMessages.length > 0 && (
                              <div className="mb-4 space-y-2">
                                {designerMessages.slice().reverse().map((msg: any, i: number) => (
                                  <div key={i} className={cn('rounded-xl p-3', i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40 border border-border/50')}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-[11px] text-muted-foreground">رسالة المصمم — {new Date(msg.date).toLocaleDateString('ar')}</span>
                                    </div>
                                    <p className="text-foreground text-sm">{msg.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Approve / Revision */}
                            {item.status === 'waiting_approval' && (
                              <div className="space-y-3">
                                <Button onClick={() => handleApproveItem(item.id)} disabled={submittingItem === item.id} size="lg" className="w-full bg-success hover:bg-success/90 text-success-foreground h-11">
                                  <CheckCircle className="w-5 h-5 ml-2" />الموافقة على التصميم ✅
                                </Button>

                                {showRevisionItem !== item.id ? (
                                  <Button onClick={() => setShowRevisionItem(item.id)} variant="outline" size="lg" className="w-full h-11 border-destructive/20 text-destructive hover:bg-destructive/5">
                                    <MessageSquare className="w-5 h-5 ml-2" />طلب تعديل
                                  </Button>
                                ) : (
                                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                                    <Textarea value={revisionNotes[item.id] || ''} onChange={e => setRevisionNotes(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="اكتب ملاحظاتك للمصمم..." className="min-h-[80px]" dir="rtl" />
                                    <div>
                                      <input ref={el => { revisionImgRefs.current[item.id] = el; }} type="file" accept="image/*" multiple className="hidden" onChange={e => handleRevisionImageSelect(e, item.id)} />
                                      {curRevisionImages.length > 0 && (
                                        <div className="flex gap-2 flex-wrap mb-2">
                                          {curRevisionImages.map((src, idx) => (
                                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/60">
                                              <img src={src} alt="" className="w-full h-full object-cover" />
                                              <button onClick={() => removeRevisionImage(item.id, idx)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"><X className="w-3 h-3 text-white" /></button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {(revisionImages[item.id] || []).length < 3 && (
                                        <button type="button" onClick={() => revisionImgRefs.current[item.id]?.click()} className="w-full border border-dashed border-border/50 hover:border-primary/40 rounded-xl p-2.5 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-sm">
                                          <ImagePlus className="w-4 h-4" />إضافة صور (اختياري)
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button onClick={() => handleRequestRevision(item.id)} disabled={submittingItem === item.id || !(revisionNotes[item.id]?.trim())} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                        {submittingItem === item.id ? 'جاري الإرسال...' : 'إرسال التعديل'}
                                      </Button>
                                      <Button onClick={() => { setShowRevisionItem(null); setRevisionNotes(prev => ({ ...prev, [item.id]: '' })); }} variant="outline">إلغاء</Button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            )}

                            {item.status === 'approved' && (
                              <div className="bg-success/8 rounded-xl p-4 text-center border border-success/20">
                                <CheckCircle className="w-5 h-5 text-success mx-auto mb-2" />
                                <p className="font-medium text-foreground text-sm">تمت الموافقة! سيتم تحضيره للطباعة</p>
                              </div>
                            )}

                            {/* Revision History */}
                            {revisions.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-border">
                                <h4 className="font-bold text-foreground text-sm mb-3">سجل التعديلات</h4>
                                <div className="space-y-2">
                                  {revisions.map((rev: any, i: number) => (
                                    <div key={i} className="bg-muted/40 rounded-xl p-3 border border-border/50">
                                      <p className="text-[11px] text-muted-foreground mb-1">الإصدار {rev.version} — {new Date(rev.date).toLocaleDateString('ar')}</p>
                                      <p className="text-foreground text-sm">{rev.note}</p>
                                      {rev.images?.length > 0 && <RevisionImages paths={rev.images} />}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Waiting state if no designs yet */}
                        {!showDesignReview && !['approved', 'print_ready', 'printed', 'delivered', 'cancelled'].includes(item.status) && (
                          <div className="p-5 text-center">
                            <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">المصمم يعمل على هذا العنصر...</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-6 border border-border/60 text-center">
              <p className="text-muted-foreground">لا توجد عناصر في هذا الطلب</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OrderTracking;
