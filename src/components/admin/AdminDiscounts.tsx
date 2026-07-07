import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiscounts, useCoupons, Discount, Coupon } from '@/hooks/useDiscounts';
import { useServices } from '@/hooks/useServices';
import type { ServiceRow } from '@/types/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Percent, Ticket, Copy, Tag } from 'lucide-react';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  global: 'خصم عام',
  parent_service: 'قسم عام',
  sub_service: 'قسم فرعي',
};

const AdminDiscounts = () => {
  const { discounts, loading: dLoading, reload: reloadDiscounts } = useDiscounts();
  const { coupons, loading: cLoading, reload: reloadCoupons } = useCoupons();
  const { services } = useServices();

  // Discount dialog
  const [discountDialog, setDiscountDialog] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: 'global', target_id: '', percentage: 10 });

  // Coupon dialog
  const [couponDialog, setCouponDialog] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: generateCode(), percentage: 10, max_uses: '' });
  // Creating a coupon mass-notifies every customer — confirm with the real count first.
  const [couponConfirm, setCouponConfirm] = useState<{ open: boolean; count: number }>({ open: false, count: 0 });
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  const parentServices = services.filter(s => !(s as ServiceRow).parent_id);
  const subServices = services.filter(s => (s as ServiceRow).parent_id);

  const handleCreateDiscount = async () => {
    if (discountForm.percentage < 1 || discountForm.percentage > 100) { toast.error('النسبة يجب أن تكون بين 1 و 100'); return; }
    if (discountForm.type !== 'global' && !discountForm.target_id) { toast.error('اختر القسم'); return; }

    const { error } = await supabase.from('discounts').insert({
      discount_type: discountForm.type,
      target_id: discountForm.type === 'global' ? null : discountForm.target_id,
      percentage: discountForm.percentage,
    });
    if (error) { toast.error('فشل إنشاء الخصم', { description: error.message || error.code }); return; }
    toast.success('تم إنشاء الخصم');
    setDiscountDialog(false);
    setDiscountForm({ type: 'global', target_id: '', percentage: 10 });
    reloadDiscounts();
  };

  const handleToggleDiscount = async (id: string, active: boolean) => {
    const { error } = await supabase.from('discounts').update({ is_active: !active }).eq('id', id);
    if (error) { toast.error('فشل تحديث الخصم', { description: error.message || error.code }); return; }
    reloadDiscounts();
  };

  const handleDeleteDiscount = async (id: string) => {
    const { error } = await supabase.from('discounts').delete().eq('id', id);
    if (error) { toast.error('فشل حذف الخصم', { description: error.message || error.code }); return; }
    toast.success('تم حذف الخصم');
    reloadDiscounts();
  };

  // Step 1: validate the form, fetch the real customer count, then ask for confirmation
  // (creating a coupon broadcasts a notification to every customer).
  const handleRequestCreateCoupon = async () => {
    if (!couponForm.code.trim()) { toast.error('الكود مطلوب'); return; }
    if (couponForm.percentage < 1 || couponForm.percentage > 100) { toast.error('النسبة يجب أن تكون بين 1 و 100'); return; }
    const { count, error } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer');
    if (error) { toast.error('فشل جلب عدد الزبائن', { description: error.message || error.code }); return; }
    setCouponConfirm({ open: true, count: count ?? 0 });
  };

  // Step 2: actually create the coupon and notify all customers (after confirmation).
  const handleCreateCoupon = async () => {
    setCreatingCoupon(true);
    try {
      const { error } = await supabase.from('coupons').insert({
        code: couponForm.code.trim().toUpperCase(),
        percentage: couponForm.percentage,
        max_uses: couponForm.max_uses ? parseInt(couponForm.max_uses) : null,
      }).select('id').single();
      if (error) {
        if (error.code === '23505') toast.error('هذا الكود مستخدم مسبقاً');
        else toast.error('فشل إنشاء الكوبون', { description: error.message || error.code });
        return;
      }

      // Send notification to all customers
      const code = couponForm.code.trim().toUpperCase();
      const pct = couponForm.percentage;
      const { data: customerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'customer');
      if (customerRoles && customerRoles.length > 0) {
        const notifs = customerRoles.map((r) => ({
          user_id: r.user_id,
          title: `🎉 كوبون خصم ${pct}%`,
          message: `استخدم الكود ${code} للحصول على خصم ${pct}% على طلبك القادم!`,
          link: '/my-coupons',
        }));
        const { error: notifError } = await supabase.from('notifications').insert(notifs);
        if (notifError) {
          toast.error('تم إنشاء الكوبون لكن فشل إرسال الإشعارات', { description: notifError.message || notifError.code });
        } else {
          toast.success(`تم إنشاء الكوبون وإرسال إشعار إلى ${customerRoles.length} زبون`);
        }
      } else {
        toast.success('تم إنشاء الكوبون');
      }
      setCouponDialog(false);
      setCouponForm({ code: generateCode(), percentage: 10, max_uses: '' });
      reloadCoupons();
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    const { error } = await supabase.from('coupons').update({ is_active: !active }).eq('id', id);
    if (error) { toast.error('فشل تحديث الكوبون', { description: error.message || error.code }); return; }
    reloadCoupons();
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    const { error } = await supabase.from('coupons').delete().eq('id', coupon.id);
    if (error) { toast.error('فشل حذف الكوبون', { description: error.message || error.code }); return; }
    // Also remove the announcement notifications broadcast for this coupon so they
    // don't orphan (matched by code inside coupon-titled notifications). Needs the
    // admin DELETE policy from migration 20260705110000_admin_delete_coupon_notifications.
    const codePattern = coupon.code.replace(/[\\%_]/g, '\\$&');
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .like('title', '%كوبون%')
      .like('message', `%${codePattern}%`);
    if (notifError) {
      toast.error('تم حذف الكوبون لكن فشل حذف إشعاراته', { description: notifError.message || notifError.code });
    } else {
      toast.success('تم حذف الكوبون وإشعاراته');
    }
    reloadCoupons();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  const getTargetLabel = (d: Discount) => {
    if (d.discount_type === 'global') return 'جميع الخدمات';
    const svc = services.find(s => s.id === d.target_id);
    return svc?.label || d.target_id || '-';
  };

  return (
    <div className="space-y-8">
      {/* ── Discounts Section ── */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Percent className="w-5 h-5 text-primary" />
            الخصومات على الأقسام
          </CardTitle>
          <Button onClick={() => setDiscountDialog(true)} size="sm" className="gap-1.5 rounded-xl w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            خصم جديد
          </Button>
        </CardHeader>
        <CardContent>
          {dLoading ? (
            <p className="text-muted-foreground text-sm text-center py-6">جاري التحميل...</p>
          ) : discounts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">لا توجد خصومات حالياً</p>
          ) : (
            <div className="space-y-3">
              {discounts.map(d => (
                <div key={d.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border transition-all ${d.is_active ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border/50 opacity-60'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-black text-lg">{d.percentage}%</span>
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{getTargetLabel(d)}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{DISCOUNT_TYPE_LABELS[d.discount_type]}</Badge>
                        {d.ends_at && (
                          <span className="text-[10px] text-muted-foreground">
                            ينتهي: {new Date(d.ends_at).toLocaleDateString('ar')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_active} onCheckedChange={() => handleToggleDiscount(d.id, d.is_active)} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الخصم؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف هذا الخصم نهائياً</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDiscount(d.id)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Coupons Section ── */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ticket className="w-5 h-5 text-primary" />
            كوبونات الخصم
          </CardTitle>
          <Button onClick={() => { setCouponForm({ code: generateCode(), percentage: 10, max_uses: '' }); setCouponDialog(true); }} size="sm" className="gap-1.5 rounded-xl w-full sm:w-auto">
            <Plus className="w-4 h-4" />
            كوبون جديد
          </Button>
        </CardHeader>
        <CardContent>
          {cLoading ? (
            <p className="text-muted-foreground text-sm text-center py-6">جاري التحميل...</p>
          ) : coupons.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">لا توجد كوبونات حالياً</p>
          ) : (
            <div className="space-y-3">
              {coupons.map(c => (
                <div key={c.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border transition-all ${c.is_active ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50 opacity-60'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border-2 border-dashed border-primary/40 hover:border-primary transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <span className="font-mono font-black text-primary tracking-widest text-sm">{c.code}</span>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <div>
                      <p className="font-bold text-foreground text-sm">خصم {c.percentage}%</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {/* dir=ltr: a bare "N / M" run gets bidi-reordered inside RTL text */}
                          مستخدم: <span dir="ltr">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</span>
                        </span>
                        {c.expires_at && (
                          <span className="text-[10px] text-muted-foreground">
                            ينتهي: {new Date(c.expires_at).toLocaleDateString('ar')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.is_active} onCheckedChange={() => handleToggleCoupon(c.id, c.is_active)} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف الكوبون؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف هذا الكوبون نهائياً مع الإشعارات التي أُرسلت للزبائن عنه</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCoupon(c)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Discount Dialog ── */}
      <Dialog open={discountDialog} onOpenChange={setDiscountDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              إضافة خصم جديد
            </DialogTitle>
            <DialogDescription>
              حدد نوع الخصم ونسبته ليُطبق تلقائياً على أسعار القسم المختار.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">نوع الخصم</label>
              <Select value={discountForm.type} onValueChange={v => setDiscountForm(f => ({ ...f, type: v, target_id: '' }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">خصم عام (جميع الخدمات)</SelectItem>
                  <SelectItem value="parent_service">قسم عام</SelectItem>
                  <SelectItem value="sub_service">قسم فرعي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {discountForm.type === 'parent_service' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">القسم العام</label>
                <Select value={discountForm.target_id} onValueChange={v => setDiscountForm(f => ({ ...f, target_id: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {parentServices.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {discountForm.type === 'sub_service' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">القسم الفرعي</label>
                <Select value={discountForm.target_id} onValueChange={v => setDiscountForm(f => ({ ...f, target_id: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                  <SelectContent>
                    {subServices.map(s => {
                      const parent = parentServices.find(p => p.id === (s as ServiceRow).parent_id);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label} {parent ? `(${parent.label})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">نسبة الخصم %</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={discountForm.percentage}
                onChange={e => setDiscountForm(f => ({ ...f, percentage: parseInt(e.target.value) || 0 }))}
                className="rounded-xl"
                dir="ltr"
              />
            </div>

            <Button onClick={handleCreateDiscount} className="w-full rounded-xl h-11 font-bold">
              إنشاء الخصم
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Coupon Dialog ── */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              إنشاء كوبون خصم
            </DialogTitle>
            <DialogDescription>
              أنشئ كود خصم يستخدمه الزبائن عند إتمام الطلب، وسيصلهم إشعار به.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">كود الخصم</label>
              <div className="flex gap-2">
                <Input
                  value={couponForm.code}
                  onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="rounded-xl font-mono tracking-widest"
                  dir="ltr"
                  placeholder="SAVE20"
                />
                <Button variant="outline" size="icon" onClick={() => setCouponForm(f => ({ ...f, code: generateCode() }))} className="rounded-xl shrink-0" title="توليد كود عشوائي">
                  🎲
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">كل كوبون له كود فريد مختلف</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">نسبة الخصم %</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={couponForm.percentage}
                onChange={e => setCouponForm(f => ({ ...f, percentage: parseInt(e.target.value) || 0 }))}
                className="rounded-xl"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">الحد الأقصى للاستخدام (اختياري)</label>
              <Input
                type="number"
                min={1}
                value={couponForm.max_uses}
                onChange={e => setCouponForm(f => ({ ...f, max_uses: e.target.value }))}
                className="rounded-xl"
                dir="ltr"
                placeholder="بدون حد"
              />
            </div>

            <Button onClick={handleRequestCreateCoupon} className="w-full rounded-xl h-11 font-bold">
              إنشاء الكوبون
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Coupon Broadcast Dialog ── */}
      <AlertDialog open={couponConfirm.open} onOpenChange={(open) => setCouponConfirm(c => ({ ...c, open }))}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إنشاء الكوبون</AlertDialogTitle>
            <AlertDialogDescription className="space-y-1.5">
              <span className="block">
                سيتم إنشاء الكوبون <span dir="ltr" className="font-mono font-bold text-primary tracking-widest">{couponForm.code.trim().toUpperCase()}</span> بنسبة خصم <strong>{couponForm.percentage}%</strong>.
              </span>
              <span className="block font-semibold text-foreground">
                سيتم إرسال إشعار إلى {couponConfirm.count} زبون.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-2">
            <AlertDialogCancel disabled={creatingCoupon}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              disabled={creatingCoupon}
              onClick={() => { setCouponConfirm(c => ({ ...c, open: false })); handleCreateCoupon(); }}
            >
              {creatingCoupon ? 'جاري الإنشاء...' : 'نعم، إنشاء وإرسال'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDiscounts;
